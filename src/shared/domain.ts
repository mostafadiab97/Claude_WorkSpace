// Data types shared by the core and the UI. Plain types only — no code, no Node APIs — so the UI may use them.
// Modules re-export these from their public entries; this file is the single definition.

// ---------- schema (requirements/.reqman/schema.yaml)

export type FieldType = 'text' | 'enum' | 'list' | 'number' | 'date'

export interface ItemTypeDef {
  id: string
  name: string
  /** ID prefix, e.g. SYS → SYS-K7Q3XM. */
  prefix: string
  /** False for headings/information that structure a specification but are not requirements. */
  requirement: boolean
}

export interface FieldDef {
  id: string
  name: string
  type: FieldType
  /** Allowed values (enum fields). */
  options?: string[]
  /** Value given to new items. */
  default?: string
}

export interface LinkTypeDef {
  id: string
  /** Read from the source: "TC-1 verifies SYS-1". */
  name: string
  /** Read from the target: "SYS-1 is verified by TC-1". */
  reverseName: string
}

export interface Schema {
  version: number
  itemTypes: ItemTypeDef[]
  fields: FieldDef[]
  linkTypes: LinkTypeDef[]
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
}

export interface Item {
  id: string
  /** Item type id from the schema, e.g. "system-requirement". */
  type: string
  title: string
  parent?: string
  /** Position among siblings; spaced (10, 20, 30) so inserting rarely touches other files. */
  order?: number
  /** Values of schema fields (status, priority, owner, tags, custom fields). */
  fields: Record<string, FieldValue>
  links: Link[]
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
}

// ---------- index queries

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
  /** Number of items whose parent is this item. */
  childCount: number
  /** Number of links from other items to this one. */
  incomingCount: number
  /** Outgoing links whose target changed (title, text or type) since the link was confirmed. */
  suspectCount: number
}

/** `relevance` = best search matches first (exact ID, then title, then text); only meaningful with `text`. */
export type SortKey = 'id' | 'type' | 'title' | 'order' | 'relevance' | 'text' | 'links' | `field:${string}`

export interface ItemQuery {
  /** Words to find in ID, title or text. Each word must match (prefix match: "brak" finds "braking"). */
  text?: string
  types?: string[]
  /** Field id → accepted values. An item matches if it has any of the values (for lists: any element). */
  fields?: Record<string, string[]>
  /** `suspect` = items with at least one suspect outgoing link; `none` = items with no links in or out. */
  links?: 'suspect' | 'none'
  /** Only direct children of this item; `null` = only top-level items. */
  parent?: string | null
  sort?: { by: SortKey; descending?: boolean }
  limit?: number
  offset?: number
  /** Return only the start of the text, as plain text (smaller results for tables and trees). */
  brief?: boolean
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
