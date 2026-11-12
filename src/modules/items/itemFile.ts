// The item file format: one Markdown file per item with a YAML header.
//
//   ---
//   id: REQ-K7Q3XMB
//   type: system-requirement
//   title: Brake pedal response time
//   status: Draft            <- schema fields, in schema order
//   parent: STK-2B8R1C
//   order: a3               <- order key (older files: a number, read as a key)
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
import { isOrderKey, keyOfNumber } from './orderKey'
import { isValidId } from './ids'

export const ITEM_FILE_EXTENSION = '.md'

const BUILT_IN = new Set(['id', 'type', 'title', 'parent', 'order', 'links'])

export type ParseResult = { ok: true; item: Item } | { ok: false; error: string }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function toFieldValue(v: unknown): FieldValue | undefined {
  if (typeof v === 'string' || typeof v === 'number') return v
  // only plain text, numbers and lists of them are field values; anything else (true/false, mappings, lists of
  // mappings) stays in `extra` exactly as written (CR1-02, NFR-05)
  if (Array.isArray(v) && v.every((x) => x === null || x === undefined || typeof x === 'string' || typeof x === 'number')) {
    return v.filter((x) => x !== null && x !== undefined).map(String)
  }
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
      const rest = Object.fromEntries(Object.entries(l).filter(([k]) => k !== 'type' && k !== 'target' && k !== 'confirmed'))
      if (Object.keys(rest).length > 0) link.extra = rest
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
  else if (typeof header.parent === 'number') item.parent = String(header.parent)
  // a parent ReqMan cannot read (a list, a mapping) is kept as it was, never dropped (CR1-02)
  else if (header.parent !== undefined && header.parent !== null) item.extra['parent'] = header.parent
  if (typeof header.order === 'number' && Number.isFinite(header.order)) item.order = keyOfNumber(header.order)
  else if (typeof header.order === 'string' && isOrderKey(header.order.trim())) item.order = header.order.trim()
  // an order value ReqMan cannot read is kept as it was (never lost), but gives no position
  else if (header.order !== undefined && header.order !== null) item.extra['order'] = header.order
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
  else if (item.extra['parent'] !== undefined) header.parent = item.extra['parent']
  if (item.order !== undefined) header.order = item.order
  else if (item.extra['order'] !== undefined) header.order = item.extra['order']
  if (item.links.length > 0) {
    header.links = item.links.map((l) => ({ type: l.type, target: l.target, ...(l.confirmed ? { confirmed: l.confirmed } : {}), ...(l.extra ?? {}) }))
  }
  const yamlText = stringifyYaml(header, { lineWidth: 0, defaultStringType: 'PLAIN', defaultKeyType: 'PLAIN' })
  const body = item.text.replace(/\r\n?/g, '\n').replace(/\n+$/, '')
  return `---\n${yamlText}---\n${body ? `${body}\n` : ''}`
}

/**
 * Only `id`, `parent` and `order` of an item file, read from the header lines without the YAML library — for outline
 * numbers of a whole commit (Compare, W-20: parsing 50,000 files took 10 s). Returns null when the header is not in
 * the plain form reqochet writes (quotes, comments, special values): the caller then uses parseItemFile.
 */
export function readStructure(content: string): { id: string; parent?: string; order?: string } | null {
  let i = content.charCodeAt(0) === 0xfeff ? 1 : 0
  const first = content.indexOf('\n', i)
  if (first < 0 || content.slice(i, first).replace(/\r$/, '') !== '---') return null
  i = first
  const out: { id?: string; parent?: string; order?: string } = {}
  const seen = new Set<string>()
  let blockOpen = false // the last top-level key had no value: indented lines (a list, a mapping) may follow
  for (;;) {
    const end = content.indexOf('\n', i + 1)
    const line = content.slice(i + 1, end < 0 ? undefined : end).replace(/\r$/, '')
    if (line === '---') break
    if (end < 0 || line === '' || /[\u2028\u2029\t]/.test(line)) return null
    if (line.startsWith(' ')) {
      // inside a block: only the plain forms the serializer writes ("  - type: x", "    target: REQ-…", "  - tag")
      if (!blockOpen || !/^ +(- )?([A-Za-z0-9_-]+: )?[^\s'"[{&*!|>%@`#][^#]*$/.test(line) || /: .*: |:$/.test(line.trim().replace(/^- /, ''))) return null
      i = end
      continue
    }
    // every top-level line is "key: value" (or "key:" opening a block) in the plain form reqochet writes; anything
    // else — a second ": ", a comment, a missing space, an indicator — goes to the full parser (review 2, B-01)
    const m = /^([A-Za-z0-9_-]+):(?: (.*))?$/.exec(line)
    if (!m) return null
    const key = m[1] as string
    if (seen.has(key)) return null
    seen.add(key)
    const value = (m[2] ?? '').trimEnd()
    blockOpen = value === ''
    if (!blockOpen && !/^"(?:[^"\\]|\\.)*"$|^'(?:[^']|'')*'$/.test(value)) {
      if (/^['"[{&*!|>%@`]|: | #|:$/.test(value)) return null
    }
    if (key === 'id' || key === 'parent' || key === 'order') {
      if (blockOpen || /^['"]/.test(value)) return null
      if (key === 'order') {
        if (isOrderKey(value) && !/^[+-]?[\d.]/.test(value)) out.order = value
        else if (/^(0|[1-9]\d{0,14})$/.test(value)) out.order = keyOfNumber(Number(value))
        else return null
      } else {
        if (!isValidId(value)) return null
        if (key === 'id') out.id = value
        else out.parent = value
      }
    }
    i = end
  }
  // a file without a type is refused by the full parser (R2)
  if (!out.id || !seen.has('type')) return null
  return { id: out.id, ...(out.parent ? { parent: out.parent } : {}), ...(out.order !== undefined ? { order: out.order } : {}) }
}
