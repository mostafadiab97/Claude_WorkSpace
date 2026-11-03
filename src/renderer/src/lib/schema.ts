import type { FieldDef, FieldValue, ItemTypeDef, Labels, LinkTypeDef, Schema } from '../../../shared/domain'
import { getLanguage } from '../../../shared/text'

// Names from schema.yaml in the window's language (UI review UX-22): `labels: { ar: … }` next to `name`. Read at
// render time — the language switch swaps the language in place (never keep the result in a module constant).
const inLanguage = (name: string, labels: Labels | undefined): string => labels?.[getLanguage()] ?? name

export const typeLabel = (t: ItemTypeDef): string => inLanguage(t.name, t.labels)
export const typeName = (schema: Schema, id: string): string => {
  const t = schema.itemTypes.find((x) => x.id === id)
  return t ? typeLabel(t) : id
}
/** The short label for narrow places (table), else the full name; a translated name wins over a Latin abbreviation. */
export const typeShort = (schema: Schema, id: string): string => {
  const t = schema.itemTypes.find((x) => x.id === id)
  if (!t) return id
  return t.labels?.[getLanguage()] ?? t.short ?? t.name
}
/** Headings / information items (not requirements). */
export const isHeading = (schema: Schema, id: string): boolean => schema.itemTypes.find((x) => x.id === id)?.requirement === false

export const fieldLabel = (f: FieldDef): string => inLanguage(f.name, f.labels)
/** How a choice is shown; the stored value stays the choice itself. */
export const optionLabel = (f: FieldDef | undefined, value: string): string => f?.optionLabels?.[getLanguage()]?.[value] ?? value

export const linkLabel = (t: LinkTypeDef, reverse = false): string => (reverse ? inLanguage(t.reverseName, t.reverseLabels) : inLanguage(t.name, t.labels))
export const linkName = (schema: Schema, id: string, reverse = false): string => {
  const t = schema.linkTypes.find((l) => l.id === id)
  return t ? linkLabel(t, reverse) : id
}

export const formatValue = (v: FieldValue | undefined, f?: FieldDef): string =>
  v === undefined ? '' : Array.isArray(v) ? v.map((x) => optionLabel(f, x)).join(', ') : f ? optionLabel(f, String(v)) : String(v)
