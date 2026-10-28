import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkRepository, createFileRepositoryStore } from '../src/modules/repository-store'
import type { Item } from '../src/modules/items'

const store = createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml'))
const newRoot = (): Promise<string> => mkdtemp(join(tmpdir(), 'reqman-repo-'))

describe('repository store', () => {
  it('initialises a requirements folder with the default schema', async () => {
    const root = await newRoot()
    expect(await store.inspect(root)).toBe('not-initialized')
    const repo = await store.initialize(root)
    expect(await store.inspect(root)).toBe('ready')
    expect(repo.schemaProblems).toEqual([])
    expect(repo.schema.itemTypes).toHaveLength(12)
    expect(await readFile(join(root, 'requirements', '.gitattributes'), 'utf8')).toContain('eol=lf')
    await expect(store.initialize(root)).rejects.toThrow(/already has/)
    expect(await store.inspect(join(root, 'nope'))).toBe('missing')
  })

  it('refuses to open a folder that is not initialised', async () => {
    await expect(store.open(await newRoot())).rejects.toThrow(/No ReqMan requirements folder/)
  })

  it('creates, saves, reloads and deletes items', async () => {
    const repo = await store.initialize(await newRoot())
    const taken = new Set<string>()
    const stk = repo.createItem('stakeholder-need', taken, { title: 'Comfort' })
    taken.add(stk.id)
    const sys = repo.createItem('system-requirement', taken, { title: 'Accuracy', parent: stk.id, order: 'aA' })
    sys.links.push({ type: 'refines', target: stk.id })
    expect(stk.id).toMatch(/^REQ-[0-9A-Z]{7}$/)
    expect(sys.fields.status).toBe('Draft')

    await repo.writeItem(stk)
    await repo.writeItem(sys)
    const loaded = await repo.loadAll()
    expect(loaded.fileProblems).toEqual([])
    expect(loaded.issues).toEqual([])
    expect(loaded.items.map((i) => i.id).sort()).toEqual([stk.id, sys.id].sort())
    expect(loaded.items.find((i) => i.id === sys.id)).toEqual(sys)

    await repo.deleteItem(stk.id)
    const after = await repo.loadAll()
    expect(after.items).toHaveLength(1)
    expect(after.issues.map((i) => i.message)).toEqual([
      `Links to ${stk.id}, which does not exist.`,
      `Parent ${stk.id} does not exist.`
    ])
  })

  it('leaves no temporary files behind after saving', async () => {
    const repo = await store.initialize(await newRoot())
    for (let i = 0; i < 20; i++) await repo.writeItem(repo.createItem('risk', new Set(), { title: `R${i}` }))
    const names = await readdir(join(repo.folder, 'items'))
    expect(names.filter((n) => n.endsWith('.tmp'))).toEqual([])
    expect(names.filter((n) => n.endsWith('.md'))).toHaveLength(20)
  })

  it('reports unreadable files without stopping, and never overwrites them', async () => {
    const repo = await store.initialize(await newRoot())
    const good = repo.createItem('risk', new Set(), { title: 'Fine' })
    await repo.writeItem(good)
    const brokenPath = join(repo.folder, 'items', 'RSK-BROKEN.md')
    await writeFile(brokenPath, 'someone deleted the header')
    const loaded = await repo.loadAll()
    expect(loaded.items).toHaveLength(1)
    expect(loaded.fileProblems).toEqual([{ path: 'items/RSK-BROKEN.md', message: expect.stringMatching(/header/) }])

    await expect(repo.writeItem({ ...good, id: 'RSK-BROKEN' })).rejects.toThrow(/cannot be read/)
    expect(await readFile(brokenPath, 'utf8')).toBe('someone deleted the header')
  })

  it('notices a file renamed by hand', async () => {
    const repo = await store.initialize(await newRoot())
    const item = repo.createItem('risk', new Set(), { title: 'X' })
    await repo.writeItem(item)
    const { rename } = await import('node:fs/promises')
    await rename(join(repo.folder, 'items', `${item.id}.md`), join(repo.folder, 'items', 'RSK-RENAME.md'))
    const { issues } = await repo.loadAll()
    expect(issues.map((i) => i.message)).toEqual([`The file is named RSK-RENAME but contains ID ${item.id}.`])
  })
})

describe('repository checks', () => {
  const base = (id: string, parent?: string): Item => ({ id, type: 'risk', title: id, fields: {}, links: [], text: '', extra: {}, ...(parent ? { parent } : {}) })

  it('detects duplicate IDs and parent loops', async () => {
    const repo = await store.initialize(await newRoot())
    const issues = checkRepository(
      [base('RSK-AAAAAA', 'RSK-BBBBBB'), base('RSK-BBBBBB', 'RSK-AAAAAA'), base('RSK-CCCCCC'), base('RSK-CCCCCC')],
      repo.schema
    )
    expect(issues.map((i) => `${i.itemId}:${i.message}`)).toEqual([
      'RSK-CCCCCC:Two files have the ID RSK-CCCCCC.',
      'RSK-AAAAAA:The parent chain loops back to this item.',
      'RSK-BBBBBB:The parent chain loops back to this item.'
    ])
  })
})
