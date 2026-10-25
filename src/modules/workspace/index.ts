// PUBLIC ENTRY of the workspace module. Other code may import only from this file.
// Responsibility: the requirements repository the user has open — opening/creating it, keeping its index
// up to date, and every item operation the UI performs (query, read, create, save, delete, reorder),
// with the rules that need the whole repository (no parent loops, conflict-safe saving).
import type {
  FieldDef,
  FolderCheck,
  Item,
  ItemDetails,
  ItemQuery,
  QueryResult,
  RecentRepository,
  RepoInfo,
  SaveResult
} from '../../shared/api'
import { cacheFileName, createWorkspace, type WorkspaceDeps } from './workspace'

export type OpResult = { ok: true } | { ok: false; message: string }

export interface WorkspaceService {
  checkFolder(path: string): Promise<FolderCheck>
  initialize(root: string): Promise<RepoInfo>
  open(root: string): Promise<RepoInfo>
  close(): void
  refresh(): Promise<RepoInfo>
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
  moveItem(id: string, direction: 'up' | 'down'): Promise<OpResult>
  reparentItem(id: string, parent: string | null, before?: string | null): Promise<OpResult>
  ancestors(id: string): string[]
  saveSchemaFields(fields: FieldDef[], schemaRevision: string): Promise<{ ok: true; info: RepoInfo } | { ok: false; message: string }>
}

export { createWorkspace, cacheFileName, type WorkspaceDeps }
