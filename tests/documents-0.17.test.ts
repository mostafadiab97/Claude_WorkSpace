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
