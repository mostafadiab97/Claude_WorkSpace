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
import type { FieldDef, ItemTypeDef, LinkTypeDef, Schema, SchemaProblem } from '../schema'
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
  /** The project folder in use: '.reqochet', or '.reqman' in a project not yet renamed (0.16). */
  readonly metaDir: '.reqochet' | '.reqman'
  readonly schema: Schema
  readonly schemaProblems: SchemaProblem[]
  /** Hash of schema.yaml as read, for conflict-safe schema edits. */
  readonly schemaRevision: string
  /**
   * Replaces the schema's field list (keeping comments and other sections). Refuses with a ConflictError if
   * schema.yaml changed since this repository was opened. The repository must be re-opened afterwards.
   */
  writeSchemaFields(fields: FieldDef[], expectedRevision: string): Promise<void>
  /** Replaces the item and link type lists the same way (S-04): other keys and comments stay as written. */
  writeSchemaTypes(itemTypes: ItemTypeDef[], linkTypes: LinkTypeDef[], expectedRevision: string): Promise<void>
  listItemFiles(): Promise<ItemFileInfo[]>
  /** The documents: folders directly under requirements/ (S-10), byte-wise sorted. */
  listDocuments(): Promise<string[]>
  /** Where a new item goes when no document is given: the only document, "items" (before 0.17) or the first. */
  readonly defaultDocument: string
  /**
   * Reads one item file. `allKeysAsFields`: every header key with a simple value goes to `fields`, whether or not
   * the schema defines it (the index stores them all, so adding or removing a field needs no re-index).
   */
  readItemFile(path: string, opts?: { allKeysAsFields?: boolean }): Promise<{ ok: true; item: Item } | { ok: false; error: string }>
  /** Path of an item's file relative to the requirements folder — where it really is (see OpenOptions.locate). */
  itemPath(id: string, document?: string): string
  /** Where the item's file should be: items/<ID>.md. */
  defaultItemPath(id: string, document?: string): string
  /**
   * Renames a file whose name does not match its ID to items/<ID>.md (Git sees a rename, so history is kept).
   * Refuses if that name is taken. Returns the new path.
   */
  fixFileName(id: string): Promise<string>
  /**
   * Reads one item by ID, with a revision (hash of the file content) for conflict-safe saving.
   * `null` if no file exists.
   */
  readItem(id: string): Promise<({ ok: true; item: Item } | { ok: false; error: string }) & { revision: string } | null>
  /** Reads every item and runs all checks. */
  loadAll(): Promise<LoadResult>
  /** A new item with a fresh unique ID and the schema's default values. Not saved yet. */
  createItem(typeId: string, takenIds: ReadonlySet<string>, init?: Partial<Pick<Item, 'title' | 'text' | 'parent' | 'order' | 'document'>>): Item
  /**
   * Saves an item atomically (a crash never leaves a half-written file) and returns its new revision.
   * With `expectedRevision`, refuses with a ConflictError if the file changed since it was read
   * (`null` = the file must not exist yet).
   */
  writeItem(item: Item, options?: { expectedRevision?: string | null }): Promise<string>
  deleteItem(id: string, options?: { expectedRevision?: string }): Promise<void>
}

export interface OpenOptions {
  /**
   * Where an item's file really is (path relative to the requirements folder), if known — e.g. from the index.
   * Without it, items/<ID>.md is assumed.
   */
  locate?: (id: string) => string | undefined
}

export type FolderState = 'ready' | 'not-initialized' | 'missing'

export interface RepositoryStore {
  /** Is there a requirements folder in this repository? */
  inspect(repoRoot: string): Promise<FolderState>
  /** Creates the requirements folder with the default schema. Refuses if it already exists. */
  /** `firstDocument`: the name of the first document folder (default "items"; the window passes "Specification", S-10). */
  initialize(repoRoot: string, firstDocument?: string): Promise<RequirementsRepo>
  open(repoRoot: string, options?: OpenOptions): Promise<RequirementsRepo>
  /**
   * Renames requirements/.reqman to .reqochet (0.16; `back` undoes it). Returns both paths, or null when there is nothing
   * to rename. An empty folder in the way is removed; a full one: Error('both-folders').
   */
  renameLegacyFolder(repoRoot: string, back?: boolean): Promise<{ from: string; to: string } | null>
}

export { createFileRepositoryStore }
export { FIRST_DOCUMENT, isDocumentName } from './fileStore'
export { ConflictError } from './errors'
export { checkRepository } from './checks'
