import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { contentFingerprint, type FieldValue, type Item } from '../items'
import type { RequirementsRepo } from '../repository-store'
import { documentOfPath, type ItemIssue } from '../../shared/domain'
import { T } from '../../shared/text'
import type { IndexCache, IndexedItem, ItemQuery, LinkRef, QueryResult, SyncStats } from './index'

/** Bump when the table layout changes; an old cache file is then rebuilt automatically. */
const FORMAT_VERSION = '5'

/** A text used inside LIKE: its wildcards and the escape character itself stand for themselves (QA-WP-02). */
/** White space as JavaScript's trim() sees it (the common kinds): the filter and the editor agree on "empty" (CR-20). */
const BLANKS = "' ' || char(9) || char(10) || char(11) || char(12) || char(13) || char(160) || char(8239) || char(12288) || char(65279)"

/** The document of an item row: the first folder of its path ('' = a loose file). */

const likeEscape = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`)

const DDL = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS files (path TEXT PRIMARY KEY, mtime REAL NOT NULL, size INTEGER NOT NULL, ok INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS items (
  rid INTEGER PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  parent TEXT,
  ord TEXT,
  text TEXT NOT NULL,
  fields_json TEXT NOT NULL,
  links_json TEXT NOT NULL,
  fp TEXT NOT NULL,
  doc TEXT NOT NULL DEFAULT '',
  top INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS items_id ON items(id);
CREATE INDEX IF NOT EXISTS items_type ON items(type);
CREATE INDEX IF NOT EXISTS items_parent ON items(parent, ord);
CREATE INDEX IF NOT EXISTS items_doc_top ON items(doc, top, ord);
CREATE INDEX IF NOT EXISTS items_top ON items(top, ord);
CREATE TABLE IF NOT EXISTS item_fields (rid INTEGER NOT NULL, field TEXT NOT NULL, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS item_fields_lookup ON item_fields(field, value, rid);
CREATE INDEX IF NOT EXISTS item_fields_rid ON item_fields(rid);
CREATE TABLE IF NOT EXISTS links (rid INTEGER NOT NULL, source TEXT NOT NULL, type TEXT NOT NULL, target TEXT NOT NULL, confirmed TEXT);
CREATE INDEX IF NOT EXISTS links_target ON links(target);
CREATE INDEX IF NOT EXISTS links_rid ON links(rid);
CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(id, title, text, tokenize = 'unicode61 remove_diacritics 2');
`

interface ItemRow {
  rid: number
  path: string
  id: string
  type: string
  title: string
  parent: string | null
  ord: string | null
  text: string
  fields_json: string
  links_json: string
  fp: string
  child_count: number
  incoming_count: number
  suspect_count: number
}

/** Outgoing links whose target changed since the link was confirmed. */
const SUSPECT_SQL = 'SELECT 1 FROM links l JOIN items t ON t.id = l.target WHERE l.rid = i.rid AND l.confirmed IS NOT NULL AND l.confirmed <> t.fp'
const COUNTS = `(SELECT COUNT(*) FROM items c WHERE c.parent = i.id) AS child_count,
  (SELECT COUNT(*) FROM links l WHERE l.target = i.id) AS incoming_count,
  (SELECT COUNT(*) FROM links l JOIN items t ON t.id = l.target WHERE l.rid = i.rid AND l.confirmed IS NOT NULL AND l.confirmed <> t.fp) AS suspect_count`

/** Plain-text start of an item's text for table cells: Markdown markers removed, at most 200 characters. */
export function preview(text: string): string {
  return text
    .slice(0, 600)
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/^\s{0,3}(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\|)\s*/gm, '') // list marker only with a space: "**bold**" keeps both stars
    // markers only: underscores inside words (SIG_BRAKE_REQ) and lone stars (2 * 3) stay — QA-01 of 0.15
    .replace(/(\*\*|\*|`|~~)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/(^|[^\p{L}\p{N}_])(__|_)(?=\S)([\s\S]*?\S)\2(?![\p{L}\p{N}_])/gu, '$1$3')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

/** Only the values of fields the current schema defines (the index keeps every header key; see P-05). */
function schemaFields(json: string, fieldIds: ReadonlySet<string>): Record<string, FieldValue> {
  const all = JSON.parse(json) as Record<string, FieldValue>
  const out: Record<string, FieldValue> = {}
  for (const k of Object.keys(all)) if (fieldIds.has(k)) out[k] = all[k] as FieldValue
  return out
}

function rowToItem(r: ItemRow, fieldIds: ReadonlySet<string>): IndexedItem {
  const item: IndexedItem = {
    id: r.id,
    type: r.type,
    title: r.title,
    fields: schemaFields(r.fields_json, fieldIds),
    links: JSON.parse(r.links_json) as IndexedItem['links'],
    text: r.text,
    path: r.path,
    document: documentOfPath(r.path),
    childCount: r.child_count,
    incomingCount: r.incoming_count,
    suspectCount: r.suspect_count
  }
  if (r.parent !== null) item.parent = r.parent
  if (r.ord !== null) item.order = r.ord
  return item
}

/** Turns what a user types into a safe FTS5 query: every word must appear, as a prefix. */
export function toFtsQuery(text: string): string | null {
  // a "word" made only of underscores is not one the full-text index knows: it is searched as a sign (QA-WP-02)
  const words = text.match(/[\p{L}\p{N}_]+/gu)?.filter((w) => /[\p{L}\p{N}]/u.test(w))
  if (!words || words.length === 0) return null
  return words.map((w) => `"${w}"*`).join(' AND ')
}

async function mapLimit<T, R>(inputs: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(inputs.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, inputs.length) }, async () => {
      while (next < inputs.length) {
        const i = next++
        out[i] = await fn(inputs[i] as T)
      }
    })
  )
  return out
}

/**
 * Creates the tables, or re-creates them when the cache file was written by a version with a different table
 * layout (`CREATE TABLE IF NOT EXISTS` alone would keep the old columns). The cache holds nothing that is not
 * in the item files, so dropping it is always safe; the next sync re-reads everything.
 */
function prepareTables(db: DatabaseSync): void {
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name)
  let format: string | undefined
  if (tables.includes('meta')) {
    format = (db.prepare("SELECT value FROM meta WHERE key = 'format'").get() as { value: string } | undefined)?.value
  }
  if (tables.length > 0 && format !== FORMAT_VERSION) {
    for (const t of ['items_fts', 'items', 'item_fields', 'links', 'files', 'meta']) db.exec(`DROP TABLE IF EXISTS ${t}`)
  }
  db.exec(DDL)
  db.prepare("INSERT INTO meta(key, value) VALUES('format', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(FORMAT_VERSION)
}

export function createSqliteIndexCache(dbFile: string): IndexCache {
  if (dbFile !== ':memory:') mkdirSync(dirname(dbFile), { recursive: true })
  const db = new DatabaseSync(dbFile)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA temp_store = MEMORY;')
  prepareTables(db)
  /** Field IDs of the schema last synced with; query results show only these. */
  let fieldIds: ReadonlySet<string> = new Set()
  const useSchema = (repo: RequirementsRepo): void => {
    fieldIds = new Set(repo.schema.fields.map((f) => f.id))
  }

  const stmt = {
    getMeta: db.prepare('SELECT value FROM meta WHERE key = ?'),
    setMeta: db.prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
    allFiles: db.prepare('SELECT path, mtime, size FROM files'),
    upsertFile: db.prepare('INSERT INTO files(path, mtime, size, ok) VALUES(?, ?, ?, ?) ON CONFLICT(path) DO UPDATE SET mtime = excluded.mtime, size = excluded.size, ok = excluded.ok'),
    deleteFile: db.prepare('DELETE FROM files WHERE path = ?'),
    ridByPath: db.prepare('SELECT rid, id FROM items WHERE path = ?'),
    insertItem: db.prepare(
      'INSERT INTO items(path, id, type, title, parent, ord, text, fields_json, links_json, fp, doc) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ),
    // "top level" of its document: no parent, or the parent is in another document or missing (0.18.0). Stored, so
    // the tree's first level is an index lookup; recomputed for the changed items and their children only
    setTopAll: db.prepare(`UPDATE items SET top = (parent IS NULL OR NOT EXISTS (SELECT 1 FROM items p WHERE p.id = items.parent AND p.doc = items.doc))`),
    setTopFor: db.prepare(
      `UPDATE items SET top = (parent IS NULL OR NOT EXISTS (SELECT 1 FROM items p WHERE p.id = items.parent AND p.doc = items.doc))
       WHERE id IN (SELECT value FROM json_each(?1)) OR parent IN (SELECT value FROM json_each(?1))`
    ),
    deleteItem: db.prepare('DELETE FROM items WHERE rid = ?'),
    insertField: db.prepare('INSERT INTO item_fields(rid, field, value) VALUES(?, ?, ?)'),
    deleteFields: db.prepare('DELETE FROM item_fields WHERE rid = ?'),
    insertLink: db.prepare('INSERT INTO links(rid, source, type, target, confirmed) VALUES(?, ?, ?, ?, ?)'),
    deleteLinks: db.prepare('DELETE FROM links WHERE rid = ?'),
    insertFts: db.prepare('INSERT INTO items_fts(rowid, id, title, text) VALUES(?, ?, ?, ?)'),
    deleteFts: db.prepare('DELETE FROM items_fts WHERE rowid = ?'),
    getById: db.prepare(`SELECT i.*, ${COUNTS} FROM items i WHERE i.id = ? ORDER BY i.path LIMIT 1`),
    incoming: db.prepare(
      `SELECT l.source AS id, l.type, (l.confirmed IS NOT NULL AND l.confirmed <> t.fp) AS suspect
       FROM links l LEFT JOIN items t ON t.id = l.target WHERE l.target = ? ORDER BY l.type, l.source`
    ),
    fingerprint: db.prepare('SELECT fp FROM items WHERE id = ? LIMIT 1'),
    count: db.prepare('SELECT COUNT(*) AS n FROM items')
  }

  /** Goes up by one with every change to the index, so callers can cache things computed from it. */
  let revision = 0
  const transaction = (fn: () => void): void => {
    revision++
    db.exec('BEGIN')
    try {
      fn()
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  }

  /** IDs whose top-level flag (theirs and their children's) must be recomputed before the transaction ends. */
  const touched = new Set<string>()
  const removePath = (path: string): void => {
    const row = stmt.ridByPath.get(path) as { rid: number; id: string } | undefined
    if (row) {
      touched.add(row.id)
      stmt.deleteFields.run(row.rid)
      stmt.deleteLinks.run(row.rid)
      stmt.deleteFts.run(row.rid)
      stmt.deleteItem.run(row.rid)
    }
  }

  const insertItem = (path: string, item: Item): void => {
    const res = stmt.insertItem.run(
      path,
      item.id,
      item.type,
      item.title,
      item.parent ?? null,
      item.order ?? null,
      item.text,
      JSON.stringify(item.fields),
      JSON.stringify(item.links),
      contentFingerprint(item),
      path.includes('/') ? path.slice(0, path.indexOf('/')) : ''
    )
    touched.add(item.id)
    const rid = Number(res.lastInsertRowid)
    for (const [field, value] of Object.entries(item.fields)) {
      for (const v of Array.isArray(value) ? value : [value]) stmt.insertField.run(rid, field, String(v))
    }
    for (const l of item.links) stmt.insertLink.run(rid, item.id, l.type, l.target, l.confirmed ?? null)
    stmt.insertFts.run(rid, item.id, item.title, item.text)
  }

  const clearAll = (): void => {
    db.exec('DELETE FROM items; DELETE FROM item_fields; DELETE FROM links; DELETE FROM items_fts; DELETE FROM files;')
  }

  /**
   * The cache must be rebuilt when its format or the repository changes. Schema fields are NOT part of it: every
   * header key is stored, and results are filtered to the current fields, so a field change re-reads nothing.
   */
  const signature = (repo: RequirementsRepo): string => createHash('sha1').update(`${FORMAT_VERSION}|${repo.root}`).digest('hex')

  async function doSync(repo: RequirementsRepo, forceFull: boolean): Promise<SyncStats> {
    const started = performance.now()
    useSchema(repo)
    const sig = signature(repo)
    const full = forceFull || (stmt.getMeta.get('signature') as { value: string } | undefined)?.value !== sig

    const onDisk = await repo.listItemFiles()
    const known = new Map<string, { mtime: number; size: number }>()
    if (!full) for (const r of stmt.allFiles.all() as { path: string; mtime: number; size: number }[]) known.set(r.path, r)

    const changed = onDisk.filter((f) => {
      const k = known.get(f.path)
      return !k || k.mtime !== f.mtimeMs || k.size !== f.size
    })
    const diskPaths = new Set(onDisk.map((f) => f.path))
    const removed = full ? [] : [...known.keys()].filter((p) => !diskPaths.has(p))

    // Read changed files first (async, a few at a time), then apply everything in one transaction.
    const parsed = await mapLimit(changed, 64, async (f) => ({ f, r: await repo.readItemFile(f.path, { allKeysAsFields: true }) }))

    let added = 0
    let updated = 0
    let unreadable = 0
    transaction(() => {
      touched.clear()
      if (full) clearAll()
      for (const p of removed) {
        removePath(p)
        stmt.deleteFile.run(p)
      }
      for (const { f, r } of parsed) {
        const existed = known.has(f.path)
        removePath(f.path)
        if (r.ok) insertItem(f.path, r.item)
        else unreadable++
        stmt.upsertFile.run(f.path, f.mtimeMs, f.size, r.ok ? 1 : 0)
        if (existed) updated++
        else added++
      }
      if (full) stmt.setTopAll.run()
      else if (touched.size > 0) stmt.setTopFor.run(JSON.stringify([...touched]))
      touched.clear()
      stmt.setMeta.run('signature', sig)
    })
    return {
      files: onDisk.length,
      added,
      updated,
      removed: removed.length,
      unreadable,
      full,
      durationMs: Math.round(performance.now() - started)
    }
  }

  return {
    sync: (repo) => doSync(repo, false),

    async syncPaths(repo, paths) {
      useSchema(repo)
      const unique = [...new Set(paths)]
      const results = await mapLimit(unique, 16, async (path) => {
        const s = await stat(join(repo.folder, path)).catch(() => null)
        return { path, s, r: s ? await repo.readItemFile(path, { allKeysAsFields: true }) : null }
      })
      transaction(() => {
        touched.clear()
        for (const { path, s, r } of results) {
          removePath(path)
          if (!s || !r) {
            stmt.deleteFile.run(path)
            continue
          }
          if (r.ok) insertItem(path, r.item)
          stmt.upsertFile.run(path, s.mtimeMs, s.size, r.ok ? 1 : 0)
        }
        if (touched.size > 0) stmt.setTopFor.run(JSON.stringify([...touched]))
        touched.clear()
      })
    },

    repositoryIssues(): ItemIssue[] {
      const issues: ItemIssue[] = []
      for (const r of db.prepare('SELECT id, COUNT(*) AS n FROM items GROUP BY id HAVING n > 1').all() as { id: string; n: number }[]) {
        // usually a file copied by hand: "Give the copy a new ID" (the owner on 0.17.2)
        issues.push({ itemId: r.id, path: 'id', message: T.validate.sameIdFiles(r.n, r.id), severity: 'error', fix: 'copy-id' })
      }
      const broken = db
        .prepare('SELECT l.source, l.type, l.target FROM links l WHERE l.target <> l.source AND NOT EXISTS (SELECT 1 FROM items t WHERE t.id = l.target) ORDER BY l.source')
        .all() as { source: string; type: string; target: string }[]
      for (const r of broken) {
        issues.push({ itemId: r.source, path: 'links', message: `"${r.type}" link to ${r.target}, which does not exist.`, severity: 'error' })
      }
      const orphans = db
        .prepare('SELECT i.id, i.parent FROM items i WHERE i.parent IS NOT NULL AND i.parent <> i.id AND NOT EXISTS (SELECT 1 FROM items p WHERE p.id = i.parent) ORDER BY i.id')
        .all() as { id: string; parent: string }[]
      for (const r of orphans) {
        issues.push({ itemId: r.id, path: 'parent', message: `Parent ${r.parent} does not exist.`, severity: 'error' })
      }
      const misnamed = db
        .prepare("SELECT id, path FROM items WHERE path <> id || '.md' AND substr(path, -length(id) - 4) <> '/' || id || '.md' ORDER BY id")
        .all() as { id: string; path: string }[]
      for (const r of misnamed) {
        issues.push({ itemId: r.id, path: 'file-name', message: `The file ${r.path} holds ${r.id}; it should be named ${r.id}.md.`, severity: 'warning', fix: 'file-name' })
      }
      for (const r of db.prepare('SELECT path FROM files WHERE ok = 0 ORDER BY path').all() as { path: string }[]) {
        issues.push({ itemId: r.path, path: 'file', message: 'This file could not be read.', severity: 'error' })
      }
      return issues
    },
    rebuild: (repo) => doSync(repo, true),

    query(q: ItemQuery): QueryResult {
      const where: string[] = []
      const params: (string | number | null)[] = []

      if (q.text && q.text.trim()) {
        const fts = toFtsQuery(q.text)
        // % and _ are LIKE wildcards: escaped, so a search for "_" finds a "_", not everything (QA-WP-02)
        const idLike = `%${likeEscape(q.text.trim().toUpperCase())}%`
        if (fts) {
          where.push("(i.rid IN (SELECT rowid FROM items_fts WHERE items_fts MATCH ?) OR i.id LIKE ? ESCAPE '\\')")
          params.push(fts, idLike)
        } else {
          // no word to search for (only signs such as "_", "%", "#"): look for the signs themselves
          const anyLike = `%${likeEscape(q.text.trim())}%`
          where.push("(i.id LIKE ? ESCAPE '\\' OR i.title LIKE ? ESCAPE '\\' OR i.text LIKE ? ESCAPE '\\')")
          params.push(idLike, anyLike, anyLike)
        }
      }
      if (q.types && q.types.length > 0) {
        where.push(`i.type IN (${q.types.map(() => '?').join(',')})`)
        params.push(...q.types)
      }
      for (const [field, values] of Object.entries(q.fields ?? {})) {
        if (values.length === 0) continue
        where.push(`i.rid IN (SELECT rid FROM item_fields WHERE field = ? AND value IN (${values.map(() => '?').join(',')}))`)
        params.push(field, ...values)
      }
      if (q.links === 'suspect') where.push(`EXISTS (${SUSPECT_SQL})`)
      else if (q.links === 'none') where.push('NOT EXISTS (SELECT 1 FROM links l WHERE l.rid = i.rid) AND NOT EXISTS (SELECT 1 FROM links l WHERE l.target = i.id)')
      if (q.incomplete) {
        // items missing a required field of their type (S-05); title and text are columns, the rest item_fields
        const ors: string[] = []
        for (const [type, fields] of Object.entries(q.required ?? {})) {
          const missing = fields.map((f) => {
            if (f === 'title') return `trim(i.title, ${BLANKS}) = ''`
            if (f === 'text') return `trim(i.text, ${BLANKS}) = ''`
            params.push(f)
            // INDEXED BY: without it SQLite walks every row of that field for each item (3 s at 10k, 83 s at 50k — PERF-01)
            return `NOT EXISTS (SELECT 1 FROM item_fields x INDEXED BY item_fields_rid WHERE x.rid = i.rid AND x.field = ? AND trim(x.value, ${BLANKS}) <> '')`
          })
          if (missing.length === 0) continue
          ors.push(`(i.type = ? AND (${missing.join(' OR ')}))`)
          // the type parameter comes before its field parameters in the SQL text
          params.splice(params.length - fields.filter((f) => f !== 'title' && f !== 'text').length, 0, type)
        }
        where.push(ors.length ? `(${ors.join(' OR ')})` : '0')
      }
      if (q.document !== undefined) {
        // the document is the first folder of the path (S-10); '' = files directly in requirements/
        // stored at indexing time (0.18.0; before: a range on the path)
        where.push('i.doc = ?')
        params.push(q.document)
      }
      if (q.parent !== undefined) {
        if (q.parent === null) {
          // the top level: also items whose parent is in another document or missing — a file copied by hand from
          // another document keeps its old parent and would otherwise have no place (the owner on 0.17.2); stored as
          // `top` so this is an index lookup (the subquery cost 0.5 s at 50,000 items on CI)
          where.push('i.top = 1')
        } else {
          // children in the parent's own document only: a hand-moved child shows at its own document's top level,
          // not also under its old parent (CR18-04)
          where.push('i.parent = ? AND i.doc IN (SELECT p.doc FROM items p WHERE p.id = ?)')
          params.push(q.parent, q.parent)
        }
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

      const by = q.sort?.by ?? 'id'
      const dir = q.sort?.descending ? 'DESC' : 'ASC'
      let orderSql: string
      const orderParams: string[] = []
      const fts = q.text?.trim() ? toFtsQuery(q.text) : null
      if (by === 'relevance' && q.text?.trim()) {
        // Exact ID first, then the best full-text matches. bm25 weights: ID ×4, title ×10, text ×1,
        // so a heading whose title matches beats a long text that mentions the words in passing.
        const exact = q.text.trim().toUpperCase()
        orderSql = "CASE WHEN i.id = ? THEN 0 WHEN i.id LIKE ? ESCAPE '\\' THEN 1 ELSE 2 END"
        orderParams.push(exact, `${likeEscape(exact)}%`)
        if (fts) {
          orderSql += `, (SELECT bm25(items_fts, 4.0, 10.0, 1.0) FROM items_fts WHERE items_fts MATCH ? AND rowid = i.rid) ASC NULLS LAST`
          orderParams.push(fts)
        }
        orderSql += ', length(i.title), i.id'
      } else if (by === 'relevance') {
        orderSql = 'i.id'
      } else if (by.startsWith('field:')) {
        orderSql = `json_extract(i.fields_json, ?) IS NULL, json_extract(i.fields_json, ?) COLLATE NOCASE ${dir}, i.id`
        const pathExpr = `$."${by.slice(6).replace(/"/g, '')}"`
        orderParams.push(pathExpr, pathExpr)
      } else {
        const col = {
          id: 'i.id',
          type: 'i.type',
          title: 'i.title COLLATE NOCASE',
          order: 'i.ord IS NULL, i.ord',
          text: 'i.text COLLATE NOCASE',
          links: `(json_array_length(i.links_json) + (SELECT COUNT(*) FROM links l WHERE l.target = i.id))`
        }[by as 'id']
        orderSql = `${col} ${dir}, i.id`
        // All documents, top level, document order: one document after the other, each in its own order (CR-22)
        if (by === 'order' && q.parent === null && q.document === undefined) orderSql = `i.doc, ${orderSql}`
      }

      const total = (db.prepare(`SELECT COUNT(*) AS n FROM items i ${whereSql}`).get(...params) as { n: number }).n
      const limit = Math.max(0, Math.min(q.limit ?? 200, 10_000))
      const offset = Math.max(0, q.offset ?? 0)
      const rows = db
        .prepare(`SELECT i.*, ${COUNTS} FROM items i ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`)
        .all(...params, ...orderParams, limit, offset) as unknown as ItemRow[]
      return { total, items: rows.map((r) => rowToItem(q.brief ? { ...r, text: preview(r.text) } : r, fieldIds)) }
    },

    pathsOf: (id) => (db.prepare('SELECT path FROM items WHERE id = ? ORDER BY path').all(id) as { path: string }[]).map((r) => r.path),
    get(id) {
      const r = stmt.getById.get(id) as ItemRow | undefined
      return r ? rowToItem(r, fieldIds) : undefined
    },

    incomingLinks(id): LinkRef[] {
      return (stmt.incoming.all(id) as unknown as { id: string; type: string; suspect: number }[]).map((r) => ({ id: r.id, type: r.type, suspect: r.suspect === 1 }))
    },

    fingerprint(id) {
      return (stmt.fingerprint.get(id) as { fp: string } | undefined)?.fp
    },

    count: () => (stmt.count.get() as { n: number }).n,

    fieldValues: (field, limit) =>
      (db.prepare('SELECT trim(value) AS v, COUNT(*) AS n FROM item_fields WHERE field = ? AND trim(value) <> \'\' GROUP BY trim(value) ORDER BY n DESC, v LIMIT ?').all(field, limit) as { v: string }[]).map((r) => r.v),

    revision: () => revision,

    documentCounts: () => {
      // one pass for every document (PERF-02): '' = files directly in requirements/
      const rows = db.prepare('SELECT doc AS d, COUNT(*) AS n FROM items GROUP BY doc').all() as { d: string; n: number }[]
      return Object.fromEntries(rows.map((r) => [r.d, r.n]))
    },
    typeUsage: () => ({
      items: Object.fromEntries((db.prepare('SELECT type AS t, COUNT(*) AS n FROM items GROUP BY type').all() as { t: string; n: number }[]).map((r) => [r.t, r.n])),
      links: Object.fromEntries((db.prepare('SELECT type AS t, COUNT(*) AS n FROM links GROUP BY type').all() as { t: string; n: number }[]).map((r) => [r.t, r.n]))
    }),

    structure: () =>
      (db.prepare('SELECT id, parent, ord, path FROM items ORDER BY ord IS NULL, ord, id').all() as { id: string; parent: string | null; ord: string | null; path: string }[]).map((r) => ({
        id: r.id,
        document: documentOfPath(r.path),
        ...(r.parent !== null ? { parent: r.parent } : {}),
        ...(r.ord !== null ? { order: r.ord } : {})
      })),

    close() {
      db.close()
    }
  }
}

