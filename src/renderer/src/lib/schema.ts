import type { FieldValue, Schema } from '../../../shared/domain'

export const typeName = (schema: Schema, id: string): string => schema.itemTypes.find((t) => t.id === id)?.name ?? id
/** The short label for narrow places (table), else the full name. */
export const typeShort = (schema: Schema, id: string): string => {
  const t = schema.itemTypes.find((x) => x.id === id)
  return t?.short ?? t?.name ?? id
}
/** Headings / information items (not requirements). */
export const isHeading = (schema: Schema, id: string): boolean => schema.itemTypes.find((x) => x.id === id)?.requirement === false

export const linkName = (schema: Schema, id: string, reverse = false): string => {
  const t = schema.linkTypes.find((l) => l.id === id)
  return t ? (reverse ? t.reverseName : t.name) : id
}

export const formatValue = (v: FieldValue | undefined): string =>
  v === undefined ? '' : Array.isArray(v) ? v.join(', ') : String(v)
