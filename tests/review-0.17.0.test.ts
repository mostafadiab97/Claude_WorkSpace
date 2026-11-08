// 0.17.0 — fixes from the helper review of 1a (docs/reviews/agents/0.17.0-code-reviewer.md, 0.17.0-qa-tester.md).
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readdir, rename, symlink, writeFile } from 'node:fs/promises'
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

  it('SEC-17-04: invisible format characters and superscript device names are refused', () => {
    for (const n of ['Spec\u202Eabc', 'a\u200Bb', 'x\u2066y', 'COM¹', 'lpt³']) expect(isDocumentName(n), JSON.stringify(n)).toBe(false)
    expect(isDocumentName('مستند النظام')).toBe(true)
  })

  it('SEC-17-03: an item file that is a link is not read', async () => {
    const { ws, root } = await setup()
    const outside = join(await mkdtemp(join(tmpdir(), 'rq-outside-')), 'secret.md')
    await writeFile(outside, '---\nid: REQ-OUTSIDE\ntype: system-requirement\ntitle: secret\n---\n')
    await symlink(outside, join(root, 'requirements', 'Spec', 'REQ-OUTSIDE.md')).catch(() => undefined)
    await ws.refresh(true)
    expect(ws.query({}).items.map((i) => i.id)).not.toContain('REQ-OUTSIDE')
  })

  it('PERF-02: item counts per document come from one query and match the documents', async () => {
    const { ws, root } = await setup('A')
    await mkdir(join(root, 'requirements', 'B'))
    await ws.refresh(true)
    await add(ws, 'a', { document: 'A' })
    await add(ws, 'b1', { document: 'B' })
    await add(ws, 'b2', { document: 'B' })
    expect((await ws.refresh(false)).documents).toEqual([
      { name: 'A', itemCount: 1 },
      { name: 'B', itemCount: 2 }
    ])
    // the document range filter does not take "B2" for "B"
    await mkdir(join(root, 'requirements', 'B2'))
    await ws.refresh(true)
    await add(ws, 'other', { document: 'B2' })
    expect(ws.query({ document: 'B' }).total).toBe(2)
  })

  it('SEC-17-01: Git paths are literal — a loose "X[1]" moved into a document does not commit Doc/X1.md', async () => {
    const { ws, root } = await setup('Doc')
    const sh = (...a: string[]): string => execFileSync('git', a, { cwd: root, encoding: 'utf8' })
    sh('init', '-q')
    sh('config', 'user.name', 'T')
    sh('config', 'user.email', 't@example.invalid')
    await writeFile(join(root, 'requirements', 'Doc', 'X1.md'), '---\nid: X1\ntype: system-requirement\ntitle: one\n---\n')
    await writeFile(join(root, 'requirements', 'X[1].md'), '---\nid: X[1]\ntype: system-requirement\ntitle: loose\n---\n')
    sh('add', '-A')
    sh('commit', '-qm', 'start')
    await writeFile(join(root, 'requirements', 'Doc', 'X1.md'), '---\nid: X1\ntype: system-requirement\ntitle: one, edited\n---\n')
    await ws.open(root) // now a Git repository
    const r = await ws.renameDocument('', 'Doc')
    expect(r.ok).toBe(true)
    expect(sh('log', '--oneline').trim().split('\n')).toHaveLength(2) // the move was committed
    expect(sh('status', '--porcelain')).toContain('requirements/Doc/X1.md') // still uncommitted
  })
})
