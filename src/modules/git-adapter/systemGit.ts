// Implementation: uses the Git installed on the user's PC (Git for Windows), so ReqMan works
// with exactly the credentials, SSH keys and configuration the user already has.
// Every call passes arguments as an array (no shell), so file names and messages are never interpreted.
import { execFile, spawn } from 'node:child_process'
import { mkdtemp, rm, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, normalize } from 'node:path'
import type { GitInfo } from '../../shared/api'
import type { CommitInfo, FileChange, GitAdapter, GitRef, GitStatus, MergeCheck, NameStatus, ReflogEntry } from './index'

export const GIT_DOWNLOAD_URL = 'https://git-scm.com/downloads/win'

export interface RunOptions {
  cwd?: string
  timeoutMs?: number
  /** Extra environment variables (e.g. GIT_INDEX_FILE for a temporary index, GIT_REFLOG_ACTION). */
  env?: Record<string, string>
  /** Text written to the program's standard input. */
  input?: string
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
/**
 * Commands over many files (a document folder of 10,000 items) — on Windows with a virus scanner, adding thousands of
 * files took longer than 30 s, Git was stopped halfway and the rename could not be put back (the owner, 8 Nov 2026).
 */
const BULK_TIMEOUT = 15 * 60_000
/** Paths per command: Windows refuses a command line over ~32,000 characters ("spawn ENAMETOOLONG"). */
const PATHS_PER_COMMAND = 200
const chunks = <X>(xs: X[], n = PATHS_PER_COMMAND): X[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))
/** A path list for `--pathspec-from-file=- --pathspec-file-nul` (no command-line length limit). */
const nulList = (paths: string[]): string => paths.map((p) => `${p}\0`).join('')
/** Pull and push may wait for the network or for the user to sign in (Git Credential Manager window). */
const NETWORK_TIMEOUT = 180_000

// GIT_LITERAL_PATHSPECS: a path is always a path, never a pattern — an ID like "X[1]" must not also match X1.md (SEC-17-01)
const GIT_ENV = (): NodeJS.ProcessEnv => ({ ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LITERAL_PATHSPECS: '1', LC_ALL: 'C', LANG: 'C' })
/**
 * Settings every Git call gets: paths printed as they are, not quoted with octal escapes (W-02: an Arabic document
 * name made merge-tree and log print "requirements/\331\205…", so pulls and history missed those files), and on
 * Windows paths over 260 characters (W-12: a deep project folder + a long document name made commit fail).
 */
export const GIT_CONFIG_ARGS: readonly string[] = ['-c', 'core.quotePath=false', ...(process.platform === 'win32' ? ['-c', 'core.longpaths=true'] : [])]

/**
 * Reads many files of one commit through a single `git cat-file --batch` process (one process instead of one
 * `git show` per file — matters for thousands of files). Returns null for files missing in that commit.
 */
export function readBlobs(root: string, oids: string[], timeoutMs = 120_000): Promise<Map<string, string | null>> {
  // Objects are named by their blob ID (from `git diff --raw` / `ls-tree`). Naming them "<commit>:<path>" would make
  // Git search the folder listing for every file — very slow with 10,000 files in one folder.
  return new Promise((resolve, reject) => {
    const result = new Map<string, string | null>()
    const wanted = [...new Set(oids)]
    if (wanted.length === 0) return resolve(result)
    const child = spawn('git', [...GIT_CONFIG_ARGS, '-C', root, 'cat-file', '--batch'], { windowsHide: true, env: GIT_ENV() })
    const timer = setTimeout(() => child.kill(), timeoutMs)
    let buf: Buffer = Buffer.alloc(0)
    let index = 0
    let stderr = ''
    const parse = (): void => {
      while (index < wanted.length) {
        const nl = buf.indexOf(10)
        if (nl < 0) return
        const header = buf.subarray(0, nl).toString('utf8')
        const oid = wanted[index] as string
        if (header.endsWith(' missing') || header.endsWith(' ambiguous')) {
          result.set(oid, null)
          buf = buf.subarray(nl + 1)
          index++
          continue
        }
        const size = Number(header.split(' ')[2])
        if (buf.length < nl + 1 + size + 1) return // wait for the rest of this object
        result.set(oid, buf.subarray(nl + 1, nl + 1 + size).toString('utf8'))
        buf = buf.subarray(nl + 1 + size + 1)
        index++
      }
    }
    child.stdout.on('data', (chunk: Buffer) => {
      buf = buf.length ? Buffer.concat([buf, chunk]) : chunk
      parse()
      if (index >= wanted.length) child.stdin.end()
    })
    child.stderr.on('data', (c: Buffer) => (stderr += c.toString()))
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (index >= wanted.length) resolve(result)
      else reject(new GitError(stderr.trim() || `git cat-file stopped (${code ?? 'killed'})`, ['cat-file', '--batch'], code, '', stderr))
    })
    child.stdin.on('error', () => {}) // the process may close early on errors; reported via "close"
    child.stdin.write(wanted.map((o) => `${o}\n`).join(''))
  })
}

const defaultRunner: CommandRunner = (file, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = execFile(
      file,
      args,
      {
        cwd: options.cwd,
        timeout: options.timeoutMs ?? 10_000,
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024,
        // Never wait for a username/password typed into a terminal nobody sees; the Git Credential Manager
        // window (Git for Windows) still appears when a sign-in is needed. LC_ALL keeps messages parseable.
        env: { ...GIT_ENV(), ...options.env }
      },
      (error, stdout, stderr) => {
        if (!error) return resolve(stdout)
        const code = typeof error.code === 'number' ? error.code : null
        // stopped by the time limit: say so — "Command failed: git …" alone hid the cause (the owner, 8 Nov 2026)
        const tooMuch = (error as { code?: unknown }).code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'
        const stopped = tooMuch ? 'Git was stopped: its output was too large. ' : (error as { killed?: boolean }).killed === true || (error as { signal?: string | null }).signal ? 'Git was stopped: it timed out. ' : ''
        const detail = `${stopped}${(stderr || stdout || error.message).trim()}`
        reject(new GitError(detail || `git ${args[0] ?? ''} failed`, args, code, stdout, stderr))
      }
    )
    if (options.input !== undefined) {
      child.stdin?.on('error', () => {}) // reported through the callback
      child.stdin?.end(options.input)
    }
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

/** Markers in push errors the workspace turns into texts (core messages come from shared/text there). */
export const PUSH_NO_UPSTREAM = 'reqochet:push-no-upstream'
export const PUSH_OTHER_NAME = 'reqochet:push-other-name'

export function createSystemGitAdapter(run: CommandRunner = defaultRunner): GitAdapter {
  const git = (root: string, args: string[], timeoutMs = LOCAL_TIMEOUT, extra: Omit<RunOptions, 'timeoutMs'> = {}): Promise<string> =>
    run('git', [...GIT_CONFIG_ARGS, '-C', root, ...args], { timeoutMs, ...extra })
  // a list in one repository config value, written in one call (CR18-11)
  const configList = async (root: string, key: string): Promise<string[]> => {
    try {
      return (await git(root, ['config', '--local', '--get', key])).trim().split(/\s+/).filter(Boolean)
    } catch {
      return [] // not set
    }
  }
  const setConfigList = async (root: string, key: string, names: string[]): Promise<void> => {
    if (names.length === 0) await git(root, ['config', '--local', '--unset-all', key]).catch(() => undefined)
    else await git(root, ['config', '--local', key, names.join(' ')])
  }
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
      // thousands of files (a first commit, an import) with a virus scanner: the bulk limit, not 30 s (W-08)
      await git(root, ['add', '--all', '--', pathspec], BULK_TIMEOUT)
      await git(root, ['commit', '--quiet', '-m', message, '--only', '--', pathspec], BULK_TIMEOUT)
      return (await git(root, ['rev-parse', 'HEAD'])).trim()
    },

    async trackedFiles(root, path) {
      return (await git(root, ['ls-files', '-z', '--', path])).split('\0').filter(Boolean)
    },

    async unstage(root, paths) {
      // works before the first commit too (no HEAD to reset to)
      for (const part of chunks(paths)) {
        await git(root, ['rm', '-r', '--cached', '--quiet', '--ignore-unmatch', '--', ...part], BULK_TIMEOUT).catch(() => undefined)
        await git(root, ['reset', '-q', '--', ...part], BULK_TIMEOUT).catch(() => undefined)
      }
    },

    async move(root, sources, destination) {
      // `git mv` renames on disk and in Git's index in one step, without reading the files again (fast for 10,000)
      if (sources.length === 1) await git(root, ['mv', '--', sources[0] as string, destination], BULK_TIMEOUT)
      else for (const part of chunks(sources, 100)) await git(root, ['mv', '--', ...part, `${destination}/`], BULK_TIMEOUT)
    },

    async commitFiles(root, paths, message, alreadyStaged = false) {
      // the path list goes through standard input: no command-line limit, and a long time limit for many files
      // (after `git mv` the index already holds the change; adding the old, now empty path would fail)
      if (!alreadyStaged) await git(root, ['add', '--pathspec-from-file=-', '--pathspec-file-nul'], BULK_TIMEOUT, { input: nulList(paths) })
      await git(root, ['commit', '--quiet', '-m', message, '--only', '--pathspec-from-file=-', '--pathspec-file-nul'], BULK_TIMEOUT, { input: nulList(paths) })
      return (await git(root, ['rev-parse', 'HEAD'])).trim()
    },

    async fetch(root) {
      await git(root, ['fetch', '--quiet', '--prune'], NETWORK_TIMEOUT)
    },

    async checkMerge(root, upstream, ours): Promise<MergeCheck> {
      // Computes the merge in memory (Git ≥ 2.38); nothing in the working folder changes.
      try {
        const out = await git(root, ['merge-tree', '--write-tree', '--name-only', '--no-messages', ours ?? 'HEAD', upstream])
        return { clean: true, conflicts: [], tree: out.trim().split(/\r?\n/)[0] ?? '' }
      } catch (e) {
        if (e instanceof GitError && e.code === 1) {
          // stdout: tree id (with conflict markers in the clashing files), then the conflicted paths, one per line
          const lines = e.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
          return { clean: false, conflicts: [...new Set(lines.slice(1))], tree: lines[0] ?? '' }
        }
        throw e
      }
    },

    async merge(root, upstream, fastForwardOnly, reflogAction) {
      await git(root, fastForwardOnly ? ['merge', '--ff-only', '--quiet', upstream] : ['merge', '--no-edit', '--quiet', upstream], BULK_TIMEOUT, reflogAction ? { env: { GIT_REFLOG_ACTION: reflogAction } } : {})
    },

    async mergeBase(root, a, b) {
      try {
        return (await git(root, ['merge-base', a, b])).trim() || null
      } catch {
        return null // no common history
      }
    },

    async isAncestor(root, a, b) {
      try {
        await git(root, ['merge-base', '--is-ancestor', a, b])
        return true
      } catch (e) {
        if (e instanceof GitError && e.code === 1) return false
        throw e
      }
    },

    async commitTree(root, tree, files, parents, message) {
      // A temporary index (never the user's): Git's merged tree, then the decided files on top. The working
      // folder and the user's staged files are not touched; the caller fast-forwards to the new commit.
      const dir = await mkdtemp(join(tmpdir(), 'reqman-merge-'))
      const env = { GIT_INDEX_FILE: join(dir, 'index') }
      try {
        await git(root, ['read-tree', tree], LOCAL_TIMEOUT, { env })
        for (const f of files) {
          if (f.content === null) {
            await git(root, ['update-index', '--force-remove', '--', f.path], LOCAL_TIMEOUT, { env })
          } else {
            const blob = (await git(root, ['hash-object', '-w', '--stdin', `--path=${f.path}`], LOCAL_TIMEOUT, { input: f.content })).trim()
            await git(root, ['update-index', '--add', '--cacheinfo', `100644,${blob},${f.path}`], LOCAL_TIMEOUT, { env })
          }
        }
        const finalTree = (await git(root, ['write-tree'], LOCAL_TIMEOUT, { env })).trim()
        return (await git(root, ['commit-tree', finalTree, ...parents.flatMap((p) => ['-p', p]), '-m', message])).trim()
      } finally {
        await rm(dir, { recursive: true, force: true })
      }
    },

    async restoreFrom(root, ref, paths) {
      // a few hundred paths per call keeps the command line short enough for Windows
      for (let i = 0; i < paths.length; i += 200) await git(root, ['restore', `--source=${ref}`, '--worktree', '--', ...paths.slice(i, i + 200)], BULK_TIMEOUT)
    },

    async treeOf(root, ref) {
      try {
        return (await git(root, ['rev-parse', '--verify', '--quiet', `${ref}^{tree}`])).trim() || null
      } catch {
        return null
      }
    },

    async deleteBranch(root, name, force) {
      await git(root, ['branch', force ? '-D' : '-d', name])
    },

    async checkBranchName(root, name) {
      try {
        await git(root, ['check-ref-format', '--branch', name])
        return true
      } catch {
        return false
      }
    },

    async switchBranch(root, name, create) {
      // `git switch` carries uncommitted changes along when they do not clash, and refuses otherwise (nothing lost)
      if (create) await git(root, ['switch', '--quiet', '-c', name, create.startPoint, ...(create.track ? ['--track'] : ['--no-track'])], BULK_TIMEOUT)
      else await git(root, ['switch', '--quiet', name], BULK_TIMEOUT)
    },

    async init(root) {
      await git(root, ['init', '--quiet', '-b', 'main'])
    },

    async addRemote(root, name, url) {
      await git(root, ['remote', 'add', name, url])
    },

    async push(root, setUpstream) {
      if (setUpstream) {
        await git(root, ['push', '--quiet', '-u', setUpstream.remote, `HEAD:refs/heads/${setUpstream.branch}`], NETWORK_TIMEOUT)
        return
      }
      // name exactly what is sent — this branch to its upstream branch, never with "+" — so the user's Git settings
      // (push.default=matching, a "+" push rule) can never push other branches or force a push (W-11)
      const branch = (await git(root, ['symbolic-ref', '--short', 'HEAD'])).trim()
      const config = async (key: string): Promise<string> => (await git(root, ['config', '--get', key]).catch(() => '')).trim()
      const upstreamRemote = await config(`branch.${branch}.remote`)
      const merge = await config(`branch.${branch}.merge`)
      // where Git itself would push: a push remote (fork workflow) wins over the upstream's remote (CR-05)
      const remote = (await config(`branch.${branch}.pushRemote`)) || (await config('remote.pushDefault')) || upstreamRemote
      if (!remote) throw new GitError(PUSH_NO_UPSTREAM, ['push'], null, '', '')
      // the branch goes to the branch of the same name; an upstream of another name (git switch -c fix origin/main)
      // is refused like plain `git push` does, so "fix" never lands on the shared main (CR-01)
      if (remote === upstreamRemote && merge && merge !== `refs/heads/${branch}`) {
        throw new GitError(`${PUSH_OTHER_NAME}\n${branch}\n${merge.replace(/^refs\/heads\//, '')}`, ['push'], null, '', '')
      }
      await git(root, ['push', '--quiet', remote, `HEAD:refs/heads/${branch}`], NETWORK_TIMEOUT)
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

    async commitInfo(root, ref) {
      try {
        const out = (await git(root, ['log', '-1', '--format=%H%x1f%an%x1f%ae%x1f%aI%x1f%s', ref, '--'])).trim()
        const [hash, author, email, date, ...subject] = out.split('\x1f')
        return hash ? { hash, author: author ?? '', email: email ?? '', date: date ?? '', message: subject.join('\x1f'), path: '' } : null
      } catch {
        return null
      }
    },

    // ---- baselines (S-06): annotated tags refs/tags/baseline/<name>; history list (S-09) ----
    async baselines(root) {
      // six NUL-ended fields per tag: a tag message cannot contain NUL, so a crafted note cannot add entries (SEC-18-03)
      const out = await git(root, ['for-each-ref', '--sort=-creatordate', '--format=%(refname:strip=3)%00%(*objectname)%00%(objectname)%00%(taggername)%00%(creatordate:iso-strict)%00%(contents)%00', 'refs/tags/baseline/'])
      const f = out.split('\0')
      const list: { name: string; commit: string; by: string; date: string; note: string }[] = []
      for (let i = 0; i + 5 < f.length; i += 6) {
        const name = (f[i] ?? '').replace(/^\r?\n/, '')
        if (!name) continue
        list.push({ name, commit: f[i + 1] || f[i + 2] || '', by: f[i + 3] ?? '', date: f[i + 4] ?? '', note: (f[i + 5] ?? '').trim() })
      }
      return list
    },
    async checkBaselineName(root, name) {
      try {
        await git(root, ['check-ref-format', `refs/tags/baseline/${name}`])
        return true
      } catch {
        return false
      }
    },
    async createBaseline(root, name, commit, note) {
      await git(root, ['tag', '-a', '-m', note || name, `baseline/${name}`, commit])
    },
    async pushBaselines(root, remote, names) {
      // one by one: a name a colleague already pushed must not block the others (QA-02, SEC-18-06)
      const refused: string[] = []
      for (const n of names) {
        try {
          await git(root, ['push', '--quiet', remote, `refs/tags/baseline/${n}:refs/tags/baseline/${n}`], NETWORK_TIMEOUT)
        } catch (e) {
          if (/rejected|already exists|does not match/i.test(String((e as Error).message))) refused.push(n)
          else throw e
        }
      }
      return refused
    },
    // one config value with the names separated by spaces (a baseline name has none): written in one call (CR18-11)
    async pendingBaselines(root) {
      return configList(root, 'reqochet.baselinesToPush')
    },
    async setPendingBaselines(root, names) {
      await setConfigList(root, 'reqochet.baselinesToPush', names)
    },
    async refusedBaselines(root) {
      return configList(root, 'reqochet.baselinesRefused')
    },
    async setRefusedBaselines(root, names) {
      await setConfigList(root, 'reqochet.baselinesRefused', names)
    },

    async history(root, pathspec, opts) {
      const args = ['log', `-n${opts.limit + 1}`, `--skip=${opts.skip}`, '--format=%x1e%H%x1f%an%x1f%ae%x1f%aI%x1f%s']
      const search = opts.search?.trim()
      // a commit ID (or its start) finds that commit; other words are searched in the commit messages
      if (!(await git(root, ['rev-parse', '--verify', '--quiet', 'HEAD']).then(() => true, () => false))) return { commits: [], more: false }
      if (search && /^[0-9a-f]{4,40}$/i.test(search)) {
        const hash = await git(root, ['rev-parse', '--verify', '--quiet', `${search}^{commit}`]).then((h) => h.trim(), () => '')
        // only commits of the current branch: not one taken back with "Undo commit" or on another branch (SEC-18-05)
        const onBranch = hash ? await git(root, ['merge-base', '--is-ancestor', hash, 'HEAD']).then(() => true, () => false) : false
        if (onBranch) {
          // exactly that commit, also when it did not touch the requirements folder (CR18-08)
          const one = await git(root, ['log', '-n1', '--format=%H%x1f%an%x1f%ae%x1f%aI%x1f%s', hash])
          const [h, author, email, date, ...subject] = one.trim().split('\x1f')
          return { commits: opts.skip > 0 ? [] : [{ hash: h ?? '', author: author ?? '', email: email ?? '', date: date ?? '', message: subject.join('\x1f'), path: pathspec }], more: false }
        }
        args.push('--regexp-ignore-case', '--fixed-strings', `--grep=${search}`)
      } else if (search) args.push('--regexp-ignore-case', '--fixed-strings', `--grep=${search}`)
      args.push('--', pathspec)
      const list = (await git(root, args))
        .split('\x1e')
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => {
          const [hash, author, email, date, ...subject] = c.split('\x1f')
          return { hash: hash ?? '', author: author ?? '', email: email ?? '', date: date ?? '', message: subject.join('\x1f'), path: pathspec }
        })
      return { commits: list.slice(0, opts.limit), more: list.length > opts.limit }
    },
    async createBranchAt(root, name, commit) {
      await git(root, ['branch', '--', name, commit])
    },

    async commits(root, pathspec, limit = 100): Promise<CommitInfo[]> {
      const out = await git(root, ['log', `-n${limit}`, '--format=%x1e%H%x1f%an%x1f%ae%x1f%aI%x1f%s', '--', pathspec])
      return out
        .split('\x1e')
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => {
          const [hash, author, email, date, ...subject] = c.split('\x1f')
          return { hash: hash ?? '', author: author ?? '', email: email ?? '', date: date ?? '', message: subject.join('\x1f'), path: pathspec }
        })
    },

    async reflog(root, limit = 300): Promise<ReflogEntry[]> {
      try {
        // %gd with --date gives "HEAD@{<when HEAD moved>}" — the time of the pull, not of the commit
        const out = await git(root, ['reflog', 'show', `-n${limit}`, '--date=iso-strict', '--format=%H%x1f%gs%x1f%gd', 'HEAD'])
        return out
          .split(/\r?\n/)
          .filter(Boolean)
          .map((l) => {
            const [hash, subject, selector] = l.split('\x1f')
            return { hash: hash ?? '', subject: subject ?? '', date: /\{(.*)\}/.exec(selector ?? '')?.[1] ?? '' }
          })
      } catch {
        return [] // no commits yet
      }
    },

    async refs(root): Promise<GitRef[]> {
      const out = await git(root, ['for-each-ref', '--format=%(refname)%1f%(objectname)%1f%(*objectname)', 'refs/heads', 'refs/remotes', 'refs/tags'])
      return out
        .split(/\r?\n/)
        .filter(Boolean)
        .map((l) => {
          const [ref, oid, peeled] = l.split('\x1f')
          const name = (ref ?? '').replace(/^refs\/(heads|remotes|tags)\//, '')
          const kind: GitRef['kind'] = ref?.startsWith('refs/heads/') ? 'branch' : ref?.startsWith('refs/tags/') ? 'tag' : 'remote'
          return { name, kind, hash: peeled || oid || '' }
        })
        .filter((r) => !r.name.endsWith('/HEAD'))
    },

    async resolve(root, ref) {
      try {
        return (await git(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])).trim() || null
      } catch {
        return null
      }
    },

    async diffNameStatus(root, from, to, pathspec): Promise<NameStatus[]> {
      // --raw gives both blob IDs; to = null compares with the working folder (new side = 000… → read the file)
      const args = ['diff', '--raw', '-z', '-M', '--no-color', '--abbrev=40', from, ...(to ? [to] : []), '--', pathspec]
      const parts = (await git(root, args, NETWORK_TIMEOUT)).split('\0')
      const out: NameStatus[] = []
      const zero = /^0+$/
      for (let i = 0; i < parts.length; i++) {
        const meta = parts[i]
        if (!meta?.startsWith(':')) continue
        // :100644 100644 <old> <new> M
        const [, , oldOid, newOid, code] = meta.slice(1).split(' ')
        const status = (code ?? 'M')[0] as string
        const blob = (o: string | undefined): string | null => (o && !zero.test(o) ? o : null)
        if (status === 'R' || status === 'C') {
          out.push({ status: status === 'R' ? 'R' : 'A', from: parts[i + 1] ?? '', path: parts[i + 2] ?? '', oldOid: status === 'R' ? blob(oldOid) : null, newOid: blob(newOid) })
          i += 2
        } else {
          out.push({ status: (status === 'T' ? 'M' : status) as NameStatus['status'], path: parts[i + 1] ?? '', oldOid: blob(oldOid), newOid: blob(newOid) })
          i += 1
        }
      }
      if (!to) {
        const untracked = (await git(root, ['ls-files', '--others', '--exclude-standard', '-z', '--', pathspec])).split('\0').filter(Boolean)
        for (const p of untracked) out.push({ status: 'A', path: p, oldOid: null, newOid: null })
      }
      return out
    },

    readBlobs: (root, oids) => readBlobs(root, oids),


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
      await git(root, ['reset', '--soft', '--quiet', 'HEAD~1'], BULK_TIMEOUT)
    },

    async headSummary(root) {
      try {
        // first line: the last commit's parents (two = a joining commit made by a pull), then its message
        const [parents = '', message = ''] = (await git(root, ['log', '-1', '--format=%P%n%s'])).split(/\r?\n/)
        const count = parents.trim() ? parents.trim().split(/\s+/).length : 0
        return { hasParent: count >= 1, isMerge: count >= 2, lastMessage: message.trim() || null }
      } catch {
        return { hasParent: false, isMerge: false, lastMessage: null } // no commits yet
      }
    },

    async blobIds(root, ref, paths) {
      const out = new Map<string, string>()
      // a few hundred paths per call keeps the command line short enough for Windows
      for (let i = 0; i < paths.length; i += 200) {
        let text: string
        try {
          text = await git(root, ['ls-tree', '-z', ref, '--', ...paths.slice(i, i + 200)])
        } catch {
          continue // no such commit (e.g. before the first commit)
        }
        for (const entry of text.split('\0')) {
          // <mode> blob <oid>\t<path>
          const m = /^\d+ blob ([0-9a-f]+)\t(.*)$/s.exec(entry)
          if (m) out.set(m[2] as string, m[1] as string)
        }
      }
      return out
    },

    async treeBlobs(root, ref, dir) {
      const out = new Map<string, string>()
      const text = await git(root, ['ls-tree', '-r', '-z', ref, '--', dir]).catch(() => '')
      for (const entry of text.split('\0')) {
        const m = /^\d+ blob ([0-9a-f]+)\t(.*)$/s.exec(entry)
        if (m) out.set(m[2] as string, m[1] as string)
      }
      return out
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
      // Always this repository (0.15). The global settings are written only when they are empty: an existing global
      // name/address (e.g. for company repositories) is never changed, and new clones still know the user (CR-05).
      await git(root, ['config', '--local', 'user.name', name])
      await git(root, ['config', '--local', 'user.email', email])
      const globalSet = async (key: string): Promise<boolean> => {
        try {
          return (await git(root, ['config', '--global', '--get', key])).trim() !== ''
        } catch {
          return false
        }
      }
      if (!(await globalSet('user.name')) && !(await globalSet('user.email'))) {
        await git(root, ['config', '--global', 'user.name', name])
        await git(root, ['config', '--global', 'user.email', email])
      }
    },

    async discard(root, paths) {
      if (paths.length === 0) return
      // Files Git knows go back to the last commit; new (untracked) files are deleted.
      // in parts: "Discard all" of 10,000 files was one command line too long for Windows (spawn ENAMETOOLONG)
      const tracked = new Set<string>()
      for (const part of chunks(paths)) for (const p of (await git(root, ['ls-files', '-z', '--', ...part], BULK_TIMEOUT)).split('\0')) if (p) tracked.add(p)
      const inHead = new Set<string>()
      if (tracked.size > 0) {
        try {
          for (const part of chunks(paths)) for (const p of (await git(root, ['ls-tree', '-r', '-z', '--name-only', 'HEAD', '--', ...part], BULK_TIMEOUT)).split('\0')) if (p) inHead.add(p)
        } catch {
          // no commit yet: nothing is in HEAD
        }
      }
      const restore = paths.filter((p) => inHead.has(p))
      const remove = paths.filter((p) => !inHead.has(p))
      for (const part of chunks(restore)) await git(root, ['restore', '--source=HEAD', '--staged', '--worktree', '--', ...part], BULK_TIMEOUT)
      const stagedNew = remove.filter((p) => tracked.has(p))
      for (const part of chunks(stagedNew)) await git(root, ['rm', '--cached', '--quiet', '--', ...part], BULK_TIMEOUT)
      for (const p of remove) await rm(join(root, p), { force: true })
      // a folder the discard left empty goes too (the owner on 0.17.2: a discarded new document stayed in the list)
      // deepest folders first, one level at a time, so a parent is tried only after all its emptied children went;
      // rmdir alone: it refuses a folder that still holds anything, so no listing is needed (listing the parent after
      // every removal made 10,000 folders take 34 s — PERF-01)
      const depth = (d: string): number => d.split(/[\\/]/).length
      let level = new Set(remove.map((p) => dirname(p)).filter((d) => d && d !== '.' && d !== '/'))
      while (level.size > 0) {
        const deepest = Math.max(...[...level].map(depth))
        const next = new Set<string>()
        for (const d of level) {
          if (depth(d) < deepest) {
            next.add(d)
            continue
          }
          if (await rmdir(join(root, d)).then(() => true, () => false)) {
            const up = dirname(d)
            if (up && up !== '.' && up !== '/') next.add(up)
          }
        }
        level = next
      }
    }
  }
}
