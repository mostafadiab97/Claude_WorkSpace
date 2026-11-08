// 0.18.0 — fixes from the helper review (docs/reviews/agents/0.18.0-*.md).
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, rename, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }
async function setup(): Promise<{ ws: WorkspaceService; root: string; remote: string; base: string; sh: (...a: string[]) => string }> {
  const base = await mkdtemp(join(tmpdir(), 'rq-r18-'))
  const remote = join(base, 'remote.git')
  const root = join(base, 'work')
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote])
  execFileSync('git', ['init', '-q', '-b', 'main', root])
  const sh = (...a: string[]): string => execFileSync('git', a, { cwd: root, encoding: 'utf8' })
  sh('config', 'user.name', 'T')
  sh('config', 'user.email', 't@example.invalid')
  sh('remote', 'add', 'origin', remote)
  const userDir = await mkdtemp(join(tmpdir(), 'rq-r18-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: () => createSqliteIndexCache(join(userDir, 'index.sqlite')),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
  await ws.initialize(root, 'System')
  return { ws, root, remote, base, sh }
}
const add = async (ws: WorkspaceService, title: string, parent?: string, document?: string): Promise<string> => {
  const it = { ...ws.newItem('system-requirement', parent, undefined, parent ? undefined : (document ?? 'System')), title }
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}

describe('0.18.0 review fixes', () => {
  it('CR18-01/02: a baseline name a colleague pushed first does not block later pushes and is marked', async () => {
    const { ws, remote, base, sh } = await setup()
    await add(ws, 'a')
    expect((await ws.commit('a')).ok).toBe(true)
    expect((await ws.push()).ok).toBe(true)
    // a colleague pushes baseline/SRS-1.0 at another commit
    const other = join(base, 'other')
    execFileSync('git', ['clone', '-q', remote, other])
    const o = (...a: string[]): string => execFileSync('git', a, { cwd: other, encoding: 'utf8' })
    o('config', 'user.name', 'C')
    o('config', 'user.email', 'c@example.invalid')
    o('commit', '-q', '--allow-empty', '-m', 'theirs')
    o('tag', '-a', '-m', 'theirs', 'baseline/SRS-1.0')
    o('push', '-q', 'origin', 'HEAD:refs/heads/other', 'refs/tags/baseline/SRS-1.0')
    expect((await ws.createBaseline({ name: 'SRS-1.0', note: 'mine' })).ok).toBe(true)
    const p = await ws.push()
    expect(p.ok, p.message).toBe(true)
    expect(p.message).toMatch(/already has a baseline called SRS-1.0/)
    expect((await ws.gitState()).pendingBaselines).toBe(0)
    expect((await ws.listBaselines())[0]).toMatchObject({ name: 'SRS-1.0', refused: true, pending: false })
    await add(ws, 'b')
    expect((await ws.commit('b')).ok).toBe(true)
    expect((await ws.push()).ok).toBe(true)
    void sh
  })

  it('CR18-03/14: a name with a space or a slash gets the friendly message', async () => {
    const { ws } = await setup()
    await add(ws, 'a')
    expect((await ws.commit('a')).ok).toBe(true)
    for (const name of ['SRS 1.0', 'a/b', '.hidden', '-x']) {
      const r = await ws.createBaseline({ name, note: '' })
      expect(r.ok, name).toBe(false)
      expect(r.message, name).toMatch(/letters/)
    }
    expect((await ws.createBaseline({ name: 'مراجعة-1', note: '' })).ok).toBe(true)
  })

  it('CR18-04/05: a hand-moved child shows at its new document\'s top level, not also under its old parent', async () => {
    const { ws, root } = await setup()
    await ws.createDocument('Software')
    const parent = await add(ws, 'parent')
    const child = await add(ws, 'child', parent)
    await rename(join(root, 'requirements', 'System', `${child}.md`), join(root, 'requirements', 'Software', `${child}.md`))
    await ws.refresh(true)
    expect(ws.query({ parent }).items.map((i) => i.id)).toEqual([])
    expect(ws.query({ document: 'Software', parent: null }).items.map((i) => i.id)).toEqual([child])
  })

  it('CR18-07: renewing a copied parent and child (any order) keeps the copied hierarchy', async () => {
    const { ws, root } = await setup()
    const top = await add(ws, 'top')
    const kid = await add(ws, 'kid', top)
    expect((await ws.commit('originals')).ok).toBe(true)
    await ws.createDocument('Copy')
    for (const id of [top, kid]) await copyFile(join(root, 'requirements', 'System', `${id}.md`), join(root, 'requirements', 'Copy', `${id}.md`))
    await ws.refresh(true)
    { const r = await ws.renewCopyId(kid); expect(r.ok, r.ok ? "" : r.message).toBe(true) } // child first
    await ws.refresh(true)
    { const r = await ws.renewCopyId(top); expect(r.ok, r.ok ? "" : r.message).toBe(true) }
    await ws.refresh(true)
    const copies = ws.query({ document: 'Copy' }).items
    const newTop = copies.find((i) => i.title === 'top')
    const newKid = copies.find((i) => i.title === 'kid')
    expect(newTop?.id).not.toBe(top)
    expect(newKid?.id).not.toBe(kid)
    expect(newKid?.parent).toBe(newTop?.id)
    expect(ws.query({ document: 'System' }).items.find((i) => i.id === kid)?.parent).toBe(top)
  })

  it('CR18-08: searching a commit ID lists exactly that commit, also when it did not touch requirements/', async () => {
    const { ws, root, sh } = await setup()
    await add(ws, 'a')
    expect((await ws.commit('a')).ok).toBe(true)
    await writeFile(join(root, 'README.txt'), 'x')
    sh('add', 'README.txt')
    sh('commit', '-qm', 'outside requirements')
    const h = sh('rev-parse', 'HEAD').trim()
    const page = await ws.getHistory({ search: h.slice(0, 10) })
    expect(page.commits.map((c) => c.message)).toEqual(['outside requirements'])
  })

  it('CR18-09: a commit a baseline marks cannot be taken back', async () => {
    const { ws } = await setup()
    await add(ws, 'a')
    expect((await ws.commit('a')).ok).toBe(true)
    await add(ws, 'b')
    expect((await ws.commit('b')).ok).toBe(true)
    expect((await ws.createBaseline({ name: 'B', note: '' })).ok).toBe(true)
    const r = await ws.undoLastCommit()
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/baseline B marks this commit/)
  })

  it('PERF-01: discard removes emptied folders level by level, quickly, and keeps folders that hold something', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rq-r18-d-'))
    execFileSync('git', ['init', '-q', root])
    const paths: string[] = []
    for (let i = 0; i < 3000; i++) {
      await mkdir(join(root, 'requirements', 'New', `D${i}`), { recursive: true })
      await writeFile(join(root, 'requirements', 'New', `D${i}`, 'x.md'), 'x')
      paths.push(`requirements/New/D${i}/x.md`)
    }
    await mkdir(join(root, 'requirements', 'Kept', 'longer-name'), { recursive: true })
    await mkdir(join(root, 'requirements', 'Kept', 'a'), { recursive: true })
    await writeFile(join(root, 'requirements', 'Kept', 'longer-name', 'x.md'), 'x')
    await writeFile(join(root, 'requirements', 'Kept', 'a', 'x.md'), 'x')
    await writeFile(join(root, 'requirements', 'Kept', 'keep.txt'), 'x')
    paths.push('requirements/Kept/longer-name/x.md', 'requirements/Kept/a/x.md')
    const t = Date.now()
    await createSystemGitAdapter().discard(root, paths)
    expect(Date.now() - t).toBeLessThan(10_000)
    expect(existsSync(join(root, 'requirements', 'New'))).toBe(false)
    expect(existsSync(join(root, 'requirements', 'Kept', 'a'))).toBe(false)
    expect(existsSync(join(root, 'requirements', 'Kept', 'longer-name'))).toBe(false)
    expect(existsSync(join(root, 'requirements', 'Kept', 'keep.txt'))).toBe(true)
  }, 60_000)
})
