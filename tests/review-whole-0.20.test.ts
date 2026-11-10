// 0.20.2 — data-safety fixes from the whole-project review (docs/reviews/2026-11-10-project-review.md, W-nn).
import { execFileSync } from 'node:child_process'
import { copyFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { mergeItems, type Item } from '../src/modules/items'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { cacheFileName, createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }
async function setup(): Promise<{ ws: WorkspaceService; root: string; remote: string; base: string; sh: (...a: string[]) => string }> {
  const base = await mkdtemp(join(tmpdir(), 'rq-w20-'))
  const remote = join(base, 'remote.git')
  const root = join(base, 'work')
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote])
  execFileSync('git', ['init', '-q', '-b', 'main', root])
  const sh = (...a: string[]): string => execFileSync('git', a, { cwd: root, encoding: 'utf8' })
  sh('config', 'user.name', 'T')
  sh('config', 'user.email', 't@example.invalid')
  sh('remote', 'add', 'origin', remote)
  const userDir = await mkdtemp(join(tmpdir(), 'rq-w20-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: (r: string) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(r))),
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

async function secondPc(remote: string): Promise<{ ws: WorkspaceService; root: string }> {
  const base = await mkdtemp(join(tmpdir(), 'rq-w20-b-'))
  const root = join(base, 'b')
  execFileSync('git', ['clone', '-q', remote, root])
  execFileSync('git', ['config', 'user.name', 'B'], { cwd: root })
  execFileSync('git', ['config', 'user.email', 'b@example.invalid'], { cwd: root })
  const userDir = await mkdtemp(join(tmpdir(), 'rq-w20-userb-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: (r: string) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(r))),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
  await ws.open(root)
  return { ws, root }
}
const edit = async (ws: WorkspaceService, id: string, change: (i: NonNullable<Awaited<ReturnType<WorkspaceService['getItem']>>>['item']) => void): Promise<void> => {
  const got = await ws.getItem(id)
  if (!got) throw new Error(`no ${id}`)
  change(got.item)
  const r = await ws.saveItem(got.item, got.revision)
  if (!r.ok) throw new Error(r.message)
}

describe('0.20.2 whole-project review fixes', () => {
  it('W-01: renewing a copied PARENT moves the copy\'s child, never the original child (copy document sorts after)', async () => {
    const { ws, root } = await setup()
    await ws.renameDocument('System', 'Alpha')
    await ws.refresh(true)
    const top = await add(ws, 'top', undefined, 'Alpha')
    const kid = await add(ws, 'kid', top)
    expect((await ws.commit('originals')).ok).toBe(true)
    await ws.createDocument('Zeta')
    for (const id of [top, kid]) await copyFile(join(root, 'requirements', 'Alpha', `${id}.md`), join(root, 'requirements', 'Zeta', `${id}.md`))
    await ws.refresh(true)
    const r = await ws.renewCopyId(top) // parent first
    expect(r.ok, r.ok ? '' : r.message).toBe(true)
    await ws.refresh(true)
    const newTop = ws.query({ document: 'Zeta' }).items.find((i) => i.title === 'top')
    expect(newTop?.id).not.toBe(top)
    // the original child still points to the original parent
    expect(ws.query({ document: 'Alpha' }).items.find((i) => i.id === kid)?.parent).toBe(top)
    // the copied child now points to the copy
    expect(ws.query({ document: 'Zeta' }).items.find((i) => i.title === 'kid')?.parent).toBe(newTop?.id)
  })
  it('W-02: a document with an Arabic name: a pull where both PCs edited the same item merges, and history finds it', async () => {
    const { ws, remote } = await setup()
    await ws.renameDocument('System', 'متطلبات')
    await ws.refresh(true)
    const id = await add(ws, 'shared', undefined, 'متطلبات')
    expect((await ws.commit('init')).ok).toBe(true)
    expect((await ws.push()).ok).toBe(true)
    const b = await secondPc(remote)
    await edit(b.ws, id, (i) => {
      i.title = 'title from B'
    })
    expect((await b.ws.commit('b')).ok).toBe(true)
    expect((await b.ws.push()).ok).toBe(true)
    await edit(ws, id, (i) => {
      i.fields.status = 'Review' // the line next to the title: Git sees one clash, the field merge solves it
    })
    expect((await ws.commit('a')).ok).toBe(true)
    const p = await ws.pull()
    expect(p.ok, p.message).toBe(true)
    const got = await ws.getItem(id)
    expect(got?.item.title).toBe('title from B')
    expect(got?.item.fields.status).toBe('Review')
    const h = await ws.itemHistory(id)
    expect(JSON.stringify(h)).toMatch(/title from B|b\b/)
    expect(Array.isArray(h) ? h.length : (h as { entries?: unknown[] }).entries?.length ?? 0).toBeGreaterThanOrEqual(3)
  })
  it('W-03: a merge keeps extra keys on links, and a change only to such a key is not lost', () => {
    const schema = { fields: [], itemTypes: [{ id: 'system-requirement', name: 'S' }] } as unknown as Parameters<typeof mergeItems>[3]
    const item = (title: string, note?: string, text = ''): Item => ({
      id: 'REQ-AAAAAAA', type: 'system-requirement', title, fields: {}, text, extra: {},
      links: [{ type: 'refines', target: 'REQ-BBBBBBB', ...(note ? { extra: { note } } : {}) }]
    })
    // mine changed the title, theirs changed only the link note
    const r = mergeItems(item('t', 'old'), item('t mine', 'old'), item('t', 'new'), schema)
    expect(r.conflicts).toEqual([])
    expect(r.item?.title).toBe('t mine')
    expect(r.item?.links[0]?.extra).toEqual({ note: 'new' })
    // only theirs changed the note: the merge must not treat the item as unchanged
    const r2 = mergeItems(item('t', 'old'), item('t', 'old'), item('t', 'new'), schema)
    expect(r2.item?.links[0]?.extra).toEqual({ note: 'new' })
  })
  it('W-04: exporting while an old version is shown gives valid ReqIF (no NUL characters in the title)', async () => {
    const { ws } = await setup()
    await add(ws, 'first')
    expect((await ws.commit('one')).ok).toBe(true)
    const first = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: (await ws.repoInfo())!.root, encoding: 'utf8' }).trim()
    await add(ws, 'second')
    expect((await ws.commit('two')).ok).toBe(true)
    expect((await ws.openVersion(first)).ok).toBe(true)
    const out = await ws.exportItems({ scope: 'all', columns: ['id', 'title'], format: 'reqif' } as Parameters<WorkspaceService['exportItems']>[0])
    const xml = String(out.content)
    expect(xml.includes(String.fromCharCode(0))).toBe(false)
    expect(xml).toMatch(/<TITLE>[^<]*work — requirements<\/TITLE>/)
    await ws.closeVersion()
  })
  it('W-11: Push sends only this branch to its upstream, whatever push.default or a "+" push rule says', async () => {
    const { ws, remote, sh } = await setup()
    await add(ws, 'a')
    expect((await ws.commit('a')).ok).toBe(true)
    expect((await ws.push()).ok).toBe(true)
    sh('branch', 'private-work')
    sh('config', 'push.default', 'matching')
    sh('config', 'remote.origin.push', '+refs/heads/*:refs/heads/*')
    await add(ws, 'b')
    expect((await ws.commit('b')).ok).toBe(true)
    expect((await ws.push()).ok).toBe(true)
    const heads = execFileSync('git', ['for-each-ref', '--format=%(refname)', 'refs/heads/'], { cwd: remote, encoding: 'utf8' })
    expect(heads.trim()).toBe('refs/heads/main')
  })
})
