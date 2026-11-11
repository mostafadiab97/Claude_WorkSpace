import { useEffect, useMemo, useState } from 'react'
import type { CoverageReport, Matrix, RepoInfo } from '../../../shared/api'
import type { ItemQuery, Schema } from '../../../shared/domain'
import { T } from '../../../shared/text'
import { errorMessage } from '../lib/hooks'
import { linkName, ruleText, typeName, typeLabel } from '../lib/schema'
import { closedMark, onTabListKeyDown } from '../lib/keys'

/** Above this many columns the matrix is shown as a list (T-07); the Excel file always has the grid. */
const GRID_COLUMNS = 300

/**
 * The Traceability view (theme 1b — the owner's decision T-01): full width like Changes, with **Coverage** (each rule,
 * how many items it covers, the gaps) and **Matrix** (rows of one type, columns = the linked items of another).
 * Both follow the document picker; the matrix also follows the table's filter.
 */
export function TraceabilityView(props: {
  schema: Schema
  info: RepoInfo
  /** The document picked in the table (undefined = all documents). */
  document: string | undefined
  /** The table's filter (search, fields…) — the matrix rows follow it. */
  query: Omit<ItemQuery, 'limit' | 'offset'>
  dataVersion: number
  onOpenItem: (id: string) => void
  /** Shows the gaps of one rule in the table (Coverage gaps filter + the rule's type). */
  onShowGaps: (type: string) => void
  /** Missing while an old version is shown: nothing can be saved then (CR20-19). */
  onEditRules?: () => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'coverage' | 'matrix'>('coverage')
  return (
    <section className="trace" aria-label={T.trace.title}>
      <div className="compare__head">
        <h2 className="compare__title">{T.trace.title}</h2>
        <div className="tabs trace__tabs" role="tablist" aria-label={T.trace.tabs} onKeyDown={onTabListKeyDown}>
          <button type="button" role="tab" aria-selected={tab === 'coverage'} className={tab === 'coverage' ? 'tabs__tab tabs__tab--active' : 'tabs__tab'} onClick={() => setTab('coverage')}>
            {T.trace.coverageTab}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'matrix'} className={tab === 'matrix' ? 'tabs__tab tabs__tab--active' : 'tabs__tab'} onClick={() => setTab('matrix')}>
            {T.trace.matrixTab}
          </button>
        </div>
        <span className="muted-inline">{props.document === undefined ? T.trace.allDocuments : T.trace.document(props.document || T.documents.loose)}</span>
        <span className="toolbar__spacer" />
        {props.onEditRules && (
          <button type="button" className="btn" onClick={props.onEditRules}>
            {T.trace.editRules}
          </button>
        )}
        <button type="button" className="btn" onClick={props.onClose}>
          {T.trace.close}
        </button>
      </div>
      {tab === 'coverage' ? <CoverageTab {...props} /> : <MatrixTab {...props} />}
    </section>
  )
}

function CoverageTab(props: { schema: Schema; document: string | undefined; dataVersion: number; onOpenItem: (id: string) => void; onShowGaps: (type: string) => void; onEditRules?: () => void }) {
  const [report, setReport] = useState<CoverageReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const rulesKey = JSON.stringify(props.schema.rules ?? [])
  useEffect(() => {
    let live = true
    window.reqochet.getCoverage(props.document).then(
      (r) => {
        if (!live) return
        setReport(r)
        setError(null)
      },
      (e: unknown) => live && setError(errorMessage(e))
    )
    return () => {
      live = false
    }
  }, [props.document, props.dataVersion, rulesKey])
  if (error) return <p className="notice notice--error" role="alert">{error}</p>
  if (!report) return <p className="muted" role="status">{T.trace.loading}</p>
  if (report.rules.length === 0)
    return (
      <div className="trace__empty">
        <p className="muted">{T.trace.noRules}</p>
        {props.onEditRules && (
          <button type="button" className="btn btn--primary" onClick={props.onEditRules}>
            {T.trace.editRules}
          </button>
        )}
      </div>
    )
  return (
    <ul className="trace__rules scroll" aria-label={T.trace.coverageTab}>
      {[...report.rules].sort((a, b) => Number(a.total === 0) - Number(b.total === 0)).map(({ rule, total, gapCount, gaps }) => {
        const covered = total - gapCount
        const pct = total === 0 ? 100 : Math.floor((covered / total) * 100)
        const shown = open.has(rule.id)
        return (
          <li key={rule.id} className={total === 0 ? 'trace__rule trace__rule--idle' : 'trace__rule'}>
            <div className="trace__rule-head">
              <span className="trace__rule-text" dir="auto">
                {ruleText(props.schema, rule)}
              </span>
              <span className={`trace__level trace__level--${rule.level}`} title={T.trace.levelTooltip}>
                {rule.level === 'error' ? T.trace.levelError : T.trace.levelWarning}
              </span>
            </div>
            <div
              className="trace__bar"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={total === 0 ? 0 : pct}
              aria-valuetext={total === 0 ? T.trace.noItems : T.trace.covered(covered, total)}
              aria-label={ruleText(props.schema, rule)}
            >
              {/* UI-09: gaps colour the bar (warning, or danger for an error-level rule) */}
              <span className={gapCount === 0 ? 'trace__bar-fill' : `trace__bar-fill trace__bar-fill--${rule.level}`} style={{ inlineSize: total === 0 ? '0%' : `${pct}%` }} />
            </div>
            <div className="trace__rule-foot">
              {total === 0 ? (
                <span className="muted-inline">{T.trace.noItems}</span>
              ) : (
                <span>
                  {T.trace.covered(covered, total)} · {T.trace.percent(pct)}
                </span>
              )}
              {total === 0 ? null : gapCount === 0 ? (
                <span className="muted-inline">{T.trace.noGaps}</span>
              ) : (
                <>
                  <button type="button" className="link-btn" aria-expanded={shown} onClick={() => setOpen((s) => (s.has(rule.id) ? new Set([...s].filter((x) => x !== rule.id)) : new Set(s).add(rule.id)))}>
                    {shown ? '▾' : closedMark()} {T.trace.gaps(gapCount)}
                  </button>
                  <button type="button" className="link-btn" onClick={() => props.onShowGaps(rule.type)}>
                    {T.trace.showInTable}
                  </button>
                </>
              )}
            </div>
            {shown && (
              <ul className="trace__gaps">
                {gaps.slice(0, 200).map((g) => (
                  <li key={`${g.document}/${g.id}`}>
                    <button type="button" className="link-btn trace__gap" onClick={() => props.onOpenItem(g.id)}>
                      <span className="compare__number">{g.number ?? ''}</span>
                      <span className="tree__id">{g.id}</span>
                      <span dir="auto">{g.title || T.common.noTitle}</span>
                    </button>
                  </li>
                ))}
                {gapCount > 200 && (
                  <li>
                    <button type="button" className="link-btn" onClick={() => props.onShowGaps(rule.type)}>
                      {T.compare.showMore(gapCount - 200)}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function MatrixTab(props: { schema: Schema; query: Omit<ItemQuery, 'limit' | 'offset'>; dataVersion: number; onOpenItem: (id: string) => void }) {
  const types = props.schema.itemTypes.filter((t) => t.requirement !== false)
  const [rowType, setRowType] = useState(types.find((t) => t.id === 'system-requirement')?.id ?? types[0]?.id ?? '')
  const [colType, setColType] = useState(types.find((t) => t.id === 'test-case')?.id ?? types[1]?.id ?? types[0]?.id ?? '')
  const [link, setLink] = useState('')
  const [m, setM] = useState<Matrix | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const req = useMemo(() => ({ rowType, colType, ...(link ? { link } : {}), query: { ...props.query } }), [rowType, colType, link, props.query])
  const reqKey = JSON.stringify(req)
  useEffect(() => {
    let live = true
    window.reqochet.getMatrix(req).then(
      (r) => {
        if (!live) return
        setM(r)
        setError(null)
      },
      (e: unknown) => live && setError(errorMessage(e))
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reqKey stands for req
  }, [reqKey, props.dataVersion])
  const exportIt = async (): Promise<void> => {
    try {
      const r = await window.reqochet.exportMatrix(req)
      if (r.ok) setSaved(r.path)
      else if (!r.canceled) setError(r.message)
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  const relation = (type: string, dir: 'out' | 'in'): string => linkName(props.schema, type, dir === 'in')
  const byRow = useMemo(() => {
    const map = new Map<number, Matrix['cells']>()
    for (const c of m?.cells ?? []) {
      const row = map.get(c.r)
      if (row) row.push(c)
      else map.set(c.r, [c])
    }
    return map
  }, [m])
  const label = (h: { id: string; number?: string }): string => `${h.number ? `${h.number} ` : ''}${h.id}`
  return (
    <div className="trace__matrix">
      <div className="trace__controls">
        <label className="field">
          <span className="field__label">{T.trace.matrixRows}</span>
          <select className="input" value={rowType} onChange={(e) => setRowType(e.target.value)}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {typeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">{T.trace.matrixCols}</span>
          <select className="input" value={colType} onChange={(e) => setColType(e.target.value)}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {typeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">{T.trace.matrixLink}</span>
          <select className="input" value={link} onChange={(e) => setLink(e.target.value)}>
            <option value="">{T.trace.allLinks}</option>
            {props.schema.linkTypes.map((l) => (
              <option key={l.id} value={l.id}>
                {linkName(props.schema, l.id)}
              </option>
            ))}
          </select>
        </label>
        <span className="toolbar__spacer" />
        <button type="button" className="btn" disabled={!m || m.rows.length === 0} onClick={() => void exportIt()}>
          {T.trace.exportExcel}
        </button>
      </div>
      <p className="muted-inline">{T.trace.matrixHint}</p>
      <p className="muted-inline trace__legend">{T.trace.matrixLegend}</p>
      {saved && (
        <p className="compare__pull" role="status">
          {T.trace.exportedTo(saved)}{' '}
          <button type="button" className="link-btn" onClick={() => void window.reqochet.showInFolder(saved)}>
            {T.exportDialog.showInFolder}
          </button>
        </p>
      )}
      {error && <p className="notice notice--error" role="alert">{error}</p>}
      {!m ? (
        <p className="muted" role="status">{T.trace.loading}</p>
      ) : m.rows.length === 0 ? (
        <p className="muted">{T.trace.matrixEmpty}</p>
      ) : m.cols.length === 0 ? (
        <p className="muted">{T.trace.matrixNoLinks}</p>
      ) : (
        <>
          {m.truncatedRows && <p className="notice notice--warn">{T.trace.matrixTruncated(m.rows.length, m.totalRows)}</p>}
          {m.cols.length > GRID_COLUMNS ? (
            <>
              <p className="notice">{T.trace.matrixAsList(m.cols.length)}</p>
              <ul className="trace__list scroll">
                {m.rows.map((r, k) => (
                  <li key={r.id}>
                    <button type="button" className="link-btn" onClick={() => props.onOpenItem(r.id)}>
                      {label(r)}
                    </button>{' '}
                    <span dir="auto">{r.title}</span>
                    <span className="muted-inline">
                      {T.trace.listSep}
                      {(byRow.get(k) ?? []).map((c) => `${relation(c.type, c.dir)} ${label(m.cols[c.c] ?? { id: '?' })}`).join(T.trace.listJoin) || T.trace.matrixNoLink}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="trace__grid scroll">
              <table className="matrix">
                <thead>
                  <tr>
                    <th scope="col" className="matrix__corner">
                      {typeName(props.schema, rowType)} × {typeName(props.schema, colType)}
                    </th>
                    {m.cols.map((c) => (
                      <th key={c.id} scope="col" className="matrix__col" title={`${label(c)} — ${c.title}`}>
                        <button type="button" className="link-btn" onClick={() => props.onOpenItem(c.id)}>
                          <span className="matrix__col-title" dir="auto">
                            {c.title || T.common.noTitle}
                          </span>
                          <span className="matrix__col-id">{label(c)}</span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {m.rows.map((r, k) => {
                    // a row and column can be linked more than once (both ways, two link types): one cell shows them all (CR20-07)
                    const here = new Map<number, Matrix['cells']>()
                    for (const c of byRow.get(k) ?? []) {
                      const list = here.get(c.c)
                      if (list) list.push(c)
                      else here.set(c.c, [c])
                    }
                    return (
                      <tr key={r.id} className={here.size === 0 ? 'matrix__row--empty' : undefined}>
                        <th scope="row" className="matrix__row" title={r.title}>
                          {here.size === 0 && (
                            <span className="table__gap" role="img" aria-label={T.trace.matrixNoLink} title={T.trace.matrixNoLink} />
                          )}
                          <button type="button" className="link-btn" onClick={() => props.onOpenItem(r.id)}>
                            {label(r)}
                          </button>{' '}
                          <span dir="auto">{r.title}</span>
                        </th>
                        {m.cols.map((c, ci) => {
                          const links = here.get(ci)
                          const suspect = links?.some((x) => x.suspect) === true
                          const out = links?.some((x) => x.dir === 'out') === true
                          const into = links?.some((x) => x.dir === 'in') === true
                          const words = links?.map((x) => `${T.trace.matrixCell(r.id, relation(x.type, x.dir), c.id)}${x.suspect ? ` (${T.trace.matrixSuspect})` : ''}`).join(T.trace.listJoin)
                          return (
                            <td key={c.id} className={links ? (suspect ? 'matrix__cell matrix__cell--suspect' : 'matrix__cell matrix__cell--on') : 'matrix__cell'} title={words} aria-label={words}>
                              {links ? (suspect ? '⚠' : out && into ? '↔' : out ? '→' : '←') : ''}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
