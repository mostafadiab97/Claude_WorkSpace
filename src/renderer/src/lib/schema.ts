import type { FieldDef, FieldValue, ItemTypeDef, Labels, LinkTypeDef, Schema } from '../../../shared/domain'
import { getLanguage } from '../../../shared/text'

// Names from schema.yaml in the window's language (UI review UX-22): `labels: { ar: … }` next to `name`. Read at
// render time — the language switch swaps the language in place (never keep the result in a module constant).
const own = (m: Labels | undefined, key: string): string | undefined => (m && Object.hasOwn(m, key) ? m[key] : undefined)
const inLanguage = (name: string, labels: Labels | undefined): string => own(labels, getLanguage()) ?? name

export const typeLabel = (t: ItemTypeDef): string => inLanguage(t.name, t.labels)
export const typeName = (schema: Schema, id: string): string => {
  const t = schema.itemTypes.find((x) => x.id === id)
  return t ? typeLabel(t) : id
}
/** The short label for narrow places (table), else the full name; a translated name wins over a Latin abbreviation. */
export const typeShort = (schema: Schema, id: string): string => {
  const t = schema.itemTypes.find((x) => x.id === id)
  if (!t) return id
  return own(t.labels, getLanguage()) ?? t.short ?? t.name
}
/** Headings / information items (not requirements). */
export const isHeading = (schema: Schema, id: string): boolean => schema.itemTypes.find((x) => x.id === id)?.requirement === false

export const fieldLabel = (f: FieldDef): string => inLanguage(f.name, f.labels)
/** How a choice is shown; the stored value stays the choice itself. */
export const optionLabel = (f: FieldDef | undefined, value: string): string => {
  const lang = getLanguage()
  const byLang = f?.optionLabels && Object.hasOwn(f.optionLabels, lang) ? f.optionLabels[lang] : undefined
  return own(byLang, value) ?? value
}

export const linkLabel = (t: LinkTypeDef, reverse = false): string => (reverse ? inLanguage(t.reverseName, t.reverseLabels) : inLanguage(t.name, t.labels))
export const linkName = (schema: Schema, id: string, reverse = false): string => {
  const t = schema.linkTypes.find((l) => l.id === id)
  return t ? linkLabel(t, reverse) : id
}

export const formatValue = (v: FieldValue | undefined, f?: FieldDef): string =>
  v === undefined ? '' : Array.isArray(v) ? v.map((x) => optionLabel(f, x)).join(', ') : f ? optionLabel(f, String(v)) : String(v)

/**
 * Translations that a change in the Fields window leaves out of date (owner, 4 Nov 2026: warn, do not drop):
 * the field was renamed but keeps its translated names, or enum choices with a translation are no longer offered.
 */
export const staleTranslations = (
  was: FieldDef | undefined,
  name: string,
  options: readonly string[]
): { name: boolean; options: string[] } => {
  if (!was) return { name: false, options: [] }
  const hasLabels = Object.keys(was.labels ?? {}).length > 0
  return {
    name: hasLabels && name.trim() !== was.name,
    options: Object.keys(was.optionLabels ?? {}).filter((o) => !options.includes(o))
  }
}
