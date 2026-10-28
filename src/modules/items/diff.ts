import type { DiffRow, FieldValue, Item, ItemDiff, Link, Schema } from '../../shared/domain'
import { T } from '../../shared/text'

const show = (v: FieldValue | undefined | unknown): string =>
  v === undefined || v === null ? '' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v)

const linkKey = (l: Link): string => `${l.type}\u0000${l.target}`

/**
 * What differs between two versions of one item, field by field — the requirement-level view of a change
 * (instead of changed file lines). `before` null = the item was created; `after` null = deleted.
 * Only changed rows are returned. Re-confirming a link is not a change.
 */
export function diffItems(before: Item | null, after: Item | null, schema: Pick<Schema, 'fields' | 'itemTypes'>): ItemDiff {
  const rows: DiffRow[] = []
  const add = (key: string, label: string, a: string, b: string): void => {
    if (a !== b) rows.push({ key, label, before: a, after: b })
  }
  const typeName = (id: string | undefined): string => (id ? (schema.itemTypes.find((t) => t.id === id)?.name ?? id) : '')
  add('title', 'Title', before?.title ?? '', after?.title ?? '')
  add('type', 'Type', typeName(before?.type), typeName(after?.type))
  add('parent', 'Parent', before?.parent ?? '', after?.parent ?? '')
  // Order keys mean nothing to a reader: a changed position is shown in words here, and Compare replaces them
  // with the outline numbers before and after ("1.2 → 3.5.1"). A new or deleted item has no position change.
  if (before && after && (before.order ?? '') !== (after.order ?? '')) rows.push({ key: 'order', label: T.change.position, before: T.change.oldPlace, after: T.change.newPlace })
  const known = new Set(schema.fields.map((f) => f.id))
  for (const f of schema.fields) add(`field:${f.id}`, f.name, show(before?.fields[f.id]), show(after?.fields[f.id]))
  // values of fields that are no longer (or not yet) in the schema
  const others = new Set([...Object.keys(before?.fields ?? {}), ...Object.keys(after?.fields ?? {})].filter((k) => !known.has(k)))
  for (const k of [...others].sort()) add(`field:${k}`, k, show(before?.fields[k]), show(after?.fields[k]))
  const extraKeys = new Set([...Object.keys(before?.extra ?? {}), ...Object.keys(after?.extra ?? {})])
  for (const k of [...extraKeys].sort()) add(`extra:${k}`, k, show(before?.extra[k]), show(after?.extra[k]))

  const beforeLinks = new Map((before?.links ?? []).map((l) => [linkKey(l), l]))
  const afterLinks = new Map((after?.links ?? []).map((l) => [linkKey(l), l]))
  const textBefore = before?.text ?? ''
  const textAfter = after?.text ?? ''
  return {
    kind: before === null && after === null ? 'unchanged' : before === null ? 'added' : after === null ? 'deleted' : 'modified',
    rows,
    text: textBefore.trim() !== textAfter.trim() ? { before: textBefore, after: textAfter } : null,
    linksAdded: [...afterLinks].filter(([k]) => !beforeLinks.has(k)).map(([, l]) => l),
    linksRemoved: [...beforeLinks].filter(([k]) => !afterLinks.has(k)).map(([, l]) => l)
  }
}

export const isEmptyDiff = (d: ItemDiff): boolean => d.rows.length === 0 && d.text === null && d.linksAdded.length === 0 && d.linksRemoved.length === 0
