// PUBLIC ENTRY of the schema module. Other code may import only from this file.
// Responsibility: the project's configurable model — item types, fields and link types — read from
// requirements/.reqman/schema.yaml, validated so that a mistake in the file never breaks the app.
import type { Schema, SchemaProblem } from '../../shared/domain'
import { parseSchema, BUILT_IN_PROPERTIES } from './parse'

export type { FieldType, ItemTypeDef, FieldDef, LinkTypeDef, Schema, SchemaProblem } from '../../shared/domain'

export interface ParsedSchema {
  /** Usable schema: invalid entries are left out, so the app keeps working. */
  schema: Schema
  problems: SchemaProblem[]
}

export { parseSchema, BUILT_IN_PROPERTIES }
