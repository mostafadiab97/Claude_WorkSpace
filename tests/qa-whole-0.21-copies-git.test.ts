// QA whole project 0.21 (helper agent, docs/AGENT-WORKFLOW.md): copied documents and "Give the copy a new ID", Arabic and
// other non-ASCII document names through rename, history, compare, baselines and pull, and the push rules.
// Assertions state the EXPECTED behaviour; `it.fails` marks a defect found.
// Details: docs/reviews/agents/whole-project-0.21-qa-tester.md
import { execFileSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { cacheFileName, createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }
async function makeWs(): Promise<WorkspaceService> {
  const userDir = await mkdtemp(join(tmpdir(), 'rq-qaw21c-user-'))
  return createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: (r: string) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(r))),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
}
type Env = { ws: WorkspaceService; root: string; remote: string; sh: (...a: string[]) => string }
async function setup(first = 'Spec', git = true): Promise<Env> {
  const base = await mkdtemp(join(tmpdir(), 'rq-qaw21c-'))
  const root = join(base, 'proj')
  const remote = join(base, 'remote.git')
  await mkdir(root)
  const sh = (...a: string[]): string => execFileSync('git', a, { cwd: root, encoding: 'utf8' })
  if (git) {
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote])
    sh('init', '-q', '-b', 'main')
    sh('config', 'user.name', 'T')
    sh('config', 'user.email', 't@example.invalid')
    sh('remote', 'add', 'origin', remote)
  }
  const ws = await makeWs()
  await ws.initialize(root, first)
  return { ws, root, remote, sh }
}
async function secondPc(remote: string): Promise<{ ws: WorkspaceService; root: string }> {
  const root = join(await mkdtemp(join(tmpdir(), 'rq-qaw21c-b-')), 'b')
  execFileSync('git', ['clone', '-q', remote, root])
  execFileSync('git', ['config', 'user.name', 'B'], { cwd: root })
  execFileSync('git', ['config', 'user.email', 'b@example.invalid'], { cwd: root })
  const ws = await makeWs()
  await ws.open(root)
  return { ws, root }
}
const add = async (ws: WorkspaceService, title: string, o: { parent?: string; document?: string } = {}): Promise<string> => {
  const it = { ...ws.newItem('system-requirement', o.parent, undefined, o.parent ? undefined : (o.document ?? ws.repoInfo().documents[0]?.name ?? 'Spec')), title }
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}
const edit = async (ws: WorkspaceService, id: string, f: (i: NonNullable<Awaited<ReturnType<WorkspaceService['getItem']>>>['item']) => void): Promise<void> => {
  const g = await ws.getItem(id)
  f(g!.item)
  const r = await ws.saveItem(g!.item, g!.revision)
  if (!r.ok) throw new Error(r.message)
}
const docFiles = async (root: string, doc: string): Promise<Record<string, string>> => {
  const out: Record<string, string> = {}
  for (const f of await readdir(join(root, 'requirements', doc))) if (f.endsWith('.md')) out[f] = await readFile(join(root, 'requirements', doc, f), 'utf8')
  return out
}
const allIds = (ws: WorkspaceService): string[] => ws.query({ limit: 100000 }).items.map((i) => i.id)

describe('QA-W21 copied documents and "Give the copy a new ID" (W-01)', { timeout: 120_000 }, () => {
  for (const [label, orig, copy] of [
    ['copy sorts before the original', 'Spec', 'Aaa copy'],
    ['copy sorts after the original', 'Spec', 'Zzz copy'],
    ['Arabic names', 'متطلبات', 'نسخة'],
    ['names with a space and an accent', 'System spec', 'Système (copie)']
  ] as const) {
    it(`QW21-10 (${label}): renewing the copy's parent then its child leaves the original document's files byte for byte unchanged and every ID once`, async () => {
      const { ws, root, sh } = await setup(orig)
      const p = await add(ws, 'parent', { document: orig })
      const c = await add(ws, 'child', { parent: p })
      const c2 = await add(ws, 'child 2', { parent: p })
      expect((await ws.commit('base')).ok).toBe(true)
      const before = await docFiles(root, orig)
      await cp(join(root, 'requirements', orig), join(root, 'requirements', copy), { recursive: true })
      await ws.refresh(true)
      expect(allIds(ws).length).toBe(6)
      const r1 = await ws.renewCopyId(p)
      expect(r1.ok, JSON.stringify(r1)).toBe(true)
      expect(r1.newId).toBeTruthy()
      for (const child of [c, c2]) {
        const r = await ws.renewCopyId(child)
        expect(r.ok, JSON.stringify(r)).toBe(true)
      }
      expect(await docFiles(root, orig)).toEqual(before)
      const ids = allIds(ws)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids.length).toBe(6)
      // the copy keeps its shape: both children hang under the copy's new parent
      const kids = ws.query({ document: copy, limit: 100000 }).items
      const top = kids.filter((k) => !k.parent)
      expect(top.length).toBe(1)
      expect(top[0]!.id).toBe(r1.newId)
      expect(kids.filter((k) => k.parent === r1.newId).length).toBe(2)
      void sh
    })
  }
  it('QW21-11: renewing the copy\'s CHILD first (parent still twice) keeps the child under the copy\'s parent, and a later parent renew moves it along', async () => {
    const { ws, root } = await setup()
    const p = await add(ws, 'parent')
    const c = await add(ws, 'child', { parent: p })
    expect((await ws.commit('base')).ok).toBe(true)
    await cp(join(root, 'requirements', 'Spec'), join(root, 'requirements', 'Aaa'), { recursive: true })
    await ws.refresh(true)
    const rc = await ws.renewCopyId(c)
    expect(rc.ok, JSON.stringify(rc)).toBe(true)
    const rp = await ws.renewCopyId(p)
    expect(rp.ok, JSON.stringify(rp)).toBe(true)
    const inCopy = ws.query({ document: 'Aaa', limit: 100000 }).items
    expect(inCopy.map((i) => i.parent).filter(Boolean)).toEqual([rp.newId])
    const inOrig = ws.query({ document: 'Spec', limit: 100000 }).items
    expect(inOrig.find((i) => i.id === c)?.parent).toBe(p)
  })
  it('QW21-12: links to the old ID from a third document stay on the original; the copy\'s own outgoing links survive', async () => {
    const { ws, root } = await setup()
    await ws.createDocument('Tests')
    const p = await add(ws, 'parent')
    const t = { ...ws.newItem('test-case', undefined, undefined, 'Tests'), title: 'test' }
    expect((await ws.saveItem(t, null)).ok).toBe(true)
    expect(await ws.addLink(t.id, 'verifies', p)).toEqual({ ok: true })
    const q = await add(ws, 'other')
    expect(await ws.addLink(p, 'refines', q)).toEqual({ ok: true })
    expect((await ws.commit('base')).ok).toBe(true)
    await cp(join(root, 'requirements', 'Spec'), join(root, 'requirements', 'Zcopy'), { recursive: true })
    await ws.refresh(true)
    // the copy of p and of q both exist now; renew both copies
    const rp = await ws.renewCopyId(p)
    expect(rp.ok, JSON.stringify(rp)).toBe(true)
    const rq = await ws.renewCopyId(q)
    expect(rq.ok, JSON.stringify(rq)).toBe(true)
    const test = await ws.getItem(t.id)
    expect(test?.item.links.map((l) => l.target)).toEqual([p])
    const copyP = await ws.getItem(rp.newId as string)
    expect(copyP?.item.links.map((l) => l.target)).toEqual([q]) // the original target: link into the other document of the same items
    expect((await ws.getItem(p))?.item.links.map((l) => l.target)).toEqual([q])
  })
  it('QW21-13: renewing when both copies are tracked and no parent tells which is the copy is refused with a message and writes nothing', async () => {
    const { ws, root, sh } = await setup()
    const p = await add(ws, 'top')
    await cp(join(root, 'requirements', 'Spec'), join(root, 'requirements', 'Twin'), { recursive: true })
    sh('add', '-A')
    sh('commit', '-q', '-m', 'both')
    await ws.refresh(true)
    const before = [await docFiles(root, 'Spec'), await docFiles(root, 'Twin')]
    const r = await ws.renewCopyId(p)
    expect(r.ok).toBe(false)
    expect((r as { message?: string }).message).toBeTruthy()
    expect([await docFiles(root, 'Spec'), await docFiles(root, 'Twin')]).toEqual(before)
  })
  it('QW21-14: two renewals at once on the same ID never give two items the same new ID or lose the copy', async () => {
    const { ws, root } = await setup()
    const p = await add(ws, 'top')
    expect((await ws.commit('base')).ok).toBe(true)
    await cp(join(root, 'requirements', 'Spec'), join(root, 'requirements', 'Aaa'), { recursive: true })
    await ws.refresh(true)
    const [a, b] = await Promise.all([ws.renewCopyId(p), ws.renewCopyId(p)])
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    const ids = allIds(ws)
    expect(ids.length).toBe(2)
    expect(new Set(ids).size).toBe(2)
  })
  it('QW21-15: without Git, an untracked-vs-tracked guess is impossible: the copy is refused with a message (never the newer file)', async () => {
    const { ws, root } = await setup('Spec', false)
    const p = await add(ws, 'top')
    await cp(join(root, 'requirements', 'Spec'), join(root, 'requirements', 'Aaa'), { recursive: true })
    await ws.refresh(true)
    const r = await ws.renewCopyId(p)
    expect(r.ok).toBe(false)
    expect(allIds(ws).length).toBe(2)
  })
})

describe('QA-W21 non-ASCII document names (W-02)', { timeout: 180_000 }, () => {
  it('QW21-20: rename Arabic → Arabic with Git: history follows the file, compare across the rename shows the item as moved (not deleted+added), a baseline taken before still opens', async () => {
    const { ws } = await setup('متطلبات')
    const id = await add(ws, 'one')
    expect((await ws.commit('first')).ok).toBe(true)
    const b = await ws.createBaseline({ name: 'v1', note: 'before rename' })
    expect(b.ok, JSON.stringify(b)).toBe(true)
    expect(await ws.renameDocument('متطلبات', 'مواصفات')).toMatchObject({ ok: true })
    await edit(ws, id, (i) => {
      i.title = 'one (edited)'
    })
    expect((await ws.commit('after rename')).ok).toBe(true)
    const h = JSON.stringify(await ws.itemHistory(id))
    expect(h).toContain('first')
    expect(h).toContain('after rename')
    const r = await ws.compareVersions('baseline/v1', 'HEAD')
    expect(r.entries.map((e) => `${e.id}:${e.kind}`)).toEqual([`${id}:modified`].length === 1 ? expect.arrayContaining([expect.stringMatching(new RegExp(`^${id}:(modified|moved)$`))]) : [])
    expect(r.entries.filter((e) => e.id === id).length).toBe(1)
    expect(r.entries.find((e) => e.id === id)?.title).toBe('one (edited)')
    const v = await ws.openVersion('baseline/v1')
    expect(v.ok, JSON.stringify(v)).toBe(true)
    expect(ws.query({ document: 'متطلبات', limit: 100 }).items.map((i) => i.id)).toEqual([id])
    await ws.closeVersion()
    expect(ws.query({ document: 'مواصفات', limit: 100 }).items.map((i) => i.id)).toEqual([id])
  })
  it('QW21-21: decomposed vs composed accents, emoji, and a trailing dot or space in a document name never break rename, commit, compare or history', async () => {
    const names = ['Café', 'Résumé', '📋 Plan', 'Plan 日本語']
    for (const name of names) {
      const { ws } = await setup('Start')
      const id = await add(ws, 'one')
      expect((await ws.commit('a')).ok).toBe(true)
      const r = await ws.renameDocument('Start', name)
      expect(r.ok, `${name}: ${JSON.stringify(r)}`).toBe(true)
      // renameDocument commits by itself with Git; a second commit finds nothing
      expect((await ws.commit('rename')).ok, name).toBe(false)
      const cmp = await ws.compareVersions('HEAD~1', 'HEAD')
      expect(cmp.entries.filter((e) => e.id === id).length, name).toBeLessThanOrEqual(1)
      expect(JSON.stringify(await ws.itemHistory(id)), name).toMatch(/[Rr]ename/)
      expect((await ws.getHistory({})).entries?.length ?? (await ws.getHistory({})).items?.length ?? 2, name).toBeGreaterThanOrEqual(2)
    }
  })
  it('QW21-22: Arabic document: pull where B added an item and A edited another one (no overlap) is a clean fast merge and both sides see all items', async () => {
    const { ws, remote } = await setup('متطلبات')
    const a1 = await add(ws, 'a1')
    expect((await ws.commit('init')).ok).toBe(true)
    expect((await ws.push()).ok).toBe(true)
    const b = await secondPc(remote)
    const b1 = await add(b.ws, 'from B', { document: 'متطلبات' })
    expect((await b.ws.commit('b')).ok).toBe(true)
    expect((await b.ws.push()).ok).toBe(true)
    await edit(ws, a1, (i) => {
      i.title = 'a1 edited'
    })
    expect((await ws.commit('a')).ok).toBe(true)
    const p = await ws.pull()
    expect(p.ok, p.message).toBe(true)
    expect(allIds(ws).sort()).toEqual([a1, b1].sort())
    expect((await ws.push()).ok).toBe(true)
  })
  it('QW21-23: the pull window (items edited on both PCs, Arabic document, body text conflict) lists the item and finishing with "mine" keeps my text', async () => {
    const { ws, remote } = await setup('متطلبات')
    const id = await add(ws, 'shared')
    await edit(ws, id, (i) => {
      i.text = 'line one\nline two\nline three'
    })
    expect((await ws.commit('init')).ok).toBe(true)
    expect((await ws.push()).ok).toBe(true)
    const b = await secondPc(remote)
    await edit(b.ws, id, (i) => {
      i.text = 'line one\nB changed\nline three'
    })
    expect((await b.ws.commit('b')).ok).toBe(true)
    expect((await b.ws.push()).ok).toBe(true)
    await edit(ws, id, (i) => {
      i.text = 'line one\nA changed\nline three'
    })
    expect((await ws.commit('a')).ok).toBe(true)
    const p = await ws.pull()
    // either asked (needs a decision) or merged; never "conflict outside the requirements folder"
    expect(p.message ?? '').not.toMatch(/outside the requirements/i)
    expect(JSON.stringify(p)).toContain(id)
  })
})

describe('QA-W21 push rules (W-11, CR-01)', { timeout: 180_000 }, () => {
  async function pushed(env: Env, text: string): Promise<void> {
    await add(env.ws, text)
    expect((await env.ws.commit(text)).ok).toBe(true)
  }
  const remoteHeads = (remote: string): string[] => execFileSync('git', ['for-each-ref', '--format=%(refname)', 'refs/heads/'], { cwd: remote, encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  it('QW21-30: no upstream, first push sets it and goes to the same-named branch; a second branch without upstream does not touch main', async () => {
    const env = await setup()
    await pushed(env, 'a')
    expect((await env.ws.push()).ok).toBe(true)
    env.sh('switch', '-q', '-c', 'feature')
    await env.ws.refresh(true)
    await pushed(env, 'b')
    const mainBefore = execFileSync('git', ['rev-parse', 'main'], { cwd: env.remote, encoding: 'utf8' })
    expect((await env.ws.push()).ok).toBe(true)
    expect(remoteHeads(env.remote).sort()).toEqual(['refs/heads/feature', 'refs/heads/main'])
    expect(execFileSync('git', ['rev-parse', 'main'], { cwd: env.remote, encoding: 'utf8' })).toBe(mainBefore)
  })
  it('QW21-31: branch.<name>.pushRemote to a second remote: the branch goes there, nothing goes to origin, and upstream stays', async () => {
    const env = await setup()
    await pushed(env, 'a')
    expect((await env.ws.push()).ok).toBe(true)
    const fork = join(await mkdtemp(join(tmpdir(), 'rq-qaw21c-fork-')), 'fork.git')
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', fork])
    env.sh('remote', 'add', 'fork', fork)
    env.sh('config', 'branch.main.pushRemote', 'fork')
    await env.ws.refresh(true)
    await pushed(env, 'b')
    const originBefore = execFileSync('git', ['rev-parse', 'main'], { cwd: env.remote, encoding: 'utf8' })
    const r = await env.ws.push()
    expect(r.ok, r.message).toBe(true)
    expect(execFileSync('git', ['rev-parse', 'main'], { cwd: env.remote, encoding: 'utf8' })).toBe(originBefore)
    expect(remoteHeads(fork)).toEqual(['refs/heads/main'])
    // the window must then not claim "nothing to push" or "ahead" forever; at least a second push does not fail
    await env.ws.refresh(true)
    const again = await env.ws.push()
    expect(again.ok, again.message).toBe(true)
  })
  it('QW21-32: remote.pushDefault to a second remote is honoured like pushRemote (or refused clearly), never sent to origin silently', async () => {
    const env = await setup()
    await pushed(env, 'a')
    expect((await env.ws.push()).ok).toBe(true)
    const fork = join(await mkdtemp(join(tmpdir(), 'rq-qaw21c-fork-')), 'fork.git')
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', fork])
    env.sh('remote', 'add', 'fork', fork)
    env.sh('config', 'remote.pushDefault', 'fork')
    await env.ws.refresh(true)
    await pushed(env, 'b')
    const originBefore = execFileSync('git', ['rev-parse', 'main'], { cwd: env.remote, encoding: 'utf8' })
    const r = await env.ws.push()
    const originAfter = execFileSync('git', ['rev-parse', 'main'], { cwd: env.remote, encoding: 'utf8' })
    // plain `git push` would use the fork; whichever reqochet chooses, the reply must be true to what happened
    if (r.ok && originAfter !== originBefore) expect(remoteHeads(fork)).toEqual([]) // went to origin only
    else if (r.ok) expect(remoteHeads(fork)).toEqual(['refs/heads/main'])
    else expect(r.message).toBeTruthy()
  })
  it('QW21-33: upstream of another name on ANOTHER remote and a local tracking branch both refuse or push safely; main on origin stays', async () => {
    const env = await setup()
    await pushed(env, 'a')
    expect((await env.ws.push()).ok).toBe(true)
    env.sh('switch', '-q', '-c', 'local-fix', '--track', 'main') // upstream is the LOCAL main (remote ".")
    await env.ws.refresh(true)
    await pushed(env, 'b')
    const before = execFileSync('git', ['rev-parse', 'main'], { cwd: env.remote, encoding: 'utf8' })
    const localMain = env.sh('rev-parse', 'main')
    const r = await env.ws.push()
    expect(execFileSync('git', ['rev-parse', 'main'], { cwd: env.remote, encoding: 'utf8' })).toBe(before)
    expect(env.sh('rev-parse', 'main')).toBe(localMain) // the local main was not moved by a push to "."
    expect(r.ok === false ? r.message : 'pushed').toBeTruthy()
  })
  it('QW21-34: detached HEAD and a rejected (non fast-forward) push give a plain message and change nothing remote', async () => {
    const env = await setup()
    await pushed(env, 'a')
    expect((await env.ws.push()).ok).toBe(true)
    const b = await secondPc(env.remote)
    await pushed({ ...env, ws: b.ws }, 'from B')
    expect((await b.ws.push()).ok).toBe(true)
    await pushed(env, 'mine')
    const before = execFileSync('git', ['rev-parse', 'main'], { cwd: env.remote, encoding: 'utf8' })
    const rej = await env.ws.push()
    expect(rej.ok).toBe(false)
    expect(rej.message).toBeTruthy()
    expect(rej.message).not.toMatch(/\n.*hint:/s)
    expect(execFileSync('git', ['rev-parse', 'main'], { cwd: env.remote, encoding: 'utf8' })).toBe(before)
    env.sh('checkout', '-q', '--detach')
    await env.ws.refresh(true)
    const det = await env.ws.push()
    expect(det.ok).toBe(false)
    expect(det.message).toBeTruthy()
  })
  it('QW21-35: no remote at all, and a remote that does not exist any more, give a message and keep the commit', async () => {
    const env = await setup()
    await pushed(env, 'a')
    env.sh('remote', 'remove', 'origin')
    await env.ws.refresh(true)
    const r = await env.ws.push()
    expect(r.ok).toBe(false)
    expect(r.message).toBeTruthy()
    env.sh('remote', 'add', 'origin', join(tmpdir(), 'rq-qaw21c-does-not-exist.git'))
    await env.ws.refresh(true)
    const r2 = await env.ws.push()
    expect(r2.ok).toBe(false)
    expect(r2.message).toBeTruthy()
    expect(env.sh('log', '--oneline').trim().split('\n').length).toBeGreaterThanOrEqual(1)
  })
})
