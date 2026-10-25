import type { FieldValue, Schema } from '../../../shared/domain'

export const typeName = (schema: Schema, id: string): string => schema.itemTypes.find((t) => t.id === id)?.name ?? id

export const linkName = (schema: Schema, id: string, reverse = false): string => {
  const t = schema.linkTypes.find((l) => l.id === id)
  return t ? (reverse ? t.reverseName : t.name) : id
}

export const formatValue = (v: FieldValue | undefined): string =>
  v === undefined ? '' : Array.isArray(v) ? v.join(', ') : String(v)
