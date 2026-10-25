import { randomBytes } from 'node:crypto'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { generateId, ITEM_FILE_EXTENSION, parseItemFile, serializeItem, type FieldValue, type Item } from '../items'
import { parseSchema } from '../schema'
import { checkRepository } from './checks'
import {
  REQUIREMENTS_FOLDER,
  type FolderState,
  type ItemFileInfo,
  type LoadResult,
  type RepositoryStore,
  type RequirementsRepo
} from './index'

const ITEMS_DIR = 'items'
const META_DIR = '.reqman'
const SCHEMA_FILE = 'schema.yaml'
const GITATTRIBUTES = '# Written by ReqMan: identical line endings on every PC keep diffs clean.\n* text=auto eol=lf\n'
const READ_CONCURRENCY = 64

const exists = async (p: string): Promise<boolean> => (await stat(p).catch(() => null)) !== null

/** Writes to a temporary file in the same folder, then renames it over the target. */
async function atomicWrite(file: string, content: string): Promise<void> {
  const tmp = `${file}.${randomBytes(4).toString('hex')}.tmp`
  try {
    await writeFile(tmp, content, 'utf8')
    await rename(tmp, file)
  } catch (e) {
    await rm(tmp, { force: true })
    throw e
  }
}

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

  async function open(root: string): Promise<RequirementsRepo> {
    const folder = folderOf(root)
    const schemaFile = join(folder, META_DIR, SCHEMA_FILE)
    let schemaText: string
    try {
      schemaText = await readFile(schemaFile, 'utf8')
    } catch {
      throw new Error(`No ReqMan requirements folder in ${root} (missing ${REQUIREMENTS_FOLDER}/${META_DIR}/${SCHEMA_FILE}).`)
    }
    const { schema, problems: schemaProblems } = parseSchema(schemaText)
    const fieldIds = new Set(schema.fields.map((f) => f.id))
    const itemsDir = join(folder, ITEMS_DIR)
    const fileFor = (id: string): string => join(itemsDir, `${id}${ITEM_FILE_EXTENSION}`)

    const repo: RequirementsRepo = {
      root,
      folder,
      schema,
      schemaProblems,

      async listItemFiles(): Promise<ItemFileInfo[]> {
        const names = await readdir(itemsDir).catch(() => [] as string[])
        const files = names.filter((n) => n.endsWith(ITEM_FILE_EXTENSION))
        const infos = await mapLimit(files, READ_CONCURRENCY, async (n) => {
          const s = await stat(join(itemsDir, n)).catch(() => null)
          return s?.isFile() ? { path: `${ITEMS_DIR}/${n}`, mtimeMs: s.mtimeMs, size: s.size } : null
        })
        return infos.filter((x): x is ItemFileInfo => x !== null).sort((a, b) => a.path.localeCompare(b.path))
      },

      async readItemFile(path) {
        try {
          return parseItemFile(await readFile(join(folder, path), 'utf8'), fieldIds)
        } catch (e) {
          return { ok: false, error: `Could not read the file: ${(e as Error).message}` }
        }
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
          id: generateId(type.prefix, (id) => takenIds.has(id)),
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

      async writeItem(item) {
        const file = fileFor(item.id)
        // Never overwrite a file a person edited into a state ReqMan cannot read: their text would be lost.
        if (await exists(file)) {
          const current = await repo.readItemFile(`${ITEMS_DIR}/${basename(file)}`)
          if (!current.ok) throw new Error(`${basename(file)} cannot be read (${current.error}); fix it before saving over it.`)
        }
        await mkdir(itemsDir, { recursive: true })
        await atomicWrite(file, serializeItem(item, schema))
      },

      async deleteItem(id) {
        await rm(fileFor(id), { force: true })
      }
    }
    return repo
  }

  return {
    async inspect(root): Promise<FolderState> {
      if (!(await exists(root))) return 'missing'
      return (await exists(join(folderOf(root), META_DIR, SCHEMA_FILE))) ? 'ready' : 'not-initialized'
    },

    async initialize(root) {
      const folder = folderOf(root)
      if (await exists(join(folder, META_DIR, SCHEMA_FILE))) throw new Error('This repository already has a requirements folder.')
      await mkdir(join(folder, META_DIR), { recursive: true })
      await mkdir(join(folder, ITEMS_DIR), { recursive: true })
      await writeFile(join(folder, META_DIR, SCHEMA_FILE), await readFile(defaultSchemaFile, 'utf8'), { flag: 'wx' })
      await writeFile(join(folder, '.gitattributes'), GITATTRIBUTES, { flag: 'w' })
      // Git does not track empty folders; this keeps items/ in a fresh repository.
      await writeFile(join(folder, ITEMS_DIR, '.gitkeep'), '', { flag: 'w' })
      return open(root)
    },

    open
  }
}
