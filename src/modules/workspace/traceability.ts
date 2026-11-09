// Traceability views (theme 1b — the owner's decisions T-01…T-08, 8 Nov 2026): coverage against the project's
// rules, the impact chain of one item, and the traceability matrix. Read-only; answered from the index.
import type { CoverageReport, ImpactNode, ImpactResult, Matrix, MatrixHead, MatrixRequest } from '../../shared/api'
import type { IndexedItem, ItemQuery } from '../../shared/domain'
import type { SheetData } from '../import-export'
import { queryAll, withRequired, type Session, type WorkspaceContext } from './context'
import { compareOutline } from './structure'
import { T } from '../../shared/text'

/** An impact chain stops here (a whole project depends on its top heading). */
export const IMPACT_LIMIT = 5000
/** Rows drawn in the matrix view; the Excel export has them all. */
export const MATRIX_ROWS = 2000
/** The Excel file is a grid up to this size, else a list (SEC20-01). */
export const GRID_COLS = 1000
export const GRID_CELLS = 200_000
/** "relates to" is a loose association, not a dependency: it does not carry impact (T-06). */
const NOT_A_DEPENDENCY = new Set(['relates-to'])

export function createTraceabilityOps(ctx: WorkspaceContext) {
  const head = (s: Session, i: Pick<IndexedItem, 'id' | 'title'>): MatrixHead => {
    const n = ctx.numbers(s).get(i.id)
    return { id: i.id, title: i.title, ...(n ? { number: n } : {}) }
  }
  const byNumber = (a: MatrixHead, b: MatrixHead): number => compareOutline(a.number, b.number) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

  /**
   * The matrix: rows = the filtered row items (sorted by number), columns = the column-type items linked to the first
   * `rowLimit` rows. Rows past the limit are only counted (P7/SEC20-07: the links of rows not shown are not read).
   */
  function buildMatrix(s: Session, req: MatrixRequest, rowLimit: number): Matrix {
    const filter: ItemQuery = { ...(req.query ?? {}), types: [req.rowType] }
    delete filter.limit
    delete filter.offset
    // the table's filter as the table uses it: Incomplete needs the required fields, Coverage gaps the rules (CR20-04)
    const rowItems = queryAll(s.index, withRequired(s, filter))
    const sorted = rowItems.map((i) => ({ head: head(s, i), item: i })).sort((a, b) => byNumber(a.head, b.head))
    const shown = sorted.slice(0, rowLimit)
    const colTypeOf = new Map<string, IndexedItem>()
    for (const c of queryAll(s.index, { types: [req.colType] })) colTypeOf.set(c.id, c)
    const raw: { r: number; col: string; type: string; dir: 'out' | 'in'; suspect: boolean }[] = []
    shown.forEach(({ item: it }, r) => {
      for (const l of it.links) {
        if ((req.link && l.type !== req.link) || !colTypeOf.has(l.target)) continue
        const fp = s.index.fingerprint(l.target)
        raw.push({ r, col: l.target, type: l.type, dir: 'out', suspect: l.confirmed !== undefined && fp !== undefined && l.confirmed !== fp })
      }
      for (const l of s.index.incomingLinks(it.id)) {
        if ((req.link && l.type !== req.link) || !colTypeOf.has(l.id)) continue
        raw.push({ r, col: l.id, type: l.type, dir: 'in', suspect: l.suspect })
      }
    })
    const cols = [...new Set(raw.map((x) => x.col))].map((id) => head(s, colTypeOf.get(id) as IndexedItem)).sort(byNumber)
    const colIndex = new Map(cols.map((c, k) => [c.id, k]))
    return {
      rows: shown.map((x) => x.head),
      cols,
      cells: raw.map((x) => ({ r: x.r, c: colIndex.get(x.col) as number, type: x.type, dir: x.dir, suspect: x.suspect })),
      truncatedRows: sorted.length > shown.length,
      totalRows: sorted.length
    }
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
      return buildMatrix(s, req, MATRIX_ROWS)
    },

    /**
     * For Excel: the grid when it is small enough to open (rows × columns ≤ GRID_CELLS, columns ≤ GRID_COLS), else a
     * list — one row per row item with its linked items. A dense grid of 10,000 × 1,500 ran the main process out of
     * memory (SEC20-01/P1); Excel also stops at 16,384 columns.
     */
    matrixSheet(s: Session, req: MatrixRequest): SheetData {
      const m = buildMatrix(s, req, Number.MAX_SAFE_INTEGER)
      const label = (h: MatrixHead): string => `${h.number ? `${h.number} ` : ''}${h.id}`
      const text = (type: string, dir: 'out' | 'in'): string => {
        const name = s.repo.schema.linkTypes.find((l) => l.id === type)
        return dir === 'out' ? (name?.name ?? type) : (name?.reverseName ?? type)
      }
      const byRow = new Map<number, Matrix['cells']>()
      for (const c of m.cells) {
        const row = byRow.get(c.r)
        if (row) row.push(c)
        else byRow.set(c.r, [c])
      }
      if (m.cols.length <= GRID_COLS && m.rows.length * m.cols.length <= GRID_CELLS) {
        return {
          name: T.trace.matrixSheet,
          header: [T.columns.number, T.columns.id, T.columns.title, ...m.cols.map(label)],
          rows: m.rows.map((r, k) => {
            const line = new Array<string>(m.cols.length).fill('')
            for (const c of byRow.get(k) ?? []) line[c.c] = line[c.c] ? `${line[c.c]}, ${text(c.type, c.dir)}` : text(c.type, c.dir)
            return [r.number ?? '', r.id, r.title, ...line]
          })
        }
      }
      return {
        name: T.trace.matrixSheet,
        header: [T.columns.number, T.columns.id, T.columns.title, T.trace.linkedItems],
        rows: m.rows.map((r, k) => [r.number ?? '', r.id, r.title, (byRow.get(k) ?? []).map((c) => `${text(c.type, c.dir)} ${label(m.cols[c.c] as MatrixHead)}`).join('; ')]),
        wrapColumns: [3]
      }
    }
  }
}
