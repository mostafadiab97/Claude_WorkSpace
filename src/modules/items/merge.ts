// Field-level 3-way merge of one item (review S-05, owner's decisions M8-3 and M8-7, 29 Oct 2026).
// base = the version both sides started from, mine = this PC's branch, theirs = the branch being pulled in.
// Each part of an item is merged on its own: a part changed on one side only takes that side's value; a part
// changed on both sides to the same value is fine; only a part changed differently on both sides is a conflict
// the user decides ("mine / theirs / edit"). Links and list values are merged as sets, so two people adding
// different links (or tags) never clash. Pure logic: no files, no Git.
import type { MergeChoice, MergePart } from '../../shared/api'
import type { FieldValue, Item, Link, Schema } from '../../shared/domain'
import { T } from '../../shared/text'

/** One part both sides changed differently (values shown as text). */
export type MergeConflict = MergePart

export interface ItemMergeResult {
  /** The merged item (null = deleted). Unanswered conflicts take "mine" here; check `conflicts` first. */
  item: Item | null
  conflicts: MergeConflict[]
}

const show = (v: unknown): string => (v === undefined || v === null ? '' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v))
const same = (a: unknown, b: unknown): boolean => canon(a) === canon(b)
const canon = (v: unknown): string => (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0) ? '' : JSON.stringify(v))
const linkKey = (l: Link): string => `${l.type}\u0000${l.target}`

/** Do two versions say the same thing? (Re-confirmed links count as the same; trailing blank lines too.) */
export function sameItem(a: Item | null, b: Item | null): boolean {
  if (a === null || b === null) return a === b
  const sorted = (o: Record<string, unknown>): [string, string][] =>
    Object.keys(o)
      .filter((k) => canon(o[k]) !== '')
      .sort()
      .map((k) => [k, canon(o[k])])
  const strip = (i: Item): string =>
    JSON.stringify([i.id, i.type, i.title, i.parent ?? '', i.order ?? '', i.text.replace(/\s+$/, ''), i.links.map(linkKey), sorted(i.fields), sorted(i.extra)])
  return strip(a) === strip(b)
}

/** 3-way rule for one value: the side that changed wins; both changed the same way is fine; otherwise a conflict. */
function pick<V>(base: V, mine: V, theirs: V): { value: V; conflict: boolean } {
  if (same(mine, theirs)) return { value: mine, conflict: false }
  if (same(mine, base)) return { value: theirs, conflict: false }
  if (same(theirs, base)) return { value: mine, conflict: false }
  return { value: mine, conflict: true }
}

/** Set merge (links, list values): an element is kept unless a side removed it; an element a side added is kept. */
function mergeSet<V>(base: V[], mine: V[], theirs: V[], key: (v: V) => string): V[] {
  const b = new Set(base.map(key))
  const m = new Map(mine.map((v) => [key(v), v]))
  const t = new Map(theirs.map((v) => [key(v), v]))
  const out: V[] = []
  // my order first, then what only they added, in their order
  for (const [k, v] of m) if (t.has(k) || !b.has(k)) out.push(v)
  for (const [k, v] of t) if (!m.has(k) && !b.has(k)) out.push(v)
  return out
}

const fieldValue = (v: string, type: string | undefined): FieldValue => {
  if (type === 'list')
    return v
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
  if (type === 'number' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return v
}

/**
 * Merges three versions of one item. `choices` answers conflicts by key (from an earlier call's `conflicts`);
 * conflicts are always reported, answered or not, so the window can show what was decided.
 */
export function mergeItems(
  base: Item | null,
  mine: Item | null,
  theirs: Item | null,
  schema: Pick<Schema, 'fields' | 'itemTypes'>,
  choices: Record<string, MergeChoice> = {}
): ItemMergeResult {
  // ---- whole-item cases
  if (sameItem(mine, theirs)) return { item: mine, conflicts: [] }
  if (sameItem(base, mine)) return { item: theirs, conflicts: [] }
  if (sameItem(base, theirs)) return { item: mine, conflicts: [] }
  if (mine === null || theirs === null) {
    // deleted on one side, changed on the other
    const conflict: MergeConflict = {
      key: 'item',
      label: T.merge.wholeItem,
      base: '',
      mine: mine === null ? T.merge.deleted : T.merge.changed,
      theirs: theirs === null ? T.merge.deleted : T.merge.changed,
      editable: false
    }
    const c = choices['item']
    return { item: c === 'theirs' ? theirs : mine, conflicts: [conflict] }
  }
  // both sides have the item: added on both sides (no base) is treated like a common empty start
  const b: Item = base ?? { id: mine.id, type: '', title: '', fields: {}, links: [], text: '', extra: {} }
  const conflicts: MergeConflict[] = []
  const decide = <V>(key: string, label: string, bv: V, mv: V, tv: V, editable: boolean, fromText: (s: string) => V, text: (v: V) => string = show): V => {
    const r = pick(bv, mv, tv)
    if (!r.conflict) return r.value
    conflicts.push({ key, label, base: text(bv), mine: text(mv), theirs: text(tv), editable })
    const c = choices[key]
    if (c === 'theirs') return tv
    if (c && typeof c === 'object') return fromText(c.edit)
    return mv
  }
  const typeName = (id: string): string => schema.itemTypes.find((t) => t.id === id)?.name ?? id

  const item: Item = { id: mine.id, type: mine.type, title: '', fields: {}, links: [], text: '', extra: {} }
  item.title = decide('title', T.merge.title, b.title, mine.title, theirs.title, true, (s) => s)
  item.type = decide('type', T.merge.type, b.type, mine.type, theirs.type, false, (s) => s, (v) => typeName(String(v)))
  // parent and order move together: a position is one decision
  const pos = (i: Item): { parent: string; order: string } => ({ parent: i.parent ?? '', order: i.order ?? '' })
  const position = decide('position', T.merge.position, pos(b), pos(mine), pos(theirs), false, () => pos(mine), (p) =>
    p.parent ? T.merge.under(p.parent) : T.merge.topLevel
  )
  if (position.parent) item.parent = position.parent
  if (position.order) item.order = position.order
  item.text = decide('text', T.merge.text, b.text.replace(/\s+$/, ''), mine.text.replace(/\s+$/, ''), theirs.text.replace(/\s+$/, ''), true, (s) => s)

  const fieldDefs = new Map(schema.fields.map((f) => [f.id, f]))
  const fieldKeys = [...new Set([...schema.fields.map((f) => f.id), ...Object.keys(b.fields), ...Object.keys(mine.fields), ...Object.keys(theirs.fields)])]
  for (const k of fieldKeys) {
    const def = fieldDefs.get(k)
    const bv = b.fields[k]
    const mv = mine.fields[k]
    const tv = theirs.fields[k]
    let v: FieldValue | undefined
    if (Array.isArray(mv) || Array.isArray(tv) || def?.type === 'list') {
      const arr = (x: FieldValue | undefined): string[] => (x === undefined ? [] : Array.isArray(x) ? x : [String(x)])
      const merged = mergeSet(arr(bv), arr(mv), arr(tv), (s) => s)
      v = merged.length ? merged : undefined
    } else {
      v = decide(`field:${k}`, def?.name ?? k, bv, mv, tv, true, (s) => fieldValue(s, def?.type))
    }
    if (v !== undefined && v !== '') item.fields[k] = v
  }
  const extraKeys = [...new Set([...Object.keys(b.extra), ...Object.keys(mine.extra), ...Object.keys(theirs.extra)])].sort()
  for (const k of extraKeys) {
    const v = decide(`extra:${k}`, k, b.extra[k], mine.extra[k], theirs.extra[k], false, () => mine.extra[k])
    if (v !== undefined && v !== null) item.extra[k] = v
  }

  // links as a set; for a link both keep, the confirmation follows the usual rule (no question: a newer
  // confirmation on either side is fine, and the Keep/Unlink window shows anything suspect afterwards)
  const merged = mergeSet(b.links, mine.links, theirs.links, linkKey)
  const byKey = (ls: Link[]): Map<string, Link> => new Map(ls.map((l) => [linkKey(l), l]))
  const [bl, ml, tl] = [byKey(b.links), byKey(mine.links), byKey(theirs.links)]
  item.links = merged.map((l) => {
    const k = linkKey(l)
    const r = pick(bl.get(k)?.confirmed, ml.get(k)?.confirmed, tl.get(k)?.confirmed)
    const confirmed = r.conflict ? tl.get(k)?.confirmed : r.value
    return confirmed ? { type: l.type, target: l.target, confirmed } : { type: l.type, target: l.target }
  })
  return { item, conflicts }
}

/** Replaces every reference to `from` (parent and link targets) with `to` — used when a duplicate ID is repaired. */
export function renameReferences(item: Item, from: string, to: string): Item {
  const out: Item = { ...item, links: item.links.map((l) => (l.target === from ? { ...l, target: to } : l)) }
  if (item.parent === from) out.parent = to
  return out
}
