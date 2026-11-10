// The workspace facade: one WorkspaceService built from small services (review S-01) —
//   itemOps (read/create/save/delete), links, structure (hierarchy, moves), schemaFields, exporting,
//   gitOps (M4) and compare (M5).
// Every operation that writes files, changes the index or runs Git goes through one queue (review D-03).
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { access, mkdir, rename, rm, rmdir, writeFile } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'
import type { CreateBaselineRequest, FolderCheck, GitResult, GitState, MatrixRequest, ImportSettings, MergeAnswers, MergePlan, ImportSource, IndexedItem, QueryResult, RepoInfo } from '../../shared/api'
import type { GitAdapter } from '../git-adapter'
import type { IndexCache } from '../index-cache'
import type { Logger } from '../logger'
import { isDocumentName, type RepositoryStore } from '../repository-store'
import { createBaselineOps } from './baselines'
import { closeVersion, openVersion, type VersionView } from './versionView'
import { createTraceabilityOps } from './traceability'
import { starterRules } from '../schema'
import { writeXlsx } from '../import-export'
import { createCompare } from './compare'
import { queryAll, syncInfo, withRequired, type Session, type WorkspaceContext } from './context'
import { createExportOps } from './exporting'
import { createGitOps, explainGitError } from './gitOps'
import { createMerging } from './merging'
import type { WorkspaceService } from './index'
import { createImportOps } from './importing'
import { createItemOps } from './itemOps'
import { createLinkOps } from './links'
import { createSerialQueue } from './queue'
import { createRecentList } from './recent'
import { createRevertOps } from './revert'
import { createSchemaFieldOps } from './schemaFields'
import { compareOutline, createStructureOps, outlineNumbers, planTidy } from './structure'
import { documentFolders, watchRequirementsFolder } from './watcher'
import { T } from '../../shared/text'

export interface WorkspaceDeps {
  store: RepositoryStore
  git: GitAdapter
  /** Creates (or reopens) the index cache for a repository root. */
  openIndex(root: string): IndexCache
  /** Folder for per-user state (recent repositories list). */
  userDir: string
  /** Opens an index at this file (an old version's temporary index, D-19b); without it `openIndex(key)` is used. */
  openIndexAt?(file: string): IndexCache
  log: Pick<Logger, 'info' | 'warn' | 'error'>
  /** Watch the requirements folder so refreshes re-read only changed files (default true). */
  watchFiles?: boolean
}

const withNumber = (i: IndexedItem, numbers: Map<string, string>): IndexedItem => {
  const n = numbers.get(i.id)
  return n === undefined ? i : { ...i, number: n }
}

/** How long a refresh waits for change notices that are still on their way (see refresh). */
const SETTLE_MS = 60

export function cacheFileName(root: string): string {
  return `${createHash('sha1').update(resolve(root).toLowerCase()).digest('hex').slice(0, 20)}.sqlite`
}

/** The rename commit's message — in the team's Git history, so the same in every window language (UX16-03). */
/** The commit of a document rename — the same in every language, like FOLDER_RENAME_COMMIT (S-10). */
const exists = (p: string): Promise<boolean> => access(p).then(() => true, () => false)

/** Loose files moved in one commit at most: two paths each must fit on a Windows command line (CR-07). */

export const DOCUMENT_RENAME_COMMIT = (from: string, to: string): string => `Rename the document ${from} to ${to} (reqochet)`
export const FOLDER_RENAME_COMMIT = 'Rename the project folder .reqman to .reqochet (reqochet)'

export function createWorkspace(deps: WorkspaceDeps): WorkspaceService {
  const { store, git, log } = deps
  const recent = createRecentList(deps.userDir, (m) => log.warn(m))
  const queue = createSerialQueue()
  let session: Session | null = null
  /** An old version shown in the table (D-19b): read calls go to it, writes and Git actions are refused. */
  let viewing: VersionView | null = null
  const versionsDir = join(deps.userDir, 'cache', 'versions')
  // left over from a quit while a version was shown (SEC-19-05): nothing in there is needed any more
  void rm(versionsDir, { recursive: true, force: true }).catch(() => undefined)

  const need = (): Session => {
    if (!session) throw new Error(T.wsMsg.noRepo)
    return session
  }

  let outline: { index: IndexCache; revision: number; map: Map<string, string>; ranks?: Map<string, number> } | null = null

  /** The session the read calls answer from: the old version while one is shown, else the open repository. */
  const reading = (): Session => viewing?.session ?? need()

  const ctx: WorkspaceContext = {
    store,
    git,
    log,
    need,
    // The index knows where each item's file really is, so an item in a renamed file can still be read and
    // saved in place (review D-01).
    openRepo: (root) => store.open(root, { locate: (id) => (session && session.repo.root === root ? session.index.get(id)?.path : undefined) }),
    numbers(s) {
      const revision = s.index.revision()
      if (!outline || outline.index !== s.index || outline.revision !== revision) outline = { index: s.index, revision, map: outlineNumbers(s.index.structure()) }
      return outline.map
    },
    keepNumbers(s, before) {
      if (outline && outline.index === s.index && outline.revision === before) outline.revision = s.index.revision()
    },
    numberRanks(s) {
      const numbers = ctx.numbers(s)
      if (!outline?.ranks) {
        // every item's place when sorted by outline number, worked out once per index state (W-22): sorting the
        // matching rows is then an integer compare instead of splitting "3.12.4" strings 50,000 × log times
        const sorted = [...numbers.entries()].sort(([ia, a], [ib, b]) => compareOutline(a, b) || (ia < ib ? -1 : ia > ib ? 1 : 0))
        if (outline) outline.ranks = new Map(sorted.map(([id], k) => [id, k]))
        else return new Map(sorted.map(([id], k) => [id, k]))
      }
      return outline.ranks
    },
    async resyncAll(s) {
      s.watch?.take() // everything is re-checked now; keep only changes that happen from here on
      const repo = await ctx.openRepo(s.repo.root)
      s.lastSync = syncInfo(await s.index.sync(repo))
      s.repo = repo
      rewatch(s)
    }
  }

  /** (Re)starts the folder watch for the project folder in use — after the .reqman → .reqochet rename, also when the
   * rename arrives by pull or branch switch (code review CR-05). */
  const rewatch = (s: Session): void => {
    if (deps.watchFiles === false) return
    // restart when the project folder was renamed or a document folder came or went (S-10)
    if (s.watch && s.watchedMeta === s.repo.metaDir && s.watch.documents === documentFolders(s.repo.folder).join('\u0000')) return
    s.watch?.close()
    s.watch = watchRequirementsFolder(s.repo.folder, (e) => log.warn(`Folder watch: ${String(e)}`), s.repo.metaDir)
    s.watchedMeta = s.repo.metaDir
  }

  /**
   * Runs a Git action that may add, remove or rename document folders with the folder watch closed: Windows refuses
   * to remove a folder that is being watched (CR-09). Every such action re-reads the project afterwards (resync), and
   * the watch starts again then — or here, when the action stopped early.
   */
  const paused = async <R>(run: (s: Session) => Promise<R>): Promise<R> => {
    const s = need()
    s.watch?.close()
    s.watch = null
    try {
      return await run(s)
    } finally {
      // an action that stopped before its resync changed nothing: just watch again
      if (session === s && !s.watch) rewatch(s)
    }
  }

  // the documents (folders under requirements/) with their item counts; '' = loose files, listed only when there are any
  const documentsOf = (s: Session): { name: string; itemCount: number }[] => {
    const counts = s.index.documentCounts()
    // an old version has no folders on disk: its documents are the ones its items are in
    const names =
      s === viewing?.session
        ? Object.keys(counts).filter((d) => d !== '').sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        : documentFolders(s.repo.folder).filter((d) => d !== s.repo.metaDir && d !== '.reqman' && d !== '.reqochet')
    const out = names.map((name) => ({ name, itemCount: counts[name] ?? 0 }))
    const loose = counts[''] ?? 0
    return loose > 0 ? [...out, { name: '', itemCount: loose }] : out
  }
  const info = (s: Session = reading()): RepoInfo => ({
    ...(viewing && s === viewing.session ? { version: { ref: viewing.ref, label: viewing.label } } : {}),
    // an old version's repo.root is an internal key: the window always gets the project folder (CR19-02)
    root: need().repo.root,
    name: basename(need().repo.root),
    isGitRepository: s.isGit,
    schema: s.repo.schema,
    schemaProblems: s.repo.schemaProblems,
    schemaRevision: s.repo.schemaRevision,
    itemCount: s.index.count(),
    issues: s.index.repositoryIssues(),
    lastSync: s.lastSync,
    documents: documentsOf(s),
    defaultDocument: s.repo.defaultDocument,
    ...(s.repo.metaDir === '.reqman' ? { legacyFolder: true } : {})
  })

  /**
   * "Update this project to reqochet" (0.16): renames requirements/.reqman to .reqochet and commits only that rename,
   * which the user then pushes; Git shows it as a rename. Until then the project keeps working under the old name.
   */
  const renameProjectFolder = async (): Promise<{ ok: true; info: RepoInfo } | { ok: false; message: string }> => {
    const s = need()
    if (s.repo.metaDir !== '.reqman') return { ok: true, info: info() }
    const root = s.repo.root
    const base = relative(root, s.repo.folder).split('\\').join('/') || '.'
    const from = `${base}/.reqman`
    const to = `${base}/.reqochet`
    try {
      // The commit carries the rename only (code review CR-03, QA-05): uncommitted edits in the old folder would be
      // committed under the rename message, so they are committed or discarded first.
      const tracked = s.isGit ? await git.trackedFiles(root, from) : []
      if (tracked.length > 0) {
        const dirty = (await git.status(root, from)).changes
        if (dirty.length > 0) return { ok: false, message: T.wsMsg.folderRenameDirty }
      }
      // close the watcher first: Windows refuses to rename a folder that is being watched
      s.watch?.close()
      s.watch = null
      let moved: { from: string; to: string } | null
      try {
        moved = await store.renameLegacyFolder(root)
      } catch (e) {
        rewatch(s)
        return { ok: false, message: e instanceof Error && e.message === 'both-folders' ? T.wsMsg.folderRenameBoth : String(e) }
      }
      if (moved && tracked.length > 0) {
        try {
          await git.commitFiles(root, [from, to], FOLDER_RENAME_COMMIT)
        } catch (e) {
          // refused (e.g. a commit hook): put everything back as it was, so the folder and the window agree (QA-07)
          await git.unstage(root, [from, to])
          await store.renameLegacyFolder(root, true)
          rewatch(s)
          return { ok: false, message: T.wsMsg.folderRenameRefused(explainGitError(e)) }
        }
      }
      log.info(`Project folder renamed: ${from} → ${to}${moved && tracked.length > 0 ? ' (committed)' : ''}`)
      s.repo = await ctx.openRepo(root)
      rewatch(s)
      s.lastSync = syncInfo(await s.index.sync(s.repo))
      gitOps.invalidate()
      return { ok: true, info: info() }
    } catch (e) {
      rewatch(s)
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }
  }

  /** A new, empty document: a folder under requirements/ (S-10). Git keeps it through a .gitkeep file. */
  const createDocument = async (name: string): Promise<{ ok: true; info: RepoInfo } | { ok: false; message: string }> => {
    const s = need()
    const n = name.trim()
    if (!isDocumentName(n)) return { ok: false, message: T.wsMsg.documentName }
    if (documentFolders(s.repo.folder).some((d) => d.toLowerCase() === n.toLowerCase())) return { ok: false, message: T.wsMsg.documentExists(n) }
    try {
      await mkdir(join(s.repo.folder, n), { recursive: true })
      await writeFile(join(s.repo.folder, n, '.gitkeep'), '', { flag: 'w' })
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) } // a file with that name, no permission (CR-11)
    }
    log.info(`Document created: ${n}`)
    s.repo = await ctx.openRepo(s.repo.root)
    rewatch(s)
    return { ok: true, info: info() }
  }

  /**
   * Renames a document folder — or moves the loose item files (document '') into a new document — in one Git commit,
   * so Git keeps every item's history (S-10: a project made before 0.17 names its "items" folder this way).
   */
  const renameDocument = async (from: string, to: string): Promise<{ ok: true; info: RepoInfo } | { ok: false; message: string }> => {
    const s = need()
    const n = to.trim()
    if (!isDocumentName(n)) return { ok: false, message: T.wsMsg.documentName }
    if (n === from) return { ok: true, info: info() } // nothing to do (QA-10)
    const docs = documentFolders(s.repo.folder)
    if (from !== '' && !docs.includes(from)) return { ok: false, message: T.wsMsg.missing(from) }
    // a case-only rename confuses Git on Windows and macOS (CR-12); another spelling of an existing folder too (CR-13)
    if (from !== '' && from.toLowerCase() === n.toLowerCase()) return { ok: false, message: T.wsMsg.documentCaseOnly }
    const existing = docs.find((d) => d !== from && d.toLowerCase() === n.toLowerCase())
    if (from !== '' && existing) return { ok: false, message: T.wsMsg.documentExists(n) }
    const target = from === '' && existing ? existing : n
    const root = s.repo.root
    const base = relative(root, s.repo.folder).split('\\').join('/') || '.'
    const p = (x: string): string => (base === '.' ? x : `${base}/${x}`)
    // the files that move: the whole folder, or each loose item file the index knows (not README or notes — QA-09)
    const loose = from === '' ? queryAll(s.index, { document: '' }).map((i) => i.path).filter((x) => !x.includes('/')) : []
    const moves = from === '' ? loose.map((f) => ({ a: f, b: `${target}/${f}` })) : [{ a: from, b: target }]
    // never over an existing file (CR-01, QA-02): an item there would be lost
    for (const m of moves) if (from === '' && (await exists(join(s.repo.folder, m.b)))) return { ok: false, message: T.wsMsg.documentFileTaken(m.b) }
    const trackedAll = s.isGit ? new Set(await git.trackedFiles(root, base === '.' ? '.' : base)) : new Set<string>()
    const isTracked = (a: string): boolean => trackedAll.has(p(a)) || [...trackedAll].some((t) => t.startsWith(`${p(a)}/`))
    const viaGit = moves.filter((m) => (from === '' ? trackedAll.has(p(m.a)) : isTracked(m.a)))
    const onDisk = moves.filter((m) => !viaGit.includes(m))
    if (viaGit.length > 0 && (await git.status(root, from === '' ? base : p(from))).changes.some((c) => moves.some((m) => c.path === p(m.a) || c.path.startsWith(`${p(m.a)}/`)))) {
      return { ok: false, message: T.wsMsg.documentDirty }
    }
    const createdTarget = from === '' && !(await exists(join(s.repo.folder, target)))
    // Put back whatever already moved, so the folder, Git and the window agree again (CR-06; the owner, 8 Nov 2026:
    // a stopped Git left the folder renamed). Windows may hold a file for a moment after a stopped process: retry.
    const putBack = async (): Promise<boolean> => {
      let ok = true
      const back = async (fn: () => Promise<void>): Promise<void> => {
        for (let attempt = 0; ; attempt++) {
          try {
            return await fn()
          } catch (e) {
            if (attempt >= 4) {
              ok = false
              log.error('Putting a moved document back failed', e)
              return
            }
            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
          }
        }
      }
      const gitBack = viaGit.filter((m) => existsSync(join(s.repo.folder, m.b)))
      if (from !== '' && gitBack.length > 0) await back(() => git.move(root, [p(target)], p(from)))
      else if (gitBack.length > 0) await back(() => git.move(root, gitBack.map((m) => p(m.b)), base))
      for (const m of onDisk.filter((x) => existsSync(join(s.repo.folder, x.b)))) await back(() => rename(join(s.repo.folder, m.b), join(s.repo.folder, m.a)))
      if (createdTarget) await rmdir(join(s.repo.folder, target)).catch(() => undefined)
      return ok
    }
    const failed = async (why: string): Promise<{ ok: false; message: string }> => {
      const back = await putBack()
      // re-read the folder in every case: the window must show what is really on disk
      try {
        s.repo = await ctx.openRepo(root)
        s.lastSync = syncInfo(await s.index.sync(s.repo))
      } catch (e) {
        log.error('Re-reading the project after a failed document move', e)
      }
      rewatch(s)
      gitOps.invalidate()
      return { ok: false, message: back ? T.wsMsg.folderRenameRefused(why) : T.wsMsg.documentNotPutBack(why) }
    }
    s.watch?.close() // Windows refuses to rename a watched folder
    s.watch = null
    try {
      if (from === '') await mkdir(join(s.repo.folder, target), { recursive: true })
      // tracked files move with `git mv` — on disk and in the index at once, without reading 10,000 files again
      if (viaGit.length > 0) {
        if (from !== '') await git.move(root, [p(from)], p(target))
        else await git.move(root, viaGit.map((m) => p(m.a)), p(target))
      }
      for (const m of onDisk) await rename(join(s.repo.folder, m.a), join(s.repo.folder, m.b))
    } catch (e) {
      return failed(explainGitError(e))
    }
    if (viaGit.length > 0) {
      try {
        await git.commitFiles(root, viaGit.flatMap((m) => [p(m.a), p(m.b)]), DOCUMENT_RENAME_COMMIT(from || 'loose files', target), true)
      } catch (e) {
        return failed(explainGitError(e))
      }
    }
    log.info(`Document ${from || '(loose files)'} → ${target}${viaGit.length > 0 ? ' (committed)' : ''}`)
    s.repo = await ctx.openRepo(root)
    rewatch(s)
    s.lastSync = syncInfo(await s.index.sync(s.repo))
    gitOps.invalidate()
    return { ok: true, info: info() }
  }

  const links = createLinkOps(ctx)
  const structure = createStructureOps(ctx)
  const items = createItemOps(ctx, links, structure)
  const fields = createSchemaFieldOps(ctx, () => info())
  const compare = createCompare(git)
  const revert = createRevertOps(ctx, git, items.saveItem)
  const importing = createImportOps(ctx, structure, { userDir: deps.userDir, cacheName: cacheFileName, info: () => info() })
  const exporting = createExportOps(ctx, structure, compare)
  // the same read services on whatever the table shows: the old version while one is open (D-19b)
  const viewCtx: WorkspaceContext = { ...ctx, need: reading }
  const viewStructure = createStructureOps(viewCtx)
  const viewItems = createItemOps(viewCtx, createLinkOps(viewCtx), viewStructure)
  const viewExporting = createExportOps(viewCtx, viewStructure, compare)
  const viewFields = createSchemaFieldOps(viewCtx, () => info())
  // traceability answers from whatever the table shows (an old version too)
  const trace = createTraceabilityOps(viewCtx)
  const gitOps = createGitOps({
    git,
    log,
    resync: () => ctx.resyncAll(need()),
    async tidyBeforePush(s, upstream) {
      const session = need()
      const base = relative(session.repo.root, session.repo.folder).split('\\').join('/') || '.'
      const prefix = base === '.' ? '' : `${base}/`
      // groups (parents) of the items this user changed in commits not on the remote yet
      // item files of every document (S-10), not the project folder
      const changed = (await git.changedFiles(s.repo.root, upstream, 'HEAD', base === '.' ? '.' : base)).filter((f) => f.endsWith('.md') && !f.slice(prefix.length).startsWith('.'))
      // a group = a parent, or the top level of one document (CR-04)
      const parents = new Set<string>()
      for (const f of changed) {
        const it = session.index.get(basename(f, '.md'))
        if (it) parents.add(it.parent ?? `\u0000${it.document ?? ''}`)
      }
      if (parents.size === 0) return 0
      // never touch a group with uncommitted edits: they would end up in this commit
      const dirty = new Set((await git.status(s.repo.root, base)).changes.map((c) => c.path))
      const plan: { id: string; order: string }[] = []
      for (const p of parents) {
        const sibs = p.startsWith('\u0000') ? structure.siblings(session, undefined, p.slice(1)) : structure.siblings(session, p)
        if (sibs.some((x) => dirty.has(`${prefix}${x.path}`))) continue
        plan.push(...planTidy(sibs))
      }
      if (plan.length === 0) return 0
      const r = await structure.applyPlan(session, plan)
      if (!r.ok) throw new Error(r.message)
      const touched = plan.map((x) => `${prefix}${session.repo.itemPath(x.id)}`)
      try {
        await git.commitFiles(s.repo.root, touched, T.gitMsg.tidyCommit(plan.length))
      } catch (e) {
        // all or nothing (CR1-05): the tidy could not be committed (no Git name, a hook, a lock) — put the files back
        // exactly as they were, so the user's next commit does not carry changes they never made
        await git.unstage(s.repo.root, touched).catch(() => {})
        await git.discard(s.repo.root, touched)
        await ctx.resyncAll(session)
        throw e
      }
      return plan.length
    }
  })

  const merging = createMerging({ git, log, resync: () => ctx.resyncAll(need()), ops: gitOps })
  const baselineOps = createBaselineOps({ git, log, gitOps })

  const endVersion = async (): Promise<void> => {
    const v = viewing
    viewing = null
    if (v) await closeVersion(v).catch((e: unknown) => log.warn(`Could not remove the old version's index: ${String(e)}`))
  }

  function closeSession(): void {
    void endVersion()
    session?.watch?.close()
    session?.index.close()
    session = null
  }

  async function startSession(repoRoot: string, isGit: boolean, init?: () => Promise<void>): Promise<RepoInfo> {
    await endVersion() // its temporary index is removed before another project opens (QA19-07)
    closeSession()
    gitOps.invalidate()
    if (init) await init()
    // the phases are logged so a slow open shows where its time went (PQ-02)
    const t0 = performance.now()
    const lap = (): number => Math.round(performance.now() - t0)
    // opened with the locator: it asks the session's index (set below) where each item's file is
    const repo = await ctx.openRepo(repoRoot)
    const tRepo = lap()
    const index = deps.openIndex(repo.root)
    // Watch before the first sync, so nothing that changes during it is missed.
    const watch = deps.watchFiles === false ? null : watchRequirementsFolder(repo.folder, (e) => log.warn(`Folder watch: ${String(e)}`), repo.metaDir)
    const tWatch = lap()
    const stats = await index.sync(repo)
    watch?.take()
    session = { repo, index, isGit, watch, watchedMeta: repo.metaDir, lastSync: syncInfo(stats) }
    log.info(
      `Opened ${repo.root}: ${stats.files} files, ${stats.added} added / ${stats.updated} updated / ${stats.removed} removed ` +
        `in ${stats.durationMs} ms${stats.full ? ' (full index)' : ''} — phases: project ${tRepo} ms, index+watch ready ${tWatch} ms, synced ${lap()} ms`
    )
    await recent.remember(repo.root)
    return info(session)
  }

  /** Brings the index up to date. With a working folder watch only the files it saw change are re-read. */
  async function refresh(focus: boolean): Promise<RepoInfo> {
    const s = need()
    if (focus) gitOps.invalidate() // remotes or identity may have changed outside ReqMan
    // the operating system reports file changes a few milliseconds after they happen: let them arrive
    if (s.watch) await new Promise((r) => setTimeout(r, SETTLE_MS))
    const seen = s.watch?.take()
    if (!seen || seen.all || seen.schema) {
      const repo = await ctx.openRepo(s.repo.root)
      s.lastSync = syncInfo(await s.index.sync(repo))
      s.repo = repo
      rewatch(s)
    } else if (seen.paths.length > 0) {
      const started = performance.now()
      await s.index.syncPaths(s.repo, seen.paths)
      s.lastSync = { durationMs: Math.round(performance.now() - started), full: false, changedFiles: seen.paths.length }
    } else {
      s.lastSync = { durationMs: 0, full: false, changedFiles: 0 }
    }
    // while an old version is shown, the live project is refreshed quietly and the window keeps the version (QA19-03)
    return info(viewing ? viewing.session : s)
  }

  /** Queued, and allowed while an old version is shown (reads, opening, refresh). */
  const qr = <A extends unknown[], R>(fn: (...a: A) => Promise<R>) => (...a: A): Promise<R> => queue.run(() => fn(...a))
  /** Queued writes and Git actions: refused while an old version is shown (D-19b — nothing can change there). */
  // the refusal fits every result these calls return: OpResult, SaveResult (reason) and GitResult (state) — CR19-03
  const refusal = async (): Promise<{ ok: false; message: string; reason: 'error'; state: GitState }> => ({
    ok: false,
    message: T.version.readOnly,
    reason: 'error',
    state: await gitOps.state(need())
  })
  const q = <A extends unknown[], R>(fn: (...a: A) => Promise<R>) => (...a: A): Promise<R> =>
    queue.run(() => (viewing ? (refusal() as Promise<unknown> as Promise<R>) : fn(...a)))

  return {
    async checkFolder(path): Promise<FolderCheck> {
      const gitRoot = await git.findRepositoryRoot(path)
      const root = gitRoot ?? resolve(path)
      return { root, isGitRepository: gitRoot !== null, state: await store.inspect(root) }
    },

    /** "New project from a file" (M7): a new Git repository with a requirements folder in an empty folder. */
    createProject: qr(async (root: string, firstDocument?: string) => {
      await mkdir(root, { recursive: true })
      await git.init(root)
      return startSession(root, true, async () => {
        await store.initialize(root, firstDocument)
        log.info(`Created a new project in ${root}`)
      })
    }),

    initialize: qr(async (root: string, firstDocument?: string) => {
      const isGit = (await git.findRepositoryRoot(root)) !== null
      return startSession(root, isGit, async () => {
        await store.initialize(root, firstDocument)
        log.info(`Created requirements folder in ${root}`)
      })
    }),

    open: qr(async (root: string) => startSession(root, (await git.findRepositoryRoot(root)) !== null)),

    close() {
      if (session) log.info(`Closed ${session.repo.root}`)
      closeSession()
    },

    refresh: qr((focus?: boolean) => refresh(focus === true)),
    repoInfo: () => info(),
    isOpen: () => session !== null,
    recent: recent.read,
    forgetRecent: (root) => recent.forget(root),

    query(asked) {
      const s = reading()
      // "incomplete" needs the required fields of every type (S-05): the index gets them from the schema here
      const query = withRequired(s, asked)
      const numbers = ctx.numbers(s)
      const withNumbers = (r: QueryResult): QueryResult => ({ total: r.total, items: r.items.map((i) => withNumber(i, numbers)) })
      if (query.sort?.by !== 'number') return withNumbers(s.index.query(query))
      // sorted by outline number: the index cannot do that in SQL, so sort the matching rows here
      const { limit = 200, offset = 0, ...rest } = query
      const ranks = ctx.numberRanks(s)
      const rank = (id: string): number => ranks.get(id) ?? Number.MAX_SAFE_INTEGER // no number (orphan): last
      const all = queryAll(s.index, { ...rest, sort: { by: 'id' } })
      const dir = query.sort?.descending ? -1 : 1
      all.sort((a, b) => (rank(a.id) - rank(b.id)) * dir || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      return { total: all.length, items: all.slice(offset, offset + limit).map((i) => withNumber(i, numbers)) }
    },
    getItem: viewItems.getItem,
    newItem: items.newItem,
    saveItem: q(items.saveItem),
    deleteItem: q(items.deleteItem),
    fixFileName: q(items.fixFileName),
    renewCopyId: q(items.renewCopyId),
    ancestors: viewStructure.ancestors,
    fieldValues: (field) => reading().index.fieldValues(field, 200),
    reparentItem: q(structure.reparentItem),
    reparentItems: q(structure.reparentItems),
    moveItem: q(structure.moveItem),
    checkFields: viewFields.checkFields,
    saveSchemaFields: q(fields.saveSchemaFields),
    typeUsage: viewFields.typeUsage,
    saveSchemaTypes: q(fields.saveSchemaTypes),
    saveSchemaRules: q(fields.saveSchemaRules),
    getCoverage: (document?: string) => trace.coverage(reading(), document),
    getImpact: (id: string) => trace.impact(reading(), id),
    starterRules: () => starterRules(reading().repo.schema),
    getMatrix: (req: MatrixRequest) => trace.matrix(reading(), req),
    async exportMatrix(req: MatrixRequest) {
      const sheet = trace.matrixSheet(reading(), req)
      return { content: await writeXlsx([sheet]), count: sheet.rows.length }
    },
    renameProjectFolder: q(renameProjectFolder),
    createDocument: q(createDocument),
    renameDocument: q(renameDocument),
    addLink: q(links.addLink),
    removeLink: q(links.removeLink),
    confirmLinks: q(links.confirmLinks),
    decideLinks: q(links.decideLinks),
    revertChange: q(revert.revertChange),

    gitState: qr(() => gitOps.state(need())),
    commit: q((message: string) => gitOps.commit(need(), message)),
    pull: q(() => paused((s) => merging.pull(s))),
    pullFrom: q((source: string) => paused((s) => merging.pullFrom(s, source))),
    finishPull: q((plan: MergePlan, answers: MergeAnswers) => paused((s) => merging.finishPull(s, plan, answers))),
    listBranches: () => merging.listBranches(need()),
    createBranch: q((name: string) => merging.createBranch(need(), name)),
    listBaselines: () => baselineOps.list(need()),
    createBaseline: q((req: CreateBaselineRequest) => baselineOps.create(need(), req)),
    getHistory: (req: { search?: string; skip?: number }) => baselineOps.history(need(), req),
    openVersion: qr(async (ref: string) => {
      const s = need()
      let next: VersionView
      // temporary indexes live in cache/versions/, emptied when the app starts (a quit while one is shown — CR19-07)
      const fileOf = (key: string): string => join(versionsDir, cacheFileName(key))
      try {
        // the one shown stays until the new one is ready: a failed open changes nothing (QA19-06)
        // without openIndexAt the index is wherever openIndex puts it — by convention cache/<hash>.sqlite
        const at = deps.openIndexAt
        if (at) await mkdir(versionsDir, { recursive: true })
        next = at
          ? await openVersion({ git, s, ref, openIndex: (key) => at(fileOf(key)), indexFile: fileOf })
          : await openVersion({ git, s, ref, openIndex: deps.openIndex, indexFile: (key) => join(deps.userDir, 'cache', cacheFileName(key)) })
      } catch (e) {
        return { ok: false as const, message: explainGitError(e) }
      }
      if (session !== s) {
        // the project was closed while the version was being read (CR19-05)
        await closeVersion(next)
        return { ok: false as const, message: T.wsMsg.noRepo }
      }
      if (viewing?.ref === next.ref) {
        // the same commit again: the same index file — keep the one that is open
        next.session.index.close()
      } else {
        await endVersion()
        viewing = next
      }
      log.info(`Showing the old version ${viewing.label} (${viewing.session.index.count()} items, ${viewing.session.lastSync.durationMs} ms)`)
      return { ok: true as const, info: info() }
    }),
    closeVersion: qr(async () => {
      await endVersion()
      return info()
    }),
    createBranchAt: q((name: string, commit: string) => baselineOps.branchAt(need(), name, commit)),
    switchBranch: q((name: string, changes: 'take' | 'discard') => paused((s) => merging.switchBranch(s, name, changes))),
    branchRange: (name: string) => merging.branchRange(need(), name),
    deleteBranch: q((name: string, force: boolean) => merging.deleteBranch(need(), name, force)),
    push: q(() => gitOps.push(need())),
    discardChanges: q((paths: string[]) => paused((s) => gitOps.discard(s, paths))),
    setGitIdentity: q((name: string, email: string) => gitOps.setIdentity(need(), name, email)),
    undoLastCommit: q(() => paused((s) => gitOps.undoLastCommit(s))),
    itemHistory: (id) => gitOps.history(need(), id),
    compareItemVersion: (id, hash) => gitOps.compare(need(), id, hash),

    /** "Publish to GitHub" (M7): the address of an empty repository becomes "origin", then the first push. */
    publish: q(async (url: string): Promise<GitResult> => {
      const s = need()
      const u = url.trim()
      if (!/^(https:\/\/|ssh:\/\/|file:\/\/|git@)[^\s]+$/.test(u)) return { ok: false, message: T.importMsg.badUrl, state: await gitOps.state(s) }
      if ((await git.remotes(s.repo.root)).length > 0) return { ok: false, message: T.importMsg.hasRemote, state: await gitOps.state(s) }
      await git.addRemote(s.repo.root, 'origin', u)
      gitOps.invalidate()
      log.info(`Added remote origin ${u}`)
      return gitOps.push(s)
    }),

    previewImport: (sheet, settings) => importing.preview(sheet, settings),
    runImport: q((sheet: string[][], settings: ImportSettings, source: Omit<ImportSource, 'sheet'>, commitMessage?: string) => importing.run(sheet, settings, source, commitMessage)),
    importSource: () => importing.source(),
    sourceUpdate: (sheet) => importing.sourceUpdate(sheet),

    compareOptions: () => compare.options(need()),
    compareVersions: (from, to) => compare.compare(need(), from, to),
    exportItems: viewExporting.exportItems,
    exportCompare: exporting.exportCompare
  }
}
