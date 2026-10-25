import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { FieldValue, Item } from '../items'
import type { RequirementsRepo } from '../repository-store'
import type { IndexCache, IndexedItem, ItemQuery, LinkRef, QueryResult, SyncStats } from './index'

/** Bump when the table layout changes; an old cache file is then rebuilt automatically. */
const FORMAT_VERSION = '1'

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
  ord REAL,
  text TEXT NOT NULL,
  fields_json TEXT NOT NULL,
  links_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS items_id ON items(id);
CREATE INDEX IF NOT EXISTS items_type ON items(type);
CREATE INDEX IF NOT EXISTS items_parent ON items(parent, ord);
CREATE TABLE IF NOT EXISTS item_fields (rid INTEGER NOT NULL, field TEXT NOT NULL, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS item_fields_lookup ON item_fields(field, value, rid);
CREATE INDEX IF NOT EXISTS item_fields_rid ON item_fields(rid);
CREATE TABLE IF NOT EXISTS links (rid INTEGER NOT NULL, source TEXT NOT NULL, type TEXT NOT NULL, target TEXT NOT NULL);
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
  ord: number | null
  text: string
  fields_json: string
  links_json: string
}

function rowToItem(r: ItemRow): IndexedItem {
  const item: IndexedItem = {
    id: r.id,
    type: r.type,
    title: r.title,
    fields: JSON.parse(r.fields_json) as Record<string, FieldValue>,
    links: JSON.parse(r.links_json) as IndexedItem['links'],
    text: r.text,
    path: r.path
  }
  if (r.parent !== null) item.parent = r.parent
  if (r.ord !== null) item.order = r.ord
  return item
}

/** Turns what a user types into a safe FTS5 query: every word must appear, as a prefix. */
export function toFtsQuery(text: string): string | null {
  const words = text.match(/[\p{L}\p{N}_]+/gu)
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

export function createSqliteIndexCache(dbFile: string): IndexCache {
  if (dbFile !== ':memory:') mkdirSync(dirname(dbFile), { recursive: true })
  const db = new DatabaseSync(dbFile)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA temp_store = MEMORY;')
  db.exec(DDL)

  const stmt = {
    getMeta: db.prepare('SELECT value FROM meta WHERE key = ?'),
    setMeta: db.prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
    allFiles: db.prepare('SELECT path, mtime, size FROM files'),
    upsertFile: db.prepare('INSERT INTO files(path, mtime, size, ok) VALUES(?, ?, ?, ?) ON CONFLICT(path) DO UPDATE SET mtime = excluded.mtime, size = excluded.size, ok = excluded.ok'),
    deleteFile: db.prepare('DELETE FROM files WHERE path = ?'),
    ridByPath: db.prepare('SELECT rid FROM items WHERE path = ?'),
    insertItem: db.prepare(
      'INSERT INTO items(path, id, type, title, parent, ord, text, fields_json, links_json) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ),
    deleteItem: db.prepare('DELETE FROM items WHERE rid = ?'),
    insertField: db.prepare('INSERT INTO item_fields(rid, field, value) VALUES(?, ?, ?)'),
    deleteFields: db.prepare('DELETE FROM item_fields WHERE rid = ?'),
    insertLink: db.prepare('INSERT INTO links(rid, source, type, target) VALUES(?, ?, ?, ?)'),
    deleteLinks: db.prepare('DELETE FROM links WHERE rid = ?'),
    insertFts: db.prepare('INSERT INTO items_fts(rowid, id, title, text) VALUES(?, ?, ?, ?)'),
    deleteFts: db.prepare('DELETE FROM items_fts WHERE rowid = ?'),
    getById: db.prepare('SELECT * FROM items WHERE id = ? ORDER BY path LIMIT 1'),
    incoming: db.prepare('SELECT source AS id, type FROM links WHERE target = ? ORDER BY type, source'),
    count: db.prepare('SELECT COUNT(*) AS n FROM items')
  }

  const transaction = (fn: () => void): void => {
    db.exec('BEGIN')
    try {
      fn()
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  }

  const removePath = (path: string): void => {
    const row = stmt.ridByPath.get(path) as { rid: number } | undefined
    if (row) {
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
      JSON.stringify(item.links)
    )
    const rid = Number(res.lastInsertRowid)
    for (const [field, value] of Object.entries(item.fields)) {
      for (const v of Array.isArray(value) ? value : [value]) stmt.insertField.run(rid, field, String(v))
    }
    for (const l of item.links) stmt.insertLink.run(rid, item.id, l.type, l.target)
    stmt.insertFts.run(rid, item.id, item.title, item.text)
  }

  const clearAll = (): void => {
    db.exec('DELETE FROM items; DELETE FROM item_fields; DELETE FROM links; DELETE FROM items_fts; DELETE FROM files;')
  }

  /** The cache must be rebuilt when the cache format or the set of schema fields changes. */
  const signature = (repo: RequirementsRepo): string =>
    createHash('sha1')
      .update(`${FORMAT_VERSION}|${repo.root}|${repo.schema.fields.map((f) => `${f.id}:${f.type}`).join(',')}`)
      .digest('hex')

  async function doSync(repo: RequirementsRepo, forceFull: boolean): Promise<SyncStats> {
    const started = performance.now()
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
    const parsed = await mapLimit(changed, 64, async (f) => ({ f, r: await repo.readItemFile(f.path) }))

    let added = 0
    let updated = 0
    let unreadable = 0
    transaction(() => {
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
    rebuild: (repo) => doSync(repo, true),

    query(q: ItemQuery): QueryResult {
      const where: string[] = []
      const params: (string | number | null)[] = []

      if (q.text && q.text.trim()) {
        const fts = toFtsQuery(q.text)
        const idLike = `%${q.text.trim().toUpperCase().replace(/[%_]/g, '')}%`
        if (fts) {
          where.push('(i.rid IN (SELECT rowid FROM items_fts WHERE items_fts MATCH ?) OR i.id LIKE ?)')
          params.push(fts, idLike)
        } else {
          where.push('i.id LIKE ?')
          params.push(idLike)
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
      if (q.parent !== undefined) {
        if (q.parent === null) where.push('i.parent IS NULL')
        else {
          where.push('i.parent = ?')
          params.push(q.parent)
        }
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

      const by = q.sort?.by ?? 'id'
      const dir = q.sort?.descending ? 'DESC' : 'ASC'
      let orderSql: string
      const orderParams: string[] = []
      if (by.startsWith('field:')) {
        orderSql = `json_extract(i.fields_json, ?) IS NULL, json_extract(i.fields_json, ?) COLLATE NOCASE ${dir}, i.id`
        const pathExpr = `$."${by.slice(6).replace(/"/g, '')}"`
        orderParams.push(pathExpr, pathExpr)
      } else {
        const col = { id: 'i.id', type: 'i.type', title: 'i.title COLLATE NOCASE', order: 'i.ord IS NULL, i.ord' }[by as 'id']
        orderSql = `${col} ${dir}, i.id`
      }

      const total = (db.prepare(`SELECT COUNT(*) AS n FROM items i ${whereSql}`).get(...params) as { n: number }).n
      const limit = Math.max(0, Math.min(q.limit ?? 200, 10_000))
      const offset = Math.max(0, q.offset ?? 0)
      const rows = db
        .prepare(`SELECT i.* FROM items i ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`)
        .all(...params, ...orderParams, limit, offset) as unknown as ItemRow[]
      return { total, items: rows.map(rowToItem) }
    },

    get(id) {
      const r = stmt.getById.get(id) as ItemRow | undefined
      return r ? rowToItem(r) : undefined
    },

    incomingLinks(id): LinkRef[] {
      return stmt.incoming.all(id) as unknown as LinkRef[]
    },

    count: () => (stmt.count.get() as { n: number }).n,

    close() {
      db.close()
    }
  }
}

