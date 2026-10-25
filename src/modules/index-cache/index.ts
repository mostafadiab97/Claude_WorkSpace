// PUBLIC ENTRY of the index-cache module. Other code may import only from this file.
// Responsibility: fast search, filtering, sorting and reverse-link lookup over all items of a repository.
// The cache is a local SQLite file OUTSIDE the repository. It is never the source of truth: it can be
// deleted at any time and is rebuilt from the item files; normally only changed files are re-read.
import type { IndexedItem, ItemIssue, ItemQuery, LinkRef, QueryResult } from '../../shared/domain'
import type { RequirementsRepo } from '../repository-store'
import { createSqliteIndexCache, preview } from './sqliteIndex'

export type { IndexedItem, SortKey, ItemQuery, QueryResult, LinkRef } from '../../shared/domain'

export interface SyncStats {
  files: number
  added: number
  updated: number
  removed: number
  unreadable: number
  /** True if everything was re-read (first open, schema change, or cache format change). */
  full: boolean
  durationMs: number
}

export interface IndexCache {
  /** Brings the cache up to date with the files, re-reading only what changed. */
  sync(repo: RequirementsRepo): Promise<SyncStats>
  /** Re-reads just these files (paths relative to the requirements folder), e.g. right after saving. */
  syncPaths(repo: RequirementsRepo, paths: string[]): Promise<void>
  /** Throws the cache away and re-reads every file. */
  rebuild(repo: RequirementsRepo): Promise<SyncStats>
  query(q: ItemQuery): QueryResult
  get(id: string): IndexedItem | undefined
  /** Links pointing TO this item (the reverse view: "verified by …"). */
  incomingLinks(id: string): LinkRef[]
  /** Content fingerprint of an item (for confirming links), or undefined if it does not exist. */
  fingerprint(id: string): string | undefined
  count(): number
  /**
   * Whole-repository problems, answered from the index in milliseconds: duplicate IDs, links to missing
   * items, missing parents, and files that could not be read (`itemId` is then the file path).
   */
  repositoryIssues(): ItemIssue[]
  close(): void
}

export { createSqliteIndexCache, preview }
