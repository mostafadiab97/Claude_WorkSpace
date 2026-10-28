// Export (M6): builds the file content for the table or a comparison; the main process asks where to save it.
import { basename } from 'node:path'
import type { ExportItemsRequest } from '../../shared/api'
import { compareToCsv, compareToMarkdown, itemsToCsv, itemsToMarkdown, type ExportItem } from '../import-export'
import { queryAll, type WorkspaceContext } from './context'
import type { createCompare } from './compare'
import { depthOf, type StructureOps } from './structure'

export function createExportOps(ctx: WorkspaceContext, structure: StructureOps, compare: ReturnType<typeof createCompare>) {
  return {
    async exportItems(request: ExportItemsRequest): Promise<{ content: string; count: number }> {
      const s = ctx.need()
      const numbers = ctx.numbers(s)
      let rows: ExportItem[]
      if (request.scope === 'filtered' && request.query) {
        const all = queryAll(s.index, request.query)
        // Markdown of a search result: flat list of headings; CSV keeps the real level
        rows = all.map((item) => ({ item, depth: request.format === 'markdown' ? 0 : depthOf(s, item.id), incoming: [] }))
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
      const content =
        request.format === 'markdown'
          ? itemsToMarkdown(s.repo.schema, rows, columns, `${basename(s.repo.root)} — requirements`)
          : itemsToCsv(s.repo.schema, rows, columns)
      return { content, count: rows.length }
    },

    async exportCompare(from: string, to: string, format: 'csv' | 'markdown'): Promise<{ content: string; count: number }> {
      const s = ctx.need()
      const r = await compare.compare(s, from, to)
      return { content: format === 'markdown' ? compareToMarkdown(s.repo.schema, r) : compareToCsv(s.repo.schema, r), count: r.entries.length }
    }
  }
}
