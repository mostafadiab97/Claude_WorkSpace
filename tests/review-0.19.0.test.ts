// 0.19.0 — fixes from the helper review (docs/reviews/agents/0.19.0-*.md).
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { cacheFileName, createWorkspace } from '../src/modules/workspace'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }
async function setup() {
  const base = await mkdtemp(join(tmpdir(), 'rq-r19-'))
  const root = join(base, 'work')
  execFileSync('git', ['init', '-q', '-b', 'main', root])
  const sh = (...a: string[]): string => execFileSync('git', a, { cwd: root, encoding: 'utf8' })
  sh('config', 'user.name', 'T')
  sh('config', 'user.email', 't@example.invalid')
  const userDir = await mkdtemp(join(tmpdir(), 'rq-r19-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: (r: string) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(r))),
    openIndexAt: (file: string) => createSqliteIndexCache(file),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
  await ws.initialize(root, 'System')
  const it = { ...ws.newItem('system-requirement', undefined, undefined, 'System'), title: 'one', text: 'x'.repeat(5000) }
  expect((await ws.saveItem(it, null)).ok).toBe(true)
  expect((await ws.commit('one')).ok).toBe(true)
  return { ws, root, userDir, sh, id: it.id }
}

describe('0.19.0 review fixes', () => {
  it('CR19-02/03: while a version is shown the window gets the folder, and a refused Git action still carries its state', async () => {
    const { ws, root, sh } = await setup()
    const v = await ws.openVersion(sh('rev-parse', 'HEAD').trim())
    expect(v.ok).toBe(true)
    if (!v.ok) return
    expect(v.info.root).toBe(root)
    expect(v.info.name).toBe('work')
    const r = await ws.commit('no')
    expect(r.ok).toBe(false)
    expect(r.state?.available).toBe(true)
    await ws.closeVersion()
  })

  it('CR19-07: an old version\'s temporary index lives in cache/versions and is removed on Back to now', async () => {
    const { ws, userDir, sh } = await setup()
    expect((await ws.openVersion(sh('rev-parse', 'HEAD').trim())).ok).toBe(true)
    const dir = join(userDir, 'cache', 'versions')
    expect((await readdir(dir)).some((f) => f.endsWith('.sqlite'))).toBe(true)
    await ws.closeVersion()
    expect((await readdir(dir)).filter((f) => f.endsWith('.sqlite'))).toEqual([])
  })

  it('CR19-05: closing the project while a version opens leaves nothing shown', async () => {
    const { ws, userDir, sh } = await setup()
    const opening = ws.openVersion(sh('rev-parse', 'HEAD').trim())
    ws.close()
    // before the reading started it is refused at once (no project), during the reading it ends without a version
    const r = await opening.catch(() => ({ ok: false as const, message: 'no project' }))
    expect(r.ok).toBe(false)
    expect(existsSync(join(userDir, 'cache', 'versions')) ? (await readdir(join(userDir, 'cache', 'versions'))).filter((f) => f.endsWith('.sqlite')) : []).toEqual([])
  })

  it('SEC-19-03: the table asks for at most textUpTo characters of each text', async () => {
    const { ws, id } = await setup()
    expect(ws.query({ limit: 5, textUpTo: 3001 }).items.find((i) => i.id === id)?.text.length).toBe(3001)
    expect(ws.query({ limit: 5 }).items.find((i) => i.id === id)?.text.length).toBe(5000)
  })
})
