// 0.17.0 — fixes from the helper review of 1a (docs/reviews/agents/0.17.0-code-reviewer.md, 0.17.0-qa-tester.md).
import { mkdtemp, mkdir, readdir, rename, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore, isDocumentName } from '../src/modules/repository-store'
import { createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }

async function setup(first = 'Spec'): Promise<{ ws: WorkspaceService; root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'rq-rev17-'))
  const userDir = await mkdtemp(join(tmpdir(), 'rq-rev17-user-'))
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

describe('0.17.0 review fixes', () => {
  it('CR-05: export of the Incomplete filter gives the incomplete items, as the table shows', async () => {
    const { ws } = await setup()
    const info = await ws.refresh(false)
    const types = info.schema.itemTypes.map((t) => (t.id === 'system-requirement' ? { ...t, required: ['text'] } : t))
    expect((await ws.saveSchemaTypes(types, info.schema.linkTypes, info.schemaRevision)).ok).toBe(true)
    const empty = await add(ws, 'no text')
    const full = { ...ws.newItem('system-requirement'), title: 'with text', text: 'body' }
    expect((await ws.saveItem(full, null)).ok).toBe(true)
    expect(ws.query({ incomplete: true }).items.map((i) => i.id)).toEqual([empty])
    const r = await ws.exportItems({ scope: 'filtered', format: 'csv', columns: ['id', 'title'], query: { incomplete: true } } as Parameters<WorkspaceService['exportItems']>[0])
    expect(r.count).toBe(1)
    expect(String(r.content)).toContain(empty)
    expect(String(r.content)).not.toContain(full.id)
  })

  it('CR-10 / CR-17: a child of a loose item stays loose (no folder is made for it)', async () => {
    const { ws, root } = await setup()
    const parent = await add(ws, 'parent')
    await rename(join(root, 'requirements', 'Spec', `${parent}.md`), join(root, 'requirements', `${parent}.md`))
    await ws.refresh(true)
    const child = await add(ws, 'child', { parent })
    expect(await readdir(join(root, 'requirements'))).toContain(`${child}.md`)
    expect(ws.query({ document: '' }).items.map((i) => i.id).sort()).toEqual([parent, child].sort())
  })

  it('CR-14: a README.md in requirements/ or in a document folder is not an item', async () => {
    const { ws, root } = await setup()
    await writeFile(join(root, 'requirements', 'README.md'), '# notes\n')
    await writeFile(join(root, 'requirements', 'Spec', 'README.md'), '# notes\n')
    const info = await ws.refresh(true)
    expect(ws.query({}).total).toBe(0)
    expect(info.issues).toEqual([])
  })

  it('CR-22: All documents lists each document\'s top level together, documents in name order', async () => {
    const { ws, root } = await setup('B')
    await mkdir(join(root, 'requirements', 'A'))
    await ws.refresh(true)
    const b1 = await add(ws, 'b1', { document: 'B' })
    const a1 = await add(ws, 'a1', { document: 'A' })
    const b2 = await add(ws, 'b2', { document: 'B' })
    const a2 = await add(ws, 'a2', { document: 'A' })
    expect(ws.query({ parent: null, sort: { by: 'order' } }).items.map((i) => i.id)).toEqual([a1, a2, b1, b2])
  })

  it('QA-01: Windows device names are not document names', () => {
    for (const n of ['CON', 'prn', 'Aux', 'NUL', 'com1', 'LPT9', 'con.txt']) expect(isDocumentName(n), n).toBe(false)
    for (const n of ['Console', 'Compliance', 'Spec']) expect(isDocumentName(n), n).toBe(true)
  })

  it('CR-19: a type id must start with a letter', async () => {
    const { ws } = await setup()
    const info = await ws.refresh(false)
    const r = await ws.saveSchemaTypes([...info.schema.itemTypes, { id: '1-type', name: 'N', requirement: true }], info.schema.linkTypes, info.schemaRevision).catch(() => ({ ok: false }))
    expect(r.ok).toBe(false)
  })
})
