// QA 0.15.0 (helper agent, docs/AGENT-WORKFLOW.md): tries to break the main-process and data parts of the UI polish
// version. A failing test here shows a product bug — see docs/reviews/agents/0.15.0-qa.md.
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fieldDefs, importPath } from '../src/main/validate'
import { loadImportFile } from '../src/main/importFiles'
import { parseSchema } from '../src/modules/schema'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createWorkspace } from '../src/modules/workspace'
import type { Item } from '../src/modules/items'

const DEFAULT_SCHEMA = join(__dirname, '..', 'config', 'default-schema.yaml')
const store = createFileRepositoryStore(DEFAULT_SCHEMA)
const sh = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' })
const quietLog = { info: () => {}, warn: () => {}, error: () => {} }

// ---------------------------------------------------------------- a file dropped on the import window
describe('QA importPath', () => {
  const ext = ['xlsx', 'xlsm', 'csv', 'txt', 'reqif', 'reqifz']
  it('accepts forward slashes, mixed case and a dot in a folder name', () => {
    expect(importPath('C:/Data/v1.2/Reqs.CsV', ext)).toBe('C:/Data/v1.2/Reqs.CsV')
    expect(importPath('D:\\a.b\\c.reqifz', ext)).toBe('D:\\a.b\\c.reqifz')
  })
  it('refuses a file without an extension whose folder looks like one', () => {
    expect(() => importPath('C:\\x.csv\\readme', ext)).toThrow()
    expect(() => importPath('C:\\folder\\csv', ext)).toThrow()
  })
  it('refuses URLs, drive-relative paths, empty values, trailing spaces and very long paths', () => {
    for (const p of ['file:///C:/x.csv', 'https://example.org/x.csv', 'C:x.csv', '', 'C:\\x.csv ', `C:\\${'a'.repeat(5000)}.csv`, ['C:\\x.csv'], null]) {
      expect(() => importPath(p, ext), JSON.stringify(p)?.slice(0, 40)).toThrow()
    }
  })
  it('refuses Windows device namespaces (\\\\.\\ and \\\\?\\) that are not ordinary files', () => {
    expect(() => importPath('\\\\.\\pipe\\evil.csv', ext)).toThrow()
    expect(() => importPath('\\\\?\\GLOBALROOT\\Device\\x.csv', ext)).toThrow()
  })
  it('a dropped folder named like a file gives a clear error, not a hang', async () => {
    const dir = join(await mkdtemp(join(tmpdir(), 'qa-imp-')), 'looks-like.csv')
    await mkdir(dir)
    await expect(loadImportFile(importPath(dir, ext))).rejects.toThrow()
  })
  it('an empty or binary .csv file reads without throwing', async () => {
    const base = await mkdtemp(join(tmpdir(), 'qa-imp-'))
    await writeFile(join(base, 'empty.csv'), '')
    await writeFile(join(base, 'bin.csv'), Buffer.from([0, 255, 1, 254, 10, 13, 0]))
    expect((await loadImportFile(join(base, 'empty.csv'))).sheets[0]?.rows).toEqual([])
    await expect(loadImportFile(join(base, 'bin.csv'))).resolves.toBeTruthy()
  })
})

// ---------------------------------------------------------------- field definitions from the window
describe('QA fieldDefs with labels', () => {
  const base = { id: 'status', name: 'Status', type: 'enum', options: ['Draft'] }
  it('refuses labels that are not language → text', () => {
    for (const labels of [[], 'ar', { ar: 5 }, { ar: '' }, { ar: null }, { ar: { x: 'y' } }]) {
      expect(() => fieldDefs([{ ...base, labels }]), JSON.stringify(labels)).toThrow()
    }
    for (const optionLabels of [[], 'x', { ar: 'x' }, { ar: [] }, { ar: { Draft: 1 } }]) {
      expect(() => fieldDefs([{ ...base, optionLabels }]), JSON.stringify(optionLabels)).toThrow()
    }
  })
  it('refuses language keys that schema.yaml would reject (so the window never writes a schema with problems)', () => {
    expect(() => fieldDefs([{ ...base, labels: { 'Arabic!': 'x' } }])).toThrow()
    expect(() => fieldDefs([{ ...base, optionLabels: { 'not a language': { Draft: 'x' } } }])).toThrow()
  })
  it('caps the number of languages in optionLabels like it caps labels', () => {
    const many = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`l${i}`.slice(0, 16), { Draft: 'x' }]))
    expect(() => fieldDefs([{ ...base, optionLabels: many }])).toThrow()
  })
  it('a "__proto__" key is refused (not a language) and does not change prototypes', () => {
    // builder, 0.15: since QA-08 only language codes are accepted as keys, so "__proto__" is refused
    expect(() => fieldDefs(JSON.parse('[{"id":"status","name":"Status","type":"enum","options":["Draft"],"labels":{"__proto__":"x","ar":"y"}}]'))).toThrow()
    expect(({} as Record<string, unknown>)['x']).toBeUndefined()
  })
})

// ---------------------------------------------------------------- schema.yaml translated names
describe('QA schema labels in odd YAML', () => {
  const head = 'itemTypes:\n  - { id: sys, name: Sys }\n'
  it('an empty "labels:" key is treated like no labels (YAML null), not as a problem', () => {
    const { problems, schema } = parseSchema(`${head}fields:\n  - id: owner\n    name: Owner\n    type: text\n    labels:\n`)
    expect(problems).toEqual([])
    expect(schema.fields[0]?.labels).toBeUndefined()
  })
  it('language codes with region and three letters are accepted; upper case is reported', () => {
    const { problems, schema } = parseSchema(`${head}fields:\n  - { id: o, name: O, type: text, labels: { ar-EG: a, fil: b, AR: c } }\n`)
    expect(schema.fields[0]?.labels).toEqual({ 'ar-EG': 'a', fil: 'b' })
    expect(problems.map((p) => p.path)).toEqual(['fields[0].labels.AR'])
  })
  it('numbers as option names match their optionLabels', () => {
    const { problems, schema } = parseSchema(`${head}fields:\n  - { id: asil, name: ASIL, type: enum, options: [1, 2], optionLabels: { ar: { 1: واحد, 2: اثنان } } }\n`)
    expect(problems).toEqual([])
    expect(schema.fields[0]?.optionLabels?.['ar']?.['1']).toBe('واحد')
  })
  it('optionLabels that are not a mapping are reported per language, the rest kept', () => {
    const { problems, schema } = parseSchema(`${head}fields:\n  - { id: s, name: S, type: enum, options: [A], optionLabels: { ar: { A: أ }, de: [A], X1: { A: b } } }\n`)
    expect(schema.fields[0]?.optionLabels).toEqual({ ar: { A: 'أ' } })
    expect(problems.map((p) => p.path).sort()).toEqual(['fields[0].optionLabels.X1', 'fields[0].optionLabels.de'])
  })
  it('a choice called "constructor" keeps its label as data', () => {
    const { schema } = parseSchema(`${head}fields:\n  - { id: s, name: S, type: enum, options: [constructor], optionLabels: { ar: { constructor: c } } }\n`)
    const m = schema.fields[0]?.optionLabels?.['ar']
    expect(Object.prototype.hasOwnProperty.call(m, 'constructor') && m?.['constructor']).toBe('c')
  })
  it('link type and item type labels: strings only, problems reported, link still usable', () => {
    const { problems, schema } = parseSchema(`${head}linkTypes:\n  - { id: verifies, name: verifies, labels: { ar: 5 }, reverseLabels: nope }\n`)
    expect(schema.linkTypes[0]).toMatchObject({ id: 'verifies', reverseName: 'verifies (reverse)' })
    expect(schema.linkTypes[0]?.labels).toBeUndefined()
    expect(problems.map((p) => p.path).sort()).toEqual(['linkTypes[0].labels.ar', 'linkTypes[0].reverseLabels'])
  })
  it('a very long label and Arabic with right-to-left marks survive parsing', () => {
    const long = 'م'.repeat(2000)
    const { schema } = parseSchema(`${head}fields:\n  - { id: o, name: O, type: text, labels: { ar: "\u200f${long}" } }\n`)
    expect(schema.fields[0]?.labels?.['ar']).toBe(`\u200f${long}`)
  })
})

describe('QA writeSchemaFields keeps translations and the rest of the file', () => {
  const schemaFile = (root: string): string => join(root, 'requirements', '.reqman', 'schema.yaml')
  async function repoWith(yaml: string) {
    const root = await mkdtemp(join(tmpdir(), 'qa-schema-'))
    await store.initialize(root)
    await writeFile(schemaFile(root), yaml)
    return store.open(root)
  }
  const yaml = [
    '# team schema — keep this comment',
    'version: 1',
    'itemTypes:',
    '  - id: sys # system level',
    '    name: System Requirement',
    '    short: SysReq',
    '    labels: { ar: متطلب نظام }',
    'fields:',
    '  - id: status',
    '    name: Status',
    '    type: enum',
    '    options: [Draft, Approved]',
    '    labels: { ar: الحالة }',
    '    optionLabels:',
    '      ar: { Draft: مسودة, Approved: معتمد }',
    'linkTypes:',
    '  - { id: verifies, name: verifies, reverseName: verified by, labels: { ar: يتحقق من }, reverseLabels: { ar: متحقق منه بـ } }',
    ''
  ].join('\n')

  it('round trip through the window keeps item/link type labels, short names and comments', async () => {
    const repo = await repoWith(yaml)
    const fields = fieldDefs(JSON.parse(JSON.stringify(repo.schema.fields)))
    await repo.writeSchemaFields([...fields, { id: 'owner', name: 'Owner', type: 'text', labels: { ar: 'المسؤول' } }], repo.schemaRevision)
    const text = await readFile(schemaFile(repo.root), 'utf8')
    expect(text).toContain('# team schema — keep this comment')
    const { schema, problems } = parseSchema(text)
    expect(problems).toEqual([])
    expect(schema.itemTypes[0]).toMatchObject({ short: 'SysReq', labels: { ar: 'متطلب نظام' } })
    expect(schema.linkTypes[0]).toMatchObject({ labels: { ar: 'يتحقق من' }, reverseLabels: { ar: 'متحقق منه بـ' } })
    expect(schema.fields.find((f) => f.id === 'status')?.optionLabels).toEqual({ ar: { Draft: 'مسودة', Approved: 'معتمد' } })
    expect(schema.fields.find((f) => f.id === 'owner')?.labels).toEqual({ ar: 'المسؤول' })
  })
  it('turning an enum field into text drops its choice labels (no orphan optionLabels in the file)', async () => {
    const repo = await repoWith(yaml)
    await repo.writeSchemaFields([{ id: 'status', name: 'Status', type: 'text', labels: { ar: 'الحالة' }, optionLabels: { ar: { Draft: 'مسودة' } } }], repo.schemaRevision)
    const text = await readFile(schemaFile(repo.root), 'utf8')
    expect(text).not.toContain('optionLabels')
    expect(parseSchema(text).schema.fields[0]?.labels).toEqual({ ar: 'الحالة' })
  })
  it('a label problem elsewhere in schema.yaml (item type) does not stop the user from saving fields', async () => {
    // parseSchema reports label problems and leaves the label out ("reported and left out") — a soft problem
    const repo = await repoWith(yaml.replace('labels: { ar: متطلب نظام }', 'labels: { Arabic: متطلب نظام }'))
    const fields = fieldDefs(JSON.parse(JSON.stringify(repo.schema.fields)))
    await expect(repo.writeSchemaFields([...fields, { id: 'owner', name: 'Owner', type: 'text' }], repo.schemaRevision)).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------- suggestions from the index
describe('QA fieldValues (Owner suggestions)', () => {
  async function indexWith(fields: Record<string, unknown>[]) {
    const root = await mkdtemp(join(tmpdir(), 'qa-fv-'))
    const repo = await store.initialize(root)
    const taken = new Set<string>()
    for (const [n, f] of fields.entries()) {
      const it: Item = { ...repo.createItem('system-requirement', taken, { title: `R${n}` }), fields: f as Item['fields'] }
      taken.add(it.id)
      await repo.writeItem(it)
    }
    const cache = createSqliteIndexCache(join(root, '..', `${root.split(/[\\/]/).pop()}.sqlite`))
    await cache.sync(repo)
    return { repo, cache }
  }
  it('counts list values one by one and numbers as text; limit 0 gives nothing', async () => {
    const { cache } = await indexWith([{ tags: ['a', 'b'] }, { tags: ['b'] }, { tags: ['c'] }])
    expect(cache.fieldValues('tags', 10)).toEqual(['b', 'a', 'c'])
    expect(cache.fieldValues('tags', 0)).toEqual([])
  })
  it('ties sort byte-wise and case-sensitive, the same as everywhere else', async () => {
    const { cache } = await indexWith([{ owner: 'bob' }, { owner: 'Bob' }, { owner: 'alice' }])
    expect(cache.fieldValues('owner', 10)).toEqual(['Bob', 'alice', 'bob'])
  })
  it('never suggests a value that is only spaces', async () => {
    const { cache } = await indexWith([{ owner: '   ' }, { owner: 'Ann' }])
    expect(cache.fieldValues('owner', 10)).toEqual(['Ann'])
  })
  it('the same name with a trailing space is suggested once', async () => {
    const { cache } = await indexWith([{ owner: 'Ann' }, { owner: 'Ann ' }])
    expect(cache.fieldValues('owner', 10)).toEqual(['Ann'])
  })
  it('a field name that looks like SQL is just a name', async () => {
    const { cache } = await indexWith([{ owner: 'Ann' }])
    expect(cache.fieldValues("owner' OR '1'='1", 10)).toEqual([])
  })
  it('follows edits after a sync (a renamed owner disappears from the list)', async () => {
    const { repo, cache } = await indexWith([{ owner: 'Old Name' }])
    const id = cache.query({}).items[0]!.id
    const r = await repo.readItem(id)
    if (!r || !r.ok) throw new Error('unreadable')
    await repo.writeItem({ ...r.item, fields: { owner: 'New Name' } }, { expectedRevision: r.revision })
    await cache.sync(repo)
    expect(cache.fieldValues('owner', 10)).toEqual(['New Name'])
  })
  it('is fast on 5,000 items', async () => {
    const { cache } = await indexWith(Array.from({ length: 5000 }, (_, i) => ({ owner: `Owner ${i % 300}` })))
    const t0 = performance.now()
    const v = cache.fieldValues('owner', 200)
    expect(performance.now() - t0).toBeLessThan(200)
    expect(v).toHaveLength(200)
  }, 180_000)
})

// ---------------------------------------------------------------- Git identity per repository
describe('QA Git identity written per repository', { timeout: 120_000 }, () => {
  let home: string
  const old = { HOME: process.env['HOME'], GIT_CONFIG_GLOBAL: process.env['GIT_CONFIG_GLOBAL'] }
  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'qa-home-'))
    process.env['HOME'] = home
    process.env['GIT_CONFIG_GLOBAL'] = join(home, '.gitconfig')
  })
  afterEach(() => {
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })
  const newRepo = async (): Promise<string> => {
    const root = await mkdtemp(join(tmpdir(), 'qa-id-'))
    sh(root, 'init', '-q', '-b', 'main')
    return root
  }
  const git = createSystemGitAdapter()

  it('a global identity stays untouched; the repository one wins only in this repository', async () => {
    await writeFile(join(home, '.gitconfig'), '[user]\n\tname = Company Name\n\temail = name@company.example\n')
    const a = await newRepo()
    const b = await newRepo()
    await git.setIdentity(a, 'Private', 'private@example.org')
    expect(await readFile(join(home, '.gitconfig'), 'utf8')).toBe('[user]\n\tname = Company Name\n\temail = name@company.example\n')
    expect(await git.identity(a)).toEqual({ name: 'Private', email: 'private@example.org' })
    expect(await git.identity(b)).toEqual({ name: 'Company Name', email: 'name@company.example' })
  })
  it('names with quotes, backslashes, Arabic and a leading dash are stored literally', async () => {
    const root = await newRepo()
    for (const name of ['O"Brien \\ Jr.', 'أحمد حسن', '-Bob', '--global']) {
      await git.setIdentity(root, name, 'x@example.org')
      expect((await git.identity(root)).name, name).toBe(name)
    }
    // builder (CR-05): with no global identity the first name also becomes the Git default; later ones stay local
    expect(await readFile(join(home, '.gitconfig'), 'utf8')).toContain('O\\"Brien')
  })
  it('in a linked worktree the identity lands in the shared repository config, not the global one', async () => {
    const root = await newRepo()
    sh(root, '-c', 'user.name=t', '-c', 'user.email=t@e', 'commit', '-q', '--allow-empty', '-m', 'x')
    const wt = join(await mkdtemp(join(tmpdir(), 'qa-wt-')), 'wt')
    sh(root, 'worktree', 'add', '-q', wt)
    await git.setIdentity(wt, 'Wt User', 'wt@example.org')
    expect(await git.identity(root)).toMatchObject({ name: 'Wt User' })
    expect(await readFile(join(root, '.git', 'config'), 'utf8')).toContain('Wt User')
  })
  it('a folder that is not a Git repository gets a clear failure, not a crash', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qa-nogit-'))
    const userDir = await mkdtemp(join(tmpdir(), 'qa-user-'))
    const ws = createWorkspace({ store, git, openIndex: () => createSqliteIndexCache(join(userDir, 'i.sqlite')), userDir, log: quietLog })
    await ws.initialize(root)
    const r = await ws.setGitIdentity('Bob', 'bob@example.org')
    expect(r.ok).toBe(false)
    await expect(readFile(join(home, '.gitconfig'), 'utf8')).rejects.toThrow()
  })
  it('the workspace trims and refuses an address with spaces or two @', async () => {
    const root = await newRepo()
    const userDir = await mkdtemp(join(tmpdir(), 'qa-user-'))
    const ws = createWorkspace({ store, git, openIndex: () => createSqliteIndexCache(join(userDir, 'i.sqlite')), userDir, log: quietLog })
    await ws.initialize(root)
    expect((await ws.setGitIdentity('Bob', 'bob @example.org')).ok).toBe(false)
    expect((await ws.setGitIdentity('Bob', 'a@b@c')).ok).toBe(false)
    expect((await ws.setGitIdentity('  Bob  ', '  bob@example.org  ')).ok).toBe(true)
    expect(await git.identity(root)).toEqual({ name: 'Bob', email: 'bob@example.org' })
    expect((await ws.gitState()).identity).toEqual({ name: 'Bob', email: 'bob@example.org' })
  })
})
