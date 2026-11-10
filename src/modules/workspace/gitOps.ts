// The Git side of the workspace (M4): what changed, commit, pull, push, discard, per-item history.
// Rules (decided with the product owner, 25 Oct 2026):
//  - ReqMan commits only the requirements folder, never other project files.
//  - Push never forces. Pull and branches live in merging.ts (M8).
import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { GitResult, GitState, HistoryEntry, ItemChange, ItemVersionCompare } from '../../shared/api'
import type { Item } from '../../shared/domain'
import { GitError, PUSH_NO_UPSTREAM, PUSH_OTHER_NAME, type FileChange, type GitAdapter } from '../git-adapter'
import type { IndexCache } from '../index-cache'
import { diffItems, parseItemFile } from '../items'
import type { Logger } from '../logger'
import type { RequirementsRepo } from '../repository-store'
import { T } from '../../shared/text'

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
  /**
   * Right before a push: give short order keys back to sibling groups the user changed (since `upstream`) whose
   * keys got longer than 4 characters, as one extra commit. Returns how many items were touched.
   */
  tidyBeforePush?(s: GitSession, upstream: string): Promise<number>
}

// an item file: requirements/<document>/<ID>.md or a loose requirements/<ID>.md — never a hidden folder (S-10)
export const ID_FROM_PATH = /(?:^|\/)requirements\/(?:(?!\.)[^/]+\/)?(?!README\.md$)([^/]+)\.md$/i

/** "requirements" for the usual layout; forward slashes, relative to the repository top folder. */
export const reqPath = (repo: RequirementsRepo): string => relative(repo.root, repo.folder).split('\\').join('/') || '.'

/** Turns Git's often technical messages into something a requirements engineer can act on. */
export function explainGitError(e: unknown): string {
  const text = e instanceof GitError ? `${e.stderr}\n${e.stdout}\n${e.message}` : String(e instanceof Error ? e.message : e)
  if (text.includes(PUSH_NO_UPSTREAM)) return T.gitMsg.noRemotePush
  if (text.includes(PUSH_OTHER_NAME)) {
    const [, branch = '', upstream = ''] = text.slice(text.indexOf(PUSH_OTHER_NAME)).split('\n')
    return T.gitMsg.upstreamOtherName(branch, upstream)
  }
  if (/Authentication failed|could not read Username|terminal prompts disabled|Permission denied \(publickey\)|\b403\b/i.test(text)) {
    return T.gitMsg.signIn
  }
  // GitHub itself failed ("! [remote rejected] main -> main (Internal Server Error)") — not "pull first" (0.15.2: the
  // acceptance run was told to pull while GitHub had an outage)
  if (!/hook/i.test(text) && /internal server error|returned error: 5\d\d|HTTP 5\d\d/i.test(text)) {
    return T.gitMsg.serverError
  }
  if (/Could not resolve host|Failed to connect|Connection timed out|unable to access|Network is unreachable/i.test(text)) {
    return T.gitMsg.offline
  }
  if (/\[rejected\]|fetch first|non-fast-forward/i.test(text)) {
    return T.gitMsg.pullFirst
  }
  if (/ETIMEDOUT|timed out|SIGTERM/i.test(text)) return T.gitMsg.timeout
  if (/hook/i.test(text)) return T.gitMsg.hook(firstLine(text))
  return firstLine(text) || T.gitMsg.generic
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
    const label = name === 'schema.yaml' ? T.gitMsg.schemaLabel : name.startsWith('.git') ? T.gitMsg.folderSetup(inFolder) : inFolder
    return { path: c.path, kind: c.kind, label }
  }

  // Things that rarely change are asked once and kept until `invalidate()` (window focus, identity saved):
  // starting a Git process is slow on Windows, and the Git bar refreshes after every change (review P-02).
  // the baselines waiting for a push (S-06) are one of these facts: they change only through reqochet's own actions
  let cached: { root: string; info: Awaited<ReturnType<GitAdapter['getGitInfo']>>; remotes: string[]; identity: GitState['identity']; pendingBaselines: number } | null = null
  async function slowFacts(s: GitSession): Promise<NonNullable<typeof cached>> {
    if (cached && cached.root === s.repo.root) return cached
    const [info, remotes, identity, pending] = await Promise.all([git.getGitInfo(), git.remotes(s.repo.root), git.identity(s.repo.root), git.pendingBaselines(s.repo.root).catch(() => [] as string[])])
    cached = { root: s.repo.root, info, remotes, identity, pendingBaselines: pending.length }
    return cached
  }
  const invalidate = (): void => {
    cached = null
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
    if (!s.isGit) return { ...empty, reason: T.gitMsg.notGit }
    const facts = await slowFacts(s)
    const { info, remotes, identity } = facts
    if (!info.installed) {
      invalidate() // check again next time: the user may install Git meanwhile
      return { ...empty, reason: T.gitMsg.noGit(info.reason) }
    }
    // three Git processes per refresh: status, merge state, last two commits
    const [st, merging, head] = await Promise.all([
      git.status(s.repo.root, reqPath(s.repo)),
      git.refExists(s.repo.root, 'MERGE_HEAD'),
      git.headSummary(s.repo.root)
    ])
    const hasParent = head.hasParent
    // undoing a pull's joining commit would undo the pull itself (CR1-12, the owner 5 Nov 2026: do not offer it)
    const lastIsPull = head.isMerge
    const lastMessage = head.lastMessage
    const changes = st.changes.map((c) => toChange(s, c))
    // Deleted items are no longer in the index; take their titles from the last commit — all through one
    // `ls-tree` and one `cat-file` process, however many were deleted (review D-07).
    const deleted = changes.filter((c) => c.kind === 'deleted' && c.id && c.title === undefined)
    if (deleted.length > 0) {
      const oids = await git.blobIds(s.repo.root, 'HEAD', deleted.map((c) => c.path)).catch(() => new Map<string, string>())
      const blobs = await git.readBlobs(s.repo.root, [...new Set(oids.values())]).catch(() => new Map<string, string | null>())
      const fieldIds = new Set(s.repo.schema.fields.map((f) => f.id))
      for (const c of deleted) {
        const oid = oids.get(c.path)
        const old = oid ? blobs.get(oid) : null
        const parsed = old ? parseItemFile(old, fieldIds) : null
        if (parsed?.ok) {
          c.title = parsed.item.title
          c.label = `${c.id} ${parsed.item.title}`
        }
      }
    }
    changes.sort((a, b) => a.label.localeCompare(b.label))
    const [major = 0, minor = 0] = info.version.split('.').map(Number)
    const old = major < 2 || (major === 2 && minor < 38)
    return {
      ...(old ? { warning: T.gitMsg.oldGit(info.version) } : {}),
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
      canUndoCommit: hasParent && !lastIsPull && !merging && (st.upstream ? st.ahead > 0 : remotes.length === 0 || !(await branchOnRemote(s, st.branch, remotes))),
      lastCommitMessage: lastMessage,
      pendingBaselines: (await slowFacts(s)).pendingBaselines
    }
  }

  const fail = async (s: GitSession, message: string, items?: ItemChange[], neutral?: true): Promise<GitResult> => ({
    ok: false,
    message,
    ...(items ? { items } : {}),
    ...(neutral ? { neutral } : {}),
    state: await state(s)
  })
  const done = async (s: GitSession, message: string, neutral?: true): Promise<GitResult> => ({ ok: true, message, ...(neutral ? { neutral } : {}), state: await state(s) })

  /** Common refusals before changing anything. */
  async function precheck(s: GitSession): Promise<GitResult | null> {
    // actions always see fresh remotes and identity (the cache only speeds up the Git bar)
    invalidate()
    const st = await state(s)
    if (!st.available) return { ok: false, message: st.reason ?? T.gitMsg.unavailable, state: st }
    if (st.mergeInProgress) {
      return {
        ok: false,
        message: T.gitMsg.mergeOutside,
        items: st.changes.filter((c) => c.kind === 'conflict'),
        state: st
      }
    }
    if (st.detached) return { ok: false, message: T.gitMsg.detached, state: st }
    return null
  }

  /** The remote branch to pull from / push to: the upstream, or <remote>/<branch> if that exists. */
  async function remoteBranch(s: GitSession, st: GitState): Promise<{ ref: string | null; remote: string | null }> {
    const { remotes } = await slowFacts(s)
    const remote = st.upstream?.split('/')[0] ?? (remotes.includes('origin') ? 'origin' : (remotes[0] ?? null))
    if (st.upstream) return { ref: st.upstream, remote }
    if (remote && st.branch && (await git.refExists(s.repo.root, `${remote}/${st.branch}`))) return { ref: `${remote}/${st.branch}`, remote }
    return { ref: null, remote }
  }

  return {
    state,
    invalidate,
    /** Shared with merging.ts (pull, branches). */
    internal: { precheck, fail, done, toChange, remoteBranch },

    async commit(s: GitSession, message: string): Promise<GitResult> {
      const blocked = await precheck(s)
      if (blocked) return blocked
      const st = await state(s)
      const text = message.trim()
      if (!text) return fail(s, T.gitMsg.needMessage)
      if (st.changes.length === 0) return fail(s, T.gitMsg.nothingToCommit, undefined, true)
      if (!st.identity.name || !st.identity.email) return fail(s, T.gitMsg.needIdentity)
      try {
        const hash = await git.commit(s.repo.root, reqPath(s.repo), text)
        log.info(`Committed ${st.changes.length} change(s) as ${hash.slice(0, 7)}`)
        return done(s, T.gitMsg.committed(st.changes.length))
      } catch (e) {
        log.error('Commit failed', e)
        return fail(s, explainGitError(e))
      }
    },

    async push(s: GitSession): Promise<GitResult> {
      const blocked = await precheck(s)
      if (blocked) return blocked
      const st = await state(s)
      if (!st.hasRemote) return fail(s, T.gitMsg.noRemotePush)
      if (!(await git.head(s.repo.root))) return fail(s, T.gitMsg.nothingToPushYet, undefined, true)
      const { remote } = await remoteBranch(s, st)
      // baselines made here go with the push (S-06), also when no commit is waiting; one whose tag was deleted outside
      // reqochet is dropped from the list instead of failing every push (QA-01)
      const waiting = await git.pendingBaselines(s.repo.root).catch(() => [] as string[])
      const existing = new Set((await git.baselines(s.repo.root).catch(() => [])).map((b) => b.name))
      const baselines = waiting.filter((b) => existing.has(b))
      if (baselines.length !== waiting.length) {
        await git.setPendingBaselines(s.repo.root, baselines)
        invalidate()
      }
      if (st.upstream && st.ahead === 0 && baselines.length === 0) {
        return done(s, st.changes.length > 0 ? T.gitMsg.notCommittedYet : T.gitMsg.remoteHasAll)
      }
      // the owner's rule (28 Oct 2026): keep order keys short, but only in groups this user changed
      const tidied = st.upstream && deps.tidyBeforePush ? await deps.tidyBeforePush(s, st.upstream).catch((e: unknown) => (log.warn(`Tidying positions skipped: ${String(e)}`), 0)) : 0
      try {
        if (!st.upstream || st.ahead > 0) await git.push(s.repo.root, st.upstream || !remote || !st.branch ? undefined : { remote, branch: st.branch })
        let refused: string[] = []
        if (baselines.length > 0 && remote) {
          refused = await git.pushBaselines(s.repo.root, remote, baselines)
          // a refused name stays here only: the remote has a baseline of that name already (QA-02); it is marked so
          // nobody mistakes it for the shared one (CR18-02)
          await git.setPendingBaselines(s.repo.root, [])
          if (refused.length) await git.setRefusedBaselines(s.repo.root, [...new Set([...(await git.refusedBaselines(s.repo.root)), ...refused])])
          invalidate()
          log.info(`Pushed baselines: ${baselines.filter((b) => !refused.includes(b)).join(', ')}${refused.length ? `; refused: ${refused.join(', ')}` : ''}`)
        }
        log.info(`Pushed ${st.branch ?? ''}${tidied ? ` (positions of ${tidied} items tidied)` : ''}`)
        const sent = baselines.length - refused.length
        return done(s, `${T.gitMsg.pushed(st.changes.length)}${sent > 0 ? T.gitMsg.baselinesPushed(sent) : ''}${refused.length ? T.gitMsg.baselinesRefused(refused.join(', ')) : ''}`)
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
      // also restore the old name of a renamed file (a staged rename lists only its new path)
      const picked = paths.filter((p) => allowed.has(p))
      const fromOf = new Map((await git.status(s.repo.root, reqPath(s.repo))).changes.filter((c) => c.kind === 'renamed' && c.from).map((c) => [c.path, c.from as string]))
      const wanted = [...new Set([...picked, ...picked.flatMap((p) => (fromOf.has(p) ? [fromOf.get(p) as string] : []))])]
      if (wanted.length === 0) return fail(s, T.gitMsg.nothingToDiscard, undefined, true)
      try {
        await git.discard(s.repo.root, wanted)
        await deps.resync()
        log.info(`Discarded ${wanted.length} changes${wanted.length <= 20 ? `: ${wanted.join(', ')}` : ''}`)
        return done(s, T.gitMsg.discarded(picked.length))
      } catch (e) {
        log.error('Discard failed', e)
        return fail(s, explainGitError(e))
      }
    },

    async undoLastCommit(s: GitSession): Promise<GitResult> {
      const blocked = await precheck(s)
      if (blocked) return blocked
      const st = await state(s)
      if (!st.canUndoCommit) return fail(s, T.gitMsg.cannotUndo)
      // a baseline marks this commit: undoing it would leave the baseline on a commit of no branch (CR18-09)
      const head = await git.head(s.repo.root)
      const marking = (await git.baselines(s.repo.root).catch(() => [])).filter((b) => b.commit === head).map((b) => b.name)
      if (marking.length > 0) return fail(s, T.gitMsg.undoBaseline(marking.join(', ')))
      try {
        await git.undoLastCommit(s.repo.root)
        await deps.resync()
        log.info(`Undid commit "${st.lastCommitMessage ?? ''}"`)
        return done(s, T.gitMsg.undone(st.lastCommitMessage ?? ''))
      } catch (e) {
        return fail(s, explainGitError(e))
      }
    },

    async setIdentity(s: GitSession, name: string, email: string): Promise<GitResult> {
      if (!name.trim() || !/^[^\s@]+@[^\s@]+$/.test(email.trim())) return fail(s, T.gitMsg.badIdentity)
      try {
        await git.setIdentity(s.repo.root, name.trim(), email.trim())
        invalidate()
        return done(s, T.gitMsg.identitySaved)
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
      if (st && st.changes.length > 0) entries.unshift({ hash: 'working', author: '', email: '', date: '', message: T.gitMsg.notCommitted })
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
        if (!at) throw new Error(T.gitMsg.notInHistory(hash.slice(0, 7), id))
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
