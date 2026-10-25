// The item file format: one Markdown file per item with a YAML header.
//
//   ---
//   id: SYS-K7Q3XM
//   type: system-requirement
//   title: Brake pedal response time
//   status: Draft            <- schema fields, in schema order
//   parent: STK-2B8R1C
//   order: 30
//   links:
//     - type: refines
//       target: STK-2B8R1C
//   ---
//   The system shall begin braking within 150 ms of pedal input.
//
// Writing always produces the same layout for the same item (fixed key order, one value per line,
// LF line endings), so Git diffs show only real changes and merges stay line-clean.
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import type { Schema } from '../schema'
import type { FieldValue, Item, Link } from './index'

export const ITEM_FILE_EXTENSION = '.md'

const BUILT_IN = new Set(['id', 'type', 'title', 'parent', 'order', 'links'])

export type ParseResult = { ok: true; item: Item } | { ok: false; error: string }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function toFieldValue(v: unknown): FieldValue | undefined {
  if (typeof v === 'string' || typeof v === 'number') return v
  if (typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return v.filter((x) => x !== null && x !== undefined).map(String)
  return undefined
}

/**
 * Reads an item file. Values whose key is in the schema become `fields`; anything else unknown goes
 * to `extra` and is preserved on write. `schemaFieldIds` lets a file written with a field that was later
 * removed from the schema keep that value (in `extra`) instead of losing it.
 */
export function parseItemFile(content: string, schemaFieldIds: ReadonlySet<string>): ParseResult {
  const text = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  if (!text.startsWith('---\n')) return { ok: false, error: 'The file must start with a "---" header line.' }
  const closing = /\n---[ \t]*(?:\n|$)/g
  closing.lastIndex = 3
  const match = closing.exec(text)
  if (!match) return { ok: false, error: 'The header is not closed with a "---" line.' }
  const headerText = text.slice(4, match.index + 1)
  const body = text.slice(match.index + match[0].length)

  let header: unknown
  try {
    header = parseYaml(headerText)
  } catch (e) {
    return { ok: false, error: `The header is not valid YAML: ${(e as Error).message.split('\n')[0]}` }
  }
  if (!isObj(header)) return { ok: false, error: 'The header must contain key: value lines.' }

  const id = typeof header.id === 'string' ? header.id.trim() : ''
  const type = typeof header.type === 'string' ? header.type.trim() : ''
  if (!id) return { ok: false, error: 'The header has no "id".' }
  if (!type) return { ok: false, error: 'The header has no "type".' }

  const links: Link[] = []
  if (header.links !== undefined && header.links !== null) {
    if (!Array.isArray(header.links)) return { ok: false, error: '"links" must be a list.' }
    for (const [i, l] of header.links.entries()) {
      if (!isObj(l) || typeof l.type !== 'string' || typeof l.target !== 'string') {
        return { ok: false, error: `links[${i}] must have "type" and "target".` }
      }
      const link: Link = { type: l.type, target: l.target }
      if (typeof l.confirmed === 'string') link.confirmed = l.confirmed
      links.push(link)
    }
  }

  const fields: Record<string, FieldValue> = {}
  const extra: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(header)) {
    if (BUILT_IN.has(key)) continue
    const fv = schemaFieldIds.has(key) ? toFieldValue(value) : undefined
    if (fv !== undefined) fields[key] = fv
    else if (value !== null && value !== undefined) extra[key] = value
  }

  const item: Item = {
    id,
    type,
    title: header.title === undefined || header.title === null ? '' : String(header.title),
    fields,
    links,
    text: body.replace(/\n+$/, ''),
    extra
  }
  if (typeof header.parent === 'string' && header.parent.trim()) item.parent = header.parent.trim()
  if (typeof header.order === 'number' && Number.isFinite(header.order)) item.order = header.order
  return { ok: true, item }
}

/** Writes an item in the canonical layout. */
export function serializeItem(item: Item, schema: Pick<Schema, 'fields'>): string {
  const header: Record<string, unknown> = { id: item.id, type: item.type, title: item.title }
  const isEmpty = (v: FieldValue): boolean => v === '' || (Array.isArray(v) && v.length === 0)
  for (const f of schema.fields) {
    const v = item.fields[f.id]
    if (v !== undefined && !isEmpty(v)) header[f.id] = v
  }
  // Values for fields not (or no longer) in the schema: kept, sorted for a stable layout.
  for (const key of Object.keys(item.fields).sort()) {
    const v = item.fields[key]
    if (!(key in header) && v !== undefined && !isEmpty(v)) header[key] = v
  }
  for (const key of Object.keys(item.extra).sort()) {
    if (!(key in header) && !BUILT_IN.has(key)) header[key] = item.extra[key]
  }
  if (item.parent) header.parent = item.parent
  if (item.order !== undefined) header.order = item.order
  if (item.links.length > 0) {
    header.links = item.links.map((l) => (l.confirmed ? { type: l.type, target: l.target, confirmed: l.confirmed } : { type: l.type, target: l.target }))
  }
  const yamlText = stringifyYaml(header, { lineWidth: 0, defaultStringType: 'PLAIN', defaultKeyType: 'PLAIN' })
  const body = item.text.replace(/\r\n?/g, '\n').replace(/\n+$/, '')
  return `---\n${yamlText}---\n${body ? `${body}\n` : ''}`
}
