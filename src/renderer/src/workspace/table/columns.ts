// Table columns: which exist, their order and visibility (personal, per repository on this PC).
import type { IndexedItem, Schema, SortKey } from '../../../../shared/domain'
import { formatValue, isHeading, typeName, typeShort } from '../../lib/schema'
import { T } from '../../../../shared/text'

export interface Column {
  key: SortKey
  label: string
  /** Narrowest the column may get; wider windows share the extra space by `grow`. */
  minPx: number
  grow: number
  /** Width the user dragged the column to (px); replaces minPx/grow. */
  width?: number
  value: (i: IndexedItem) => string
  /** Shown in the warning colour (e.g. suspect links). */
  warn?: (i: IndexedItem) => boolean
  /** Tooltip, when it differs from the shown value (e.g. the full type name behind a short label). */
  tip?: (i: IndexedItem) => string
}

/** Default column order (UX-03): Type, Status, Links, the other fields, ID, Text. */
export function defaultOrder(schema: Schema): string[] {
  const fields = schema.fields.map((f) => `field:${f.id}`)
  const status = fields.filter((k) => k === 'field:status')
  return ['type', ...status, 'links', ...fields.filter((k) => k !== 'field:status'), 'id', 'text']
}

/** Built-in columns that can be hidden (ID and Title are always shown). */
const builtInOptional = () =>
  [
    { key: 'number', label: T.columns.number },
    { key: 'type', label: T.columns.type },
    { key: 'text', label: T.columns.text },
    { key: 'links', label: T.columns.links }
  ] as const

/** Columns that can be hidden: Type, Text, Links and every schema field. */
export function optionalColumns(schema: Schema): { key: string; label: string; builtIn: boolean }[] {
  const BUILT_IN_OPTIONAL = builtInOptional()
  return [
    { ...BUILT_IN_OPTIONAL[0], builtIn: true },
    { ...BUILT_IN_OPTIONAL[1], builtIn: true },
    { ...BUILT_IN_OPTIONAL[3], builtIn: true },
    ...schema.fields.map((f) => ({ key: `field:${f.id}`, label: f.name, builtIn: false })),
    { ...BUILT_IN_OPTIONAL[2], builtIn: true }
  ]
}

/** "→2 ←3 ⚠1": links out, links in, suspect links. */
export function linkSummary(i: Pick<IndexedItem, 'links' | 'incomingCount' | 'suspectCount'>): string {
  const parts: string[] = []
  if (i.links.length) parts.push(`→${i.links.length}`)
  if (i.incomingCount) parts.push(`←${i.incomingCount}`)
  if (i.suspectCount) parts.push(`⚠${i.suspectCount}`)
  return parts.join(' ')
}

export function linkTitle(i: Pick<IndexedItem, 'links' | 'incomingCount' | 'suspectCount'>): string {
  const lines = [T.table.linksTooltip(i.links.length, i.incomingCount)]
  if (i.suspectCount) lines.push(T.table.suspectTooltip(i.suspectCount))
  return lines.join('\n')
}

/** Personal table layout: hidden column keys, the order of the optional columns, and widths set by dragging. */
export interface ColumnPrefs {
  hidden: ReadonlySet<string>
  order: string[]
  /** Column key → width in px; columns without an entry size themselves. */
  widths?: Readonly<Record<string, number>>
}

export const MIN_COLUMN_PX = 48
export const MAX_COLUMN_PX = 1200
export const clampWidth = (px: number): number => Math.round(Math.min(MAX_COLUMN_PX, Math.max(MIN_COLUMN_PX, px)))

/** CSS grid columns: a dragged width is fixed; other columns grow from their minimum. */
export function columnTemplate(cols: Pick<Column, 'minPx' | 'grow' | 'width'>[]): string {
  return cols.map((c) => (c.width !== undefined ? `${c.width}px` : c.grow ? `minmax(${c.minPx}px, ${c.grow}fr)` : `${c.minPx}px`)).join(' ')
}

/** Narrowest the whole table may get before it scrolls sideways. */
export const tableMinWidth = (cols: Pick<Column, 'minPx' | 'width'>[]): number => cols.reduce((sum, c) => sum + (c.width ?? c.minPx), 0)

/** New width list after a drag (null = back to automatic). */
export function withWidth(widths: Readonly<Record<string, number>> | undefined, key: string, px: number | null): Record<string, number> {
  const next = { ...widths }
  if (px === null) delete next[key]
  else next[key] = clampWidth(px)
  return next
}

/** Sorts columns by a saved key order; columns not in it (e.g. new fields) keep their place at the end. */
export function orderColumns<C extends { key: string }>(cols: C[], order: string[]): C[] {
  const pos = new Map(order.map((k, i) => [k, i]))
  return cols
    .map((c, i) => ({ c, rank: pos.get(c.key) ?? order.length + i }))
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.c)
}

/** The visible optional columns in the user's order — also what the export offers by default. */
export function shownColumnKeys(schema: Schema, prefs: ColumnPrefs): string[] {
  return orderColumns(optionalColumns(schema), prefs.order.length ? prefs.order : defaultOrder(schema))
    .filter((c) => !prefs.hidden.has(c.key))
    .map((c) => c.key)
}

export function columnsFor(schema: Schema, prefs: ColumnPrefs = { hidden: new Set(), order: [] }): Column[] {
  const all: Column[] = [
    // the outline number (calculated, never stored — O-03); sorting by it = document order
    { key: 'number', label: T.columns.number, minPx: 72, grow: 0, value: (i) => i.number ?? '' },
    { key: 'title', label: T.columns.title, minPx: 280, grow: 4, value: (i) => i.title || T.common.noTitle },
    // short type label in the table (full name in the tooltip); headings show no type — they stand out by weight (UX-03)
    { key: 'type', label: T.columns.type, minPx: 84, grow: 0.6, value: (i) => (isHeading(schema, i.type) ? '' : typeShort(schema, i.type)), tip: (i) => typeName(schema, i.type) },
    { key: 'links', label: T.columns.links, minPx: 72, grow: 0, value: linkSummary, warn: (i) => i.suspectCount > 0 },
    ...schema.fields.map<Column>((f) => ({
      key: `field:${f.id}`,
      label: f.name,
      minPx: f.type === 'list' ? 110 : f.id === 'priority' ? 80 : 96,
      grow: f.type === 'list' ? 1 : 0.6,
      value: (i) => formatValue(i.fields[f.id])
    })),
    { key: 'id', label: T.columns.id, minPx: 110, grow: 0, value: (i) => i.id },
    { key: 'text', label: T.columns.text, minPx: 200, grow: 2, value: (i) => i.text }
  ]
  // No. and Title stay at the front; the rest follow the user's order — by default the descriptive columns first
  // (Type, Status, Links, other fields), then ID and Text (UI review UX-03, owner's decision 3 Nov 2026)
  const [number, title, ...rest] = all
  const widths = prefs.widths ?? {}
  const order = prefs.order.length ? prefs.order : defaultOrder(schema)
  return [number as Column, title as Column, ...orderColumns(rest, order)]
    .filter((c) => !prefs.hidden.has(c.key))
    .map((c) => (widths[c.key] !== undefined ? { ...c, width: widths[c.key] } : c))
}
