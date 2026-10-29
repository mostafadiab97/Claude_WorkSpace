import type { CompareResult } from '../../shared/api'
import type { Schema } from '../../shared/domain'
import { toCsv } from './csv'
import type { SheetData } from './xlsx'

const KIND: Record<string, string> = { added: 'Added', modified: 'Changed', moved: 'Moved', deleted: 'Deleted' }

/** "2.3", or "1.2 → 3.5.1" when the item moved. */
export function numberLabel(e: { numberBefore?: string; numberAfter?: string }): string {
  if (e.numberBefore && e.numberAfter && e.numberBefore !== e.numberAfter) return `${e.numberBefore} → ${e.numberAfter}`
  return e.numberAfter ?? e.numberBefore ?? ''
}

/** One row per changed item, plus one per changed field — easy to filter in Excel. */
export function compareToCsv(schema: Schema, r: CompareResult): string {
  return toCsv(compareRows(schema, r))
}

/** The same rows as an Excel sheet (header + rows). */
export function compareToSheet(schema: Schema, r: CompareResult): SheetData {
  const [header, ...rows] = compareRows(schema, r)
  return { name: 'Changes', header: header as string[], rows, wrapColumns: [6, 7], widths: [14, 10, 40, 18, 10, 22, 50, 50] }
}

function compareRows(schema: Schema, r: CompareResult): string[][] {
  const typeName = (id: string): string => schema.itemTypes.find((t) => t.id === id)?.name ?? id
  const linkName = (id: string): string => schema.linkTypes.find((l) => l.id === id)?.name ?? id
  const rows: string[][] = [['ID', 'No.', 'Title', 'Type', 'Change', 'What', 'Before', 'After']]
  for (const e of r.entries) {
    const head = [e.id, numberLabel(e), e.title, typeName(e.type), KIND[e.kind] ?? e.kind]
    rows.push([...head, e.summary, '', ''])
    for (const d of e.diff.rows) rows.push([...head, d.label, d.before, d.after])
    if (e.diff.text) rows.push([...head, 'Text', e.diff.text.before, e.diff.text.after])
    for (const l of e.diff.linksAdded) rows.push([...head, 'Link added', '', `${linkName(l.type)} ${l.target}`])
    for (const l of e.diff.linksRemoved) rows.push([...head, 'Link removed', `${linkName(l.type)} ${l.target}`, ''])
  }
  return rows
}

/** The comparison as a Markdown report (for sharing with AI tools or in a pull request description). */
export function compareToMarkdown(schema: Schema, r: CompareResult): string {
  const typeName = (id: string): string => schema.itemTypes.find((t) => t.id === id)?.name ?? id
  const linkName = (id: string): string => schema.linkTypes.find((l) => l.id === id)?.name ?? id
  const count = (k: string): number => r.entries.filter((e) => e.kind === k).length
  const esc = (t: string): string => t.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
  const out: string[] = [
    '# Requirement changes',
    '',
    `From **${r.from.label}** to **${r.to.label}**`,
    '',
    `Added ${count('added')} · Changed ${count('modified')} · Moved ${count('moved')} · Deleted ${count('deleted')} · Links +${r.links.filter((l) => l.change === 'added').length} −${r.links.filter((l) => l.change === 'removed').length}`,
    ''
  ]
  if (r.schema) {
    const s = r.schema
    const parts = [
      s.fieldsAdded.length && `fields added: ${s.fieldsAdded.join(', ')}`,
      s.fieldsRemoved.length && `fields removed: ${s.fieldsRemoved.join(', ')}`,
      s.typesAdded.length && `item types added: ${s.typesAdded.join(', ')}`,
      s.typesRemoved.length && `item types removed: ${s.typesRemoved.join(', ')}`,
      s.linkTypesAdded.length && `link types added: ${s.linkTypesAdded.join(', ')}`,
      s.linkTypesRemoved.length && `link types removed: ${s.linkTypesRemoved.join(', ')}`
    ].filter(Boolean)
    out.push(`**Schema changed:** ${parts.join('; ') || 'names, options or defaults'}`, '')
  }
  for (const e of r.entries) {
    out.push(`## ${numberLabel(e) ? `${numberLabel(e)} ` : ''}${e.id} — ${e.title || '(no title)'}`, '', `${typeName(e.type)} · **${KIND[e.kind] ?? e.kind}** · ${e.summary}`, '')
    if (e.diff.rows.length) {
      out.push('| Field | Before | After |', '| --- | --- | --- |')
      for (const d of e.diff.rows) out.push(`| ${esc(d.label)} | ${esc(d.before) || '—'} | ${esc(d.after) || '—'} |`)
      out.push('')
    }
    if (e.diff.text) {
      if (e.kind !== 'added') out.push('Text before:', '', ...e.diff.text.before.trim().split('\n').map((l) => `> ${l}`), '')
      out.push(e.kind === 'added' ? 'Text:' : 'Text after:', '', ...e.diff.text.after.trim().split('\n').map((l) => `> ${l}`), '')
    }
    for (const l of e.diff.linksAdded) out.push(`- link added: ${linkName(l.type)} ${l.target}`)
    for (const l of e.diff.linksRemoved) out.push(`- link removed: ${linkName(l.type)} ${l.target}`)
    if (e.diff.linksAdded.length || e.diff.linksRemoved.length) out.push('')
  }
  if (r.entries.length === 0) out.push('No requirement changed.', '')
  return `${out.join('\n').trimEnd()}\n`
}
