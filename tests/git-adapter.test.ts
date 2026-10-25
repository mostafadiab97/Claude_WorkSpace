import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'

describe('git-adapter', () => {
  it('reports the installed Git version', async () => {
    const git = createSystemGitAdapter(async () => 'git version 2.47.1.windows.2\n')
    expect(await git.getGitInfo()).toEqual({ installed: true, version: '2.47.1' })
  })

  it('reports Git as missing when the command fails', async () => {
    const git = createSystemGitAdapter(async () => {
      throw new Error('ENOENT')
    })
    const info = await git.getGitInfo()
    expect(info.installed).toBe(false)
    if (!info.installed) expect(info.downloadUrl).toMatch(/^https:\/\/git-scm\.com/)
  })

  it('treats unexpected output as not installed', async () => {
    const git = createSystemGitAdapter(async () => 'something else')
    expect((await git.getGitInfo()).installed).toBe(false)
  })

  it('works against the real Git on this machine', async () => {
    const info = await createSystemGitAdapter().getGitInfo()
    expect(info.installed).toBe(true)
  })
})

// ---- real Git: a bare repository as "GitHub" and two clones as "PC A" and "PC B"
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GitError, parseStatusV2 } from '../src/modules/git-adapter'

const sh = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' })

async function twoPcs(): Promise<{ remote: string; a: string; b: string }> {
  const base = await mkdtemp(join(tmpdir(), 'reqman-git-'))
  const remote = join(base, 'remote.git')
  sh(base, 'init', '-q', '--bare', '-b', 'main', remote)
  const clone = (name: string, user: string): string => {
    const dir = join(base, name)
    sh(base, 'clone', '-q', remote, dir)
    sh(dir, 'config', 'user.name', user)
    sh(dir, 'config', 'user.email', `${user.toLowerCase()}@example.com`)
    sh(dir, 'checkout', '-q', '-B', 'main')
    return dir
  }
  const a = clone('a', 'Alice')
  const b = clone('b', 'Bob')
  return { remote, a, b }
}

const put = async (root: string, path: string, text: string): Promise<void> => {
  await mkdir(join(root, path, '..'), { recursive: true })
  await writeFile(join(root, path), text)
}

describe('git-adapter with real repositories', () => {
  const git = createSystemGitAdapter()

  it('commits only the requirements folder, pushes, and the other PC pulls (fast-forward)', async () => {
    const { a, b } = await twoPcs()
    await put(a, 'requirements/items/SYS-1.md', 'one\n')
    await put(a, 'src/code.c', 'int x;\n')
    let st = await git.status(a, 'requirements')
    expect(st.branch).toBe('main')
    expect(st.changes).toEqual([{ path: 'requirements/items/SYS-1.md', kind: 'added', staged: false }])

    await git.commit(a, 'requirements', 'Add SYS-1')
    expect(sh(a, 'status', '--porcelain')).toContain('?? src/') // code file left alone
    expect(sh(a, 'show', '--name-only', '--format=', 'HEAD').trim()).toBe('requirements/items/SYS-1.md')

    // first push of a new branch: sets the upstream
    st = await git.status(a, 'requirements')
    expect(st.upstream).toBeNull()
    await git.push(a, { remote: 'origin', branch: 'main' })
    st = await git.status(a, 'requirements')
    expect(st.upstream).toBe('origin/main')
    expect(st.ahead).toBe(0)

    // B gets the first commit, then A pushes a second one
    await git.fetch(b)
    sh(b, 'checkout', '-q', '-B', 'main', 'origin/main')
    await put(a, 'requirements/items/SYS-1.md', 'one, edited\n')
    await git.commit(a, 'requirements', 'Edit SYS-1')
    await git.push(a)
    await git.fetch(b)
    st = await git.status(b, 'requirements')
    expect(st.upstream).toBe('origin/main')
    expect(st.behind).toBe(1)
    expect(await git.checkMerge(b, 'origin/main')).toEqual({ clean: true, conflicts: [] })
    await git.merge(b, 'origin/main', true)
    expect(await readFile(join(b, 'requirements/items/SYS-1.md'), 'utf8')).toBe('one, edited\n')
  })

  it('detects conflicts in memory, merges different items, and never forces a push', async () => {
    const { a, b } = await twoPcs()
    await put(a, 'requirements/items/SYS-1.md', 'one\n')
    await put(a, 'requirements/items/SYS-2.md', 'two\n')
    await git.commit(a, 'requirements', 'Start')
    await git.push(a, { remote: 'origin', branch: 'main' })
    await git.fetch(b)
    sh(b, 'checkout', '-q', '-B', 'main', 'origin/main')

    // both change SYS-1, A pushes first
    await put(a, 'requirements/items/SYS-1.md', 'one (Alice)\n')
    await git.commit(a, 'requirements', 'Alice edits SYS-1')
    await git.push(a)
    await put(b, 'requirements/items/SYS-1.md', 'one (Bob)\n')
    await git.commit(b, 'requirements', 'Bob edits SYS-1')

    // Bob's push is rejected (not forced)
    await expect(git.push(b)).rejects.toBeInstanceOf(GitError)
    await git.fetch(b)
    const st = await git.status(b, 'requirements')
    expect([st.ahead, st.behind]).toEqual([1, 1])
    const check = await git.checkMerge(b, 'origin/main')
    expect(check).toEqual({ clean: false, conflicts: ['requirements/items/SYS-1.md'] })
    expect(sh(b, 'status', '--porcelain')).toBe('') // nothing touched

    // different items: merges cleanly
    sh(b, 'reset', '-q', '--hard', 'HEAD~1')
    await put(b, 'requirements/items/SYS-2.md', 'two (Bob)\n')
    await git.commit(b, 'requirements', 'Bob edits SYS-2')
    expect((await git.checkMerge(b, 'origin/main')).clean).toBe(true)
    await git.merge(b, 'origin/main', false)
    expect(await readFile(join(b, 'requirements/items/SYS-1.md'), 'utf8')).toBe('one (Alice)\n')
    expect(await readFile(join(b, 'requirements/items/SYS-2.md'), 'utf8')).toBe('two (Bob)\n')
    await git.push(b)
  })

  it('lists history per file (following renames), shows old versions, discards changes', async () => {
    const { a } = await twoPcs()
    await put(a, 'requirements/items/SYS-1.md', 'v1\n')
    await git.commit(a, 'requirements', 'First')
    await put(a, 'requirements/items/SYS-1.md', 'v2\n')
    await git.commit(a, 'requirements', 'Second: with "quotes" and ünïcode')
    const log = await git.log(a, 'requirements/items/SYS-1.md')
    expect(log.map((c) => [c.message, c.author])).toEqual([
      ['Second: with "quotes" and ünïcode', 'Alice'],
      ['First', 'Alice']
    ])
    expect(await git.show(a, log[1]!.hash, log[1]!.path)).toBe('v1\n')
    expect(await git.show(a, log[1]!.hash, 'requirements/items/NOPE.md')).toBeNull()

    await put(a, 'requirements/items/SYS-1.md', 'v3 (not wanted)\n')
    await put(a, 'requirements/items/NEW-1.md', 'new\n')
    sh(a, 'add', 'requirements/items/NEW-1.md')
    await put(a, 'requirements/items/NEW-2.md', 'new, never added\n')
    await git.discard(a, ['requirements/items/SYS-1.md', 'requirements/items/NEW-1.md', 'requirements/items/NEW-2.md'])
    expect(await readFile(join(a, 'requirements/items/SYS-1.md'), 'utf8')).toBe('v2\n')
    expect((await git.status(a, 'requirements')).changes).toEqual([])
    expect(await git.identity(a)).toEqual({ name: 'Alice', email: 'alice@example.com' })
  })
})

describe('status parsing', () => {
  it('reads branch, upstream, renames, conflicts and paths with spaces', () => {
    const out = [
      '# branch.oid abc',
      '# branch.head main',
      '# branch.upstream origin/main',
      '# branch.ab +2 -3',
      '1 .M N... 100644 100644 100644 a b requirements/items/SYS-1.md',
      '1 A. N... 000000 100644 100644 a b requirements/items/with space.md',
      '2 R. N... 100644 100644 100644 a b R100 requirements/items/NEW.md',
      'requirements/items/OLD.md',
      'u UU N... 100644 100644 100644 100644 a b c requirements/items/SYS-2.md',
      '? requirements/items/SYS-3.md',
      ''
    ].join('\0')
    expect(parseStatusV2(out)).toEqual({
      branch: 'main',
      detached: false,
      upstream: 'origin/main',
      ahead: 2,
      behind: 3,
      changes: [
        { path: 'requirements/items/SYS-1.md', kind: 'modified', staged: false },
        { path: 'requirements/items/with space.md', kind: 'added', staged: true },
        { path: 'requirements/items/NEW.md', kind: 'renamed', staged: true, from: 'requirements/items/OLD.md' },
        { path: 'requirements/items/SYS-2.md', kind: 'conflict', staged: false },
        { path: 'requirements/items/SYS-3.md', kind: 'added', staged: false }
      ]
    })
  })
})
