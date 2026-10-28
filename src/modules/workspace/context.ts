// Shared state of the workspace services: the open repository ("session") and small helpers every service
// uses. Each service file (itemOps, links, structure, schemaFields, exporting, gitOps, compare) receives this
// context; workspace.ts puts them together behind the single WorkspaceService facade.
import type { RepoInfo } from '../../shared/api'
import type { GitAdapter } from '../git-adapter'
import type { IndexCache, SyncStats } from '../index-cache'
import type { Logger } from '../logger'
import type { RepositoryStore, RequirementsRepo } from '../repository-store'
import type { FolderWatch } from './watcher'

export type OpResult = { ok: true } | { ok: false; message: string }

export interface Session {
  repo: RequirementsRepo
  index: IndexCache
  isGit: boolean
  lastSync: RepoInfo['lastSync']
  watch: FolderWatch | null
}

export interface WorkspaceContext {
  store: RepositoryStore
  git: GitAdapter
  log: Pick<Logger, 'info' | 'warn' | 'error'>
  /** The open repository; throws when none is open. */
  need(): Session
  /** Opens the repository files with the index as locator, so items in renamed files are found (D-01). */
  openRepo(root: string): Promise<RequirementsRepo>
  /** Re-opens the schema and re-reads every changed file (after Git changed the working folder). */
  resyncAll(s: Session): Promise<void>
  /** Outline numbers of all items (calculated, cached until the index changes). */
  numbers(s: Session): Map<string, string>
}

export const syncInfo = (stats: SyncStats): RepoInfo['lastSync'] => ({
  durationMs: stats.durationMs,
  full: stats.full,
  changedFiles: stats.added + stats.updated + stats.removed
})

/** Reads all pages of a query (the index returns at most 10,000 rows per call). */
export function queryAll(index: IndexCache, q: Parameters<IndexCache['query']>[0]): ReturnType<IndexCache['query']>['items'] {
  const all: ReturnType<IndexCache['query']>['items'] = []
  for (let offset = 0; ; offset += 10_000) {
    const r = index.query({ ...q, limit: 10_000, offset })
    all.push(...r.items)
    if (r.items.length === 0 || all.length >= r.total) break
  }
  return all
}
