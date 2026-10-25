// PUBLIC ENTRY of the index-cache module. Other code may import only from this file.
// Responsibility: fast search, filtering, sorting and reverse-link lookup over all items of a repository.
// The cache is a local SQLite file OUTSIDE the repository. It is never the source of truth: it can be
// deleted at any time and is rebuilt from the item files; normally only changed files are re-read.
import type { FieldValue, Link } from '../items'
import type { RequirementsRepo } from '../repository-store'
import { createSqliteIndexCache } from './sqliteIndex'

export interface IndexedItem {
  id: string
  type: string
  title: string
  parent?: string
  order?: number
  fields: Record<string, FieldValue>
  links: Link[]
  text: string
  /** File path relative to the requirements folder. */
  path: string
}

export type SortKey = 'id' | 'type' | 'title' | 'order' | `field:${string}`

export interface ItemQuery {
  /** Words to find in ID, title or text. Each word must match (prefix match: "brak" finds "braking"). */
  text?: string
  types?: string[]
  /** Field id → accepted values. An item matches if it has any of the values (for lists: any element). */
  fields?: Record<string, string[]>
  /** Only direct children of this item; `null` = only top-level items. */
  parent?: string | null
  sort?: { by: SortKey; descending?: boolean }
  limit?: number
  offset?: number
}

export interface QueryResult {
  /** Number of matching items before limit/offset. */
  total: number
  items: IndexedItem[]
}

export interface LinkRef {
  /** The item on the other end. */
  id: string
  type: string
}

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
  /** Throws the cache away and re-reads every file. */
  rebuild(repo: RequirementsRepo): Promise<SyncStats>
  query(q: ItemQuery): QueryResult
  get(id: string): IndexedItem | undefined
  /** Links pointing TO this item (the reverse view: "verified by …"). */
  incomingLinks(id: string): LinkRef[]
  count(): number
  close(): void
}

export { createSqliteIndexCache }
