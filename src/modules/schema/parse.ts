import { parse as parseYaml } from 'yaml'
import type { FieldDef, FieldType, ItemTypeDef, LinkTypeDef, ParsedSchema, SchemaProblem } from './index'

/** Properties every item has; a schema may not redefine them as fields. */
export const BUILT_IN_PROPERTIES = ['id', 'type', 'title', 'parent', 'order', 'links', 'text'] as const

const FIELD_TYPES: FieldType[] = ['text', 'enum', 'list', 'number', 'date']
const ID_RE = /^[a-z][a-z0-9-]*$/

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined)

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
    itemTypes.push({ id, name: str(v.name) ?? id, requirement: v.requirement !== false })
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
    linkTypes.push({ id, name, reverseName: str(v.reverseName) ?? `${name} (reverse)` })
  })

  const version = typeof root.version === 'number' ? root.version : 1
  return { schema: { version, itemTypes, fields, linkTypes }, problems }
}
