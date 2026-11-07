// 1a (0.17.0) — documents as folders (the owner, 5 Nov 2026, S-10): requirements/<document>/<ID>.md, each
// document with its own tree and outline numbers; a tree never spans documents.
import { mkdtemp, mkdir, rename, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore, isDocumentName } from '../src/modules/repository-store'
import { createWorkspace, outlineNumbers, type WorkspaceService } from '../src/modules/workspace'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }

async function setup(first?: string): Promise<{ ws: WorkspaceService; root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'rq-docs-'))
  const userDir = await mkdtemp(join(tmpdir(), 'rq-docs-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: () => createSqliteIndexCache(join(userDir, 'index.sqlite')),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
  await ws.initialize(root, first)
  return { ws, root }
}
const add = async (ws: WorkspaceService, title: string, opts: { parent?: string; document?: string } = {}): Promise<string> => {
  const it = { ...ws.newItem('system-requirement', opts.parent, undefined, opts.document), title }
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}

describe('documents are folders (S-10)', () => {
  it('a new project from the window starts with one named document; the core default stays "items"', async () => {
    const { ws } = await setup('Specification')
    expect((await ws.refresh(false)).documents).toEqual([{ name: 'Specification', itemCount: 0 }])
    const { ws: old } = await setup()
    expect((await old.refresh(false)).documents.map((d) => d.name)).toEqual(['items'])
  })

  it('items go into the chosen document; each document numbers its own tree from 1', async () => {
    const { ws, root } = await setup('System')
    await mkdir(join(root, 'requirements', 'Software'))
    await ws.refresh(true)
    const a = await add(ws, 'System one', { document: 'System' })
    const a1 = await add(ws, 'System child', { parent: a })
    const b = await add(ws, 'Software one', { document: 'Software' })
    const info = await ws.refresh(false)
    expect(info.documents).toEqual([
      { name: 'Software', itemCount: 1 },
      { name: 'System', itemCount: 2 }
    ])
    expect(ws.query({ document: 'Software' }).items.map((i) => i.title)).toEqual(['Software one'])
    expect(ws.query({ document: 'System', parent: null }).items.map((i) => i.title)).toEqual(['System one'])
    const n = ws.query({ document: 'System' }).items
    expect(n.find((i) => i.id === a1)?.path).toBe(`System/${a1}.md`)
    // numbers restart per document
    const num = (id: string): string | undefined => ws.query({}).items.find((i) => i.id === id)?.number
    expect([num(a), num(a1), num(b)]).toEqual(['1', '1.1', '1'])
  })

  it('a parent from another document is refused, on save and on move', async () => {
    const { ws, root } = await setup('A')
    await mkdir(join(root, 'requirements', 'B'))
    await ws.refresh(true)
    const inA = await add(ws, 'in A', { document: 'A' })
    const inB = await add(ws, 'in B', { document: 'B' })
    const r = await ws.reparentItem(inB, inA)
    expect(r.ok).toBe(false)
    const d = await ws.getItem(inB)
    const s = await ws.saveItem({ ...(d?.item as NonNullable<typeof d>['item']), parent: inA }, d?.revision ?? null)
    expect(s.ok).toBe(false)
  })

  it('a project made before 0.17 (requirements/items) is one document named "items" and keeps working', async () => {
    const { ws, root } = await setup()
    const x = await add(ws, 'old style')
    expect(ws.query({}).items[0]?.path).toBe(`items/${x}.md`)
    await rename(join(root, 'requirements', 'items'), join(root, 'requirements', 'Brakes'))
    await ws.refresh(true)
    expect((await ws.refresh(false)).documents).toEqual([{ name: 'Brakes', itemCount: 1 }])
    expect(ws.query({}).items[0]?.path).toBe(`Brakes/${x}.md`)
  })

  it('a loose item file directly in requirements/ is read and listed as the document ""', async () => {
    const { ws, root } = await setup('Spec')
    await writeFile(join(root, 'requirements', 'REQ-LOOSE01.md'), '---\nid: REQ-LOOSE01\ntype: system-requirement\ntitle: Loose\n---\n')
    await writeFile(join(root, 'requirements', 'README.md'), '# not an item\n')
    await ws.refresh(true)
    expect((await ws.refresh(false)).documents).toContainEqual({ name: '', itemCount: 1 })
    expect(ws.query({ document: '' }).items.map((i) => i.id)).toEqual(['REQ-LOOSE01'])
  })

  it('outlineNumbers keeps documents apart; document names are plain folder names', () => {
    const m = outlineNumbers([
      { id: 'a', document: 'X' },
      { id: 'b', document: 'Y' },
      { id: 'c', document: 'X' },
      { id: 'd', parent: 'c', document: 'X' }
    ])
    expect([...m]).toEqual([['a', '1'], ['c', '2'], ['d', '2.1'], ['b', '1']])
    expect(['Specification', 'Brake system', 'items'].every(isDocumentName)).toBe(true)
    expect(['', '.hidden', 'a/b', 'a\\b', 'x:y', 'trailing.'].some(isDocumentName)).toBe(false)
  })
})

describe('required fields per item type (S-05)', () => {
  it('an item missing one is saved, marked incomplete and found by the "incomplete" filter', async () => {
    const { readFile } = await import('node:fs/promises')
    const { ws, root } = await setup('Spec')
    const schemaFile = join(root, 'requirements', '.reqochet', 'schema.yaml')
    const text = (await readFile(schemaFile, 'utf8')).replace('name: System Requirement, short: SysReq,', 'name: System Requirement, short: SysReq, required: [priority, text],')
    await writeFile(schemaFile, text)
    await ws.refresh(true)
    const it = { ...ws.newItem('system-requirement', undefined, undefined, 'Spec'), title: 'No priority', fields: {} }
    const r = await ws.saveItem(it, null)
    expect(r.ok).toBe(true)
    const d = await ws.getItem(it.id)
    expect(d?.issues.filter((i) => i.path === 'required').map((i) => i.severity)).toEqual(['warning', 'warning'])
    const done = { ...ws.newItem('system-requirement', undefined, undefined, 'Spec'), title: 'Complete', text: 'x', fields: { priority: 'High' } }
    expect((await ws.saveItem(done, null)).ok).toBe(true)
    expect(ws.query({ incomplete: true }).items.map((i) => i.title)).toEqual(['No priority'])
  })
})

describe('the window\'s query keeps the document and the incomplete filter (validator)', () => {
  it('passes document and incomplete, drops a required map sent by the window', async () => {
    const v = await import('../src/main/validate')
    expect(v.query({ document: 'Spec', incomplete: true, required: { x: ['y'] } })).toEqual({ document: 'Spec', incomplete: true })
    expect(v.query({ document: '' })).toEqual({ document: '' })
  })
})

describe('item and link types edited in the window (S-04)', () => {
  it('renames and adds types, keeps other keys and comments, refuses to remove a used type', async () => {
    const { readFile } = await import('node:fs/promises')
    const { ws, root } = await setup('Spec')
    const schemaFile = join(root, 'requirements', '.reqochet', 'schema.yaml')
    let info = await ws.refresh(false)
    await add(ws, 'uses system-requirement', { document: 'Spec' })
    const usage = ws.typeUsage()
    expect(usage.items['system-requirement']).toBe(1)
    // removing a used type is refused
    const without = info.schema.itemTypes.filter((t) => t.id !== 'system-requirement')
    const refused = await ws.saveSchemaTypes(without, info.schema.linkTypes, info.schemaRevision)
    expect(refused.ok).toBe(false)
    // rename one, add one item type with required fields and one link type
    const items = info.schema.itemTypes.map((t) => (t.id === 'risk' ? { ...t, name: 'Hazard' } : t)).concat([{ id: 'safety-goal', name: 'Safety Goal', requirement: true, required: ['priority'] }])
    const links = [...info.schema.linkTypes, { id: 'derives', name: 'derives', reverseName: 'derived from' }]
    const ok = await ws.saveSchemaTypes(items, links, info.schemaRevision)
    expect(ok.ok).toBe(true)
    if (!ok.ok) return
    info = ok.info
    expect(info.schema.itemTypes.find((t) => t.id === 'risk')?.name).toBe('Hazard')
    expect(info.schema.itemTypes.find((t) => t.id === 'safety-goal')?.required).toEqual(['priority'])
    expect(info.schema.linkTypes.some((l) => l.id === 'derives')).toBe(true)
    const text = await readFile(schemaFile, 'utf8')
    expect(text).toContain('# Headings and explanatory text') // the comment stays
    expect(text).toContain('labels: { ar: متطلب نظام }') // translated names stay
    // removing an unused type works
    const fewer = await ws.saveSchemaTypes(info.schema.itemTypes.filter((t) => t.id !== 'safety-goal'), info.schema.linkTypes.filter((l) => l.id !== 'derives'), info.schemaRevision)
    expect(fewer.ok).toBe(true)
  })

  it('the window validator accepts plain types and refuses odd ids', async () => {
    const v = await import('../src/main/validate')
    expect(v.itemTypeDefs([{ id: 'goal', name: 'Goal', requirement: false, short: 'G', labels: { ar: 'هدف' }, required: ['status'] }])).toEqual([{ id: 'goal', name: 'Goal', requirement: false, short: 'G', labels: { ar: 'هدف' }, required: ['status'] }])
    expect(v.linkTypeDefs([{ id: 'derives', name: 'derives', reverseName: 'derived from' }])).toEqual([{ id: 'derives', name: 'derives', reverseName: 'derived from' }])
    expect(() => v.itemTypeDefs([{ id: 'Bad Id', name: 'x' }])).toThrow()
    expect(() => v.linkTypeDefs('nope')).toThrow()
  })
})

describe('creating and renaming documents (S-10)', () => {
  it('a new document is an empty folder; renaming moves the items in one commit with their history', async () => {
    const { execFileSync } = await import('node:child_process')
    const root = await mkdtemp(join(tmpdir(), 'rq-docgit-'))
    const sh = (...a: string[]): string => execFileSync('git', a, { cwd: root, encoding: 'utf8' })
    sh('init', '-q', '-b', 'main')
    sh('config', 'user.name', 'Tester')
    sh('config', 'user.email', 'tester@example.com')
    const userDir = await mkdtemp(join(tmpdir(), 'rq-docgit-user-'))
    const ws = createWorkspace({
      store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
      git: createSystemGitAdapter(),
      openIndex: () => createSqliteIndexCache(join(userDir, 'index.sqlite')),
      userDir,
      log: quiet,
      watchFiles: false
    } as Parameters<typeof createWorkspace>[0])
    await ws.initialize(root) // the core default: requirements/items (a project made before 0.17)
    const id = await add(ws, 'kept history')
    sh('add', '-A')
    sh('commit', '-q', '-m', 'start')
    expect((await ws.createDocument('a/b')).ok).toBe(false)
    const made = await ws.createDocument('Software')
    expect(made.ok && made.info.documents.map((d) => d.name)).toEqual(['Software', 'items'])
    expect((await ws.createDocument('software')).ok).toBe(false) // same name, other case
    const renamed = await ws.renameDocument('items', 'System')
    expect(renamed.ok).toBe(true)
    expect(sh('log', '-1', '--format=%s')).toContain('Rename the document items to System')
    expect(ws.query({ document: 'System' }).items.map((i) => i.id)).toEqual([id])
    expect(sh('log', '--follow', '--format=%s', '--', `requirements/System/${id}.md`)).toContain('start')
  })
})
