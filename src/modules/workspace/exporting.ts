// Export (M6): builds the file content for the table or a comparison; the main process asks where to save it.
import { lstat, readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { T } from '../../shared/text'
import type { ExportFormat, ExportItemsRequest } from '../../shared/api'
import { compareToCsv, compareToMarkdown, compareToSheet, itemsToCsv, itemsToDocx, itemsToHtml, itemsToMarkdown, itemsToSheet, writeReqif, writeXlsx, type DocumentData, type ExportColumn, type ExportItem, type TraceRow } from '../import-export'
import { queryAll, withRequired, type WorkspaceContext } from './context'
import type { createCompare } from './compare'
import { depthOf, type StructureOps } from './structure'

export function createExportOps(ctx: WorkspaceContext, structure: StructureOps, compare: ReturnType<typeof createCompare>) {
  type Session = ReturnType<WorkspaceContext['need']>
  /** What a Word / PDF / HTML document needs besides the items: name, commit, baseline, author, links, revisions. */
  const documentData = async (s: Session, rows: ExportItem[], columns: string[], request: ExportItemsRequest): Promise<DocumentData> => {
    const [realRoot, , viewCommit] = s.repo.root.split('\u0000')
    const root = realRoot ?? s.repo.root
    const head = viewCommit ?? (await ctx.git.head(root).catch(() => ''))
    const baselines = await ctx.git.baselines(root).catch(() => [])
    const author = (await ctx.git.identity(root).catch(() => ({ name: null }))).name ?? ''
    const trace: TraceRow[] = []
    if (request.traceTable) {
      for (const r of rows)
        for (const l of r.item.links) {
          const fp = s.index.fingerprint(l.target)
          const name = s.repo.schema.linkTypes.find((t) => t.id === l.type)?.name ?? l.type
          trace.push({ source: r.item.id, sourceTitle: r.item.title, type: name, target: l.target, targetTitle: s.index.get(l.target)?.title ?? '', suspect: l.confirmed !== undefined && fp !== undefined && l.confirmed !== fp })
        }
    }
    return {
      schema: s.repo.schema,
      name: request.title?.trim() || basename(root),
      baseline: baselines.find((b) => b.commit === head)?.name ?? '',
      commit: (head ?? '').slice(0, 8),
      date: localDate(),
      author,
      // chosen items or a search result start at heading 1, however deep they sit (code review 0.25.0 C5)
      items: shallowest(rows),
      columns: columns as ExportColumn[],
      trace,
      revisions: [...baselines].sort((a, b) => b.date.localeCompare(a.date)).map((b) => ({ name: b.name, date: b.date.slice(0, 10), commit: b.commit.slice(0, 8) }))
    }
  }
  /** The chosen Word template from requirements/.reqochet/templates; no name = the built-in layout (the dialog picks the first template by default). */
  const readTemplate = async (s: Session, name?: string): Promise<Uint8Array | undefined> => {
    if (!name) return undefined
    const dir = join(s.repo.folder, s.repo.metaDir, 'templates')
    const list = await readdir(dir).catch(() => [] as string[])
    const docx = list.filter((f) => f.toLowerCase().endsWith('.docx') && !f.startsWith('~$'))
    const pick = docx.find((f) => f.slice(0, -5) === name)
    if (!pick) throw new Error(T.docExport.templateMissing(name))
    // a committed symbolic link must not read a file from elsewhere on the PC (security review 0.25.0 S-04)
    if (!(await lstat(join(dir, pick))).isFile()) throw new Error(T.docExport.templateMissing(name))
    return new Uint8Array(await readFile(join(dir, pick)))
  }

  return {
    async exportItems(request: ExportItemsRequest): Promise<{ content: string | Uint8Array; count: number }> {
      const s = ctx.need()
      const numbers = ctx.numbers(s)
      let rows: ExportItem[]
      if (request.scope === 'filtered' && request.query) {
        const all = queryAll(s.index, withRequired(s, request.query))
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
        const top = rows.reduce((m, r) => Math.min(m, r.depth), Number.POSITIVE_INFINITY) // no spread (A-27)
        rows = rows.map((r) => ({ ...r, depth: r.depth - top }))
      }
      // an old version's session root is an internal key "<root>\0version\0<commit>": the name is the real folder's (W-04)
      const title = `${basename(s.repo.root.split('\u0000')[0] ?? s.repo.root)} — requirements`
      if (request.format === 'docx' || request.format === 'html' || request.format === 'pdf') {
        const data = await documentData(s, rows, columns, request)
        if (request.format === 'docx') return { content: await itemsToDocx(data, await readTemplate(s, request.template)), count: rows.length }
        // PDF: the main process prints this HTML (print layout: no search box, no menu)
        return { content: itemsToHtml(data, request.format === 'pdf'), count: rows.length }
      }
      if (request.format === 'reqif') {
        // objects that came from ReqIF keep their identifier, so the other tool recognises them
        const sourceIds = new Map<string, string>()
        for (let i = 0; i < rows.length; i += 32) {
          await Promise.all(
            rows.slice(i, i + 32).map(async (r) => {
              const f = await s.repo.readItem(r.item.id)
              const src = f?.ok ? f.item.extra['source-id'] : undefined
              if (typeof src === 'string') sourceIds.set(r.item.id, src)
            })
          )
        }
        const items = rows.map((r) => ({ item: r.item, depth: r.depth, ...(sourceIds.has(r.item.id) ? { sourceId: sourceIds.get(r.item.id) as string } : {}) }))
        return { content: writeReqif(s.repo.schema, items, title), count: rows.length }
      }
      const content =
        request.format === 'markdown'
          ? itemsToMarkdown(s.repo.schema, rows, columns, title)
          : request.format === 'xlsx'
            ? await writeXlsx([itemsToSheet(s.repo.schema, rows, columns)])
            : itemsToCsv(s.repo.schema, rows, columns)
      return { content, count: rows.length }
    },

    /** The Word templates of the project (requirements/.reqochet/templates/*.docx), names without ".docx". */
    async wordTemplates(): Promise<string[]> {
      const s = ctx.need()
      const dir = join(s.repo.folder, s.repo.metaDir, 'templates')
      try {
        return (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.docx') && !f.startsWith('~$')).map((f) => f.slice(0, -5)).sort()
      } catch {
        return []
      }
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
 * The chosen items in document order (the owner's request, M7): with `below`, everything under a chosen item too; an
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

/** Today's date on this PC (not the UTC date: between midnight and 2 a.m. in Europe that is yesterday — C13). */
function localDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The items with depths counted from the shallowest one. */
function shallowest(rows: ExportItem[]): ExportItem[] {
  const top = Math.min(...rows.map((r) => r.depth))
  return top > 0 && Number.isFinite(top) ? rows.map((r) => ({ ...r, depth: r.depth - top })) : rows
}
