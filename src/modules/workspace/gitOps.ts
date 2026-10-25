// The Git side of the workspace (M4): what changed, commit, pull, push, discard, per-item history.
// Rules (decided with the product owner, 25 Oct 2026):
//  - ReqMan commits only the requirements folder, never other project files.
//  - Pull stops without changing anything when items were changed on both sides; it lists those items.
//    (Resolving them item by item comes with the merge milestone.)
//  - Push never forces. Branches are shown, not created or switched (later milestone).
import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { GitResult, GitState, HistoryEntry, ItemChange, ItemVersionCompare } from '../../shared/api'
import type { Item } from '../../shared/domain'
import { GitError, parseOverwrittenFiles, type FileChange, type GitAdapter } from '../git-adapter'
import type { IndexCache } from '../index-cache'
import { diffItems, parseItemFile } from '../items'
import type { Logger } from '../logger'
import type { RequirementsRepo } from '../repository-store'

export interface GitSession {
  repo: RequirementsRepo
  index: IndexCache
  isGit: boolean
}

export interface GitOpsDeps {
  git: GitAdapter
  log: Pick<Logger, 'info' | 'warn' | 'error'>
  /** Re-reads changed item files into the index after Git changed the working folder. */
  resync(): Promise<void>
}

const ID_FROM_PATH = /\/items\/([^/]+)\.md$/

/** "requirements" for the usual layout; forward slashes, relative to the repository top folder. */
const reqPath = (repo: RequirementsRepo): string => relative(repo.root, repo.folder).split('\\').join('/') || '.'

/** Turns Git's often technical messages into something a requirements engineer can act on. */
export function explainGitError(e: unknown): string {
  const text = e instanceof GitError ? `${e.stderr}\n${e.stdout}\n${e.message}` : String(e instanceof Error ? e.message : e)
  if (/Authentication failed|could not read Username|terminal prompts disabled|Permission denied \(publickey\)|403/i.test(text)) {
    return 'Git could not sign in to the remote repository. Check that you have access, then sign in once (Git for Windows shows a sign-in window, or run "git push" in a terminal) and try again.'
  }
  if (/Could not resolve host|Failed to connect|Connection timed out|unable to access|Network is unreachable/i.test(text)) {
    return 'The remote repository could not be reached. Check the network connection and try again — everything else works offline.'
  }
  if (/rejected|fetch first|non-fast-forward/i.test(text)) {
    return 'The remote has changes you do not have yet. Pull first, then push again.'
  }
  if (/ETIMEDOUT|timed out|SIGTERM/i.test(text)) return 'Git took too long to answer and was stopped. Try again.'
  if (/hook/i.test(text)) return `A Git hook of this repository refused the commit: ${firstLine(text)}`
  return firstLine(text) || 'Git reported an error.'
}

const firstLine = (t: string): string =>
  t
    .split(/\r?\n/)
    .map((l) => l.replace(/^(error|fatal|hint):\s*/i, '').trim())
    .find(Boolean) ?? ''

export function createGitOps(deps: GitOpsDeps) {
  const { git, log } = deps

  const toChange = (s: GitSession, c: Pick<FileChange, 'path' | 'kind'>): ItemChange => {
    const id = ID_FROM_PATH.exec(c.path)?.[1]
    const indexed = id ? s.index.get(id) : undefined
    if (id) {
      const title = indexed?.title
      return { path: c.path, kind: c.kind, id, ...(title !== undefined ? { title } : {}), label: title !== undefined ? `${id} ${title}` : id }
    }
    const name = c.path.split('/').pop() ?? c.path
    const base = reqPath(s.repo)
    const inFolder = base !== '.' && c.path.startsWith(`${base}/`) ? c.path.slice(base.length + 1) : c.path
    const label = name === 'schema.yaml' ? 'Schema (fields, types, link types)' : name.startsWith('.git') ? `Folder setup (${inFolder})` : inFolder
    return { path: c.path, kind: c.kind, label }
  }

  async function state(s: GitSession): Promise<GitState> {
    const empty: GitState = {
      available: false,
      branch: null,
      detached: false,
      upstream: null,
      ahead: 0,
      behind: 0,
      hasRemote: false,
      identity: { name: null, email: null },
      changes: [],
      mergeInProgress: false,
      canUndoCommit: false,
      lastCommitMessage: null
    }
    if (!s.isGit) return { ...empty, reason: 'This folder is not a Git repository, so changes cannot be committed or shared.' }
    const info = await git.getGitInfo()
    if (!info.installed) return { ...empty, reason: `${info.reason} Install Git for Windows to commit and share changes.` }
    const [st, remotes, identity, merging, hasParent, lastMessage] = await Promise.all([
      git.status(s.repo.root, reqPath(s.repo)),
      git.remotes(s.repo.root),
      git.identity(s.repo.root),
      git.refExists(s.repo.root, 'MERGE_HEAD'),
      git.refExists(s.repo.root, 'HEAD~1'),
      git.lastCommitMessage(s.repo.root)
    ])
    const changes = st.changes.map((c) => toChange(s, c))
    // Deleted items are no longer in the index; take their title from the last commit.
    for (const c of changes) {
      if (c.kind === 'deleted' && c.id && c.title === undefined) {
        const old = await git.show(s.repo.root, 'HEAD', c.path)
        const parsed = old ? parseItemFile(old, new Set(s.repo.schema.fields.map((f) => f.id))) : null
        if (parsed?.ok) {
          c.title = parsed.item.title
          c.label = `${c.id} ${parsed.item.title}`
        }
      }
    }
    changes.sort((a, b) => a.label.localeCompare(b.label))
    return {
      available: true,
      branch: st.branch,
      detached: st.detached,
      upstream: st.upstream,
      ahead: st.ahead,
      behind: st.behind,
      hasRemote: remotes.length > 0,
      identity,
      changes,
      mergeInProgress: merging || st.changes.some((c) => c.kind === 'conflict'),
      // only commits that never left this PC: with an upstream they are "ahead"; without one, none was pushed
      canUndoCommit: hasParent && !merging && (st.upstream ? st.ahead > 0 : remotes.length === 0 || !(await branchOnRemote(s, st.branch, remotes))),
      lastCommitMessage: lastMessage
    }
  }

  const fail = async (s: GitSession, message: string, items?: ItemChange[]): Promise<GitResult> => ({
    ok: false,
    message,
    ...(items ? { items } : {}),
    state: await state(s)
  })
  const done = async (s: GitSession, message: string): Promise<GitResult> => ({ ok: true, message, state: await state(s) })

  /** Common refusals before changing anything. */
  async function precheck(s: GitSession): Promise<GitResult | null> {
    const st = await state(s)
    if (!st.available) return { ok: false, message: st.reason ?? 'Git is not available.', state: st }
    if (st.mergeInProgress) {
      return {
        ok: false,
        message: 'This repository is in the middle of a merge with conflicts (started outside ReqMan). Finish or cancel it in Git first ("git merge --abort" cancels it).',
        items: st.changes.filter((c) => c.kind === 'conflict'),
        state: st
      }
    }
    if (st.detached) return { ok: false, message: 'No branch is checked out (detached HEAD). Check out a branch in Git first.', state: st }
    return null
  }

  /** The remote branch to pull from / push to: the upstream, or <remote>/<branch> if that exists. */
  async function remoteBranch(s: GitSession, st: GitState): Promise<{ ref: string | null; remote: string | null }> {
    const remotes = await git.remotes(s.repo.root)
    const remote = st.upstream?.split('/')[0] ?? (remotes.includes('origin') ? 'origin' : (remotes[0] ?? null))
    if (st.upstream) return { ref: st.upstream, remote }
    if (remote && st.branch && (await git.refExists(s.repo.root, `${remote}/${st.branch}`))) return { ref: `${remote}/${st.branch}`, remote }
    return { ref: null, remote }
  }

  return {
    state,

    async commit(s: GitSession, message: string): Promise<GitResult> {
      const blocked = await precheck(s)
      if (blocked) return blocked
      const st = await state(s)
      const text = message.trim()
      if (!text) return fail(s, 'Write a short message that says what changed and why.')
      if (st.changes.length === 0) return fail(s, 'There is nothing to commit.')
      if (!st.identity.name || !st.identity.email) return fail(s, 'Git does not know your name and e-mail yet. Enter them once; they are stored in your Git settings and shown in the history.')
      try {
        const hash = await git.commit(s.repo.root, reqPath(s.repo), text)
        log.info(`Committed ${st.changes.length} change(s) as ${hash.slice(0, 7)}`)
        return done(s, `Committed ${st.changes.length} change${st.changes.length === 1 ? '' : 's'}.`)
      } catch (e) {
        log.error('Commit failed', e)
        return fail(s, explainGitError(e))
      }
    },

    async pull(s: GitSession): Promise<GitResult> {
      const blocked = await precheck(s)
      if (blocked) return blocked
      const root = s.repo.root
      let st = await state(s)
      if (!st.hasRemote) return fail(s, 'This repository has no remote (for example GitHub) to pull from.')
      try {
        await git.fetch(root)
      } catch (e) {
        log.warn(`Fetch failed: ${String(e)}`)
        return fail(s, explainGitError(e))
      }
      st = await state(s)
      const { ref } = await remoteBranch(s, st)
      if (!ref) return done(s, `The branch "${st.branch ?? ''}" is not on the remote yet — nothing to pull. Push to publish it.`)
      if (st.upstream && st.behind === 0) return done(s, 'Already up to date.')

      const before = await git.head(root)
      const check = await git.checkMerge(root, ref).catch((e: unknown) => {
        log.warn(`In-memory merge check unavailable (${String(e)}); relying on Git's own checks.`)
        return { clean: true, conflicts: [] as string[] }
      })
      if (!check.clean) {
        const items = check.conflicts.map((p) => toChange(s, { path: p, kind: 'conflict' }))
        log.info(`Pull stopped: ${items.length} item(s) changed on both sides`)
        return fail(
          s,
          'Pull stopped — nothing was changed. You and someone else changed the same items. To take their version: Undo your last commit in Changes (if it is not pushed), Discard these items, then Pull. To keep both versions, combine them with Git outside ReqMan for now — choosing per item inside ReqMan comes with the merge milestone.',
          items
        )
      }
      try {
        // fast-forwards when possible, otherwise a merge commit (the items differ, so it is clean)
        await git.merge(root, ref, false)
      } catch (e) {
        const overwritten = e instanceof GitError ? parseOverwrittenFiles(e.stderr) : []
        if (overwritten.length > 0) {
          return fail(
            s,
            'Pull stopped — nothing was changed. These items have changes you have not committed, and the pull would overwrite them. Commit them first (or discard them), then pull again.',
            overwritten.map((p) => toChange(s, { path: p, kind: 'modified' }))
          )
        }
        // Safety net (e.g. an old Git without the in-memory check): never leave a half-finished merge behind.
        const after = await git.status(root, '.').catch(() => null)
        const conflicted = after?.changes.filter((c) => c.kind === 'conflict') ?? []
        if (conflicted.length > 0) {
          await git.abortMerge(root).catch((x: unknown) => log.error('merge --abort failed', x))
          await deps.resync()
          return fail(s, 'Pull stopped — nothing was changed. You and someone else changed the same items.', conflicted.map((c) => toChange(s, c)))
        }
        log.error('Pull failed', e)
        return fail(s, explainGitError(e))
      }
      const files = before ? await git.changedFiles(root, before, 'HEAD', reqPath(s.repo)).catch(() => []) : []
      await deps.resync()
      const items = files.filter((f) => ID_FROM_PATH.test(f)).length
      log.info(`Pulled ${ref}: ${files.length} file(s) under requirements changed`)
      return done(s, items > 0 ? `Pulled: ${items} item${items === 1 ? '' : 's'} changed.` : 'Pulled. No items changed (other files only).')
    },

    async push(s: GitSession): Promise<GitResult> {
      const blocked = await precheck(s)
      if (blocked) return blocked
      const st = await state(s)
      if (!st.hasRemote) return fail(s, 'This repository has no remote (for example GitHub) to push to.')
      if (!(await git.head(s.repo.root))) return fail(s, 'Nothing to push yet — commit your changes first.')
      const { remote } = await remoteBranch(s, st)
      if (st.upstream && st.ahead === 0) {
        return done(s, st.changes.length > 0 ? 'Nothing to push. Your changes are not committed yet — commit them first.' : 'Nothing to push — the remote already has everything.')
      }
      try {
        await git.push(s.repo.root, st.upstream || !remote || !st.branch ? undefined : { remote, branch: st.branch })
        log.info(`Pushed ${st.branch ?? ''}`)
        const note = st.changes.length > 0 ? ` (${st.changes.length} uncommitted change${st.changes.length === 1 ? ' was' : 's were'} not included)` : ''
        return done(s, `Pushed${note}.`)
      } catch (e) {
        log.warn(`Push failed: ${String(e)}`)
        return fail(s, explainGitError(e))
      }
    },

    async discard(s: GitSession, paths: string[]): Promise<GitResult> {
      const blocked = await precheck(s)
      if (blocked) return blocked
      const st = await state(s)
      const allowed = new Set(st.changes.map((c) => c.path))
      // also restore the old name of a renamed file
      const wanted = paths.filter((p) => allowed.has(p))
      if (wanted.length === 0) return fail(s, 'Nothing to discard.')
      try {
        await git.discard(s.repo.root, wanted)
        await deps.resync()
        log.info(`Discarded changes: ${wanted.join(', ')}`)
        return done(s, `Discarded ${wanted.length} change${wanted.length === 1 ? '' : 's'}.`)
      } catch (e) {
        log.error('Discard failed', e)
        return fail(s, explainGitError(e))
      }
    },

    async undoLastCommit(s: GitSession): Promise<GitResult> {
      const blocked = await precheck(s)
      if (blocked) return blocked
      const st = await state(s)
      if (!st.canUndoCommit) return fail(s, 'The last commit is already on the remote (or is the first commit), so it cannot be taken back here.')
      try {
        await git.undoLastCommit(s.repo.root)
        await deps.resync()
        log.info(`Undid commit "${st.lastCommitMessage ?? ''}"`)
        return done(s, `Took back the commit “${st.lastCommitMessage ?? ''}”. Its changes are uncommitted again.`)
      } catch (e) {
        return fail(s, explainGitError(e))
      }
    },

    async setIdentity(s: GitSession, name: string, email: string): Promise<GitResult> {
      if (!name.trim() || !/^[^\s@]+@[^\s@]+$/.test(email.trim())) return fail(s, 'Enter your name and a valid e-mail address.')
      try {
        await git.setIdentity(s.repo.root, name.trim(), email.trim())
        return done(s, 'Saved in your Git settings.')
      } catch (e) {
        return fail(s, explainGitError(e))
      }
    },

    async history(s: GitSession, id: string): Promise<HistoryEntry[]> {
      if (!s.isGit) return []
      const path = itemGitPath(s, id)
      const entries: HistoryEntry[] = (await git.log(s.repo.root, path).catch(() => [])).map((c) => ({
        hash: c.hash,
        author: c.author,
        email: c.email,
        date: c.date,
        message: c.message
      }))
      const st = await git.status(s.repo.root, path).catch(() => null)
      if (st && st.changes.length > 0) entries.unshift({ hash: 'working', author: '', email: '', date: '', message: 'Not committed yet' })
      return entries
    },

    async compare(s: GitSession, id: string, hash: string): Promise<ItemVersionCompare> {
      const fieldIds = new Set(s.repo.schema.fields.map((f) => f.id))
      const path = itemGitPath(s, id)
      const log2 = await git.log(s.repo.root, path).catch(() => [])
      const read = (text: string | null): { item: Item | null; error?: string } => {
        if (text === null) return { item: null }
        const r = parseItemFile(text, fieldIds)
        return r.ok ? { item: r.item } : { item: null, error: r.error }
      }
      let beforeText: string | null
      let afterText: string | null
      if (hash === 'working') {
        beforeText = log2[0] ? await git.show(s.repo.root, log2[0].hash, log2[0].path) : null
        afterText = await readFile(join(s.repo.root, path), 'utf8').catch(() => null)
      } else {
        const k = log2.findIndex((c) => c.hash === hash)
        const at = log2[k]
        if (!at) throw new Error(`Commit ${hash.slice(0, 7)} is not in the history of ${id}.`)
        const prev = log2[k + 1]
        beforeText = prev ? await git.show(s.repo.root, prev.hash, prev.path) : null
        afterText = await git.show(s.repo.root, at.hash, at.path)
      }
      const before = read(beforeText)
      const after = read(afterText)
      const unreadable = before.error ?? after.error
      return {
        before: before.item,
        after: after.item,
        diff: diffItems(before.item, after.item, s.repo.schema),
        ...(unreadable ? { unreadable } : {})
      }
    }
  }

  async function branchOnRemote(s: GitSession, branch: string | null, remotes: string[]): Promise<boolean> {
    if (!branch) return false
    for (const r of remotes) if (await git.refExists(s.repo.root, `${r}/${branch}`)) return true
    return false
  }

  function itemGitPath(s: GitSession, id: string): string {
    const indexed = s.index.get(id)
    const inFolder = indexed?.path ?? s.repo.itemPath(id)
    const base = reqPath(s.repo)
    return base === '.' ? inFolder : `${base}/${inFolder}`
  }
}
