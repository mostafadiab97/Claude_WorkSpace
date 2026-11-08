// Traceability views (theme 1b — the owner's decisions T-01…T-08, 8 Nov 2026): coverage against the project's
// rules, the impact chain of one item, and the traceability matrix. Read-only; answered from the index.
import type { CoverageReport, ImpactNode, ImpactResult, Matrix, MatrixHead, MatrixRequest } from '../../shared/api'
import type { IndexedItem, ItemQuery } from '../../shared/domain'
import type { SheetData } from '../import-export'
import { queryAll, type Session, type WorkspaceContext } from './context'
import { compareOutline } from './structure'
import { T } from '../../shared/text'

/** An impact chain stops here (a whole project depends on its top heading). */
export const IMPACT_LIMIT = 5000
/** Rows drawn in the matrix view; the Excel export has them all. */
export const MATRIX_ROWS = 2000
/** "relates to" is a loose association, not a dependency: it does not carry impact (T-06). */
const NOT_A_DEPENDENCY = new Set(['relates-to'])

export function createTraceabilityOps(ctx: WorkspaceContext) {
  const head = (s: Session, i: Pick<IndexedItem, 'id' | 'title'>): MatrixHead => {
    const n = ctx.numbers(s).get(i.id)
    return { id: i.id, title: i.title, ...(n ? { number: n } : {}) }
  }
  const byNumber = (a: MatrixHead, b: MatrixHead): number => compareOutline(a.number, b.number) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

  function fullMatrix(s: Session, req: MatrixRequest): Matrix & { allRows: MatrixHead[] } {
    const filter: ItemQuery = { ...(req.query ?? {}), types: [req.rowType] }
    delete filter.limit
    delete filter.offset
    const withRules = { ...filter, ...(filter.gaps ? { rules: s.repo.schema.rules ?? [] } : {}) }
    const rowItems = queryAll(s.index, withRules)
    const allRows = rowItems.map((i) => head(s, i)).sort(byNumber)
    const rowIndex = new Map(allRows.map((r, k) => [r.id, k]))
    const colTypeOf = new Map<string, IndexedItem>()
    for (const c of queryAll(s.index, { types: [req.colType] })) colTypeOf.set(c.id, c)
    const raw: { row: string; col: string; type: string; dir: 'out' | 'in'; suspect: boolean }[] = []
    for (const it of rowItems) {
      for (const l of it.links) {
        if ((req.link && l.type !== req.link) || !colTypeOf.has(l.target)) continue
        const fp = s.index.fingerprint(l.target)
        raw.push({ row: it.id, col: l.target, type: l.type, dir: 'out', suspect: l.confirmed !== undefined && fp !== undefined && l.confirmed !== fp })
      }
      for (const l of s.index.incomingLinks(it.id)) {
        if ((req.link && l.type !== req.link) || !colTypeOf.has(l.id)) continue
        raw.push({ row: it.id, col: l.id, type: l.type, dir: 'in', suspect: l.suspect })
      }
    }
    const cols = [...new Set(raw.map((x) => x.col))].map((id) => head(s, colTypeOf.get(id) as IndexedItem)).sort(byNumber)
    const colIndex = new Map(cols.map((c, k) => [c.id, k]))
    const cells = raw.map((x) => ({ r: rowIndex.get(x.row) as number, c: colIndex.get(x.col) as number, type: x.type, dir: x.dir, suspect: x.suspect }))
    return { rows: allRows, allRows, cols, cells, truncatedRows: false, totalRows: allRows.length }
  }

  return {
    coverage(s: Session, document?: string): CoverageReport {
      const numbers = ctx.numbers(s)
      return {
        rules: s.index.coverage(s.repo.schema.rules ?? [], document).map((r) => ({
          ...r,
          gaps: r.gaps.map((g) => (numbers.get(g.id) ? { ...g, number: numbers.get(g.id) as string } : g))
        }))
      }
    },

    /** Everything that depends on the item, all levels down (T-06): items linking to it (but "relates to") and its children. */
    impact(s: Session, id: string): ImpactResult {
      const numbers = ctx.numbers(s)
      const seen = new Set([id])
      const nodes: ImpactNode[] = []
      let level = [id]
      let truncated = false
      for (let depth = 1; level.length > 0 && !truncated; depth++) {
        const next: string[] = []
        for (const parent of level) {
          const deps: { id: string; via: string; suspect: boolean }[] = [
            ...s.index
              .incomingLinks(parent)
              .filter((l) => !NOT_A_DEPENDENCY.has(l.type))
              .map((l) => ({ id: l.id, via: l.type, suspect: l.suspect })),
            ...queryAll(s.index, { parent, sort: { by: 'order' } }).map((c) => ({ id: c.id, via: 'child', suspect: false }))
          ]
          for (const d of deps) {
            if (seen.has(d.id)) continue
            const it = s.index.get(d.id)
            if (!it) continue
            if (nodes.length >= IMPACT_LIMIT) {
              truncated = true
              break
            }
            seen.add(d.id)
            const n = numbers.get(d.id)
            nodes.push({ id: d.id, title: it.title, type: it.type, document: it.document ?? '', ...(n ? { number: n } : {}), depth, parent, via: d.via, suspect: d.suspect })
            next.push(d.id)
          }
          if (truncated) break
        }
        level = next
      }
      return { nodes, truncated }
    },

    matrix(s: Session, req: MatrixRequest): Matrix {
      const m = fullMatrix(s, req)
      if (m.rows.length <= MATRIX_ROWS) return { rows: m.rows, cols: m.cols, cells: m.cells, truncatedRows: false, totalRows: m.rows.length }
      // the view draws the first rows; the columns and cells follow them
      const rows = m.rows.slice(0, MATRIX_ROWS)
      const cells = m.cells.filter((c) => c.r < MATRIX_ROWS)
      const used = [...new Set(cells.map((c) => c.c))].sort((a, b) => a - b)
      const remap = new Map(used.map((c, k) => [c, k]))
      return { rows, cols: used.map((c) => m.cols[c] as MatrixHead), cells: cells.map((c) => ({ ...c, c: remap.get(c.c) as number })), truncatedRows: true, totalRows: m.rows.length }
    },

    /** The whole grid for Excel: one row per row item, one column per linked item, the link type in the cell. */
    matrixSheet(s: Session, req: MatrixRequest): SheetData {
      const m = fullMatrix(s, req)
      const label = (h: MatrixHead): string => `${h.number ? `${h.number} ` : ''}${h.id}`
      const grid = m.allRows.map(() => m.cols.map(() => ''))
      for (const c of m.cells) {
        const row = grid[c.r] as string[]
        const name = s.repo.schema.linkTypes.find((l) => l.id === c.type)
        const text = c.dir === 'out' ? (name?.name ?? c.type) : (name?.reverseName ?? c.type)
        row[c.c] = row[c.c] ? `${row[c.c]}, ${text}` : text
      }
      return {
        name: T.trace.matrixSheet,
        header: [T.columns.number, T.columns.id, T.columns.title, ...m.cols.map(label)],
        rows: m.allRows.map((r, k) => [r.number ?? '', r.id, r.title, ...(grid[k] as string[])])
      }
    }
  }
}
