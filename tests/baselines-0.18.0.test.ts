// 0.18.0 — baselines and the history list (the owner's decisions S-06 a, S-08 a, S-09 a): a baseline is the Git
// tag baseline/<name> with a note, sent with the next Push; old commits are read only, compared, made a baseline or
// a branch is started there — the working folder never "stands" on an old commit.
import { execFileSync } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { cacheFileName, createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }
async function setup(): Promise<{ ws: WorkspaceService; root: string; remote: string; sh: (...a: string[]) => string; first: string }> {
  const base = await mkdtemp(join(tmpdir(), 'rq-bl-'))
  const remote = join(base, 'remote.git')
  const root = join(base, 'work')
  execFileSync('git', ['init', '-q', '--bare', remote])
  const userDir = await mkdtemp(join(tmpdir(), 'rq-bl-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: (r: string) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(r))),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
  execFileSync('git', ['init', '-q', '-b', 'main', root])
  const sh = (...a: string[]): string => execFileSync('git', a, { cwd: root, encoding: 'utf8' })
  sh('config', 'user.name', 'T')
  sh('config', 'user.email', 't@example.invalid')
  sh('remote', 'add', 'origin', remote)
  await ws.initialize(root, 'Spec')
  const it = { ...ws.newItem('system-requirement'), title: 'first version' }
  expect((await ws.saveItem(it, null)).ok).toBe(true)
  expect((await ws.commit('one')).ok).toBe(true)
  expect((await ws.push()).ok).toBe(true)
  return { ws, root, remote, sh, first: it.id }
}

describe('0.18.0 baselines', () => {
  it('a baseline marks the latest commit, is listed with its note, and goes to the remote with the next Push', async () => {
    const { ws, remote, sh } = await setup()
    const r = await ws.createBaseline({ name: 'SRS-1.0', note: 'for the review' })
    expect(r.ok).toBe(true)
    const list = await ws.listBaselines()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ name: 'SRS-1.0', note: 'for the review', pending: true, commit: sh('rev-parse', 'HEAD').trim() })
    expect((await ws.gitState()).pendingBaselines).toBe(1)
    // nothing new to push but the baseline: Push sends it
    const p = await ws.push()
    expect(p.ok).toBe(true)
    expect(execFileSync('git', ['--git-dir', remote, 'tag', '-l'], { encoding: 'utf8' })).toContain('baseline/SRS-1.0')
    expect((await ws.listBaselines())[0]?.pending).toBe(false)
    expect((await ws.gitState()).pendingBaselines).toBe(0)
  })

  it('with uncommitted changes it asks first; "commit first" includes them, "without" leaves them out', async () => {
    const { ws, sh, first } = await setup()
    const d = await ws.getItem(first)
    expect((await ws.saveItem({ ...(d?.item as NonNullable<typeof d>['item']), title: 'changed' }, d?.revision ?? null)).ok).toBe(true)
    const ask = await ws.createBaseline({ name: 'B1', note: '' })
    expect(ask.ok).toBe(false)
    expect(ask.needs).toBe('uncommitted-decision')
    const without = await ws.createBaseline({ name: 'B1', note: '', uncommitted: 'without' })
    expect(without.ok).toBe(true)
    expect(sh('rev-parse', 'baseline/B1^{commit}').trim()).toBe(sh('rev-parse', 'HEAD').trim())
    expect((await ws.gitState()).changes.length).toBe(1)
    const withThem = await ws.createBaseline({ name: 'B2', note: '', uncommitted: 'commit', commitMessage: 'title changed' })
    expect(withThem.ok).toBe(true)
    expect((await ws.gitState()).changes.length).toBe(0)
    expect(sh('log', '-1', '--format=%s', 'baseline/B2').trim()).toBe('title changed')
  })

  it('refuses a bad name, a taken name and a non-commit', async () => {
    const { ws } = await setup()
    expect((await ws.createBaseline({ name: 'with space', note: '' })).ok).toBe(false)
    expect((await ws.createBaseline({ name: 'A', note: '' })).ok).toBe(true)
    expect((await ws.createBaseline({ name: 'A', note: '' })).ok).toBe(false)
    expect((await ws.createBaseline({ name: 'C', note: '', commit: 'nothex!' })).ok).toBe(false)
  })
})

describe('0.18.0 history list', () => {
  it('lists the branch newest first, searches messages and commit IDs, reads an old version, makes a baseline and a branch there', async () => {
    const { ws, sh, first } = await setup()
    const d = await ws.getItem(first)
    expect((await ws.saveItem({ ...(d?.item as NonNullable<typeof d>['item']), title: 'second version' }, d?.revision ?? null)).ok).toBe(true)
    expect((await ws.commit('two')).ok).toBe(true)
    const page = await ws.getHistory({})
    expect(page.commits.map((c) => c.message).slice(0, 2)).toEqual(['two', 'one'])
    expect((await ws.getHistory({ search: 'ONE' })).commits.map((c) => c.message)).toEqual(['one'])
    const oldHash = page.commits[1]?.hash as string
    expect((await ws.getHistory({ search: oldHash.slice(0, 8) })).commits.map((c) => c.hash)).toEqual([oldHash])
    // read-only: the old title, the working folder untouched
    // D-19b: the old version in the table — reads answer from it, writes are refused, Back to now returns
    const v = await ws.openVersion(oldHash)
    expect(v.ok && v.info.version?.ref).toBe(oldHash)
    expect(ws.query({ limit: 10 }).items.find((i) => i.id === first)).toMatchObject({ title: 'first version', number: '1' })
    expect((await ws.getItem(first))?.item.title).toBe('first version')
    const refused = await ws.saveItem({ ...(d?.item as NonNullable<typeof d>['item']), title: 'x' }, null)
    expect(refused.ok).toBe(false)
    expect((await ws.closeVersion()).version).toBeUndefined()
    expect((await ws.getItem(first))?.item.title).toBe('second version')
    expect(sh('rev-parse', '--abbrev-ref', 'HEAD').trim()).toBe('main')
    // a baseline and a branch at the old commit
    expect((await ws.createBaseline({ name: 'old', note: '', commit: oldHash })).ok).toBe(true)
    expect(sh('rev-parse', 'baseline/old^{commit}').trim()).toBe(oldHash)
    expect((await ws.createBranchAt('fix-old', oldHash)).ok).toBe(true)
    expect(sh('rev-parse', 'fix-old').trim()).toBe(oldHash)
    expect(sh('rev-parse', '--abbrev-ref', 'HEAD').trim()).toBe('main')
  })
})
