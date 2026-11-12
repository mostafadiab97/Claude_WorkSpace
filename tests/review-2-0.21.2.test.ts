// 0.21.2 — fixes from whole-project review 2 (docs/reviews/2026-11-12-project-review-2.md).
import { execFileSync } from 'node:child_process'
import { copyFile, mkdtemp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { cacheFileName, createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quiet = { info: () => undefined, warn: () => undefined, error: () => undefined }

async function setup(): Promise<{ ws: WorkspaceService; root: string }> {
  const base = await mkdtemp(join(tmpdir(), 'rq-r2-'))
  const root = join(base, 'work')
  execFileSync('git', ['init', '-q', '-b', 'main', root])
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: root })
  execFileSync('git', ['config', 'user.email', 't@example.invalid'], { cwd: root })
  const userDir = await mkdtemp(join(tmpdir(), 'rq-r2-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: (r: string) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(r))),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
  await ws.createProject(root)
  return { ws, root }
}

describe('0.21.2 review 2 fixes', () => {
  it('B-02: an ID in two files can be neither saved nor deleted until the copy gets a new ID', async () => {
    const { ws, root } = await setup()
    const first = (await ws.repoInfo())?.defaultDocument ?? ''
    const r = await ws.saveItem({ id: 'REQ-AAAAAAA', type: 'system-requirement', title: 'original', fields: {}, text: '', links: [], extra: {}, document: first } as Parameters<WorkspaceService['saveItem']>[0], null)
    expect(r.ok, r.ok ? '' : r.message).toBe(true)
    await ws.createDocument('Zeta')
    const from = join(root, 'requirements', first, 'REQ-AAAAAAA.md')
    await copyFile(from, join(root, 'requirements', 'Zeta', 'REQ-AAAAAAA.md'))
    await ws.refresh(true)
    const got = await ws.getItem('REQ-AAAAAAA')
    if (!got) throw new Error('no item')
    const del = await ws.deleteItem('REQ-AAAAAAA', got.revision)
    expect(del.ok).toBe(false)
    expect(del.ok ? '' : del.message).toMatch(/2 files/)
    expect(existsSync(from)).toBe(true) // the original is still there
    const save = await ws.saveItem({ ...got.item, title: 'changed' }, got.revision)
    expect(save.ok).toBe(false)
  })
})
