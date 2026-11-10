import { createHash } from 'node:crypto'
import { documentOfPath } from '../../shared/domain'
import { mkdir, readdir, readFile, lstat, stat, writeFile, rename, rmdir } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { generateId, ITEM_FILE_EXTENSION, parseItemFile, serializeItem, type FieldValue, type Item } from '../items'
import { isMap, isSeq, parseDocument, type YAMLMap, type YAMLSeq } from 'yaml'
import { parseSchema, type CoverageRule, type FieldDef } from '../schema'
import { removeFile, renameFile, writeFileAtomic } from '../safe-files'
import { checkRepository } from './checks'
import { ConflictError } from './errors'
import {
  REQUIREMENTS_FOLDER,
  type FolderState,
  type ItemFileInfo,
  type LoadResult,
  type OpenOptions,
  type RepositoryStore,
  type RequirementsRepo
} from './index'

/** The document folder of projects made before 0.17 (and the default when nothing else is known). */
const ITEMS_DIR = 'items'
/** The first document of a new project (S-10: the requirements folder holds only document folders). */
export const FIRST_DOCUMENT = 'Specification'
/** An item file larger than this is reported, not read (a requirement is text; SEC-17-03). */
const MAX_ITEM_FILE_BYTES = 5_000_000
/** True when the name can be a document folder: a plain folder name, not hidden (S-10). */
export const isDocumentName = (name: string): boolean =>
  name.length > 0 &&
  name.length <= 80 &&
  !/^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\.|$)/i.test(name) &&
  // no invisible format characters (direction marks, zero-width): a name must look like what it is (SEC-17-04)
  !/\p{Cf}/u.test(name) &&
  !/[\\/:*?"<>|]/.test(name) && ![...name].some((c) => c.charCodeAt(0) < 32) && !name.startsWith('.') && name.trim() === name && !name.endsWith('.')
/** The project folder inside requirements/ (0.16: renamed with the product; owner, 31 Oct / 4 Nov 2026). */
/** True when the ID can be used as a file name inside a document folder (no path parts). */
export const isSafeFileId = (id: string): boolean =>
  id.length > 0 &&
  id.length <= 128 &&
  !/[\\/:]/.test(id) &&
  ![...id].some((c) => c.charCodeAt(0) < 32) &&
  !id.includes('..') &&
  !id.startsWith('.') &&
  id.trim() === id

const META_DIR = '.reqochet'
/** ReqMan's name for it: still read, until the user takes the rename (one commit). */
const LEGACY_META_DIR = '.reqman'
const SCHEMA_FILE = 'schema.yaml'
const GITATTRIBUTES = '# Written by reqochet: identical line endings on every PC keep diffs clean.\n* text=auto eol=lf\n'
const READ_CONCURRENCY = 64
/** Every header key that holds a simple value counts as a field (used by the index; see readItemFile). */
const ALL_KEYS: ReadonlySet<string> = { has: () => true } as unknown as ReadonlySet<string>

const revisionOf = (content: string): string => createHash('sha1').update(content).digest('hex').slice(0, 16)

const exists = async (p: string): Promise<boolean> => (await stat(p).catch(() => null)) !== null

/** Temporary file + rename, retried while Windows briefly locks the file (see modules/safe-files). */
const atomicWrite = (file: string, content: string): Promise<void> => writeFileAtomic(file, content)

/** Runs `fn` over `inputs` with at most `limit` in flight (keeps 50k file reads from exhausting handles). */
async function mapLimit<T, R>(inputs: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(inputs.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, inputs.length) }, async () => {
    while (next < inputs.length) {
      const i = next++
      out[i] = await fn(inputs[i] as T)
    }
  })
  await Promise.all(workers)
  return out
}

/** @param defaultSchemaFile the schema copied into new requirements folders (config/default-schema.yaml) */
export function createFileRepositoryStore(defaultSchemaFile: string): RepositoryStore {
  const folderOf = (root: string): string => join(root, REQUIREMENTS_FOLDER)

  async function open(root: string, options: OpenOptions = {}): Promise<RequirementsRepo> {
    const folder = folderOf(root)
    const metaDir = (await exists(join(folder, META_DIR, SCHEMA_FILE))) ? META_DIR : LEGACY_META_DIR
    const schemaFile = join(folder, metaDir, SCHEMA_FILE)
    let schemaText: string
    try {
      schemaText = await readFile(schemaFile, 'utf8')
    } catch {
      throw new Error(`No requirements folder in ${root} (missing ${REQUIREMENTS_FOLDER}/${META_DIR}/${SCHEMA_FILE}).`)
    }
    const { schema, problems: schemaProblems } = parseSchema(schemaText)
    const fieldIds = new Set(schema.fields.map((f) => f.id))
    // Documents are the folders directly under requirements/ (S-10); the hidden project folder is not one.
    const listDocuments = async (): Promise<string[]> =>
      (await readdir(folder, { withFileTypes: true }).catch(() => []))
        .filter((d) => d.isDirectory() && isDocumentName(d.name))
        .map((d) => d.name)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    const initialDocuments = await listDocuments()
    // where a new item goes when nothing says otherwise: the only document, else "items" (before 0.17), else the first
    const defaultDocument = initialDocuments.length === 1 ? (initialDocuments[0] as string) : initialDocuments.includes(ITEMS_DIR) ? ITEMS_DIR : (initialDocuments[0] ?? FIRST_DOCUMENT)
    // An ID becomes a file name: it must be a plain name that stays inside its document (SEC-01, SEC-06). Older or
    // hand-written IDs in other formats are allowed; separators, "..", ":" and control characters are not.
    const defaultPath = (id: string, document?: string): string => {
      if (!isSafeFileId(id)) throw new Error(`"${id}" cannot be used as an item ID: it must not contain / \\ : .. or control characters.`)
      const doc = document ?? defaultDocument
      if (doc === '') return `${id}${ITEM_FILE_EXTENSION}` // a loose item stays loose (CR-10, CR-17)
      if (!isDocumentName(doc)) throw new Error(`"${doc}" cannot be used as a document name.`)
      return `${doc}/${id}${ITEM_FILE_EXTENSION}`
    }
    // An item's file is normally <document>/<ID>.md, but a file renamed by hand still holds its item: the caller's
    // locator (the index) knows the real path, so such an item can be read, saved and deleted in place.
    const pathOf = (id: string, document?: string): string => options.locate?.(id) ?? defaultPath(id, document)
    const fileFor = (id: string, document?: string): string => join(folder, pathOf(id, document))

    /** A relative path to an item file that stays inside the folder (CR-08): no absolute path, no "..", ends in .md. */
    const isSafeItemPath = (rel: string): boolean =>
      rel.endsWith(ITEM_FILE_EXTENSION) && !isAbsolute(rel) && !rel.split(/[\\/]/).some((part) => part === '..' || part === '') && !rel.includes(':') && !rel.includes(String.fromCharCode(0))

    /** One item file with its revision; null when it does not exist. */
    const readAt = async (rel: string): Promise<{ ok: true; item: Item; revision: string } | { ok: false; error: string; revision: string } | null> => {
      let content: string
      try {
        content = await readFile(join(folder, rel), 'utf8')
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
        return { ok: false, error: `Could not read the file: ${(e as Error).message}`, revision: '' }
      }
      const r = parseItemFile(content, fieldIds)
      return r.ok ? { ok: true, item: r.item, revision: revisionOf(content) } : { ok: false, error: r.error, revision: revisionOf(content) }
    }

    const repo: RequirementsRepo = {
      root,
      folder,
      metaDir,
      schema,
      schemaProblems,
      schemaRevision: revisionOf(schemaText),

      async writeSchemaFields(fields, expectedRevision) {
        const current = await readFile(schemaFile, 'utf8')
        if (revisionOf(current) !== expectedRevision) {
          throw new ConflictError('schema.yaml was changed outside reqochet since the repository was opened. Refresh and try again.')
        }
        // Edit only the "fields" list in the YAML document, so comments and the other sections stay as written.
        const doc = parseDocument(current)
        // Update each field's own map in place: keys reqochet does not manage (required:, description: …) and the
        // comments around them stay as written (CR1-03); new fields get a new map, removed ones are dropped.
        const oldSeq = doc.get('fields')
        const oldNodes = new Map<string, YAMLMap>()
        if (isSeq(oldSeq)) {
          for (const node of oldSeq.items) if (isMap(node) && typeof node.get('id') === 'string') oldNodes.set(node.get('id') as string, node)
        }
        const managed: Record<string, (f: FieldDef) => unknown> = {
          name: (f) => f.name,
          type: (f) => f.type,
          options: (f) => (f.type === 'enum' && f.options ? f.options : undefined),
          default: (f) => (f.default !== undefined && f.default !== '' ? f.default : undefined),
          // translated names (UX-22) are kept when the fields are edited in the window
          labels: (f) => (f.labels && Object.keys(f.labels).length > 0 ? f.labels : undefined),
          optionLabels: (f) => (f.type === 'enum' && f.optionLabels && Object.keys(f.optionLabels).length > 0 ? f.optionLabels : undefined)
        }
        const seq = isSeq(oldSeq) ? oldSeq : (doc.createNode([]) as YAMLSeq)
        seq.items = fields.map((f) => {
          const node = oldNodes.get(f.id) ?? (doc.createNode({ id: f.id }) as YAMLMap)
          for (const [key, value] of Object.entries(managed)) {
            const v = value(f)
            if (v === undefined) node.delete(key)
            else node.set(key, doc.createNode(v))
          }
          return node
        })
        if (!isSeq(oldSeq)) doc.set('fields', seq)
        const text = doc.toString({ lineWidth: 0 })
        // only the fields written here must be clean; a problem elsewhere in the file (e.g. an item type's label) is
        // the team's to fix and must not block editing fields (QA-02 in 0.15)
        const check = parseSchema(text)
        const own = check.problems.filter((p) => p.path === 'fields' || p.path.startsWith('fields['))
        if (own.length > 0) throw new Error(own.map((p) => `${p.path}: ${p.message}`).join(' '))
        await atomicWrite(schemaFile, text)
      },

      defaultDocument,
      listDocuments,

      async writeSchemaTypes(itemTypes, linkTypes, expectedRevision) {
        const current = await readFile(schemaFile, 'utf8')
        if (revisionOf(current) !== expectedRevision) {
          throw new ConflictError('schema.yaml was changed outside reqochet since the repository was opened. Refresh and try again.')
        }
        const doc = parseDocument(current)
        const edit = <T extends { id: string }>(key: string, list: T[], managed: Record<string, (x: T) => unknown>): void => {
          const old = doc.get(key)
          const nodes = new Map<string, YAMLMap>()
          if (isSeq(old)) for (const n of old.items) if (isMap(n) && typeof n.get('id') === 'string') nodes.set(n.get('id') as string, n)
          const seq = isSeq(old) ? old : (doc.createNode([]) as YAMLSeq)
          seq.items = list.map((x) => {
            const node = nodes.get(x.id) ?? (doc.createNode({ id: x.id }) as YAMLMap)
            for (const [k, value] of Object.entries(managed)) {
              const v = value(x)
              if (v === undefined) node.delete(k)
              else node.set(k, doc.createNode(v))
            }
            return node
          })
          if (!isSeq(old)) doc.set(key, seq)
        }
        edit('itemTypes', itemTypes, {
          name: (t) => t.name,
          short: (t) => t.short || undefined,
          requirement: (t) => (t.requirement === false ? false : undefined),
          labels: (t) => (t.labels && Object.keys(t.labels).length ? t.labels : undefined),
          required: (t) => (t.required?.length ? t.required : undefined)
        })
        edit('linkTypes', linkTypes, {
          name: (l) => l.name,
          reverseName: (l) => l.reverseName,
          labels: (l) => (l.labels && Object.keys(l.labels).length ? l.labels : undefined),
          reverseLabels: (l) => (l.reverseLabels && Object.keys(l.reverseLabels).length ? l.reverseLabels : undefined)
        })
        const text = doc.toString({ lineWidth: 0 })
        const own = parseSchema(text).problems.filter((p) => /^(itemTypes|linkTypes)/.test(p.path))
        if (own.length > 0) throw new Error(own.map((p) => `${p.path}: ${p.message}`).join(' '))
        await atomicWrite(schemaFile, text)
      },

      async writeSchemaRules(rules, expectedRevision) {
        const current = await readFile(schemaFile, 'utf8')
        if (revisionOf(current) !== expectedRevision) {
          throw new ConflictError('schema.yaml was changed outside reqochet since the repository was opened. Refresh and try again.')
        }
        // only the "rules" list changes; comments and every other section stay as written. Inside the list a rule the
        // window knows is updated in place (its unknown keys and comments stay), a rule reqochet could not read (a typo,
        // listed under Problems) is kept as written, and only the rules the user removed go (CR20-01/02)
        const doc = parseDocument(current)
        const readable = new Set((parseSchema(current).schema.rules ?? []).map((r) => r.id))
        const plain = (r: CoverageRule): Record<string, unknown> => ({ id: r.id, type: r.type, link: r.link, direction: r.direction, ...(r.from?.length ? { from: r.from } : {}), min: r.min, level: r.level })
        const old = doc.get('rules', true)
        const seq = (isSeq(old) ? old : doc.createNode([])) as YAMLSeq
        const wanted = new Map(rules.map((r) => [r.id, r]))
        const idOf = (n: unknown): string | undefined => {
          if (!isMap(n)) return undefined
          const v = n.get('id')
          if (typeof v === 'string') return v
          // a rule without an id is known by the id the parser gives it
          const t = n.get('type'), l = n.get('link'), d = n.get('direction') ?? 'incoming'
          return typeof t === 'string' && typeof l === 'string' ? `${t}-${l}-${String(d)}` : undefined
        }
        const kept: unknown[] = []
        const seen = new Set<string>()
        for (const n of seq.items) {
          const id = idOf(n)
          if (id !== undefined && wanted.has(id) && isMap(n)) {
            const r = wanted.get(id) as CoverageRule
            for (const [k, v] of Object.entries(plain(r))) n.set(k, Array.isArray(v) ? doc.createNode(v, { flow: true }) : v)
            if (!r.from?.length) n.delete('from')
            kept.push(n)
            seen.add(id)
          } else if (id === undefined || !readable.has(id)) kept.push(n) // not readable: keep it as written
        }
        for (const r of rules) {
          if (seen.has(r.id)) continue
          const n = doc.createNode(plain(r))
          if (isMap(n)) n.flow = true // one rule per line, like the types
          kept.push(n)
        }
        seq.items = kept as YAMLSeq['items']
        doc.set('rules', seq)
        const text = doc.toString({ lineWidth: 0 })
        // refuse only problems this save brings in: a rule kept as written may still have the problem it had
        const rulesProblems = (t: string): string[] => parseSchema(t).problems.filter((p) => p.path === 'rules' || p.path.startsWith('rules[')).map((p) => p.message)
        const before = new Set(rulesProblems(current))
        const own = parseSchema(text).problems.filter((p) => (p.path === 'rules' || p.path.startsWith('rules[')) && !before.has(p.message))
        if (own.length > 0) throw new Error(own.map((p) => `${p.path}: ${p.message}`).join(' '))
        await atomicWrite(schemaFile, text)
      },

      // every .md file of every document folder, plus .md files directly in requirements/ (loose items, S-10)
      async listItemFiles(): Promise<ItemFileInfo[]> {
        const docs = await listDocuments()
        const files: string[] = []
        for (const d of ['', ...docs]) {
          const names = await readdir(d ? join(folder, d) : folder).catch(() => [] as string[])
          for (const n of names) if (n.endsWith(ITEM_FILE_EXTENSION) && n.toLowerCase() !== 'readme.md') files.push(d ? `${d}/${n}` : n)
        }
        const infos = await mapLimit(files, READ_CONCURRENCY, async (p) => {
          // lstat: a link committed as an item file is not followed outside the project (SEC-17-03)
          const s = await lstat(join(folder, p)).catch(() => null)
          return s?.isFile() ? { path: p, mtimeMs: s.mtimeMs, size: s.size } : null
        })
        return infos.filter((x): x is ItemFileInfo => x !== null).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
      },

      async readItemFile(path, opts) {
        try {
          const info = await lstat(join(folder, path))
          if (!info.isFile()) return { ok: false, error: 'Not a plain file (a link or a folder): not read.' }
          if (info.size > MAX_ITEM_FILE_BYTES) return { ok: false, error: `The file is larger than ${MAX_ITEM_FILE_BYTES / 1_000_000} MB: not read.` }
          return parseItemFile(await readFile(join(folder, path), 'utf8'), opts?.allKeysAsFields ? ALL_KEYS : fieldIds)
        } catch (e) {
          return { ok: false, error: `Could not read the file: ${(e as Error).message}` }
        }
      },

      readItemAt: (rel) => (isSafeItemPath(rel) ? readAt(rel) : Promise.resolve(null)),

      itemPath: pathOf,
      defaultItemPath: defaultPath,

      async fixFileName(id) {
        const from = pathOf(id)
        // the file keeps its document; a loose file goes into the default document
        const to = defaultPath(id, documentOfPath(from))
        if (from === to) return to
        if (await exists(join(folder, to))) throw new Error(`${to} already exists; the file ${from} was not renamed.`)
        const current = await readFile(join(folder, from), 'utf8').catch(() => null)
        if (current === null) throw new Error(`${from} could not be read.`)
        const r = parseItemFile(current, fieldIds)
        if (!r.ok || r.item.id !== id) throw new Error(`${from} does not contain the item ${id}.`)
        await renameFile(join(folder, from), join(folder, to))
        return to
      },

      async readItem(id) {
        return readAt(pathOf(id))
      },

      async loadAll(): Promise<LoadResult> {
        const files = await repo.listItemFiles()
        const results = await mapLimit(files, READ_CONCURRENCY, (f) => repo.readItemFile(f.path))
        const items: Item[] = []
        const fileProblems: LoadResult['fileProblems'] = []
        const fileNameIds = new Map<Item, string>()
        results.forEach((r, i) => {
          const path = files[i]?.path ?? ''
          if (r.ok) {
            items.push(r.item)
            fileNameIds.set(r.item, basename(path, ITEM_FILE_EXTENSION))
          } else fileProblems.push({ path, message: r.error })
        })
        return { items, fileProblems, issues: checkRepository(items, schema, fileNameIds) }
      },

      createItem(typeId, takenIds, init = {}) {
        const type = schema.itemTypes.find((t) => t.id === typeId)
        if (!type) throw new Error(`Unknown item type "${typeId}".`)
        const fields: Record<string, FieldValue> = {}
        for (const f of schema.fields) if (f.default !== undefined) fields[f.id] = f.default
        const item: Item = {
          id: generateId((id) => takenIds.has(id)),
          type: typeId,
          title: init.title ?? '',
          fields,
          links: [],
          text: init.text ?? '',
          extra: {}
        }
        if (init.parent) item.parent = init.parent
        if (init.document !== undefined) item.document = init.document
        if (init.order !== undefined) item.order = init.order
        return item
      },

      async writeItem(item, options = {}) {
        // the file this save writes; the conflict check reads that same file (W-01: a duplicated ID must not let the
        // check or the write land on the other copy; CRC-19: a new item is checked in its own document)
        if (options.path !== undefined && !isSafeItemPath(options.path)) throw new Error(`"${options.path}" is not an item file inside the requirements folder.`)
        const rel = options.path ?? pathOf(item.id, item.document)
        const file = join(folder, rel)
        const current = await readAt(rel)
        if (options.expectedRevision !== undefined) {
          const actual = current ? current.revision : null
          if (actual !== options.expectedRevision) {
            throw new ConflictError(
              options.expectedRevision === null
                ? `${item.id} already exists.`
                : current
                  ? `${item.id} was changed outside reqochet since you opened it.`
                  : `${item.id} was deleted outside reqochet since you opened it.`
            )
          }
        }
        // Never overwrite a file a person edited into a state ReqMan cannot read: their text would be lost.
        if (current && !current.ok) throw new Error(`${basename(file)} cannot be read (${current.error}); fix it before saving over it.`)
        await mkdir(dirname(file), { recursive: true })
        const content = serializeItem(item, schema)
        await atomicWrite(file, content)
        return revisionOf(content)
      },

      async deleteItem(id, options = {}) {
        if (options.expectedRevision !== undefined) {
          const current = await repo.readItem(id)
          if ((current?.revision ?? null) !== options.expectedRevision) {
            throw new ConflictError(`${id} was changed outside reqochet since you opened it.`)
          }
        }
        await removeFile(fileFor(id))
      }
    }
    return repo
  }

  return {
    async inspect(root): Promise<FolderState> {
      if (!(await exists(root))) return 'missing'
      const folder = folderOf(root)
      return (await exists(join(folder, META_DIR, SCHEMA_FILE))) || (await exists(join(folder, LEGACY_META_DIR, SCHEMA_FILE))) ? 'ready' : 'not-initialized'
    },

    async initialize(root, firstDocument = ITEMS_DIR) {
      const folder = folderOf(root)
      if ((await exists(join(folder, META_DIR, SCHEMA_FILE))) || (await exists(join(folder, LEGACY_META_DIR, SCHEMA_FILE))))
        throw new Error('This repository already has a requirements folder.')
      await mkdir(join(folder, META_DIR), { recursive: true })
      // a new project starts with one document folder, never loose items (S-10)
      const doc = isDocumentName(firstDocument) ? firstDocument : ITEMS_DIR
      await mkdir(join(folder, doc), { recursive: true })
      await writeFile(join(folder, META_DIR, SCHEMA_FILE), await readFile(defaultSchemaFile, 'utf8'), { flag: 'wx' })
      await writeFile(join(folder, '.gitattributes'), GITATTRIBUTES, { flag: 'w' })
      // Git does not track empty folders; this keeps the document folder in a fresh repository.
      await writeFile(join(folder, doc, '.gitkeep'), '', { flag: 'w' })
      return open(root)
    },

    async renameLegacyFolder(root, back = false) {
      const folder = folderOf(root)
      const [src, dst] = back ? [META_DIR, LEGACY_META_DIR] : [LEGACY_META_DIR, META_DIR]
      if (!(await exists(join(folder, src)))) return null
      if (await exists(join(folder, dst))) {
        // an empty leftover folder (a half-finished manual rename) is simply removed (QA-04); anything else is kept
        const empty = (await readdir(join(folder, dst)).catch(() => ['?'])).length === 0
        if (!empty) throw new Error('both-folders')
        await rmdir(join(folder, dst))
      }
      await rename(join(folder, src), join(folder, dst))
      return { from: `${REQUIREMENTS_FOLDER}/${src}`, to: `${REQUIREMENTS_FOLDER}/${dst}` }
    },

    open: (root, options) => open(root, options)
  }
}
