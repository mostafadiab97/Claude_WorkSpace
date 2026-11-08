// QA 0.18.0 — tries to break baselines, the history list, snapshots and "Give the copy a new ID".
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readdir, rename, utimes, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }
type Ctx = { ws: WorkspaceService; root: string; remote: string; sh: (...a: string[]) => string }
async function setup(opts: { git?: boolean; remote?: boolean; name?: string } = {}): Promise<Ctx> {
  const { git = true, remote: withRemote = true, name = 'System' } = opts
  const base = await mkdtemp(join(tmpdir(), 'rq-qa18-'))
  const remote = join(base, 'remote.git')
  const root = join(base, 'work')
  const userDir = await mkdtemp(join(tmpdir(), 'rq-qa18-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: () => createSqliteIndexCache(join(userDir, 'index.sqlite')),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
  const sh = (...a: string[]): string => execFileSync('git', a, { cwd: root, encoding: 'utf8' })
  if (git) {
    execFileSync('git', ['init', '-q', '-b', 'main', root])
    sh('config', 'user.name', 'T')
    sh('config', 'user.email', 't@example.invalid')
    if (withRemote) {
      execFileSync('git', ['init', '-q', '--bare', remote])
      sh('remote', 'add', 'origin', remote)
    }
  }
  await ws.initialize(root, name)
  if (git) {
    sh('add', '-A')
    sh('commit', '-qm', 'start')
    await ws.open(root)
    if (withRemote) expect((await ws.push()).ok).toBe(true)
  }
  return { ws, root, remote, sh }
}
const add = async (ws: WorkspaceService, title: string, parent?: string, document = 'System'): Promise<string> => {
  const it = { ...ws.newItem('system-requirement', parent, undefined, parent ? undefined : document), title }
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}

describe('QA 0.18.0 baselines', () => {
  it('QA-01 a waiting baseline whose tag was deleted by hand must not block every later Push', async () => {
    const { ws, sh } = await setup()
    await add(ws, 'a')
    expect((await ws.commit('a')).ok).toBe(true)
    expect((await ws.createBaseline({ name: 'B1', note: '' })).ok).toBe(true)
    sh('tag', '-d', 'baseline/B1') // deleted outside reqochet
    await add(ws, 'b')
    expect((await ws.commit('b')).ok).toBe(true)
    const p = await ws.push()
    expect(p.ok, p.message).toBe(true)
    expect((await ws.gitState()).pendingBaselines).toBe(0)
  })

  it('QA-02 a baseline name already taken on the remote (made by a colleague) must not leave Push failing for ever', async () => {
    const { ws, root, remote, sh } = await setup()
    await add(ws, 'a')
    expect((await ws.commit('a')).ok).toBe(true)
    expect((await ws.createBaseline({ name: 'REL', note: '' })).ok).toBe(true)
    // the colleague pushes REL first, at another commit
    const other = join(root, '..', 'other')
    execFileSync('git', ['clone', '-q', '-b', 'main', remote, other])
    const o = (...a: string[]): string => execFileSync('git', a, { cwd: other, encoding: 'utf8' })
    o('config', 'user.name', 'O')
    o('config', 'user.email', 'o@example.invalid')
    o('tag', '-a', '-m', 'x', 'baseline/REL', 'HEAD')
    o('push', '-q', 'origin', 'refs/tags/baseline/REL')
    await add(ws, 'b')
    expect((await ws.commit('b')).ok).toBe(true)
    await ws.push()
    // the commits must have arrived, and a second Push must not keep failing on the rejected tag
    expect(execFileSync('git', ['--git-dir', remote, 'rev-parse', 'main'], { encoding: 'utf8' }).trim()).toBe(sh('rev-parse', 'HEAD').trim())
    const again = await ws.push()
    expect(again.ok).toBe(true)
  })

  it('QA-03 baselines can be made without a remote and are sent after a remote is added', async () => {
    const { ws, root, sh } = await setup({ remote: false })
    await add(ws, 'a')
    expect((await ws.commit('a')).ok).toBe(true)
    expect((await ws.createBaseline({ name: 'LOCAL', note: 'n' })).ok).toBe(true)
    expect((await ws.push()).ok).toBe(false) // no remote
    const bare = join(root, '..', 'late.git')
    execFileSync('git', ['init', '-q', '--bare', bare])
    sh('remote', 'add', 'origin', bare)
    await ws.refresh(true)
    const p = await ws.push()
    expect(p.ok).toBe(true)
    expect(execFileSync('git', ['--git-dir', bare, 'tag', '-l'], { encoding: 'utf8' })).toContain('baseline/LOCAL')
  })

  it('QA-04 names with a slash, a name that is a prefix of another, odd characters', async () => {
    const { ws } = await setup()
    // restated by the builder (CR18-14): a slash is refused by the name rule with the friendly message, so the
    // rel / rel/1.0 clash cannot happen; a name that is a prefix of another is fine
    const slash = await ws.createBaseline({ name: 'rel/1.0', note: '' })
    expect(slash.ok).toBe(false)
    expect(slash.message ?? '').toMatch(/letters/)
    expect((await ws.createBaseline({ name: 'rel', note: '' })).ok).toBe(true)
    expect((await ws.createBaseline({ name: 'rel.1', note: '' })).ok).toBe(true)
    for (const bad of ['', '  ', 'a..b', '.x', 'x.lock', 'a@{b', 'a b']) {
      expect((await ws.createBaseline({ name: bad, note: '' })).ok, `name "${bad}"`).toBe(false)
    }
    expect((await ws.createBaseline({ name: 'اصدار-١', note: 'ملاحظة' })).ok).toBe(true)
    expect((await ws.listBaselines()).find((b) => b.name === 'اصدار-١')?.note).toBe('ملاحظة')
  })

  it('QA-05 note with the field separator characters and newlines survives', async () => {
    const { ws } = await setup()
    const note = 'line1\n\nline3 \x1f tail\x1e end'
    expect((await ws.createBaseline({ name: 'N', note })).ok).toBe(true)
    const b = (await ws.listBaselines()).find((x) => x.name === 'N')
    expect(b?.name).toBe('N')
    expect(b?.note).toContain('line3')
  })

  it('QA-06 baseline in a repository with no commit, and after detached HEAD', async () => {
    const base = await mkdtemp(join(tmpdir(), 'rq-qa18-'))
    const root = join(base, 'w')
    execFileSync('git', ['init', '-q', '-b', 'main', root])
    execFileSync('git', ['config', 'user.name', 'T'], { cwd: root })
    execFileSync('git', ['config', 'user.email', 't@example.invalid'], { cwd: root })
    const userDir = await mkdtemp(join(tmpdir(), 'rq-qa18-user-'))
    const ws = createWorkspace({ store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')), git: createSystemGitAdapter(), openIndex: () => createSqliteIndexCache(join(userDir, 'i.sqlite')), userDir, log: quiet, watchFiles: false } as Parameters<typeof createWorkspace>[0])
    await ws.initialize(root, 'System')
    const r = await ws.createBaseline({ name: 'X', note: '', uncommitted: 'without' })
    expect(r.ok).toBe(false)
    const empty = await ws.getHistory({}).catch((e: unknown) => e)
    expect(empty, 'history of a repository without commits').toEqual({ commits: [], more: false })
    const { ws: ws2, sh } = await setup()
    sh('checkout', '-q', '--detach')
    await ws2.refresh(true)
    // decision (builder, 8 Nov 2026): like every Git action, a baseline is refused while no branch is checked out
    expect((await ws2.createBaseline({ name: 'D', note: '' })).ok).toBe(false)
    expect((await ws2.getHistory({})).commits.length).toBeGreaterThan(0)
  })
})

describe('QA 0.18.0 history and snapshots', () => {
  it('QA-07 paging over 250 commits, search + paging, words that look like hex', async () => {
    const { ws, sh } = await setup()
    const ids: string[] = []
    for (let i = 0; i < 3; i++) ids.push(await add(ws, `t${i}`))
    expect((await ws.commit('fade the cafe')).ok).toBe(true) // hex-looking words in a message
    for (let i = 0; i < 250; i++) sh('commit', '-q', '--allow-empty', '-m', `empty ${i}`)
    // empty commits do not touch requirements/: the list is per requirements folder
    const p1 = await ws.getHistory({})
    expect(p1.commits.length).toBeLessThanOrEqual(100)
    expect((await ws.getHistory({ search: 'fade' })).commits.map((c) => c.message)).toEqual(['fade the cafe'])
    expect((await ws.getHistory({ search: 'cafe' })).commits.map((c) => c.message)).toEqual(['fade the cafe'])
    expect((await ws.getHistory({ search: 'zzz' })).commits).toEqual([])
    expect((await ws.getHistory({ search: '', skip: 5000 })).commits).toEqual([])
    const all: string[] = []
    let skip = 0
    for (let k = 0; k < 10; k++) {
      const pg = await ws.getHistory({ skip })
      all.push(...pg.commits.map((c) => c.hash))
      skip += pg.commits.length
      if (!pg.more) break
    }
    expect(new Set(all).size).toBe(all.length)
    expect(all.length).toBe(Number(sh('rev-list', '--count', 'HEAD', '--', 'requirements').trim()))
  })

  it('QA-08 searching a message with regex characters and quotes is literal', async () => {
    const { ws } = await setup()
    await add(ws, 'a')
    expect((await ws.commit('fix [a-z]+ (x) "q" .*')).ok).toBe(true)
    expect((await ws.getHistory({ search: '[a-z]+' })).commits).toHaveLength(1)
    expect((await ws.getHistory({ search: '.*' })).commits).toHaveLength(1)
    expect((await ws.getHistory({ search: '--all' })).commits).toHaveLength(0)
  })

  it('QA-09 snapshot of a commit made before requirements/ existed, and of an unknown commit', async () => {
    const base = await mkdtemp(join(tmpdir(), 'rq-qa18-'))
    const root = join(base, 'w')
    execFileSync('git', ['init', '-q', '-b', 'main', root])
    const sh = (...a: string[]): string => execFileSync('git', a, { cwd: root, encoding: 'utf8' })
    sh('config', 'user.name', 'T')
    sh('config', 'user.email', 't@example.invalid')
    await writeFile(join(root, 'README.md'), 'x')
    sh('add', '-A')
    sh('commit', '-qm', 'before')
    const before = sh('rev-parse', 'HEAD').trim()
    const userDir = await mkdtemp(join(tmpdir(), 'rq-qa18-user-'))
    const ws = createWorkspace({ store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')), git: createSystemGitAdapter(), openIndex: () => createSqliteIndexCache(join(userDir, 'i.sqlite')), userDir, log: quiet, watchFiles: false } as Parameters<typeof createWorkspace>[0])
    await ws.initialize(root, 'System')
    await add(ws, 'a')
    expect((await ws.commit('later')).ok).toBe(true)
    expect((await ws.getSnapshot(before)).items).toEqual([])
    const bogus = await ws.getSnapshot('deadbeefdeadbeef').catch((e: unknown) => e)
    expect(bogus).not.toBeInstanceOf(Error) // a missing commit should give an empty snapshot, not an exception
  })

  it('QA-10 snapshot after an item moved to another document and after a parent was deleted', async () => {
    const { ws, root, sh } = await setup()
    const top = await add(ws, 'top')
    const kid = await add(ws, 'kid', top)
    expect((await ws.commit('two items')).ok).toBe(true)
    const c1 = sh('rev-parse', 'HEAD').trim()
    await ws.createDocument('Software')
    await mkdir(join(root, 'requirements', 'Software'), { recursive: true })
    await rename(join(root, 'requirements', 'System', `${kid}.md`), join(root, 'requirements', 'Software', `${kid}.md`))
    expect((await ws.commit('moved')).ok).toBe(true)
    // remove the parent file outright: the kid points to a missing parent
    sh('rm', '-q', `requirements/System/${top}.md`)
    sh('commit', '-qm', 'parent gone')
    const s1 = await ws.getSnapshot(c1)
    expect(s1.items.map((i) => i.id).sort()).toEqual([top, kid].sort())
    expect(s1.items.find((i) => i.id === kid)?.number).toBe('1.1')
    const s3 = await ws.getSnapshot(sh('rev-parse', 'HEAD').trim())
    expect(s3.items.map((i) => i.id)).toEqual([kid])
    // decision: like the live table, an item whose parent is missing gets no outline number (it is listed under Problems)
    expect(s3.items[0]?.number).toBeUndefined()
  })

  it('QA-11 snapshot of a commit that holds the same ID twice (file copied into another document) lists it once or numbers it right', async () => {
    const { ws, root, sh } = await setup()
    const a = await add(ws, 'a')
    const b = await add(ws, 'b')
    await ws.createDocument('Software')
    await copyFile(join(root, 'requirements', 'System', `${b}.md`), join(root, 'requirements', 'Software', `${b}.md`))
    sh('add', '-A')
    sh('commit', '-qm', 'dup')
    const snap = await ws.getSnapshot(sh('rev-parse', 'HEAD').trim())
    const bs = snap.items.filter((i) => i.id === b)
    // the two copies are in different documents; each must have its own outline number "1" / "2" in its document
    const nums = bs.map((i) => `${i.document}:${i.number}`).sort()
    expect(nums).toEqual(['Software:1', 'System:2'])
    expect(snap.items.find((i) => i.id === a)?.number).toBe('1')
  })

  it('QA-12 branch at a commit: existing name, name equal to a tag, uppercase hash, short hash', async () => {
    const { ws, sh } = await setup()
    await add(ws, 'a')
    expect((await ws.commit('a')).ok).toBe(true)
    const h = sh('rev-parse', 'HEAD').trim()
    expect((await ws.createBranchAt('main', h)).ok).toBe(false)
    expect((await ws.createBranchAt('b1', h.slice(0, 7).toUpperCase())).ok).toBe(true)
    expect((await ws.createBranchAt('-bad', h)).ok).toBe(false)
    expect((await ws.createBranchAt('HEAD', h)).ok).toBe(false)
    expect((await ws.createBranchAt('b2', 'abcdef1')).ok).toBe(false) // unknown commit
    expect(sh('branch', '--list').split('\n').filter((l) => l.includes('abcdef')).length).toBe(0)
  })
})

describe('QA 0.18.0 Give the copy a new ID', () => {
  it('QA-13 without Git the ORIGINAL (newest file) must not lose its ID when the copy keeps an old time', async () => {
    const { ws, root } = await setup({ git: false })
    const top = await add(ws, 'top')
    const kid = await add(ws, 'kid', top)
    await ws.createDocument('Software')
    const copy = join(root, 'requirements', 'Software', `${kid}.md`)
    await copyFile(join(root, 'requirements', 'System', `${kid}.md`), copy)
    const old = new Date(Date.now() - 3600_000)
    await utimes(copy, old, old) // copied with the time kept (cp -p, a sync tool, an unzip)
    await ws.refresh(true)
    const r = await ws.renewCopyId(kid)
    expect(r.ok).toBe(true)
    // the original (System) must still hold the old ID
    expect(existsSync(join(root, 'requirements', 'System', `${kid}.md`))).toBe(true)
    expect(existsSync(copy)).toBe(false)
  })

  it('QA-14 three copies: each click renews one, the third stays; unknown ID and single file are harmless', async () => {
    const { ws, root, sh } = await setup()
    const a = await add(ws, 'a')
    expect((await ws.commit('a')).ok).toBe(true)
    await ws.createDocument('Two')
    await ws.createDocument('Three')
    for (const d of ['Two', 'Three']) await copyFile(join(root, 'requirements', 'System', `${a}.md`), join(root, 'requirements', d, `${a}.md`))
    const info = await ws.refresh(true)
    expect(info.issues.some((i) => i.path === 'id')).toBe(true)
    expect((await ws.renewCopyId(a)).ok).toBe(true)
    expect((await ws.renewCopyId(a)).ok).toBe(true)
    const after = await ws.refresh(true)
    expect(after.issues.filter((i) => i.path === 'id')).toEqual([])
    expect(existsSync(join(root, 'requirements', 'System', `${a}.md`))).toBe(true) // the tracked original stays
    expect(ws.query({}).items).toHaveLength(3)
    expect((await ws.renewCopyId(a)).ok).toBe(true) // only one file now: no-op
    expect((await ws.renewCopyId('REQ-NOPE000')).ok).toBe(true)
    expect(sh('status', '--porcelain').split('\n').filter(Boolean).length).toBeGreaterThan(0)
  })

  it('QA-15 all copies tracked by Git (a duplicate that was committed): the user is not left with a lost item', async () => {
    const { ws, root, sh } = await setup()
    const a = await add(ws, 'a')
    await ws.createDocument('Two')
    await copyFile(join(root, 'requirements', 'System', `${a}.md`), join(root, 'requirements', 'Two', `${a}.md`))
    sh('add', '-A')
    sh('commit', '-qm', 'dup committed')
    await ws.refresh(true)
    // decision (QA-13): both files are in Git and nothing tells which is the copy — refused with a clear message,
    // nothing changed (no guess that could give the original a new ID)
    const r = await ws.renewCopyId(a)
    expect(r.ok).toBe(false)
    expect(existsSync(join(root, 'requirements', 'System', `${a}.md`)) && existsSync(join(root, 'requirements', 'Two', `${a}.md`))).toBe(true)
  })

  it('QA-16 the copy keeps its links and children of the original are not stolen', async () => {
    const { ws, root } = await setup({ git: false })
    const top = await add(ws, 'top')
    const kid = await add(ws, 'kid', top)
    await ws.createDocument('Software')
    await copyFile(join(root, 'requirements', 'System', `${top}.md`), join(root, 'requirements', 'Software', `${top}.md`))
    await ws.refresh(true)
    await ws.renewCopyId(top)
    const sys = ws.query({ document: 'System' }).items
    expect(sys.find((i) => i.id === kid)?.parent).toBe(top)
    expect(sys.map((i) => i.id)).toContain(top)
  })
})

describe('QA 0.18.0 Discard all removes emptied folders', () => {
  it('QA-17 a new document folder that also holds a non-requirement file is NOT removed', async () => {
    const { ws, root } = await setup()
    await ws.createDocument('Scratch')
    await add(ws, 'x', undefined, 'Scratch')
    await writeFile(join(root, 'requirements', 'Scratch', 'notes.txt'), 'mine') // untracked, not an item
    const st = await ws.gitState()
    // discard only the requirement file (the user ticked just that one)
    const r = await ws.discardChanges(st.changes.map((c) => c.path).filter((p) => p.endsWith('.md')))
    expect(r.ok).toBe(true)
    expect(existsSync(join(root, 'requirements', 'Scratch', 'notes.txt'))).toBe(true)
  })

  it('QA-18 a git-ignored file, a hidden file or a nested sub-folder keeps the folder; an unrelated empty folder is not touched', async () => {
    const { ws, root } = await setup()
    await ws.createDocument('Scratch')
    await mkdir(join(root, 'requirements', 'Scratch', 'sub'), { recursive: true })
    await mkdir(join(root, 'requirements', 'EmptyBefore'), { recursive: true })
    await writeFile(join(root, 'requirements', 'Scratch', '.hidden'), 'h')
    await add(ws, 'x', undefined, 'Scratch')
    const st = await ws.gitState()
    await ws.discardChanges(st.changes.map((c) => c.path).filter((p) => p.endsWith('.md')))
    expect(existsSync(join(root, 'requirements', 'Scratch', '.hidden'))).toBe(true)
    expect(existsSync(join(root, 'requirements', 'EmptyBefore'))).toBe(true)
  })

  it('QA-19 discarding one new item of a document that still has committed items never removes that document; requirements/ itself stays', async () => {
    const { ws, root } = await setup()
    const keep = await add(ws, 'keep')
    expect((await ws.commit('keep')).ok).toBe(true)
    await add(ws, 'new')
    const st = await ws.gitState()
    expect((await ws.discardChanges(st.changes.map((c) => c.path))).ok).toBe(true)
    expect(await readdir(join(root, 'requirements', 'System'))).toContain(`${keep}.md`)
    expect(existsSync(join(root, 'requirements', '.reqochet'))).toBe(true)
  })

  it('QA-20 discarding the only new item in a repository where requirements/ held nothing else (no commit with it) keeps requirements/.reqochet', async () => {
    const { ws, root, sh } = await setup()
    await ws.createDocument('A')
    await ws.createDocument('B')
    await add(ws, 'in a', undefined, 'A')
    await add(ws, 'in b', undefined, 'B')
    const st = await ws.gitState()
    const onlyA = st.changes.filter((c) => c.path.includes('/A/')).map((c) => c.path)
    expect(onlyA.length).toBeGreaterThan(0)
    expect((await ws.discardChanges(onlyA)).ok).toBe(true)
    expect(existsSync(join(root, 'requirements', 'A'))).toBe(false)
    expect(existsSync(join(root, 'requirements', 'B'))).toBe(true)
    expect(sh('status', '--porcelain')).toContain('B/')
  })
})
