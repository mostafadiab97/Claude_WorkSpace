// Input checks for every call that arrives from the window (review X-01). The window is ReqMan's own code, so
// this is about robustness: a wrong value is refused with a clear message instead of reaching a file write.
// Each function either returns a clean value of the expected type or throws.
import type { ExportItemsRequest, FieldDef, Item, ItemQuery, Link, LinkDecision, RevertPart, SortKey } from '../shared/api'

const MAX = 4096
/** Order keys (see modules/items/orderKey.ts): base-62 digits, at most 200 characters. */
const ORDER_KEY = /^[0-9A-Za-z]{2,200}$/
const MAX_TEXT = 1_000_000

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export class InvalidInput extends Error {}
const bad = (what: string): never => {
  throw new InvalidInput(`Invalid ${what}.`)
}

/** A non-empty string (IDs, paths, names). */
export function str(v: unknown, what: string, max = MAX): string {
  if (typeof v !== 'string' || v.length === 0 || v.length > max) return bad(what)
  return v
}

/** A string that may be empty (messages). */
export function text(v: unknown, what: string, max = MAX_TEXT): string {
  if (v === undefined || v === null) return ''
  if (typeof v !== 'string' || v.length > max) return bad(what)
  return v
}

/** Optional string: missing or empty → undefined. */
export function optStr(v: unknown, what: string): string | undefined {
  if (v === undefined || v === null || v === '') return undefined
  return str(v, what)
}

export function oneOf<const T extends string>(v: unknown, allowed: readonly T[], what: string): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) return bad(what)
  return v as T
}

export function strings(v: unknown, what: string, maxItems = 100_000): string[] {
  if (!Array.isArray(v) || v.length > maxItems || !v.every((x) => typeof x === 'string' && x.length <= MAX)) return bad(what)
  return v as string[]
}

export function num(v: unknown, what: string, min: number, max: number): number {
  const n = typeof v === 'number' ? v : Number.NaN
  if (!Number.isFinite(n) || n < min || n > max) return bad(what)
  return Math.round(n)
}

export function linkDecisions(v: unknown): LinkDecision[] {
  if (!Array.isArray(v) || v.length > 100_000) return bad('link decisions')
  return v.map((d: unknown) => {
    if (!isObj(d) || typeof d.keep !== 'boolean') return bad('link decision')
    return { source: str(d.source, 'source'), type: str(d.type, 'link type'), target: str(d.target, 'target'), keep: d.keep }
  })
}

export function revertPart(v: unknown): RevertPart {
  if (!isObj(v)) return bad('part to take back')
  if (v.kind === 'text') return { kind: 'text' }
  if (v.kind === 'row') return { kind: 'row', key: str(v.key, 'field') }
  if (v.kind === 'link') return { kind: 'link', type: str(v.type, 'link type'), target: str(v.target, 'target') }
  return bad('part to take back')
}

function fieldValue(v: unknown): Item['fields'][string] {
  if (typeof v === 'string' && v.length <= MAX_TEXT) return v
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v as string[]
  return bad('field value')
}

function link(v: unknown): Link {
  if (!isObj(v)) return bad('link')
  const l: Link = { type: str(v.type, 'link type'), target: str(v.target, 'link target') }
  if (v.confirmed !== undefined) l.confirmed = str(v.confirmed, 'link confirmation')
  return l
}

/** A whole item as the editor sends it for saving. */
export function item(v: unknown): Item {
  if (!isObj(v)) return bad('item')
  if (!isObj(v.fields) || !Array.isArray(v.links) || !isObj(v.extra ?? {})) return bad('item')
  const out: Item = {
    id: str(v.id, 'item ID', 64),
    type: str(v.type, 'item type'),
    title: text(v.title, 'title', MAX),
    fields: Object.fromEntries(Object.entries(v.fields).map(([k, x]) => [str(k, 'field name'), fieldValue(x)])),
    links: v.links.map(link),
    text: text(v.text, 'text'),
    extra: (v.extra ?? {}) as Record<string, unknown>
  }
  if (v.parent !== undefined && v.parent !== '') out.parent = str(v.parent, 'parent', 64)
  if (v.order !== undefined) {
    if (typeof v.order !== 'string' || !ORDER_KEY.test(v.order)) return bad('order')
    out.order = v.order
  }
  return out
}

const FIELD_TYPES = ['text', 'enum', 'list', 'number', 'date'] as const

export function fieldDefs(v: unknown): FieldDef[] {
  if (!Array.isArray(v)) return bad('field list')
  return v.map((f) => {
    if (!isObj(f)) return bad('field')
    const def: FieldDef = { id: str(f.id, 'field ID', 64), name: str(f.name, 'field name', 200), type: oneOf(f.type, FIELD_TYPES, 'field kind') }
    if (f.options !== undefined) def.options = strings(f.options, 'field choices', 1000)
    if (f.default !== undefined && f.default !== '') def.default = str(f.default, 'default value')
    return def
  })
}

const SORT = /^(id|type|title|order|number|relevance|text|links|field:[\w-]+)$/

export function query(v: unknown): ItemQuery {
  if (v === undefined || v === null) return {}
  if (!isObj(v)) return bad('query')
  const q: ItemQuery = {}
  if (v.text !== undefined) q.text = text(v.text, 'search text', 1000)
  if (v.types !== undefined) q.types = strings(v.types, 'type filter', 200)
  if (v.fields !== undefined) {
    if (!isObj(v.fields)) return bad('field filter')
    q.fields = Object.fromEntries(Object.entries(v.fields).map(([k, x]) => [k, strings(x, 'field filter', 1000)]))
  }
  if (v.links !== undefined) q.links = oneOf(v.links, ['suspect', 'none'] as const, 'links filter')
  if (v.parent !== undefined) q.parent = v.parent === null ? null : str(v.parent, 'parent', 64)
  if (v.sort !== undefined) {
    if (!isObj(v.sort) || typeof v.sort.by !== 'string' || !SORT.test(v.sort.by)) return bad('sort')
    q.sort = { by: v.sort.by as SortKey, ...(v.sort.descending === true ? { descending: true } : {}) }
  }
  if (v.limit !== undefined) q.limit = num(v.limit, 'limit', 0, 10_000)
  if (v.offset !== undefined) q.offset = num(v.offset, 'offset', 0, 10_000_000)
  if (v.brief === true) q.brief = true
  return q
}

export function exportRequest(v: unknown): ExportItemsRequest {
  if (!isObj(v)) return bad('export request')
  const scope = oneOf(v.scope, ['all', 'filtered'], 'export scope')
  const r: ExportItemsRequest = {
    scope,
    columns: strings(v.columns, 'export columns', 500),
    format: oneOf(v.format, ['csv', 'markdown'], 'export format')
  }
  if (v.query !== undefined && v.query !== null) {
    const q = query(v.query)
    delete q.limit
    delete q.offset
    delete q.brief
    r.query = q
  }
  return r
}
