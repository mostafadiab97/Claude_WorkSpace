// PUBLIC ENTRY of the schema module. Other code may import only from this file.
// Responsibility: the project's configurable model — item types, fields and link types — read from
// requirements/.reqman/schema.yaml, validated so that a mistake in the file never breaks the app.
import { parseSchema, BUILT_IN_PROPERTIES } from './parse'

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
  /** Shown on the source item: "SYS-1 verifies …" is read from the test's side as "TC-1 verifies SYS-1". */
  name: string
  /** Shown on the target item: "SYS-1 is verified by TC-1". */
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

export interface ParsedSchema {
  /** Usable schema: invalid entries are left out, so the app keeps working. */
  schema: Schema
  problems: SchemaProblem[]
}

export { parseSchema, BUILT_IN_PROPERTIES }
