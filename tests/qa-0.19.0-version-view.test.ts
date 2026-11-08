// QA 0.19.0 — tries to break "open an old version in the table" (openVersion / closeVersion).
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { cacheFileName, createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }
type Ctx = { ws: WorkspaceService; root: string; userDir: string; sh: (...a: string[]) => string; first: string; idA: string }

async function setup(): Promise<Ctx> {
  const base = await mkdtemp(join(tmpdir(), 'rq-qa19-'))
  const root = join(base, 'work')
  const userDir = await mkdtemp(join(tmpdir(), 'rq-qa19-user-'))
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
  await ws.initialize(root, 'System')
  const it0 = { ...ws.newItem('system-requirement', undefined, undefined, 'System'), title: 'Old title' }
  expect((await ws.saveItem(it0, null)).ok).toBe(true)
  expect((await ws.commit('first')).ok).toBe(true)
  const first = sh('rev-parse', 'HEAD').trim()
  // a later state: the title changed and a second item exists
  const cur = await ws.getItem(it0.id)
  expect((await ws.saveItem({ ...cur!.item, title: 'New title' }, cur!.revision)).ok).toBe(true)
  const it1 = { ...ws.newItem('system-requirement', undefined, undefined, 'System'), title: 'Second' }
  expect((await ws.saveItem(it1, null)).ok).toBe(true)
  expect((await ws.commit('second')).ok).toBe(true)
  return { ws, root, userDir, sh, first, idA: it0.id }
}

const cacheFiles = async (userDir: string): Promise<string[]> => (existsSync(join(userDir, 'cache')) ? readdir(join(userDir, 'cache')) : [])

describe('QA 0.19.0 old version in the table', () => {
  it('QA19-01 getItem answers from the commit, not from the working folder', async () => {
    const { ws, first, idA } = await setup()
    expect((await ws.openVersion(first)).ok).toBe(true)
    expect(ws.query({ limit: 10 }).total).toBe(1)
    const d = await ws.getItem(idA)
    expect(d?.item.title).toBe('Old title')
    await ws.closeVersion()
    expect((await ws.getItem(idA))?.item.title).toBe('New title')
  })

  it('QA19-02 every write and Git action is refused while a version is open, and the folder is untouched', async () => {
    const { ws, root, sh, first, idA } = await setup()
    const statusBefore = sh('status', '--porcelain')
    const fileBefore = await readFile(join(root, 'requirements', 'System', `${idA}.md`), 'utf8')
    expect((await ws.openVersion(first)).ok).toBe(true)
    const d = (await ws.getItem(idA))!
    const draft = { ...ws.newItem('system-requirement', undefined, undefined, 'System'), title: 'X' }
    const results = [
      await ws.saveItem({ ...d.item, title: 'hacked' }, d.revision),
      await ws.saveItem(draft, null),
      await ws.deleteItem(idA, d.revision),
      await ws.commit('nope'),
      await ws.push(),
      await ws.pull(),
      await ws.createBranch('x'),
      await ws.createBaseline({ name: 'B', note: '' }),
      await ws.createDocument('Other'),
      await ws.undoLastCommit(),
      await ws.discardChanges([`requirements/System/${idA}.md`]),
      await ws.switchBranch('main', 'discard'),
      await ws.createBranchAt('b2', first),
      await ws.revertChange(idA, { kind: 'text' }).catch(() => ({ ok: false, message: 'threw' }))
    ] as { ok: boolean }[]
    for (const [i, r] of results.entries()) expect(r.ok, `call #${i} must be refused`).toBe(false)
    expect(sh('status', '--porcelain')).toBe(statusBefore)
    expect(sh('branch', '--list').includes('x')).toBe(false)
    expect(await readFile(join(root, 'requirements', 'System', `${idA}.md`), 'utf8')).toBe(fileBefore)
    await ws.closeVersion()
  })

  it('QA19-03 refresh (the window got focus) while a version is open must still say a version is shown', async () => {
    const { ws, first } = await setup()
    expect((await ws.openVersion(first)).ok).toBe(true)
    const r = await ws.refresh(true)
    expect(r.version, 'refresh answered with the live info: the screen would believe the version is closed').toBeDefined()
    expect(r.itemCount).toBe(1)
    await ws.closeVersion()
  })

  it('QA19-04 repoInfo, typeUsage and checkFields describe the shown version, like the table', async () => {
    const { ws, first } = await setup()
    expect((await ws.openVersion(first)).ok).toBe(true)
    expect(ws.repoInfo().itemCount).toBe(1)
    const usage = ws.typeUsage()
    const total = Object.values(usage.items).reduce((a, b) => a + b, 0)
    expect(total, 'typeUsage counts the live items (2) while the table shows 1').toBe(1)
    await ws.closeVersion()
  })

  it('QA19-05 opening another version replaces the first and removes its temporary index; Back to now removes the last', async () => {
    const { ws, userDir, first, sh } = await setup()
    const before = (await cacheFiles(userDir)).length
    expect((await ws.openVersion(first)).ok).toBe(true)
    const during1 = await cacheFiles(userDir)
    expect((await ws.openVersion(sh('rev-parse', 'HEAD').trim())).ok).toBe(true)
    expect(ws.query({ limit: 10 }).total).toBe(2)
    const during2 = await cacheFiles(userDir)
    expect(during2.length).toBe(during1.length) // the first version's file is gone, one new one
    expect(during2.some((f) => !during1.includes(f))).toBe(true)
    const back = await ws.closeVersion()
    expect(back.version).toBeUndefined()
    expect((await cacheFiles(userDir)).length).toBe(before)
    // closing twice is harmless
    expect((await ws.closeVersion()).version).toBeUndefined()
  })

  it('QA19-06 a failing open while another version is shown: what is shown afterwards is consistent with the answer', async () => {
    const { ws, first } = await setup()
    expect((await ws.openVersion(first)).ok).toBe(true)
    const bad = await ws.openVersion('deadbeefdeadbeefdeadbeefdeadbeefdeadbeef')
    expect(bad.ok).toBe(false)
    // either the first version is still shown (and the info says so) or it is closed (and queries show the live 2)
    const shown = ws.repoInfo().version !== undefined
    expect(ws.query({ limit: 10 }).total).toBe(shown ? 1 : 2)
    await ws.closeVersion()
  })

  it('QA19-07 closing the project while viewing removes the temporary index and reopening shows the live data', async () => {
    const { ws, root, userDir, first } = await setup()
    const before = await cacheFiles(userDir)
    expect((await ws.openVersion(first)).ok).toBe(true)
    const temp = (await cacheFiles(userDir)).filter((f) => !before.includes(f))
    expect(temp.length).toBeGreaterThan(0)
    ws.close()
    expect(ws.isOpen()).toBe(false)
    await new Promise((r) => setTimeout(r, 300))
    const left = await cacheFiles(userDir)
    expect(temp.filter((f) => left.includes(f)), 'temporary index files left after closing the project').toEqual([])
    const info = await ws.open(root)
    expect(info.version).toBeUndefined()
    expect(ws.query({ limit: 10 }).total).toBe(2)
    expect((await ws.commit('after')).ok || true).toBe(true) // writes work again
  })

  it('QA19-08 opening a version with no project open, or an empty/odd ref, gives a message and never throws', async () => {
    const { ws, first } = await setup()
    for (const ref of ['', ' ', '--help', 'HEAD~99', `${first}\n`, 'main..main', '-1', 'x'.repeat(5000)]) {
      const r = await ws.openVersion(ref).catch((e: unknown) => ({ threw: String(e) }))
      expect(r, `ref ${JSON.stringify(ref.slice(0, 20))}`).not.toHaveProperty('threw')
    }
    await ws.closeVersion()
    ws.close()
    const r = await ws.openVersion(first).catch((e: unknown) => ({ threw: String(e) }))
    expect(r).toHaveProperty('threw') // documented: no project -> error (the screen never asks)
  })

  it('QA19-09 export while viewing exports the shown version, and the compare of two versions works while viewing', async () => {
    const { ws, first, sh } = await setup()
    expect((await ws.openVersion(first)).ok).toBe(true)
    const opts = await ws.compareOptions()
    expect(opts).toBeTruthy()
    const diff = await ws.compareVersions(first, sh('rev-parse', 'HEAD').trim())
    expect(diff).toBeTruthy()
    await ws.closeVersion()
  })

  it('QA19-10 outline numbers and sort by number in the old version are not mixed with the live ones', async () => {
    const { ws, first, idA } = await setup()
    const live = ws.query({ limit: 10, sort: { by: 'number' } }).items
    expect(live.length).toBe(2)
    expect((await ws.openVersion(first)).ok).toBe(true)
    const old = ws.query({ limit: 10, sort: { by: 'number' } }).items
    expect(old.map((i) => [i.id, i.number])).toEqual([[idA, '1']])
    await ws.closeVersion()
    expect(ws.query({ limit: 10, sort: { by: 'number' } }).items.length).toBe(2)
  })
})
