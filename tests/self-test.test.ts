// The in-app release self-test must pass on a healthy machine — it runs here (Linux) and on the Windows CI runner.
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { runReleaseSelfTest } from '../src/modules/self-test'
import { cacheFileName, createWorkspace } from '../src/modules/workspace'

const quietLog = { info: () => {}, warn: () => {}, error: () => {} }

describe('release self-test', { timeout: 240_000 }, () => {
  it('passes every step on a practice repository and cleans up', async () => {
    const git = createSystemGitAdapter()
    const store = createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml'))
    const r = await runReleaseSelfTest({
      version: 'test',
      gitVersion: async () => {
        const g = await git.getGitInfo()
        return g.installed ? g.version : null
      },
      createWorkspace: (userDir) =>
        createWorkspace({ store, git, userDir, log: quietLog, openIndex: (root) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(root))) })
    })
    const failed = r.steps.filter((s) => !s.ok).map((s) => `${s.name}: ${s.detail ?? ''}`)
    expect(failed).toEqual([])
    expect(r.ok).toBe(true)
    expect(r.steps.length).toBeGreaterThan(12)
  })

  it('reports a failing step and marks the later ones as not run', async () => {
    const git = createSystemGitAdapter()
    const store = createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml'))
    const userDirs: string[] = []
    const r = await runReleaseSelfTest({
      version: 'test',
      gitVersion: async () => null, // "Git is not installed"
      createWorkspace: (userDir) => {
        userDirs.push(userDir)
        return createWorkspace({ store, git, userDir, log: quietLog, openIndex: () => createSqliteIndexCache(':memory:') })
      }
    })
    expect(r.ok).toBe(false)
    expect(r.steps[0]).toMatchObject({ ok: false })
    expect(r.steps[1]?.detail).toMatch(/Not run/)
    // cleaning up always runs
    expect(r.steps.at(-1)).toMatchObject({ ok: true })
    expect(await mkdtemp(join(tmpdir(), 'x-'))).toBeTruthy()
  })
})
