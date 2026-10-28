// PUBLIC ENTRY of the workspace module. Other code may import only from this file.
// Responsibility: the requirements repository the user has open — opening/creating it, keeping its index
// up to date, and every item operation the UI performs (query, read, create, save, delete, reorder),
// with the rules that need the whole repository (no parent loops, conflict-safe saving).
// Implementation: workspace.ts (facade + queue) over small services — see the file list there.
import type {
  FieldCheck,
  CompareOptions,
  CompareResult,
  ExportItemsRequest,
  FieldDef,
  FolderCheck,
  GitResult,
  GitState,
  HistoryEntry,
  ItemVersionCompare,
  Item,
  ItemDetails,
  ItemQuery,
  QueryResult,
  RecentRepository,
  RepoInfo,
  SaveResult
} from '../../shared/api'
import { cacheFileName, createWorkspace, type WorkspaceDeps } from './workspace'

import type { OpResult } from './context'
export type { OpResult }

export interface WorkspaceService {
  checkFolder(path: string): Promise<FolderCheck>
  initialize(root: string): Promise<RepoInfo>
  open(root: string): Promise<RepoInfo>
  close(): void
  /** Re-reads what changed on disk. `focus`: the window got focus again (also re-checks Git settings). */
  refresh(focus?: boolean): Promise<RepoInfo>
  /** The repository summary as the index has it now, without touching the disk. */
  repoInfo(): RepoInfo
  isOpen(): boolean
  recent(): Promise<RecentRepository[]>
  forgetRecent(root: string): Promise<void>
  query(q: ItemQuery): QueryResult
  getItem(id: string): Promise<ItemDetails | null>
  newItem(type: string, parent?: string): Item
  saveItem(item: Item, revision: string | null): Promise<SaveResult>
  /** `removeIncomingLinks`: also remove the links other items have to it, so none point to nothing. */
  deleteItem(id: string, revision: string, opts?: { removeIncomingLinks?: boolean }): Promise<OpResult>
  addLink(source: string, type: string, target: string): Promise<OpResult>
  removeLink(source: string, type: string, target: string): Promise<OpResult>
  confirmLinks(source: string, target?: string): Promise<OpResult>
  /** Renames a file whose name does not match the ID inside it to <ID>.md. */
  fixFileName(id: string): Promise<OpResult>
  /** Before saving field definitions: items whose values the changed definitions would not allow. */
  checkFields(fields: FieldDef[]): FieldCheck[]
  moveItem(id: string, direction: 'up' | 'down'): Promise<OpResult>
  reparentItem(id: string, parent: string | null, before?: string | null): Promise<OpResult>
  ancestors(id: string): string[]
  saveSchemaFields(fields: FieldDef[], schemaRevision: string): Promise<{ ok: true; info: RepoInfo } | { ok: false; message: string }>
  // Git (M4) — see gitOps.ts for the rules
  gitState(): Promise<GitState>
  commit(message: string): Promise<GitResult>
  pull(): Promise<GitResult>
  push(): Promise<GitResult>
  discardChanges(paths: string[]): Promise<GitResult>
  setGitIdentity(name: string, email: string): Promise<GitResult>
  undoLastCommit(): Promise<GitResult>
  itemHistory(id: string): Promise<HistoryEntry[]>
  compareItemVersion(id: string, hash: string): Promise<ItemVersionCompare>
  // Compare (M5) — see compare.ts
  compareOptions(): Promise<CompareOptions>
  compareVersions(from: string, to: string): Promise<CompareResult>
  // Export (M6): builds the file content; the main process asks where to save it
  exportItems(request: ExportItemsRequest): Promise<{ content: string; count: number }>
  exportCompare(from: string, to: string, format: 'csv' | 'markdown'): Promise<{ content: string; count: number }>
}

export { createWorkspace, cacheFileName, type WorkspaceDeps }
/** Pure ordering rules, exported for tests and future tools (import, merge). */
export { compareOutline, documentOrderOf, outlineNumbers, planInsert, planSwap, planTidy } from './structure'
