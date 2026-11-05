import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, stat, writeFile, rename, rmdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { generateId, ITEM_FILE_EXTENSION, parseItemFile, serializeItem, type FieldValue, type Item } from '../items'
import { isMap, isSeq, parseDocument, type YAMLMap, type YAMLSeq } from 'yaml'
import { parseSchema, type FieldDef } from '../schema'
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

const ITEMS_DIR = 'items'
/** The project folder inside requirements/ (0.16: renamed with the product; owner, 31 Oct / 4 Nov 2026). */
/** True when the ID can be used as a file name inside items/ (no path parts). */
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
    const itemsDir = join(folder, ITEMS_DIR)
    // An ID becomes a file name: it must be a plain name that stays inside items/ (SEC-01, SEC-06). Older or
    // hand-written IDs in other formats are allowed; separators, "..", ":" and control characters are not.
    const defaultPath = (id: string): string => {
      if (!isSafeFileId(id)) throw new Error(`"${id}" cannot be used as an item ID: it must not contain / \\ : .. or control characters.`)
      return `${ITEMS_DIR}/${id}${ITEM_FILE_EXTENSION}`
    }
    // An item's file is normally items/<ID>.md, but a file renamed by hand still holds its item: the caller's
    // locator (the index) knows the real path, so such an item can be read, saved and deleted in place.
    const pathOf = (id: string): string => options.locate?.(id) ?? defaultPath(id)
    const fileFor = (id: string): string => join(folder, pathOf(id))

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

      async listItemFiles(): Promise<ItemFileInfo[]> {
        const names = await readdir(itemsDir).catch(() => [] as string[])
        const files = names.filter((n) => n.endsWith(ITEM_FILE_EXTENSION))
        const infos = await mapLimit(files, READ_CONCURRENCY, async (n) => {
          const s = await stat(join(itemsDir, n)).catch(() => null)
          return s?.isFile() ? { path: `${ITEMS_DIR}/${n}`, mtimeMs: s.mtimeMs, size: s.size } : null
        })
        return infos.filter((x): x is ItemFileInfo => x !== null).sort((a, b) => a.path.localeCompare(b.path))
      },

      async readItemFile(path, opts) {
        try {
          return parseItemFile(await readFile(join(folder, path), 'utf8'), opts?.allKeysAsFields ? ALL_KEYS : fieldIds)
        } catch (e) {
          return { ok: false, error: `Could not read the file: ${(e as Error).message}` }
        }
      },

      itemPath: pathOf,
      defaultItemPath: defaultPath,

      async fixFileName(id) {
        const from = pathOf(id)
        const to = defaultPath(id)
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
        let content: string
        try {
          content = await readFile(fileFor(id), 'utf8')
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
          return { ok: false, error: `Could not read the file: ${(e as Error).message}`, revision: '' }
        }
        const r = parseItemFile(content, fieldIds)
        return r.ok ? { ok: true, item: r.item, revision: revisionOf(content) } : { ok: false, error: r.error, revision: revisionOf(content) }
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
        if (init.order !== undefined) item.order = init.order
        return item
      },

      async writeItem(item, options = {}) {
        const file = fileFor(item.id)
        const current = await repo.readItem(item.id)
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
        await mkdir(itemsDir, { recursive: true })
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

    async initialize(root) {
      const folder = folderOf(root)
      if ((await exists(join(folder, META_DIR, SCHEMA_FILE))) || (await exists(join(folder, LEGACY_META_DIR, SCHEMA_FILE))))
        throw new Error('This repository already has a requirements folder.')
      await mkdir(join(folder, META_DIR), { recursive: true })
      await mkdir(join(folder, ITEMS_DIR), { recursive: true })
      await writeFile(join(folder, META_DIR, SCHEMA_FILE), await readFile(defaultSchemaFile, 'utf8'), { flag: 'wx' })
      await writeFile(join(folder, '.gitattributes'), GITATTRIBUTES, { flag: 'w' })
      // Git does not track empty folders; this keeps items/ in a fresh repository.
      await writeFile(join(folder, ITEMS_DIR, '.gitkeep'), '', { flag: 'w' })
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
