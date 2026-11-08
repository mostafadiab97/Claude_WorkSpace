// 0.18.0 — the owner's points on 0.17.2 test 2 (8 Nov 2026): requirement files copied by hand into a new document did
// not appear (same ID, and a parent in the other document); "Discard all" left the new, now empty folder behind.
import { execFileSync } from 'node:child_process'
import { copyFile, mkdtemp, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }
async function setup(git = false): Promise<{ ws: WorkspaceService; root: string; sh: (...a: string[]) => string }> {
  const root = await mkdtemp(join(tmpdir(), 'rq-018-'))
  const userDir = await mkdtemp(join(tmpdir(), 'rq-018-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: () => createSqliteIndexCache(join(userDir, 'index.sqlite')),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
  await ws.initialize(root, 'System')
  const sh = (...a: string[]): string => execFileSync('git', a, { cwd: root, encoding: 'utf8' })
  if (git) {
    sh('init', '-q')
    sh('config', 'user.name', 'T')
    sh('config', 'user.email', 't@example.invalid')
    sh('add', '-A')
    sh('commit', '-qm', 'start')
    await ws.open(root)
  }
  return { ws, root, sh }
}
const add = async (ws: WorkspaceService, title: string, parent?: string): Promise<string> => {
  const it = { ...ws.newItem('system-requirement', parent, undefined, parent ? undefined : 'System'), title }
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}

describe('0.18.0 — copied files and discarded documents', () => {
  it('a file copied into another document shows at its top level and gets a new ID with one click', async () => {
    const { ws, root } = await setup()
    const top = await add(ws, 'heading')
    const child = await add(ws, 'child', top)
    await ws.createDocument('Software')
    await copyFile(join(root, 'requirements', 'System', `${child}.md`), join(root, 'requirements', 'Software', `${child}.md`))
    const info = await ws.refresh(true)
    expect(ws.query({ document: 'Software', parent: null }).items.map((i) => i.title)).toEqual(['child'])
    const dup = info.issues.find((i) => i.itemId === child && i.path === 'id')
    expect(dup?.fix).toBe('copy-id')
    const r = await ws.renewCopyId(child)
    expect(r.ok).toBe(true)
    const after = await ws.refresh(false)
    expect(after.issues.filter((i) => i.path === 'id')).toEqual([])
    const copy = ws.query({ document: 'Software' }).items
    expect(copy).toHaveLength(1)
    expect(copy[0]?.id).not.toBe(child)
    expect(copy[0]?.parent).toBeUndefined()
    expect(await readdir(join(root, 'requirements', 'Software'))).toContain(`${copy[0]?.id}.md`)
    expect(ws.query({ document: 'System' }).items.map((i) => i.id).sort()).toEqual([top, child].sort())
  })

  it('Discard all of a new document removes its folder too', async () => {
    const { ws, root } = await setup(true)
    await ws.createDocument('Scratch')
    await add(ws, 'a', undefined)
    const it = { ...ws.newItem('system-requirement', undefined, undefined, 'Scratch'), title: 'x' }
    expect((await ws.saveItem(it, null)).ok).toBe(true)
    const st = await ws.gitState()
    const r = await ws.discardChanges(st.changes.map((c) => c.path))
    expect(r.ok).toBe(true)
    expect(existsSync(join(root, 'requirements', 'Scratch'))).toBe(false)
    expect((await ws.refresh(true)).documents.map((d) => d.name)).toEqual(['System'])
  })
})

import { newerRelease } from '../src/modules/updater/versions'
describe('0.18.0 — update check through the API when the releases feed fails', () => {
  const r = (version: string) => ({ version, date: '', installerUrl: `https://github.com/o/r/releases/download/v${version}/x-Setup-${version}.exe` })
  it('picks the newest release only when it is newer than the running version', () => {
    expect(newerRelease([r('0.17.1'), r('0.18.0'), r('0.17.2')], '0.17.2')?.version).toBe('0.18.0')
    expect(newerRelease([r('0.17.1'), r('0.17.2')], '0.17.2')).toBeNull()
    expect(newerRelease([], '0.17.2')).toBeNull()
    expect(newerRelease([r('0.17.10')], '0.17.9')?.version).toBe('0.17.10')
  })
})
