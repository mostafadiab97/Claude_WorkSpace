// The workspace facade: one WorkspaceService built from small services (review S-01) —
//   itemOps (read/create/save/delete), links, structure (hierarchy, moves), schemaFields, exporting,
//   gitOps (M4) and compare (M5).
// Every operation that writes files, changes the index or runs Git goes through one queue (review D-03).
import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { basename, relative, resolve } from 'node:path'
import type { FolderCheck, GitResult, ImportSettings, ImportSource, IndexedItem, QueryResult, RepoInfo } from '../../shared/api'
import type { GitAdapter } from '../git-adapter'
import type { IndexCache } from '../index-cache'
import type { Logger } from '../logger'
import type { RepositoryStore } from '../repository-store'
import { createCompare } from './compare'
import { queryAll, syncInfo, type Session, type WorkspaceContext } from './context'
import { createExportOps } from './exporting'
import { createGitOps } from './gitOps'
import type { WorkspaceService } from './index'
import { createImportOps } from './importing'
import { createItemOps } from './itemOps'
import { createLinkOps } from './links'
import { createSerialQueue } from './queue'
import { createRecentList } from './recent'
import { createRevertOps } from './revert'
import { createSchemaFieldOps } from './schemaFields'
import { compareOutline, createStructureOps, outlineNumbers, planTidy } from './structure'
import { watchRequirementsFolder } from './watcher'
import { T } from '../../shared/text'

export interface WorkspaceDeps {
  store: RepositoryStore
  git: GitAdapter
  /** Creates (or reopens) the index cache for a repository root. */
  openIndex(root: string): IndexCache
  /** Folder for per-user state (recent repositories list). */
  userDir: string
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

export function createWorkspace(deps: WorkspaceDeps): WorkspaceService {
  const { store, git, log } = deps
  const recent = createRecentList(deps.userDir, (m) => log.warn(m))
  const queue = createSerialQueue()
  let session: Session | null = null

  const need = (): Session => {
    if (!session) throw new Error(T.wsMsg.noRepo)
    return session
  }

  let outline: { index: IndexCache; revision: number; map: Map<string, string> } | null = null

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
    async resyncAll(s) {
      s.watch?.take() // everything is re-checked now; keep only changes that happen from here on
      const repo = await ctx.openRepo(s.repo.root)
      s.lastSync = syncInfo(await s.index.sync(repo))
      s.repo = repo
    }
  }

  const info = (s: Session = need()): RepoInfo => ({
    root: s.repo.root,
    name: basename(s.repo.root),
    isGitRepository: s.isGit,
    schema: s.repo.schema,
    schemaProblems: s.repo.schemaProblems,
    schemaRevision: s.repo.schemaRevision,
    itemCount: s.index.count(),
    issues: s.index.repositoryIssues(),
    lastSync: s.lastSync
  })

  const links = createLinkOps(ctx)
  const structure = createStructureOps(ctx)
  const items = createItemOps(ctx, links, structure)
  const fields = createSchemaFieldOps(ctx, () => info())
  const compare = createCompare(git)
  const revert = createRevertOps(ctx, git, items.saveItem)
  const importing = createImportOps(ctx, structure, { userDir: deps.userDir, cacheName: cacheFileName, info: () => info() })
  const exporting = createExportOps(ctx, structure, compare)
  const gitOps = createGitOps({
    git,
    log,
    resync: () => ctx.resyncAll(need()),
    async tidyBeforePush(s, upstream) {
      const session = need()
      const base = relative(session.repo.root, session.repo.folder).split('\\').join('/') || '.'
      const prefix = base === '.' ? '' : `${base}/`
      // groups (parents) of the items this user changed in commits not on the remote yet
      const changed = await git.changedFiles(s.repo.root, upstream, 'HEAD', `${prefix}items`)
      const parents = new Set<string>()
      for (const f of changed) {
        const it = session.index.get(basename(f, '.md'))
        if (it) parents.add(it.parent ?? '')
      }
      if (parents.size === 0) return 0
      // never touch a group with uncommitted edits: they would end up in this commit
      const dirty = new Set((await git.status(s.repo.root, base)).changes.map((c) => c.path))
      const plan: { id: string; order: string }[] = []
      for (const p of parents) {
        const sibs = structure.siblings(session, p || undefined)
        if (sibs.some((x) => dirty.has(`${prefix}${x.path}`))) continue
        plan.push(...planTidy(sibs))
      }
      if (plan.length === 0) return 0
      const r = await structure.applyPlan(session, plan)
      if (!r.ok) throw new Error(r.message)
      await git.commitFiles(s.repo.root, plan.map((x) => `${prefix}${session.repo.itemPath(x.id)}`), T.gitMsg.tidyCommit(plan.length))
      return plan.length
    }
  })

  function closeSession(): void {
    session?.watch?.close()
    session?.index.close()
    session = null
  }

  async function startSession(repoRoot: string, isGit: boolean, init?: () => Promise<void>): Promise<RepoInfo> {
    closeSession()
    gitOps.invalidate()
    if (init) await init()
    // opened with the locator: it asks the session's index (set below) where each item's file is
    const repo = await ctx.openRepo(repoRoot)
    const index = deps.openIndex(repo.root)
    // Watch before the first sync, so nothing that changes during it is missed.
    const watch = deps.watchFiles === false ? null : watchRequirementsFolder(repo.folder, (e) => log.warn(`Folder watch: ${String(e)}`))
    const stats = await index.sync(repo)
    watch?.take()
    session = { repo, index, isGit, watch, lastSync: syncInfo(stats) }
    log.info(
      `Opened ${repo.root}: ${stats.files} files, ${stats.added} added / ${stats.updated} updated / ${stats.removed} removed ` +
        `in ${stats.durationMs} ms${stats.full ? ' (full index)' : ''}`
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
    } else if (seen.paths.length > 0) {
      const started = performance.now()
      await s.index.syncPaths(s.repo, seen.paths)
      s.lastSync = { durationMs: Math.round(performance.now() - started), full: false, changedFiles: seen.paths.length }
    } else {
      s.lastSync = { durationMs: 0, full: false, changedFiles: 0 }
    }
    return info(s)
  }

  const q = <A extends unknown[], R>(fn: (...a: A) => Promise<R>) => (...a: A): Promise<R> => queue.run(() => fn(...a))

  return {
    async checkFolder(path): Promise<FolderCheck> {
      const gitRoot = await git.findRepositoryRoot(path)
      const root = gitRoot ?? resolve(path)
      return { root, isGitRepository: gitRoot !== null, state: await store.inspect(root) }
    },

    /** "New project from a file" (M7): a new Git repository with a requirements folder in an empty folder. */
    createProject: q(async (root: string) => {
      await mkdir(root, { recursive: true })
      await git.init(root)
      return startSession(root, true, async () => {
        await store.initialize(root)
        log.info(`Created a new project in ${root}`)
      })
    }),

    initialize: q(async (root: string) => {
      const isGit = (await git.findRepositoryRoot(root)) !== null
      return startSession(root, isGit, async () => {
        await store.initialize(root)
        log.info(`Created requirements folder in ${root}`)
      })
    }),

    open: q(async (root: string) => startSession(root, (await git.findRepositoryRoot(root)) !== null)),

    close() {
      if (session) log.info(`Closed ${session.repo.root}`)
      closeSession()
    },

    refresh: q((focus?: boolean) => refresh(focus === true)),
    repoInfo: () => info(),
    isOpen: () => session !== null,
    recent: recent.read,
    forgetRecent: (root) => recent.forget(root),

    query(query) {
      const s = need()
      const numbers = ctx.numbers(s)
      const withNumbers = (r: QueryResult): QueryResult => ({ total: r.total, items: r.items.map((i) => withNumber(i, numbers)) })
      if (query.sort?.by !== 'number') return withNumbers(s.index.query(query))
      // sorted by outline number: the index cannot do that in SQL, so sort the matching rows here
      const { limit = 200, offset = 0, ...rest } = query
      const all = queryAll(s.index, { ...rest, sort: { by: 'id' } }).map((i) => withNumber(i, numbers))
      all.sort((a, b) => compareOutline(a.number, b.number) * (query.sort?.descending ? -1 : 1) || a.id.localeCompare(b.id))
      return { total: all.length, items: all.slice(offset, offset + limit) }
    },
    getItem: items.getItem,
    newItem: items.newItem,
    saveItem: q(items.saveItem),
    deleteItem: q(items.deleteItem),
    fixFileName: q(items.fixFileName),
    ancestors: structure.ancestors,
    reparentItem: q(structure.reparentItem),
    reparentItems: q(structure.reparentItems),
    moveItem: q(structure.moveItem),
    checkFields: fields.checkFields,
    saveSchemaFields: q(fields.saveSchemaFields),
    addLink: q(links.addLink),
    removeLink: q(links.removeLink),
    confirmLinks: q(links.confirmLinks),
    decideLinks: q(links.decideLinks),
    revertChange: q(revert.revertChange),

    gitState: q(() => gitOps.state(need())),
    commit: q((message: string) => gitOps.commit(need(), message)),
    pull: q(() => gitOps.pull(need())),
    push: q(() => gitOps.push(need())),
    discardChanges: q((paths: string[]) => gitOps.discard(need(), paths)),
    setGitIdentity: q((name: string, email: string) => gitOps.setIdentity(need(), name, email)),
    undoLastCommit: q(() => gitOps.undoLastCommit(need())),
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
    exportItems: exporting.exportItems,
    exportCompare: exporting.exportCompare
  }
}
