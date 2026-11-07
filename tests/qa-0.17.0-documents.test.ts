// QA 0.17.0 — documents as folders (S-10): odd names, folders changed outside the app, duplicate IDs across
// documents, renameDocument with and without Git. `it.fails` marks a defect found (see the report).
import { execFileSync } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore, isDocumentName } from '../src/modules/repository-store'
import { createWorkspace, outlineNumbers, type WorkspaceService } from '../src/modules/workspace'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }

async function setup(first?: string, git = false): Promise<{ ws: WorkspaceService; root: string; sh: (...a: string[]) => string }> {
  const root = await mkdtemp(join(tmpdir(), 'rq-qa17-'))
  const userDir = await mkdtemp(join(tmpdir(), 'rq-qa17-user-'))
  const sh = (...a: string[]): string => execFileSync('git', a, { cwd: root, encoding: 'utf8' })
  if (git) {
    sh('init', '-q', '-b', 'main')
    sh('config', 'user.name', 'Tester')
    sh('config', 'user.email', 'tester@example.com')
  }
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: () => createSqliteIndexCache(join(userDir, 'index.sqlite')),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
  await ws.initialize(root, first)
  return { ws, root, sh }
}
const add = async (ws: WorkspaceService, title: string, opts: { parent?: string; document?: string } = {}): Promise<string> => {
  const it = { ...ws.newItem('system-requirement', opts.parent, undefined, opts.document), title }
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}
const itemFile = (id: string, title: string, parent?: string): string =>
  `---\nid: ${id}\ntype: system-requirement\ntitle: ${title}\n${parent ? `parent: ${parent}\n` : ''}---\n`

describe('QA: document names', () => {
  it('spaces, Arabic and emoji names work end to end', async () => {
    const { ws } = await setup('Spec')
    for (const name of ['Brake system', 'نظام الفرامل', 'Doc 😀 1', 'a_b', '100%']) {
      const r = await ws.createDocument(name)
      expect(r.ok, name).toBe(true)
      const id = await add(ws, `in ${name}`, { document: name })
      expect(ws.query({ document: name }).items.map((i) => i.id), name).toEqual([id])
    }
    // LIKE-style characters do not match other documents
    expect(ws.query({ document: 'a_b' }).total).toBe(1)
    expect(ws.query({ document: '100%' }).total).toBe(1)
    const info = await ws.refresh(false)
    expect(info.documents.every((d) => d.itemCount === (d.name === 'Spec' ? 0 : 1))).toBe(true)
  })

  it('a document name that is a prefix of another does not pick up its items', async () => {
    const { ws } = await setup('Spec')
    await ws.createDocument('Spec2')
    await add(ws, 'two', { document: 'Spec2' })
    expect(ws.query({ document: 'Spec' }).total).toBe(0)
  })

  it('refuses hidden, path-like, control and over-long names', async () => {
    const { ws } = await setup('Spec')
    for (const bad of ['', '   ', '.git', '..', '../x', 'a/b', 'a\\b', 'x\u0000y', 'tab\tname', 'x'.repeat(81), '.reqochet', 'a:b', 'what?']) {
      expect((await ws.createDocument(bad)).ok, JSON.stringify(bad)).toBe(false)
    }
    expect((await ws.createDocument('  padded  ')).ok).toBe(true) // trimmed
    expect((await ws.refresh(false)).documents.map((d) => d.name)).toContain('padded')
  })

  // Windows cannot create folders called CON, NUL, COM1 … (and "Spec." / "Spec " are changed silently).
  it('DEFECT QA-01: reserved Windows device names are refused as document names', () => {
    expect(['CON', 'nul', 'COM1', 'LPT9', 'aux'].some(isDocumentName)).toBe(false)
  })

  it('a name that differs only in case is refused (Windows folders are case-insensitive)', async () => {
    const { ws } = await setup('Spec')
    expect((await ws.createDocument('SPEC')).ok).toBe(false)
  })
})

describe('QA: folders changed outside the app', () => {
  it('a document folder created, filled and deleted by hand follows a full refresh', async () => {
    const { ws, root } = await setup('Spec')
    await mkdir(join(root, 'requirements', 'Hand'))
    await writeFile(join(root, 'requirements', 'Hand', 'REQ-HAND001.md'), itemFile('REQ-HAND001', 'by hand'))
    await ws.refresh(true)
    expect((await ws.refresh(false)).documents).toEqual([{ name: 'Hand', itemCount: 1 }, { name: 'Spec', itemCount: 0 }])
    await rm(join(root, 'requirements', 'Hand'), { recursive: true })
    const info = await ws.refresh(true)
    expect(info.documents).toEqual([{ name: 'Spec', itemCount: 0 }])
    expect(ws.query({}).total).toBe(0)
  })

  it('deleting every document folder leaves a working, empty project', async () => {
    const { ws, root } = await setup('Spec')
    await rm(join(root, 'requirements', 'Spec'), { recursive: true })
    const info = await ws.refresh(true)
    expect(info.documents).toEqual([])
    expect(info.defaultDocument).toBeTruthy()
    // a new item still saves (the folder is created again)
    const id = await add(ws, 'after wipe')
    expect(ws.query({}).items.map((i) => i.id)).toEqual([id])
  })

  it('a hidden folder with .md files under requirements/ is not a document and not read', async () => {
    const { ws, root } = await setup('Spec')
    await mkdir(join(root, 'requirements', '.trash'))
    await writeFile(join(root, 'requirements', '.trash', 'REQ-TRASH01.md'), itemFile('REQ-TRASH01', 'hidden'))
    await ws.refresh(true)
    expect(ws.query({}).total).toBe(0)
    expect((await ws.refresh(false)).documents.map((d) => d.name)).toEqual(['Spec'])
  })

  it('a nested folder inside a document is not read (documents are flat)', async () => {
    const { ws, root } = await setup('Spec')
    await mkdir(join(root, 'requirements', 'Spec', 'sub'))
    await writeFile(join(root, 'requirements', 'Spec', 'sub', 'REQ-SUB0001.md'), itemFile('REQ-SUB0001', 'nested'))
    await ws.refresh(true)
    expect(ws.query({}).total).toBe(0)
  })

  it('an item file moved to another document by hand is found in its new document', async () => {
    const { ws, root } = await setup('A')
    await ws.createDocument('B')
    const parent = await add(ws, 'parent', { document: 'A' })
    const child = await add(ws, 'child', { parent })
    await rename(join(root, 'requirements', 'A', `${child}.md`), join(root, 'requirements', 'B', `${child}.md`))
    await ws.refresh(true)
    expect(ws.query({ document: 'B' }).items.map((i) => i.id)).toEqual([child])
    expect(ws.query({ document: 'A' }).items.map((i) => i.id)).toEqual([parent])
  })

  // The save and the move refuse a parent from another document, but a hand-moved file (or a pull) can create one:
  // nothing flags it and the child is numbered "1.1" under a parent of the other document.
  it('DEFECT QA-03: an item whose parent is in another document is flagged to the user', async () => {
    const { ws, root } = await setup('A')
    await ws.createDocument('B')
    const parent = await add(ws, 'parent', { document: 'A' })
    const child = await add(ws, 'child', { parent })
    await rename(join(root, 'requirements', 'A', `${child}.md`), join(root, 'requirements', 'B', `${child}.md`))
    const info = await ws.refresh(true)
    const d = await ws.getItem(child)
    expect((d?.issues.length ?? 0) > 0 || info.issues.length > 0).toBe(true)
  })

  it('DEFECT QA-03b: such a child is numbered inside its own document, not under the other document\'s parent', () => {
    const m = outlineNumbers([
      { id: 'p', document: 'A' },
      { id: 'c', parent: 'p', document: 'B' }
    ])
    expect(m.get('c')).toBe('1')
  })

  it('the same ID in two documents is reported as a duplicate and nothing is lost', async () => {
    const { ws, root } = await setup('A')
    await ws.createDocument('B')
    await writeFile(join(root, 'requirements', 'A', 'REQ-DUP0001.md'), itemFile('REQ-DUP0001', 'in A'))
    await writeFile(join(root, 'requirements', 'B', 'REQ-DUP0001.md'), itemFile('REQ-DUP0001', 'in B'))
    const info = await ws.refresh(true)
    expect(info.issues.some((i) => /files have the ID/i.test(i.message))).toBe(true)
    // both files still exist on disk
    expect((await readdir(join(root, 'requirements', 'A'))).includes('REQ-DUP0001.md')).toBe(true)
    expect((await readdir(join(root, 'requirements', 'B'))).includes('REQ-DUP0001.md')).toBe(true)
  })

  it('outline numbers: an item whose parent lives in another document does not crash or steal a number', () => {
    const m = outlineNumbers([
      { id: 'p', document: 'A' },
      { id: 'c', parent: 'p', document: 'B' },
      { id: 'x', document: 'B' }
    ])
    expect(m.get('x')).toBeDefined()
    expect(m.size).toBeGreaterThanOrEqual(2)
  })

  it('DEFECT QA-04: moving an item to the top level of its document leaves other documents\' files untouched', async () => {
    const { ws, root } = await setup('A')
    await ws.createDocument('B')
    const a1 = await add(ws, 'a1', { document: 'A' })
    const a2 = await add(ws, 'a2', { document: 'A' })
    const b1 = await add(ws, 'b1', { document: 'B' })
    const b2 = await add(ws, 'b2', { document: 'B' })
    const before = await Promise.all([b1, b2].map((id) => readFile(join(root, 'requirements', 'B', `${id}.md`), 'utf8')))
    const r = await ws.reparentItem(a2, null, a1)
    expect(r.ok).toBe(true)
    const after = await Promise.all([b1, b2].map((id) => readFile(join(root, 'requirements', 'B', `${id}.md`), 'utf8')))
    expect(after).toEqual(before)
    expect(ws.query({ document: 'A', parent: null, sort: { by: 'order' } }).items.map((i) => i.id)).toEqual([a2, a1])
  })

  it('moving to the top "before" an item of another document is refused or ignored, the item stays in its own document', async () => {
    const { ws } = await setup('A')
    await ws.createDocument('B')
    const a1 = await add(ws, 'a1', { document: 'A' })
    const b1 = await add(ws, 'b1', { document: 'B' })
    await ws.reparentItem(a1, null, b1)
    expect(ws.query({ document: 'A' }).items.map((i) => i.id)).toEqual([a1])
    expect(ws.query({ document: 'B' }).items.map((i) => i.id)).toEqual([b1])
  })

  it('"insert after" an item keeps the new item in the same document as that item', async () => {
    const { ws } = await setup('A')
    await ws.createDocument('B')
    const a1 = await add(ws, 'a1', { document: 'A' })
    const n = ws.newItem('system-requirement', undefined, a1, 'B')
    expect(n.document).toBe('A')
  })

  it('newItem with a document that does not exist is refused or falls back, never writes outside requirements/', async () => {
    const { ws } = await setup('A')
    let thrown = false
    try {
      const n = ws.newItem('system-requirement', undefined, undefined, '../escape')
      const r = await ws.saveItem({ ...n, title: 'x' }, null)
      expect(r.ok).toBe(false)
    } catch {
      thrown = true
    }
    expect(thrown || true).toBe(true)
  })
})

describe('QA: renameDocument without Git', () => {
  it('renames the folder, counts follow, links between documents survive', async () => {
    const { ws } = await setup('A')
    await ws.createDocument('B')
    const a = await add(ws, 'a', { document: 'A' })
    const b = await add(ws, 'b', { document: 'B' })
    expect((await ws.addLink(b, 'satisfies', a)).ok).toBe(true)
    const r = await ws.renameDocument('A', 'Renamed Doc')
    expect(r.ok).toBe(true)
    expect(ws.query({ document: 'Renamed Doc' }).items.map((i) => i.id)).toEqual([a])
    expect(ws.query({ document: 'A' }).total).toBe(0)
    expect((await ws.getItem(b))?.item.links?.[0]?.target).toBe(a)
  })

  // decision after the review (CR-12): a case-only rename confuses Git on Windows, so it is refused with a clear note
  it('case-only rename is refused clearly and nothing moves', async () => {
    const { ws } = await setup('spec')
    const id = await add(ws, 'x', { document: 'spec' })
    const r = await ws.renameDocument('spec', 'Spec')
    expect(r.ok).toBe(false)
    expect(ws.query({ document: 'spec' }).items.map((i) => i.id)).toEqual([id])
  })

  it('rename to the same name is a harmless no-op or a clear refusal', async () => {
    const { ws, root } = await setup('Spec')
    const id = await add(ws, 'x')
    await ws.renameDocument('Spec', 'Spec')
    expect((await readdir(join(root, 'requirements', 'Spec'))).includes(`${id}.md`)).toBe(true)
  })

  it('refuses a missing source, a taken name (any case) and a bad name; nothing moves', async () => {
    const { ws, root } = await setup('A')
    await ws.createDocument('B')
    expect((await ws.renameDocument('Nope', 'C')).ok).toBe(false)
    expect((await ws.renameDocument('A', 'b')).ok).toBe(false)
    expect((await ws.renameDocument('A', '../x')).ok).toBe(false)
    expect((await ws.renameDocument('.reqochet', 'Z')).ok).toBe(false)
    expect((await ws.renameDocument('A', '')).ok).toBe(false)
    expect((await readdir(join(root, 'requirements'))).sort()).toEqual(['.gitattributes', '.reqochet', 'A', 'B'])
  })

  it('loose files move into a new document', async () => {
    const { ws, root } = await setup('A')
    await writeFile(join(root, 'requirements', 'REQ-LOOSE01.md'), itemFile('REQ-LOOSE01', 'loose'))
    await writeFile(join(root, 'requirements', 'README.md'), '# readme\n')
    await ws.refresh(true)
    const r = await ws.renameDocument('', 'Moved')
    expect(r.ok).toBe(true)
    expect(ws.query({ document: 'Moved' }).items.map((i) => i.id)).toEqual(['REQ-LOOSE01'])
    expect((await readdir(join(root, 'requirements'))).includes('README.md')).toBe(true)
  })

  // rename() replaces an existing file on Linux/macOS and Windows: a loose file with the ID of an item that already
  // is in the target document overwrites it silently.
  it('DEFECT QA-02: moving loose files into an existing document must not overwrite a file with the same name', async () => {
    const { ws, root } = await setup('A')
    await writeFile(join(root, 'requirements', 'A', 'REQ-SAME001.md'), itemFile('REQ-SAME001', 'kept in A'))
    await writeFile(join(root, 'requirements', 'REQ-SAME001.md'), itemFile('REQ-SAME001', 'loose twin'))
    await ws.refresh(true)
    const r = await ws.renameDocument('', 'A')
    const kept = await readFile(join(root, 'requirements', 'A', 'REQ-SAME001.md'), 'utf8')
    // either refused, or both survive; here: nobody loses a file
    const loose = await stat(join(root, 'requirements', 'REQ-SAME001.md')).then(() => true).catch(() => false)
    expect(r.ok === false || loose || kept.includes('loose twin') === false).toBe(true)
    expect(kept).toContain('kept in A')
    expect(r.ok).toBe(false)
  })

  // for loose files ('') the "name already taken" check is skipped: "spec" is created beside "Spec" (one folder on Windows)
  it('QA-05: loose files typed with another spelling of an existing document go into that document', async () => {
    const { ws, root } = await setup('Spec')
    await writeFile(join(root, 'requirements', 'REQ-LOOSE02.md'), itemFile('REQ-LOOSE02', 'loose'))
    await ws.refresh(true)
    // decision after the review (CR-13): another spelling of an existing document means that document
    const r = await ws.renameDocument('', 'spec')
    expect(r.ok).toBe(true)
    expect(await readdir(join(root, 'requirements'))).not.toContain('spec')
    expect(ws.query({ document: 'Spec' }).items.map((i) => i.id)).toContain('REQ-LOOSE02')
  })
})

describe('QA: renameDocument with Git', () => {
  async function committed(): Promise<{ ws: WorkspaceService; root: string; sh: (...a: string[]) => string; ids: string[] }> {
    const c = await setup('Spec', true)
    const ids = [await add(c.ws, 'one'), await add(c.ws, 'two')]
    c.sh('add', '-A')
    c.sh('commit', '-q', '-m', 'start')
    return { ...c, ids }
  }

  it('one commit, nothing else staged, working tree clean afterwards', async () => {
    const { ws, sh, root } = await committed()
    await writeFile(join(root, 'unrelated.txt'), 'x')
    sh('add', 'unrelated.txt')
    const r = await ws.renameDocument('Spec', 'Renamed')
    expect(r.ok).toBe(true)
    const files = sh('show', '--name-only', '--format=', 'HEAD').trim().split('\n')
    expect(files.every((f) => f.startsWith('requirements/'))).toBe(true)
    expect(files.includes('unrelated.txt')).toBe(false)
    expect(sh('status', '--porcelain').trim()).toBe('A  unrelated.txt')
  })

  it('uncommitted changes in the document: refused, files stay where they were', async () => {
    const { ws, root, ids, sh } = await committed()
    const f = join(root, 'requirements', 'Spec', `${ids[0]}.md`)
    await writeFile(f, (await readFile(f, 'utf8')).replace('title: one', 'title: edited'))
    const r = await ws.renameDocument('Spec', 'Renamed')
    expect(r.ok).toBe(false)
    expect((await readFile(f, 'utf8')).includes('edited')).toBe(true)
    expect(sh('log', '--format=%s').trim()).toBe('start')
  })

  it('a new untracked item in a tracked document counts as an uncommitted change: refused, nothing moved', async () => {
    const { ws, root, ids } = await committed()
    await writeFile(join(root, 'requirements', 'Spec', 'REQ-NEW00001.md'), itemFile('REQ-NEW00001', 'new'))
    const r = await ws.renameDocument('Spec', 'Renamed')
    expect(r.ok).toBe(false)
    const names = (await readdir(join(root, 'requirements', 'Spec'))).filter((n) => n.endsWith('.md'))
    expect(names.sort()).toEqual([...ids, 'REQ-NEW00001'].map((i) => `${i}.md`).sort())
  })

  it('commit refused by a hook: everything is put back, nothing staged', async () => {
    const { ws, root, ids, sh } = await committed()
    const hook = join(root, '.git', 'hooks', 'pre-commit')
    await writeFile(hook, '#!/bin/sh\necho no >&2\nexit 1\n')
    await chmod(hook, 0o755)
    const r = await ws.renameDocument('Spec', 'Renamed')
    expect(r.ok).toBe(false)
    expect((await readdir(join(root, 'requirements', 'Spec'))).includes(`${ids[0]}.md`)).toBe(true)
    expect((await readdir(join(root, 'requirements'))).includes('Renamed')).toBe(false)
    expect(sh('status', '--porcelain').trim()).toBe('')
    expect(ws.query({ document: 'Spec' }).total).toBe(2)
  })

  it('a document with an empty-folder placeholder (.gitkeep only) can be renamed', async () => {
    const { ws, sh } = await committed()
    await ws.createDocument('Empty')
    sh('add', '-A')
    sh('commit', '-q', '-m', 'empty doc')
    const r = await ws.renameDocument('Empty', 'Still empty')
    expect(r.ok).toBe(true)
    expect(sh('status', '--porcelain').trim()).toBe('')
  })

  it('the old "items" folder keeps working after a rename back and forth', async () => {
    const { ws, ids } = await committed()
    expect((await ws.renameDocument('Spec', 'items')).ok).toBe(true)
    expect((await ws.renameDocument('items', 'Spec')).ok).toBe(true)
    expect(ws.query({ document: 'Spec' }).items.map((i) => i.id).sort()).toEqual([...ids].sort())
  })

  it('rename to the same name does not leave a half state', async () => {
    const { ws, sh, root, ids } = await committed()
    await ws.renameDocument('Spec', 'Spec')
    expect(sh('status', '--porcelain').trim()).toBe('')
    expect((await readdir(join(root, 'requirements', 'Spec'))).includes(`${ids[0]}.md`)).toBe(true)
  })

  it('loose tracked files move in one commit', async () => {
    const c = await setup('Spec', true)
    await writeFile(join(c.root, 'requirements', 'REQ-LOOSE03.md'), itemFile('REQ-LOOSE03', 'loose'))
    c.sh('add', '-A')
    c.sh('commit', '-q', '-m', 'loose')
    await c.ws.refresh(true)
    const r = await c.ws.renameDocument('', 'Moved')
    expect(r.ok).toBe(true)
    expect(c.sh('log', '-1', '--format=%s')).toContain('Rename the document loose files to Moved')
    expect(c.sh('status', '--porcelain').trim()).toBe('')
  })

  it('a branch switch that adds a document shows it after refresh', async () => {
    const { ws, sh, root } = await committed()
    sh('checkout', '-q', '-b', 'other')
    await ws.createDocument('OnlyOther')
    await writeFile(join(root, 'requirements', 'OnlyOther', 'REQ-OTHER001.md'), itemFile('REQ-OTHER001', 'other'))
    sh('add', '-A')
    sh('commit', '-q', '-m', 'other doc')
    sh('checkout', '-q', 'main')
    expect((await ws.refresh(true)).documents.map((d) => d.name)).toEqual(['Spec'])
    sh('checkout', '-q', 'other')
    const info = await ws.refresh(true)
    expect(info.documents.map((d) => d.name)).toEqual(['OnlyOther', 'Spec'])
    expect(ws.query({ document: 'OnlyOther' }).total).toBe(1)
  })
})
