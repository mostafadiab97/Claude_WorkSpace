// 0.17.1 — the owner's report on 0.17.0 test 2 (8 Nov 2026): renaming the sandbox's "items" folder (10,005 files)
// failed on Windows — Git was stopped by the 30 s limit while adding the files, the folder was not put back, and
// "Discard all" of 10,000 changes failed with "spawn ENAMETOOLONG". These tests reproduce each part.
import { execFile, execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter, GitError, type CommandRunner } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }

/** Runs git for real; `hook` may refuse a command first, and every command line length is recorded. */
function runner(hook?: (args: string[]) => void, longest = { chars: 0 }): CommandRunner {
  return (file, args, options = {}) =>
    new Promise((resolve, reject) => {
      longest.chars = Math.max(longest.chars, args.join(' ').length)
      try {
        hook?.(args)
      } catch (e) {
        return reject(e)
      }
      const child = execFile(file, args, { cwd: options.cwd, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LITERAL_PATHSPECS: '1', ...options.env } }, (error, stdout, stderr) =>
        error ? reject(new GitError(stderr || error.message, args, null, stdout, stderr)) : resolve(stdout)
      )
      if (options.input !== undefined) child.stdin?.end(options.input)
    })
}

const item = (id: string): string => `---\nid: ${id}\ntype: system-requirement\ntitle: ${id}\n---\ntext\n`

async function project(count: number, run: CommandRunner, layout: 'items' | 'loose' = 'items'): Promise<{ ws: WorkspaceService; root: string; sh: (...a: string[]) => string }> {
  const root = await mkdtemp(join(tmpdir(), 'rq-big-'))
  const userDir = await mkdtemp(join(tmpdir(), 'rq-big-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(run),
    openIndex: () => createSqliteIndexCache(join(userDir, 'index.sqlite')),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
  await ws.initialize(root) // the layout of a project made before 0.17: requirements/items/
  const dir = layout === 'items' ? join(root, 'requirements', 'items') : join(root, 'requirements')
  await Promise.all(Array.from({ length: count }, (_, i) => writeFile(join(dir, `REQ-${String(i).padStart(7, '0')}.md`), item(`REQ-${String(i).padStart(7, '0')}`))))
  const sh = (...a: string[]): string => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  sh('init', '-q')
  sh('config', 'user.name', 'T')
  sh('config', 'user.email', 't@example.invalid')
  sh('add', '-A')
  sh('commit', '-qm', 'start')
  await ws.open(root)
  return { ws, root, sh }
}

describe('0.17.1 — renaming a big document safely', () => {
  it('a folder of 3,000 items is renamed with a name that has a space, in one commit of renames only', async () => {
    const { ws, root, sh } = await project(3000, runner())
    const r = await ws.renameDocument('items', 'SandBox Req')
    expect(r.ok ? '' : r.message).toBe('')
    expect((await readdir(join(root, 'requirements', 'SandBox Req'))).filter((f) => f.endsWith('.md'))).toHaveLength(3000)
    expect(sh('status', '--porcelain')).toBe('')
    const stat = sh('show', '--name-status', '--format=', 'HEAD').trim().split('\n')
    const mdOnly = stat.filter((l) => l.endsWith('.md'))
    expect(mdOnly.length).toBe(3000)
    expect(stat.every((l) => l.startsWith('R100'))).toBe(true)
    expect(ws.query({ document: 'SandBox Req', limit: 0 }).total).toBe(3000)
  }, 300_000) // 3,000 files on the Windows CI runner: usually 40–90 s, once over 120 s (0.21.1 release)

  it('when Git stops halfway (time limit), everything is put back and the window shows the old folder', async () => {
    const stopped = runner((args) => {
      if (args.includes('commit')) throw new GitError('Git was stopped: it timed out. Command failed', args, null, '', '')
    })
    const { ws, root, sh } = await project(500, stopped)
    const r = await ws.renameDocument('items', 'SandBox Req')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/put back/)
    expect(existsSync(join(root, 'requirements', 'items'))).toBe(true)
    expect(existsSync(join(root, 'requirements', 'SandBox Req'))).toBe(false)
    expect(sh('status', '--porcelain')).toBe('') // index and folder as before
    const info = await ws.refresh(false)
    expect(info.documents).toEqual([{ name: 'items', itemCount: 500 }])
  }, 120_000)

  it('more than 300 loose files can be moved into a document (no limit any more), history kept', async () => {
    const { ws, root, sh } = await project(1200, runner(), 'loose')
    const r = await ws.renameDocument('', 'Specification')
    expect(r.ok ? '' : r.message).toBe('')
    expect((await readdir(join(root, 'requirements'))).filter((f) => f.endsWith('.md'))).toEqual([])
    expect(sh('status', '--porcelain')).toBe('')
    expect(ws.query({ document: 'Specification', limit: 0 }).total).toBe(1200)
  }, 120_000)

  it('"Discard all" of thousands of changes never builds one very long command line', async () => {
    const longest = { chars: 0 }
    const { ws, root, sh } = await project(2000, runner(undefined, longest))
    // the owner's state: all files moved by hand out of the folder
    sh('mv', 'requirements/items', 'requirements/moved')
    await ws.refresh(true)
    longest.chars = 0
    const state = await ws.gitState()
    const r = await ws.discardChanges(state.changes.map((c) => c.path))
    expect(r.ok).toBe(true)
    expect(longest.chars).toBeLessThan(30_000) // Windows refuses a command line over ~32,000 characters
    expect(sh('status', '--porcelain', '--', 'requirements/items')).toBe('')
    expect((await readdir(join(root, 'requirements', 'items'))).length).toBeGreaterThanOrEqual(2000)
  }, 180_000)
})
