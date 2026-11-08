// Data types shared by the core and the UI. Plain types only — no code, no Node APIs — so the UI may use them.
// Modules re-export these from their public entries; this file is the single definition.

// ---------- schema (requirements/.reqman/schema.yaml)

export type FieldType = 'text' | 'enum' | 'list' | 'number' | 'date'

export interface ItemTypeDef {
  id: string
  name: string
  /** False for headings/information that structure a specification but are not requirements. */
  requirement: boolean
  /** Optional short label for narrow places such as the table's Type column ("SysReq"); 0.15 UI polish (UX-03). */
  short?: string
  /** The name in other window languages, e.g. `{ ar: 'متطلب نظام' }` (UX-22); `name` is the default. */
  labels?: Labels
  /** Fields an item of this type must have; one without them is saved but marked incomplete (the owner, 5 Nov 2026 — S-05). */
  required?: string[]
}

/** A text per window language (`ar`, …); missing languages use the default name. */
export type Labels = Record<string, string>

export interface FieldDef {
  id: string
  name: string
  type: FieldType
  /** Allowed values (enum fields). */
  options?: string[]
  /** Value given to new items. */
  default?: string
  /** The field name in other window languages (UX-22). */
  labels?: Labels
  /** How choices are shown in other window languages: `{ ar: { Draft: 'مسودة' } }`. Files keep the choice itself. */
  optionLabels?: Record<string, Labels>
}

export interface LinkTypeDef {
  id: string
  /** Read from the source: "TC-1 verifies SYS-1". */
  name: string
  /** Read from the target: "SYS-1 is verified by TC-1". */
  reverseName: string
  /** Both names in other window languages (UX-22). */
  labels?: Labels
  reverseLabels?: Labels
}

export interface Schema {
  version: number
  itemTypes: ItemTypeDef[]
  fields: FieldDef[]
  linkTypes: LinkTypeDef[]
  /** Features the team turned off (or on) for this repository: `features: { branches: false }` (P-40a). */
  features?: Record<string, boolean>
}

export interface SchemaProblem {
  /** Where in the file, e.g. "fields[2].options". */
  path: string
  message: string
}

// ---------- items

export type FieldValue = string | number | string[]

export interface Link {
  /** Link type id from the schema, e.g. "verifies". */
  type: string
  /** ID of the item this link points to. */
  target: string
  /** Fingerprint of the target's content when this link was last confirmed (suspect-link detection). */
  confirmed?: string
  /** Other keys written on the link by hand or by another tool — kept unchanged on save (NFR-05). */
  extra?: Record<string, unknown>
}

export interface Item {
  id: string
  /** Item type id from the schema, e.g. "system-requirement". */
  type: string
  title: string
  parent?: string
  /**
   * Position among siblings: an order key ("a0", "a1", "a0V" …) that sorts as text and always leaves room
   * between two neighbours, so a move rewrites only the moved item. Older files' numbers are read as keys.
   */
  order?: string
  /** Values of schema fields (status, priority, owner, tags, custom fields). */
  fields: Record<string, FieldValue>
  links: Link[]
  /** For a new item: the document (folder) its file goes into. Not written into the file — the folder is the document. */
  document?: string
  /** The requirement text (Markdown). */
  text: string
  /** Header keys this version of ReqMan does not know; written back unchanged so nothing is ever lost. */
  extra: Record<string, unknown>
}

export interface ItemIssue {
  itemId: string
  /** Which part of the item, e.g. "fields.status" or "links[1].target". */
  path: string
  message: string
  severity: 'error' | 'warning'
  /** reqochet can fix this with one click: 'file-name' = rename the file to <ID>.md; 'copy-id' = give the copied file a new ID. */
  fix?: 'file-name' | 'copy-id'
}

// ---------- index queries

export interface IndexedItem {
  id: string
  type: string
  title: string
  parent?: string
  order?: string
  fields: Record<string, FieldValue>
  links: Link[]
  text: string
  /** File path relative to the requirements folder. */
  path: string
  /** The document (folder under requirements/) the item's file is in; '' = directly in requirements/ (S-10). Always set by the index. */
  document?: string
  /** Number of items whose parent is this item. */
  childCount: number
  /** Number of links from other items to this one. */
  incomingCount: number
  /** Outgoing links whose target changed (title, text or type) since the link was confirmed. */
  suspectCount: number
  /** Outline number in the document ("2.3.1"), calculated from the hierarchy; none for items outside it. */
  number?: string
}

/** `relevance` = best search matches first (exact ID, then title, then text); only meaningful with `text`. */
export type SortKey = 'id' | 'type' | 'title' | 'order' | 'number' | 'relevance' | 'text' | 'links' | `field:${string}`

export interface ItemQuery {
  /** Words to find in ID, title or text. Each word must match (prefix match: "brak" finds "braking"). */
  text?: string
  types?: string[]
  /** Field id → accepted values. An item matches if it has any of the values (for lists: any element). */
  fields?: Record<string, string[]>
  /** `suspect` = items with at least one suspect outgoing link; `none` = items with no links in or out. */
  links?: 'suspect' | 'none'
  /** Only items missing a required field of their type (S-05). */
  incomplete?: boolean
  /** Filled in by the workspace from the schema (never by the window): item type → required field ids. */
  required?: Record<string, string[]>
  /** Only direct children of this item; `null` = only top-level items. */
  parent?: string | null
  /** Only items of this document (folder under requirements/); leave out for all documents (S-10). */
  document?: string
  sort?: { by: SortKey; descending?: boolean }
  limit?: number
  offset?: number
  /** Return only the start of the text, as plain text (smaller results for tables and trees). */
  brief?: boolean
  /** Return at most this many characters of the text (the table's main column, SEC-19-03); ignored with `brief`. */
  textUpTo?: number
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
  /** The target changed since this link was confirmed. */
  suspect: boolean
}

// ---------- differences between two versions of an item

export interface DiffRow {
  /** "title", "type", "parent", "order", "field:<id>", "extra:<key>" */
  key: string
  label: string
  before: string
  after: string
}

export interface ItemDiff {
  kind: 'added' | 'deleted' | 'modified' | 'unchanged'
  /** Changed values only. */
  rows: DiffRow[]
  /** Set when the text changed. */
  text: { before: string; after: string } | null
  linksAdded: Link[]
  linksRemoved: Link[]
}

/** The document of an item file: the first folder of its path under requirements/ ('' = loose file) — S-10. */
export const documentOfPath = (path: string): string => {
  const at = path.indexOf('/')
  return at < 0 ? '' : path.slice(0, at)
}
