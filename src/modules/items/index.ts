// PUBLIC ENTRY of the items module (domain core). Other code may import only from this file.
// Responsibility: what an item IS — its in-memory shape, its file format (Markdown + YAML header),
// ID generation, and validation against the project schema. Pure logic: no file or Git access.
export type FieldValue = string | number | string[]

export interface Link {
  /** Link type id from the schema, e.g. "verifies". */
  type: string
  /** ID of the item this link points to. */
  target: string
  /** Fingerprint of the target's content when this link was last confirmed (suspect-link detection, MVP). */
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

export { parseItemFile, serializeItem, ITEM_FILE_EXTENSION, type ParseResult } from './itemFile'
export { generateId, isValidId, ID_ALPHABET } from './ids'
export { validateItem } from './validate'
export { contentFingerprint } from './fingerprint'
