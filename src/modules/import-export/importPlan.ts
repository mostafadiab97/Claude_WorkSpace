// Excel / CSV import (M7), the pure part: which file column means what (guessed from the header names), and what
// importing would do — row by row: create, update, unchanged or skip, with the problems found. No file access:
// the workspace passes the sheet's text cells and the existing items, and writes the planned items afterwards.
import type { FieldDef, FieldValue, Item, Link, Schema } from '../../shared/domain'
import type { ImportPlanRow, ImportProblem, ImportTarget } from '../../shared/api'
import { T } from '../../shared/text'

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9#.]+/g, ' ')
    .trim()

/** Header names other tools and people use, per target (compared after lower-casing and removing punctuation). */
const SYNONYMS: [ImportTarget, string[]][] = [
  ['id', ['reqif identifier', 'id', 'req id', 'requirement id', 'identifier', 'object identifier', 'key', 'uid', 'absolute number', 'req no', 'requirement no']],
  ['number', ['no.', 'no', 'number', '#', 'section', 'chapter', 'outline', 'outline number', 'heading number', 'paragraph', 'clause', 'nr', 'nr.']],
  ['title', ['reqif.name', 'reqif.chaptername', 'title', 'name', 'summary', 'heading', 'short text', 'short description', 'subject', 'caption']],
  ['text', ['reqif.text', 'reqif.description', 'text', 'description', 'requirement', 'requirement text', 'details', 'body', 'object text', 'content', 'statement', 'long text']],
  ['type', ['type', 'item type', 'kind', 'category', 'object type', 'artifact type', 'requirement type']],
  ['parent', ['parent', 'parent id', 'parent requirement', 'derived from', 'parent item']],
  ['level', ['level', 'depth', 'outline level', 'hierarchy level', 'indent']],
  ['links', ['links', 'link', 'trace', 'traces', 'trace links', 'relations', 'relationships']],
  ['linkedFrom', ['linked from', 'incoming links', 'backlinks']]
]

/**
 * A first guess for every column, from its header: built-in parts, the project's fields (by name or ID) and link
 * columns ("Verified by" = links of type verifies stored in the other item). Each target is used once.
 */
export function guessMapping(headers: string[], schema: Schema): ImportTarget[] {
  // ReqMan's own ReqIF export: its "ReqMan.Type" is the item type (the ReqIF object type is just "Requirement")
  if (headers.some((h) => norm(h) === 'reqman.type')) {
    // … and its "ReqMan.Markdown" is the exact text (ReqIF.Text is the same text as XHTML, for other tools)
    const markdown = headers.some((h) => norm(h) === 'reqman.markdown')
    const rename = (h: string): string => {
      const n = norm(h)
      if (n === 'type' || n === 'reqman.number' || (markdown && n === 'reqif.text')) return ''
      if (n === 'reqman.type') return 'Type'
      if (n === 'reqman.markdown') return 'Text'
      return h
    }
    return guessMapping(headers.map(rename), schema)
  }
  const used = new Set<ImportTarget>()
  const pick = (t: ImportTarget): ImportTarget => {
    if (used.has(t)) return 'ignore'
    used.add(t)
    return t
  }
  return headers.map((h) => {
    const n = norm(h)
    if (!n) return 'ignore'
    for (const [t, names] of SYNONYMS) if (names.includes(n)) return pick(t)
    const field = schema.fields.find((f) => norm(f.name) === n || norm(f.id) === n)
    if (field) return pick(`field:${field.id}`)
    for (const l of schema.linkTypes) {
      if (norm(l.name) === n || norm(l.id) === n) return pick(`link:${l.id}`)
      if (norm(l.reverseName) === n) return pick(`linkFrom:${l.id}`)
    }
    // "Status (Approved/Draft)", "Priority level" …
    const partial = schema.fields.find((f) => n.startsWith(`${norm(f.name)} `))
    return partial ? pick(`field:${partial.id}`) : 'ignore'
  })
}

/** The first row that looks like a header: at least two filled cells, mostly short words (within the first 20 rows). */
export function guessHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const filled = (rows[i] ?? []).filter((c) => c.trim() !== '')
    if (filled.length >= 2 && filled.every((c) => c.length <= 60)) return i
  }
  return 0
}

export interface ExistingItems {
  /** Items of the repository the file's rows refer to, by ID (full items: an update keeps what the file does not mention). */
  byId: ReadonlyMap<string, Item>
  /** Whether an item exists in the repository at all (parents and link targets outside the file). */
  exists?: (id: string) => boolean
  /** `source-id` (the ID in another tool) → ReqMan ID, from earlier imports. */
  bySource: ReadonlyMap<string, string>
}

export interface ImportPlanInput {
  /** The sheet's rows after the header row. */
  rows: string[][]
  /** File row number (1-based) of rows[0]. */
  firstRow: number
  headers: string[]
  mapping: ImportTarget[]
  schema: Schema
  defaultType: string
  existing: ExistingItems
  /** A new, unused ID (REQ-…). */
  newId: () => string
  isValidId: (id: string) => boolean
}

export interface PlannedItem {
  row: number
  action: 'create' | 'update' | 'unchanged'
  item: Item
  /** The hierarchy columns decided the parent (otherwise an existing item keeps its place). */
  placed: boolean
  /** File order, for new positions. */
  seq: number
}

export interface ImportPlan {
  items: PlannedItem[]
  /** Links read from "linked from" columns whose source item is not in the file: added to that existing item. */
  extraLinks: { source: string; link: Link }[]
  problems: ImportProblem[]
  preview: ImportPlanRow[]
  counts: { create: number; update: number; unchanged: number; skip: number }
}

const splitList = (v: string): string[] =>
  v
    .split(/[;,\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)

/** "3.2.1", "3.2.1.", "§3.2.1" → "3.2.1"; null when it is not an outline number. */
export function outlineOf(v: string): string | null {
  const m = /^\D{0,2}?(\d+(?:\.\d+)*)\.?$/.exec(v.trim())
  return m ? (m[1] as string) : null
}

/** What importing would do. Rows without title and text are skipped; every decision that loses a value is a problem. */
export function planImport(input: ImportPlanInput): ImportPlan {
  const { rows, mapping, schema, existing } = input
  const problems: ImportProblem[] = []
  const problem = (row: number, col: number | null, message: string, severity: 'error' | 'warning' = 'warning'): void => {
    problems.push({ row, ...(col !== null && input.headers[col] ? { column: input.headers[col] as string } : {}), message, severity })
  }
  const colsOf = (pred: (t: ImportTarget) => boolean): number[] => mapping.flatMap((t, i) => (pred(t) ? [i] : []))
  const col = (t: ImportTarget): number | null => colsOf((x) => x === t)[0] ?? null
  const cell = (r: string[], c: number | null): string => (c === null ? '' : (r[c] ?? '').trim())
  const idCol = col('id')
  const hierarchy = col('parent') ?? col('number') ?? col('level')
  const typeByName = new Map<string, string>()
  for (const t of schema.itemTypes) {
    typeByName.set(norm(t.id), t.id)
    typeByName.set(norm(t.name), t.id)
  }
  const fieldCols = colsOf((t) => t.startsWith('field:')).map((c) => ({ c, def: schema.fields.find((f) => f.id === mapping[c]?.slice(6)) })).filter((x): x is { c: number; def: FieldDef } => x.def !== undefined)

  const mappedFields = new Set(fieldCols.map((x) => x.def.id))
  // ---- pass 1: one planned item per usable row, with its ReqMan ID
  type Draft = { row: number; r: string[]; seq: number; item: Item; base: Item | null; key: string | null }
  const drafts: Draft[] = []
  const byKey = new Map<string, Draft>() // file ID (ours or foreign) → row
  const takenNew = new Set<string>()
  const preview: ImportPlanRow[] = []
  let skip = 0
  rows.forEach((r, i) => {
    const row = input.firstRow + i
    const title0 = cell(r, col('title'))
    // the text exactly as in the cell (spaces at line ends are part of it); only Windows line ends are normalised
    const text = col('text') === null ? '' : (r[col('text') as number] ?? '').replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '')
    if (!title0 && !text.trim()) {
      if (r.some((x) => x.trim())) {
        skip++
        problem(row, null, T.importMsg.empty)
      }
      return
    }
    const key = cell(r, idCol) || null
    if (key && byKey.has(key)) {
      skip++
      problem(row, idCol, T.importMsg.duplicate(key), 'error')
      preview.push({ row, action: 'skip', id: key, type: '', title: title0 })
      return
    }
    // whose item is this row? our ID → that item; an ID from another tool → the item imported from it before
    let id: string | null = null
    if (key && existing.byId.has(key)) id = key
    else if (key && existing.bySource.has(key)) id = existing.bySource.get(key) as string
    const base = id ? (existing.byId.get(id) ?? null) : null
    if (!id) {
      if (key && input.isValidId(key) && !takenNew.has(key)) id = key // e.g. a ReqMan export opened in another repository
      else id = input.newId()
      takenNew.add(id)
    }
    // type
    let type = base?.type ?? input.defaultType
    const typeCell = cell(r, col('type'))
    if (typeCell) {
      const t = typeByName.get(norm(typeCell))
      if (t) type = t
      else problem(row, col('type'), T.importMsg.unknownType(typeCell, schema.itemTypes.find((x) => x.id === type)?.name ?? type))
    }
    const title = title0 || firstWords(text)
    const item: Item = base
      ? { ...base, fields: { ...base.fields }, links: [...base.links], extra: { ...base.extra } }
      : { id, type, title, fields: defaults(schema, mappedFields), links: [], text: '', extra: {} }
    item.type = type
    if (col('title') !== null && title0) item.title = title0
    else if (!base) item.title = title
    if (col('text') !== null) item.text = text
    if (key && key !== id && !input.isValidId(key)) item.extra['source-id'] = key
    for (const { c, def } of fieldCols) {
      const raw = cell(r, c)
      const v = fieldValue(def, raw)
      if (v === undefined) {
        if (raw) problem(row, c, T.importMsg.badValue(raw, def.name, def.options ?? null, base !== null))
        // an empty cell clears the value — unless the value is one the file could not hold (not an allowed option)
        else if (base && (def.type !== 'enum' || def.options?.includes(String(base.fields[def.id])) !== false)) delete item.fields[def.id]
        continue
      }
      item.fields[def.id] = v
    }
    const d: Draft = { row, r, seq: drafts.length, item, base, key }
    drafts.push(d)
    if (key) byKey.set(key, d)
  })

  // resolves an ID written in the file (ours, another tool's, or a row of this file) to a ReqMan ID
  const exists = (id: string): boolean => existing.byId.has(id) || existing.exists?.(id) === true
  const resolve = (ref: string): string | null => byKey.get(ref)?.item.id ?? (exists(ref) ? ref : (existing.bySource.get(ref) ?? null))

  // ---- pass 2: hierarchy
  const placed = new Set<Draft>()
  if (hierarchy !== null) {
    const pc = col('parent')
    const nc = col('number')
    const lc = col('level')
    const byNumber = new Map<string, Draft>()
    const stack: Draft[] = []
    for (const d of drafts) {
      let parent: string | null | undefined
      if (pc !== null) {
        const p = cell(d.r, pc)
        if (p) {
          parent = resolve(p)
          if (!parent) problem(d.row, pc, T.importMsg.unknownParent(p))
        } else if (d.base?.parent && resolve(d.base.parent) === null) {
          parent = undefined // a parent that exists nowhere cannot be in the file: leave it (it stays listed as a problem)
        } else parent = null
      } else if (nc !== null) {
        const num = outlineOf(cell(d.r, nc))
        if (num) {
          byNumber.set(num, d)
          const up = num.includes('.') ? num.slice(0, num.lastIndexOf('.')) : null
          parent = up ? (byNumber.get(up)?.item.id ?? null) : null
          if (up && parent === null) problem(d.row, nc, T.importMsg.noNumberAbove(up))
        } else parent = d.base ? undefined : null
      } else if (lc !== null) {
        const lv = Number.parseInt(cell(d.r, lc), 10)
        if (Number.isFinite(lv) && lv >= 1) {
          while (stack.length >= lv) stack.pop()
          parent = stack.length === lv - 1 ? (stack[stack.length - 1]?.item.id ?? null) : null
          stack.push(d)
        } else parent = d.base ? undefined : null
      }
      if (parent === undefined) continue
      if (parent === d.item.id) {
        problem(d.row, hierarchy, T.importMsg.ownParent)
        parent = null
      }
      if (parent) d.item.parent = parent
      else delete d.item.parent
      placed.add(d)
    }
  }

  // ---- pass 3: links. Columns listing this item's own links replace its links of those types (a link that stays
  // keeps its confirmation); "linked from" columns only add links, stored in the other item.
  const linkType = (name: string): { id: string; reverse: boolean } | null => {
    const n = norm(name)
    for (const l of schema.linkTypes) {
      if (norm(l.name) === n || norm(l.id) === n) return { id: l.id, reverse: false }
      if (norm(l.reverseName) === n) return { id: l.id, reverse: true }
    }
    return null
  }
  const reverse = new Map<string, Link[]>() // source ID → links to add
  const addReverse = (source: string, type: string, target: string): void => {
    reverse.set(source, [...(reverse.get(source) ?? []), { type, target }])
  }
  const outgoingCols = colsOf((t) => t === 'links' || t.startsWith('link:'))
  const wantedOf = new Map<Draft, { replaced: Set<string>; links: Link[] }>()
  for (const d of drafts) {
    const replaced = new Set<string>()
    const links: Link[] = []
    for (const c of outgoingCols) {
      const t = mapping[c] as string
      const raw = cell(d.r, c)
      if (t === 'links') {
        for (const l of d.base?.links ?? []) replaced.add(l.type)
        for (const part of raw.split(/[;\n]+/).map((x) => x.trim()).filter(Boolean)) {
          const m = /^(.*?)\s+(\S+)$/.exec(part)
          const lt = m ? linkType(m[1] as string) : null
          const target = m ? resolve(m[2] as string) : null
          if (!m || !lt) problem(d.row, c, T.importMsg.badLink(part))
          else if (!target) problem(d.row, c, T.importMsg.unknownRef(m[2] as string))
          else if (lt.reverse) addReverse(target, lt.id, d.item.id)
          else links.push({ type: lt.id, target })
        }
      } else {
        const type = t.slice(5)
        replaced.add(type)
        for (const ref of splitList(raw)) {
          const target = resolve(ref)
          if (target) links.push({ type, target })
          else problem(d.row, c, T.importMsg.unknownRef(ref))
        }
      }
    }
    // "Linked from" in ReqMan's own format: "verified by REQ-…; refined by REQ-…" (stored in the other items)
    for (const c of colsOf((t) => t === 'linkedFrom')) {
      for (const part of cell(d.r, c).split(/[;\n]+/).map((x) => x.trim()).filter(Boolean)) {
        const m = /^(.*?)\s+(\S+)$/.exec(part)
        const lt = m ? linkType(m[1] as string) : null
        const source = m ? resolve(m[2] as string) : null
        if (!m || !lt) problem(d.row, c, T.importMsg.badLink(part))
        else if (!source) problem(d.row, c, T.importMsg.unknownRef(m[2] as string))
        else addReverse(source, lt.id, d.item.id)
      }
    }
    for (const c of colsOf((t) => t.startsWith('linkFrom:'))) {
      const type = (mapping[c] as string).slice(9)
      for (const ref of splitList(cell(d.r, c))) {
        const source = resolve(ref)
        if (source) addReverse(source, type, d.item.id)
        else problem(d.row, c, T.importMsg.unknownRef(ref))
      }
    }
    wantedOf.set(d, { replaced, links })
  }
  const draftById = new Map(drafts.map((d) => [d.item.id, d]))
  for (const d of drafts) {
    const w = wantedOf.get(d) as { replaced: Set<string>; links: Link[] }
    const before = d.base?.links ?? []
    // links to items that exist nowhere cannot be in the file either: they stay (and stay listed as problems)
    const incoming = [...w.links, ...(reverse.get(d.item.id) ?? [])]
    const wanted = (l: Link): boolean => incoming.some((x) => x.type === l.type && x.target === l.target)
    // links that stay keep their place (and confirmation); new ones follow in file order
    const next: Link[] = before.filter((l) => !w.replaced.has(l.type) || resolve(l.target) === null || wanted(l))
    for (const l of incoming) {
      if (l.target === d.item.id || next.some((x) => x.type === l.type && x.target === l.target)) continue
      next.push(l)
    }
    d.item.links = next
  }
  const extraLinks: { source: string; link: Link }[] = []
  for (const [source, links] of reverse) {
    if (draftById.has(source)) continue
    for (const link of links) {
      const known = existing.byId.get(source)?.links.some((l) => l.type === link.type && l.target === link.target)
      if (!known) extraLinks.push({ source, link })
    }
  }

  // ---- result
  const counts = { create: 0, update: 0, unchanged: 0, skip }
  const items: PlannedItem[] = drafts.map((d) => {
    const action = !d.base ? 'create' : same(d.base, d.item) ? 'unchanged' : 'update'
    counts[action]++
    preview.push({ row: d.row, action, id: d.item.id, type: d.item.type, title: d.item.title })
    return { row: d.row, action, item: d.item, placed: placed.has(d), seq: d.seq }
  })
  preview.sort((a, b) => a.row - b.row)
  return { items, extraLinks, problems: problems.sort((a, b) => a.row - b.row), preview, counts }
}

/** JSON with object keys sorted, so the same item read in another key order counts as unchanged. */
const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1))) : x))
const same = (a: Item, b: Item): boolean => stable(a) === stable(b)

/** A title made from the text when the file has none: the first sentence, at most 80 characters. */
function firstWords(text: string): string {
  const first = (text.split(/(?<=[.!?])\s|\n/)[0] ?? text).trim()
  return first.length <= 80 ? first : `${first.slice(0, 77).replace(/\s+\S*$/, '')}…`
}

/** Default values for a new item — not for fields the file has a column for (an empty cell means "no value"). */
function defaults(schema: Schema, mapped: ReadonlySet<string>): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {}
  for (const f of schema.fields) if (f.default !== undefined && !mapped.has(f.id)) out[f.id] = f.default
  return out
}

/** The cell as a value of the field; undefined when empty or not allowed. */
function fieldValue(def: FieldDef, raw: string): FieldValue | undefined {
  if (!raw) return undefined
  switch (def.type) {
    case 'enum':
      return def.options?.find((o) => norm(o) === norm(raw))
    case 'list':
      return splitList(raw)
    case 'number': {
      const n = Number(raw.replace(',', '.'))
      return Number.isFinite(n) ? n : undefined
    }
    case 'date': {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw) ?? /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(raw)
      if (!m) return undefined
      return m[1]?.length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${(m[2] as string).padStart(2, '0')}-${(m[1] as string).padStart(2, '0')}`
    }
    default:
      return raw
  }
}
