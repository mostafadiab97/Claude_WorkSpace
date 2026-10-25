// PUBLIC ENTRY of the repository-store module. Other code may import only from this file.
// Responsibility: the requirements folder inside a project's Git repository — creating it, reading every
// item file, writing items safely, and checks that need the whole set (duplicate IDs, broken links).
// It reads and writes files only; it never runs Git.
//
// Layout:  <repo>/requirements/
//            .reqman/schema.yaml     the project's schema (copied from config/default-schema.yaml)
//            .gitattributes          keeps LF line endings so diffs are identical on every PC
//            items/<ID>.md           one file per item
import type { Item, ItemIssue } from '../items'
import type { FieldDef, Schema, SchemaProblem } from '../schema'
import { createFileRepositoryStore } from './fileStore'

export const REQUIREMENTS_FOLDER = 'requirements'

export interface ItemFileInfo {
  /** Path relative to the requirements folder, with forward slashes, e.g. "items/SYS-K7Q3XM.md". */
  path: string
  mtimeMs: number
  size: number
}

export interface FileProblem {
  path: string
  message: string
}

export interface LoadResult {
  items: Item[]
  /** Files that could not be read at all. They are left untouched. */
  fileProblems: FileProblem[]
  /** Problems inside readable items (schema violations, broken links, duplicates). */
  issues: ItemIssue[]
}

export interface RequirementsRepo {
  /** The Git repository folder. */
  readonly root: string
  /** <root>/requirements */
  readonly folder: string
  readonly schema: Schema
  readonly schemaProblems: SchemaProblem[]
  /** Hash of schema.yaml as read, for conflict-safe schema edits. */
  readonly schemaRevision: string
  /**
   * Replaces the schema's field list (keeping comments and other sections). Refuses with a ConflictError if
   * schema.yaml changed since this repository was opened. The repository must be re-opened afterwards.
   */
  writeSchemaFields(fields: FieldDef[], expectedRevision: string): Promise<void>
  listItemFiles(): Promise<ItemFileInfo[]>
  readItemFile(path: string): Promise<{ ok: true; item: Item } | { ok: false; error: string }>
  /** Path of an item's file relative to the requirements folder. */
  itemPath(id: string): string
  /**
   * Reads one item by ID, with a revision (hash of the file content) for conflict-safe saving.
   * `null` if no file exists.
   */
  readItem(id: string): Promise<({ ok: true; item: Item } | { ok: false; error: string }) & { revision: string } | null>
  /** Reads every item and runs all checks. */
  loadAll(): Promise<LoadResult>
  /** A new item with a fresh unique ID and the schema's default values. Not saved yet. */
  createItem(typeId: string, takenIds: ReadonlySet<string>, init?: Partial<Pick<Item, 'title' | 'text' | 'parent' | 'order'>>): Item
  /**
   * Saves an item atomically (a crash never leaves a half-written file) and returns its new revision.
   * With `expectedRevision`, refuses with a ConflictError if the file changed since it was read
   * (`null` = the file must not exist yet).
   */
  writeItem(item: Item, options?: { expectedRevision?: string | null }): Promise<string>
  deleteItem(id: string, options?: { expectedRevision?: string }): Promise<void>
}

export type FolderState = 'ready' | 'not-initialized' | 'missing'

export interface RepositoryStore {
  /** Is there a requirements folder in this repository? */
  inspect(repoRoot: string): Promise<FolderState>
  /** Creates the requirements folder with the default schema. Refuses if it already exists. */
  initialize(repoRoot: string): Promise<RequirementsRepo>
  open(repoRoot: string): Promise<RequirementsRepo>
}

export { createFileRepositoryStore }
export { ConflictError } from './errors'
export { checkRepository } from './checks'
