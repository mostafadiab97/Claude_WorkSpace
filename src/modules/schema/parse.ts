import { parse as parseYaml } from 'yaml'
import type { FieldDef, FieldType, ItemTypeDef, LinkTypeDef, ParsedSchema, SchemaProblem } from './index'

/** Properties every item has; a schema may not redefine them as fields. */
export const BUILT_IN_PROPERTIES = ['id', 'type', 'title', 'parent', 'order', 'links', 'text'] as const

const FIELD_TYPES: FieldType[] = ['text', 'enum', 'list', 'number', 'date']
const ID_RE = /^[a-z][a-z0-9-]*$/

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined)
const LANG_RE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/

/** Translated names (UX-22): `{ ar: 'الحالة' }`. Anything else is reported and left out. */
function labelsOf(v: unknown, path: string, add: (path: string, message: string) => void, keysAreLanguages = true): Record<string, string> | undefined {
  if (v === undefined || v === null) return undefined // an empty "labels:" = no labels
  if (!isObj(v)) {
    add(path, 'Must be a mapping of language to text, e.g. "{ ar: الحالة }".')
    return undefined
  }
  const out: Record<string, string> = {}
  for (const [lang, text] of Object.entries(v)) {
    const t = str(text)
    if ((keysAreLanguages && !LANG_RE.test(lang)) || t === undefined) add(`${path}.${lang}`, keysAreLanguages ? 'Must be a language code (e.g. ar) with a text.' : 'Must be a text.')
    else out[lang] = t
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function parseSchema(text: string): ParsedSchema {
  const problems: SchemaProblem[] = []
  const add = (path: string, message: string): void => void problems.push({ path, message })

  let raw: unknown
  try {
    raw = parseYaml(text)
  } catch (e) {
    add('', `Not valid YAML: ${(e as Error).message}`)
    raw = {}
  }
  if (!isObj(raw)) {
    add('', 'The schema must be a YAML mapping (key: value).')
    raw = {}
  }
  const root = raw as Obj
  const list = (key: string): unknown[] => {
    const v = root[key]
    if (v === undefined) return []
    if (!Array.isArray(v)) {
      add(key, 'Must be a list.')
      return []
    }
    return v
  }

  // ---- item types
  const itemTypes: ItemTypeDef[] = []
  list('itemTypes').forEach((v, i) => {
    const p = `itemTypes[${i}]`
    if (!isObj(v)) return add(p, 'Must be a mapping with id and name.')
    const id = str(v.id)
    if (!id || !ID_RE.test(id)) return add(`${p}.id`, 'Must be lower-case letters, digits and dashes, e.g. "system-requirement".')
    if (itemTypes.some((t) => t.id === id)) return add(`${p}.id`, `Duplicate item type "${id}".`)
    // Since 0.9.0 IDs do not depend on the type (all are REQ-…), so a "prefix" in older schemas is ignored.
    const short = str(v.short)
    const labels = labelsOf(v.labels, `${p}.labels`, add)
    itemTypes.push({ id, name: str(v.name) ?? id, requirement: v.requirement !== false, ...(short ? { short } : {}), ...(labels ? { labels } : {}) })
  })
  if (itemTypes.length === 0) add('itemTypes', 'At least one valid item type is needed.')

  // ---- fields
  const fields: FieldDef[] = []
  list('fields').forEach((v, i) => {
    const p = `fields[${i}]`
    if (!isObj(v)) return add(p, 'Must be a mapping with id, name and type.')
    const id = str(v.id)
    if (!id || !ID_RE.test(id)) return add(`${p}.id`, 'Must be lower-case letters, digits and dashes, e.g. "safety-level".')
    if ((BUILT_IN_PROPERTIES as readonly string[]).includes(id)) return add(`${p}.id`, `"${id}" is a built-in property and cannot be a field.`)
    if (fields.some((f) => f.id === id)) return add(`${p}.id`, `Duplicate field "${id}".`)
    const type = (str(v.type) ?? 'text') as FieldType
    if (!FIELD_TYPES.includes(type)) return add(`${p}.type`, `Unknown type "${String(v.type)}". Use one of: ${FIELD_TYPES.join(', ')}.`)
    const field: FieldDef = { id, type, name: str(v.name) ?? id }
    if (type === 'enum') {
      const options = Array.isArray(v.options) ? v.options.map((o) => String(o).trim()).filter(Boolean) : []
      if (options.length === 0) return add(`${p}.options`, 'An enum field needs a list of options.')
      field.options = [...new Set(options)]
    }
    const labels = labelsOf(v.labels, `${p}.labels`, add)
    if (labels) field.labels = labels
    if (v.optionLabels !== undefined && v.optionLabels !== null) {
      if (!isObj(v.optionLabels)) add(`${p}.optionLabels`, 'Must be a mapping of language to choices, e.g. "{ ar: { Draft: مسودة } }".')
      else {
        const byLang: Record<string, Record<string, string>> = {}
        for (const [lang, m] of Object.entries(v.optionLabels)) {
          const l = LANG_RE.test(lang) ? labelsOf(m, `${p}.optionLabels.${lang}`, add, false) : (add(`${p}.optionLabels.${lang}`, 'Must be a language code, e.g. ar.'), undefined)
          if (l) byLang[lang] = l
        }
        if (Object.keys(byLang).length > 0) field.optionLabels = byLang
      }
    }
    if (v.default !== undefined) {
      const d = String(v.default)
      if (field.options && !field.options.includes(d)) add(`${p}.default`, `Default "${d}" is not one of the options; ignored.`)
      else field.default = d
    }
    fields.push(field)
  })

  // ---- link types
  const linkTypes: LinkTypeDef[] = []
  list('linkTypes').forEach((v, i) => {
    const p = `linkTypes[${i}]`
    if (!isObj(v)) return add(p, 'Must be a mapping with id, name and reverseName.')
    const id = str(v.id)
    if (!id || !ID_RE.test(id)) return add(`${p}.id`, 'Must be lower-case letters, digits and dashes, e.g. "verifies".')
    if (linkTypes.some((l) => l.id === id)) return add(`${p}.id`, `Duplicate link type "${id}".`)
    const name = str(v.name) ?? id
    const labels = labelsOf(v.labels, `${p}.labels`, add)
    const reverseLabels = labelsOf(v.reverseLabels, `${p}.reverseLabels`, add)
    linkTypes.push({ id, name, reverseName: str(v.reverseName) ?? `${name} (reverse)`, ...(labels ? { labels } : {}), ...(reverseLabels ? { reverseLabels } : {}) })
  })

  // ---- feature switches set by the team (P-40a): `features: { branches: false }`; unknown names are kept (a newer
  // ReqMan may know them), values other than true/false/on/off are reported
  let features: Record<string, boolean> | undefined
  if (root.features !== undefined) {
    if (!isObj(root.features)) add('features', 'Must be a mapping, e.g. "features: { branches: false }".')
    else {
      features = {}
      for (const [k, val] of Object.entries(root.features)) {
        const b = val === true || val === 'on' ? true : val === false || val === 'off' ? false : undefined
        if (b === undefined) add(`features.${k}`, 'Must be true or false.')
        else features[k] = b
      }
    }
  }

  const version = typeof root.version === 'number' ? root.version : 1
  return { schema: { version, itemTypes, fields, linkTypes, ...(features ? { features } : {}) }, problems }
}
