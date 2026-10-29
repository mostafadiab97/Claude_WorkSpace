import type { FieldValue, IndexedItem, LinkRef, Schema } from '../../shared/domain'
import { toCsv } from './csv'
import type { SheetData } from './xlsx'

/** One item ready for export: the indexed item, its depth in the hierarchy and the links other items have to it. */
export interface ExportItem {
  item: IndexedItem
  /** 0 = top level */
  depth: number
  incoming: LinkRef[]
}

/**
 * Columns to export, in order: "id", "number", "title", "type", "parent", "level", "text", "links", "linkedFrom",
 * or "field:<id>". Unknown keys are skipped.
 */
export type ExportColumn = string

const show = (v: FieldValue | undefined): string => (v === undefined ? '' : Array.isArray(v) ? v.join(', ') : String(v))

function header(schema: Schema, key: ExportColumn): string | null {
  const fixed: Record<string, string> = { id: 'ID', number: 'No.', title: 'Title', type: 'Type', parent: 'Parent', level: 'Level', text: 'Text', links: 'Links', linkedFrom: 'Linked from' }
  if (fixed[key]) return fixed[key]
  if (key.startsWith('field:')) return schema.fields.find((f) => f.id === key.slice(6))?.name ?? key.slice(6)
  return null
}

function cell(schema: Schema, e: ExportItem, key: ExportColumn): string {
  const typeName = (id: string): string => schema.itemTypes.find((t) => t.id === id)?.name ?? id
  const link = (type: string, reverse: boolean): string => {
    const t = schema.linkTypes.find((l) => l.id === type)
    return t ? (reverse ? t.reverseName : t.name) : type
  }
  switch (key) {
    case 'id':
      return e.item.id
    case 'number':
      return e.item.number ?? ''
    case 'title':
      return e.item.title
    case 'type':
      return typeName(e.item.type)
    case 'parent':
      return e.item.parent ?? ''
    case 'level':
      return String(e.depth + 1)
    case 'text':
      return e.item.text
    case 'links':
      return e.item.links.map((l) => `${link(l.type, false)} ${l.target}`).join('; ')
    case 'linkedFrom':
      return e.incoming.map((l) => `${link(l.type, true)} ${l.id}`).join('; ')
    default:
      return key.startsWith('field:') ? show(e.item.fields[key.slice(6)]) : ''
  }
}

/** The export as a table: column names and one row of text cells per item. */
export function itemsToTable(schema: Schema, items: ExportItem[], columns: ExportColumn[]): { header: string[]; rows: string[][]; keys: string[] } {
  const keys = columns.filter((c) => header(schema, c) !== null)
  return { header: keys.map((c) => header(schema, c) as string), rows: items.map((e) => keys.map((c) => cell(schema, e, c))), keys }
}

/** Items as a CSV file Excel opens directly (comma separator, UTF-8 with BOM). */
export function itemsToCsv(schema: Schema, items: ExportItem[], columns: ExportColumn[]): string {
  const t = itemsToTable(schema, items, columns)
  return toCsv([t.header, ...t.rows])
}

/**
 * Items as an Excel workbook (M7): the same columns as the CSV; the title is indented by level and rows are grouped
 * by the hierarchy (Excel's +/− buttons on the left), long texts wrap.
 */
export function itemsToSheet(schema: Schema, items: ExportItem[], columns: ExportColumn[], name = 'Requirements'): SheetData {
  const t = itemsToTable(schema, items, columns)
  const titleCol = t.keys.indexOf('title')
  const wrap = ['text', 'links', 'linkedFrom'].map((k) => t.keys.indexOf(k)).filter((i) => i >= 0)
  return {
    name,
    header: t.header,
    rows: t.rows,
    levels: items.map((e) => e.depth),
    ...(titleCol >= 0 ? { indentColumn: titleCol } : {}),
    wrapColumns: wrap,
    widths: t.keys.map((k) => (k === 'text' ? 70 : k === 'title' ? 45 : k === 'id' ? 14 : k === 'number' ? 10 : k === 'links' || k === 'linkedFrom' ? 30 : 16))
  }
}

/**
 * Items as one Markdown document — the format agreed for sharing with AI tools: headings follow the hierarchy,
 * then the item's fields, its text and its links.
 */
export function itemsToMarkdown(schema: Schema, items: ExportItem[], columns: ExportColumn[], title: string): string {
  const fieldCols = columns.filter((c) => c === 'type' || c.startsWith('field:'))
  const out: string[] = [`# ${title}`, '', `${items.length} items · exported ${new Date().toISOString().slice(0, 10)} from ReqMan`, '']
  for (const e of items) {
    const level = Math.min(6, e.depth + 2)
    // the outline number leads every heading (owner's decision O-03): "## 2.3 REQ-K7Q3XMB — Title"
    out.push(`${'#'.repeat(level)} ${e.item.number ? `${e.item.number} ` : ''}${e.item.id} — ${e.item.title || '(no title)'}`, '')
    const facts = fieldCols.map((c) => [header(schema, c), cell(schema, e, c)] as const).filter(([, v]) => v)
    if (facts.length) out.push(facts.map(([k, v]) => `**${k}:** ${v}`).join(' · '), '')
    if (columns.includes('text') && e.item.text.trim()) out.push(e.item.text.trim(), '')
    if (columns.includes('links')) {
      const links = cell(schema, e, 'links')
      const from = cell(schema, e, 'linkedFrom')
      if (links) out.push(`Links: ${links}`)
      if (from) out.push(`Linked from: ${from}`)
      if (links || from) out.push('')
    }
  }
  return `${out.join('\n').trimEnd()}\n`
}
