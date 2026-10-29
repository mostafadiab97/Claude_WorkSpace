// Export (M6): builds the file content for the table or a comparison; the main process asks where to save it.
import { basename } from 'node:path'
import type { ExportFormat, ExportItemsRequest } from '../../shared/api'
import { compareToCsv, compareToMarkdown, compareToSheet, itemsToCsv, itemsToMarkdown, itemsToSheet, writeXlsx, type ExportItem } from '../import-export'
import { queryAll, type WorkspaceContext } from './context'
import type { createCompare } from './compare'
import { depthOf, type StructureOps } from './structure'

export function createExportOps(ctx: WorkspaceContext, structure: StructureOps, compare: ReturnType<typeof createCompare>) {
  return {
    async exportItems(request: ExportItemsRequest): Promise<{ content: string | Uint8Array; count: number }> {
      const s = ctx.need()
      const numbers = ctx.numbers(s)
      let rows: ExportItem[]
      if (request.scope === 'filtered' && request.query) {
        const all = queryAll(s.index, request.query)
        // Markdown of a search result: flat list of headings; CSV keeps the real level
        rows = all.map((item) => ({ item, depth: request.format === 'markdown' ? 0 : depthOf(s, item.id), incoming: [] }))
      } else if (request.scope === 'chosen') {
        rows = chosenRows(structure.documentOrder(s), new Set(request.ids ?? []), request.includeBelow === true)
      } else {
        rows = structure.documentOrder(s)
      }
      // every export carries the real outline numbers (also for a filtered result: no renumbering)
      for (const r of rows) {
        const n = numbers.get(r.item.id)
        if (n !== undefined) r.item = { ...r.item, number: n }
      }
      // the number column always comes right after the ID
      const columns = request.columns.includes('number') ? request.columns : request.columns.flatMap((c) => (c === 'id' ? ['id', 'number'] : [c]))
      // Markdown lists both directions under "links"
      if (request.columns.includes('linkedFrom') || (request.format === 'markdown' && request.columns.includes('links'))) {
        for (const r of rows) r.incoming = s.index.incomingLinks(r.item.id)
      }
      // a Markdown document of chosen items starts its headings at the highest chosen item
      if (request.scope === 'chosen' && request.format === 'markdown' && rows.length > 0) {
        const top = Math.min(...rows.map((r) => r.depth))
        rows = rows.map((r) => ({ ...r, depth: r.depth - top }))
      }
      const title = `${basename(s.repo.root)} — requirements`
      const content =
        request.format === 'markdown'
          ? itemsToMarkdown(s.repo.schema, rows, columns, title)
          : request.format === 'xlsx'
            ? await writeXlsx([itemsToSheet(s.repo.schema, rows, columns)])
            : itemsToCsv(s.repo.schema, rows, columns)
      return { content, count: rows.length }
    },

    async exportCompare(from: string, to: string, format: ExportFormat): Promise<{ content: string | Uint8Array; count: number }> {
      const s = ctx.need()
      const r = await compare.compare(s, from, to)
      const content = format === 'markdown' ? compareToMarkdown(s.repo.schema, r) : format === 'xlsx' ? await writeXlsx([compareToSheet(s.repo.schema, r)]) : compareToCsv(s.repo.schema, r)
      return { content, count: r.entries.length }
    }
  }
}

/**
 * The chosen items in document order (owner's request, M7): with `below`, everything under a chosen item too; an
 * item chosen twice (itself and through its parent) appears once. Depths stay the real ones (Level column).
 */
export function chosenRows(order: ExportItem[], chosen: ReadonlySet<string>, below: boolean): ExportItem[] {
  const out: ExportItem[] = []
  let inside = -1 // depth of the chosen item whose subtree we are in, or -1
  for (const r of order) {
    if (inside >= 0 && r.depth <= inside) inside = -1
    const take = chosen.has(r.item.id) || inside >= 0
    if (below && chosen.has(r.item.id) && inside < 0) inside = r.depth
    if (take) out.push(r)
  }
  return out
}
