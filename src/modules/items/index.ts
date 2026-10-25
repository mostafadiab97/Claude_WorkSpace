// PUBLIC ENTRY of the items module (domain core). Other code may import only from this file.
// Responsibility: what an item IS — its file format (Markdown + YAML header), ID generation, and validation
// against the project schema. Pure logic: no file or Git access. The data types live in src/shared/domain.ts.
export type { FieldValue, Link, Item, ItemIssue } from '../../shared/domain'

export { parseItemFile, serializeItem, ITEM_FILE_EXTENSION, type ParseResult } from './itemFile'
export { generateId, isValidId, ID_ALPHABET } from './ids'
export { validateItem } from './validate'
export { contentFingerprint } from './fingerprint'
