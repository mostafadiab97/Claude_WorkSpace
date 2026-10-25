// Implementation: uses the Git installed on the user's PC (Git for Windows), so ReqMan works
// with exactly the credentials, SSH keys and configuration the user already has.
// Every call passes arguments as an array (no shell), so file names and messages are never interpreted.
import { execFile } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { join, normalize } from 'node:path'
import type { GitInfo } from '../../shared/api'
import type { CommitInfo, FileChange, GitAdapter, GitStatus, MergeCheck } from './index'

export const GIT_DOWNLOAD_URL = 'https://git-scm.com/downloads/win'

export interface RunOptions {
  cwd?: string
  timeoutMs?: number
}

/** Runs a program and returns its stdout; rejects with a GitError. Injected so tests can fake it. */
export type CommandRunner = (file: string, args: string[], options?: RunOptions) => Promise<string>

/** A Git command that failed: exit code and what Git printed, for messages and decisions. */
export class GitError extends Error {
  constructor(
    message: string,
    readonly args: string[],
    readonly code: number | null,
    readonly stdout: string,
    readonly stderr: string
  ) {
    super(message)
    this.name = 'GitError'
  }
}

const LOCAL_TIMEOUT = 30_000
/** Pull and push may wait for the network or for the user to sign in (Git Credential Manager window). */
const NETWORK_TIMEOUT = 180_000

const defaultRunner: CommandRunner = (file, args, options = {}) =>
  new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      {
        cwd: options.cwd,
        timeout: options.timeoutMs ?? 10_000,
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024,
        // Never wait for a username/password typed into a terminal nobody sees; the Git Credential Manager
        // window (Git for Windows) still appears when a sign-in is needed. LC_ALL keeps messages parseable.
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C', LANG: 'C' }
      },
      (error, stdout, stderr) => {
        if (!error) return resolve(stdout)
        const code = typeof error.code === 'number' ? error.code : null
        const detail = (stderr || stdout || error.message).trim()
        reject(new GitError(detail || `git ${args[0] ?? ''} failed`, args, code, stdout, stderr))
      }
    )
  })

export function parseGitVersion(output: string): string | null {
  // e.g. "git version 2.47.1.windows.2"
  const match = /git version (\d+\.\d+\.\d+)/.exec(output)
  return match?.[1] ?? null
}

/** Conflict states in `git status` (both sides changed the file and Git could not combine them). */
const CONFLICT_CODES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])

/**
 * Parses `git status --porcelain=v2 --branch -z`. Paths stay as Git prints them: relative to the
 * repository top folder, with forward slashes.
 */
export function parseStatusV2(out: string): GitStatus {
  const status: GitStatus = { branch: null, detached: false, upstream: null, ahead: 0, behind: 0, changes: [] }
  const parts = out.split('\0')
  let sawAheadBehind = false
  for (let i = 0; i < parts.length; i++) {
    const line = parts[i] as string
    if (!line) continue
    if (line.startsWith('# branch.head ')) {
      const head = line.slice(14)
      if (head === '(detached)') status.detached = true
      else status.branch = head
    } else if (line.startsWith('# branch.upstream ')) {
      status.upstream = line.slice(18)
    } else if (line.startsWith('# branch.ab ')) {
      const m = /\+(\d+) -(\d+)/.exec(line)
      sawAheadBehind = true
      if (m) {
        status.ahead = Number(m[1])
        status.behind = Number(m[2])
      }
    } else if (line.startsWith('1 ')) {
      // 1 XY sub mH mI mW hH hI path
      const f = line.split(' ')
      status.changes.push(change(f[1] as string, f.slice(8).join(' ')))
    } else if (line.startsWith('2 ')) {
      // 2 XY sub mH mI mW hH hI Xscore path \0 origPath
      const f = line.split(' ')
      const c = change(f[1] as string, f.slice(9).join(' '))
      c.kind = 'renamed'
      c.from = parts[++i] ?? ''
      status.changes.push(c)
    } else if (line.startsWith('u ')) {
      // u XY sub m1 m2 m3 mW h1 h2 h3 path
      const f = line.split(' ')
      status.changes.push({ path: f.slice(10).join(' '), kind: 'conflict', staged: false })
    } else if (line.startsWith('? ')) {
      status.changes.push({ path: line.slice(2), kind: 'added', staged: false })
    }
  }
  // An upstream is configured but its remote branch does not exist (yet, or any more): treat as none,
  // so the next push publishes the branch.
  if (status.upstream && !sawAheadBehind) status.upstream = null
  return status
}

function change(xy: string, path: string): FileChange {
  if (CONFLICT_CODES.has(xy)) return { path, kind: 'conflict', staged: false }
  const [x, y] = [xy[0], xy[1]]
  const kind: FileChange['kind'] = x === 'D' || y === 'D' ? 'deleted' : x === 'A' ? 'added' : 'modified'
  return { path, kind, staged: x !== '.' }
}

/** Files Git refuses to overwrite: lines indented with a tab after "would be overwritten by merge:". */
export function parseOverwrittenFiles(stderr: string): string[] {
  const files: string[] = []
  let inList = false
  for (const line of stderr.split(/\r?\n/)) {
    if (/would be (overwritten|removed) by/.test(line)) inList = true
    else if (inList && /^\s+\S/.test(line)) files.push(line.trim())
    else if (inList) inList = false
  }
  return files
}

export function createSystemGitAdapter(run: CommandRunner = defaultRunner): GitAdapter {
  const git = (root: string, args: string[], timeoutMs = LOCAL_TIMEOUT): Promise<string> => run('git', ['-C', root, ...args], { timeoutMs })
  const configValue = async (root: string, key: string): Promise<string | null> => {
    try {
      return (await git(root, ['config', '--get', key])).trim() || null
    } catch {
      return null // not set
    }
  }

  return {
    async getGitInfo(): Promise<GitInfo> {
      try {
        const out = await run('git', ['--version'])
        const version = parseGitVersion(out)
        if (!version) {
          return { installed: false, reason: `Unrecognised output from git: ${out.trim()}`, downloadUrl: GIT_DOWNLOAD_URL }
        }
        return { installed: true, version }
      } catch {
        return { installed: false, reason: 'Git was not found on this PC.', downloadUrl: GIT_DOWNLOAD_URL }
      }
    },

    async findRepositoryRoot(path: string): Promise<string | null> {
      try {
        const out = (await run('git', ['-C', path, 'rev-parse', '--show-toplevel'])).trim()
        // Git prints forward slashes on Windows; normalise to the platform's form.
        return out ? normalize(out) : null
      } catch {
        return null
      }
    },

    async status(root, pathspec) {
      const out = await git(root, ['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all', '--', pathspec])
      return parseStatusV2(out)
    },

    async remotes(root) {
      return (await git(root, ['remote'])).split(/\r?\n/).map((r) => r.trim()).filter(Boolean)
    },

    async identity(root) {
      return { name: await configValue(root, 'user.name'), email: await configValue(root, 'user.email') }
    },

    async commit(root, pathspec, message) {
      // Stage everything under the path (new, changed, deleted files), then commit ONLY that path:
      // other files the user may have staged for their own commits stay untouched.
      await git(root, ['add', '--all', '--', pathspec])
      await git(root, ['commit', '--quiet', '-m', message, '--only', '--', pathspec])
      return (await git(root, ['rev-parse', 'HEAD'])).trim()
    },

    async fetch(root) {
      await git(root, ['fetch', '--quiet', '--prune'], NETWORK_TIMEOUT)
    },

    async checkMerge(root, upstream): Promise<MergeCheck> {
      // Computes the merge in memory (Git ≥ 2.38); nothing in the working folder changes.
      try {
        await git(root, ['merge-tree', '--write-tree', '--name-only', '--no-messages', 'HEAD', upstream])
        return { clean: true, conflicts: [] }
      } catch (e) {
        if (e instanceof GitError && e.code === 1) {
          // stdout: tree id, then the conflicted paths, one per line
          const lines = e.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
          return { clean: false, conflicts: [...new Set(lines.slice(1))] }
        }
        throw e
      }
    },

    async merge(root, upstream, fastForwardOnly) {
      await git(root, fastForwardOnly ? ['merge', '--ff-only', '--quiet', upstream] : ['merge', '--no-edit', '--quiet', upstream])
    },

    async push(root, setUpstream) {
      await git(root, setUpstream ? ['push', '--quiet', '-u', setUpstream.remote, `HEAD:refs/heads/${setUpstream.branch}`] : ['push', '--quiet'], NETWORK_TIMEOUT)
    },

    async log(root, path, limit = 200): Promise<CommitInfo[]> {
      // \x1e separates commits, \x1f separates fields; --name-only adds the file's path in that commit
      // (it changes when the file was renamed; --follow tracks it).
      const out = await git(root, ['log', '--follow', `-n${limit}`, '--name-only', '--format=%x1e%H%x1f%an%x1f%ae%x1f%aI%x1f%s', '--', path])
      return out
        .split('\x1e')
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => {
          const [head, ...files] = chunk.split(/\r?\n/)
          const [hash, author, email, date, ...subject] = (head ?? '').split('\x1f')
          return { hash: hash ?? '', author: author ?? '', email: email ?? '', date: date ?? '', message: subject.join('\x1f'), path: files.find((f) => f.trim())?.trim() ?? path }
        })
    },

    async show(root, ref, path) {
      try {
        return await git(root, ['show', `${ref}:${path}`])
      } catch (e) {
        if (e instanceof GitError) return null // the file did not exist in that commit
        throw e
      }
    },

    async refExists(root, ref) {
      try {
        await git(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])
        return true
      } catch {
        return false
      }
    },

    async head(root) {
      try {
        return (await git(root, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'])).trim() || null
      } catch {
        return null
      }
    },

    async changedFiles(root, from, to, pathspec) {
      return (await git(root, ['diff', '--name-only', '-z', from, to, '--', pathspec])).split('\0').filter(Boolean)
    },

    async undoLastCommit(root) {
      await git(root, ['reset', '--soft', '--quiet', 'HEAD~1'])
    },

    async lastCommitMessage(root) {
      try {
        return (await git(root, ['log', '-1', '--format=%s'])).trim() || null
      } catch {
        return null
      }
    },

    async abortMerge(root) {
      await git(root, ['merge', '--abort'])
    },

    async setIdentity(root, name, email) {
      await git(root, ['config', '--global', 'user.name', name])
      await git(root, ['config', '--global', 'user.email', email])
    },

    async discard(root, paths) {
      if (paths.length === 0) return
      // Files Git knows go back to the last commit; new (untracked) files are deleted.
      const tracked = (await git(root, ['ls-files', '-z', '--', ...paths])).split('\0').filter(Boolean)
      const inHead = new Set<string>()
      if (tracked.length > 0) {
        try {
          for (const p of (await git(root, ['ls-tree', '-r', '-z', '--name-only', 'HEAD', '--', ...paths])).split('\0')) if (p) inHead.add(p)
        } catch {
          // no commit yet: nothing is in HEAD
        }
      }
      const restore = paths.filter((p) => inHead.has(p))
      const remove = paths.filter((p) => !inHead.has(p))
      if (restore.length > 0) await git(root, ['restore', '--source=HEAD', '--staged', '--worktree', '--', ...restore])
      const stagedNew = remove.filter((p) => tracked.includes(p))
      if (stagedNew.length > 0) await git(root, ['rm', '--cached', '--quiet', '--', ...stagedNew])
      for (const p of remove) await rm(join(root, p), { force: true })
    }
  }
}
