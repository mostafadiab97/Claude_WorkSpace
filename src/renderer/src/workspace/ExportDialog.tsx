import { useEffect, useRef, useState } from 'react'
import type { ExportFormat, ExportItemsRequest, ExportResult, ImportSource } from '../../../shared/api'
import type { ItemQuery } from '../../../shared/domain'
import { errorMessage, useModalKeys } from '../lib/hooks'
import { T } from '../../../shared/text'
import { Icon } from '../components/icons'

/**
 * Export the requirements to a file: an Excel workbook, CSV, or Markdown for AI tools and documents. All items,
 * the search/filter result, or chosen items (with everything below them — M7). Columns follow the table (what is
 * shown, in that order); text, links and hierarchy can be added. When the repository was imported from a file on
 * this PC, that file can be updated instead ("Update the Excel file", M7).
 */
export function ExportDialog(props: {
  /** Optional columns shown in the table, in table order (type, links, text, field:<id>). */
  shownColumns: string[]
  filtered: boolean
  filteredCount: number
  totalCount: number
  query: Omit<ItemQuery, 'limit' | 'offset'>
  /** Items chosen in the table (Ctrl/Shift+click) or the right-clicked item; opens with scope "chosen". */
  chosen?: string[]
  /** 0.25.0: the name the Word / PDF / web page document starts with (the document shown; empty = the folder name). */
  documentName?: string
  onDone: (r: ExportResult & { ok: true }) => void
  onClose: () => void
}) {
  const chosen = props.chosen ?? []
  const [scope, setScope] = useState<'all' | 'filtered' | 'chosen'>(chosen.length > 0 ? 'chosen' : props.filtered ? 'filtered' : 'all')
  const [below, setBelow] = useState(true)
  const [format, setFormat] = useState<ExportFormat>('xlsx')
  const [source, setSource] = useState<ImportSource | null>(null)
  useEffect(() => {
    let live = true
    void window.reqochet.getImportSource().then((x) => live && setSource(x))
    return () => {
      live = false
    }
  }, [])
  const [hierarchy, setHierarchy] = useState(true)
  const [text, setText] = useState(true)
  const [links, setLinks] = useState(true)
  // 0.25.0 Word / PDF / web page
  const isDoc = format === 'docx' || format === 'pdf' || format === 'html'
  const [title, setTitle] = useState(props.documentName ?? '')
  const [traceTable, setTraceTable] = useState(false)
  const [templates, setTemplates] = useState<string[] | null>(null) // null while the list loads (C11)
  const [template, setTemplate] = useState('')
  useEffect(() => {
    if (format !== 'docx') return
    let live = true
    void window.reqochet.wordTemplates().then((list) => {
      if (!live) return
      setTemplates(list)
      setTemplate((t) => (t && list.includes(t) ? t : (list[0] ?? '')))
    })
    return () => {
      live = false
    }
  }, [format])
  const panel = useRef<HTMLDivElement>(null)
  useModalKeys(panel, props.onClose)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const columns = (): string[] => {
    const shown = props.shownColumns.filter((c) => (c !== 'text' || text) && (c !== 'links' || links))
    const cols = ['id', ...(hierarchy ? ['level'] : []), 'title', ...shown.filter((c) => c !== 'links' && c !== 'text')]
    if (hierarchy) cols.push('parent')
    if (text) cols.push('text')
    if (links) cols.push('links', 'linkedFrom')
    return cols
  }

  const run = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const request: ExportItemsRequest = {
        scope,
        columns: columns(),
        format,
        ...(scope === 'filtered' ? { query: props.query } : {}),
        ...(scope === 'chosen' ? { ids: chosen, includeBelow: below } : {}),
        ...(isDoc && title.trim() ? { title: title.trim() } : {}),
        ...(isDoc && traceTable ? { traceTable: true } : {}),
        ...(format === 'docx' && template ? { template } : {})
      }
      const r = await window.reqochet.exportItems(request)
      if (r.ok) props.onDone(r)
      else if (!r.canceled) setError(r.message)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const update = async (mode: 'original' | 'copy'): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const r = await window.reqochet.updateSourceFile(mode)
      if (r.ok) props.onDone(r)
      else if (!r.canceled) setError(r.message)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div ref={panel} tabIndex={-1} className="modal__panel modal__panel--narrow" role="dialog" aria-modal="true" aria-labelledby="export-title" aria-describedby="export-intro">
        <header className="modal__header">
          <div>
            <h2 className="modal__title" id="export-title">
              {T.exportDialog.title}
            </h2>
            <p className="muted" id="export-intro">
              {T.exportDialog.intro}
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label={T.common.close} onClick={props.onClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className="modal__body">
          <fieldset className="choice">
            <legend className="field__label">{T.exportDialog.which}</legend>
            <label className="check">
              <input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />
              {T.exportDialog.all(props.totalCount)}
            </label>
            <label className="check">
              <input type="radio" name="scope" checked={scope === 'filtered'} disabled={!props.filtered} onChange={() => setScope('filtered')} />
              {props.filtered ? T.exportDialog.filtered(props.filteredCount) : T.exportDialog.filteredNone}
            </label>
            {chosen.length > 0 && (
              <>
                <label className="check">
                  <input type="radio" name="scope" checked={scope === 'chosen'} onChange={() => setScope('chosen')} />
                  {chosen.length === 1 ? T.exportDialog.chosenOne(chosen[0] as string) : T.exportDialog.chosen(chosen.length)}
                </label>
                <label className="check check--nested">
                  <input type="checkbox" checked={below} disabled={scope !== 'chosen'} onChange={(e) => setBelow(e.target.checked)} />
                  {T.exportDialog.includeBelow}
                </label>
              </>
            )}
          </fieldset>
          <fieldset className="choice">
            <legend className="field__label">{T.exportDialog.columns}</legend>
            <label className="check">
              <input type="checkbox" checked={hierarchy} onChange={(e) => setHierarchy(e.target.checked)} />
              {T.exportDialog.hierarchy}
            </label>
            <label className="check">
              <input type="checkbox" checked={text} onChange={(e) => setText(e.target.checked)} />
              {T.exportDialog.fullText}
            </label>
            <label className="check">
              <input type="checkbox" checked={links} onChange={(e) => setLinks(e.target.checked)} />
              {T.exportDialog.links}
            </label>
          </fieldset>
          <fieldset className="choice">
            <legend className="field__label">{T.exportDialog.format}</legend>
            <label className="check">
              <input type="radio" name="format" checked={format === 'docx'} onChange={() => setFormat('docx')} />
              {T.exportDialog.docx}
            </label>
            <label className="check">
              <input type="radio" name="format" checked={format === 'pdf'} onChange={() => setFormat('pdf')} />
              {T.exportDialog.pdf}
            </label>
            <label className="check">
              <input type="radio" name="format" checked={format === 'html'} onChange={() => setFormat('html')} />
              {T.exportDialog.html}
            </label>
            <label className="check">
              <input type="radio" name="format" checked={format === 'xlsx'} onChange={() => setFormat('xlsx')} />
              {T.exportDialog.xlsx}
            </label>
            <label className="check">
              <input type="radio" name="format" checked={format === 'reqif'} onChange={() => setFormat('reqif')} />
              {T.exportDialog.reqif}
            </label>
            <label className="check">
              <input type="radio" name="format" checked={format === 'csv'} onChange={() => setFormat('csv')} />
              {T.exportDialog.csv}
            </label>
            <label className="check">
              <input type="radio" name="format" checked={format === 'markdown'} onChange={() => setFormat('markdown')} />
              {T.exportDialog.markdown}
            </label>
          </fieldset>
          {isDoc && (
            <fieldset className="choice">
              <legend className="field__label">{T.exportDialog.documentOptions}</legend>
              <label className="field">
                <span className="field__label">{T.exportDialog.docTitle}</span>
                <input className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="check">
                <input type="checkbox" checked={traceTable} onChange={(e) => setTraceTable(e.target.checked)} />
                {T.exportDialog.traceTable}
              </label>
              {format === 'docx' && (
                <label className="field">
                  <span className="field__label">{T.exportDialog.template}</span>
                  <select className="input" value={template} onChange={(e) => setTemplate(e.target.value)} aria-describedby="export-template-hint">
                    {(templates ?? []).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value="">{T.exportDialog.templateBuiltIn}</option>
                  </select>
                  <span className="muted-inline" id="export-template-hint">
                    {T.exportDialog.templateHint}
                  </span>
                </label>
              )}
            </fieldset>
          )}
          {source && source.kind !== 'reqif' && (
            <fieldset className="choice export__source">
              <legend className="field__label">{T.exportDialog.sourceTitle}</legend>
              <p className="muted-inline">{T.exportDialog.sourceIntro(source.name)}</p>
              <span className="actions">
                <button type="button" className="btn" disabled={busy || /\.xlsm$/i.test(source.name)} onClick={() => void update('original')} title={/\.xlsm$/i.test(source.name) ? T.importMsg.macroOriginal : T.exportDialog.updateOriginalTooltip}>
                  {T.exportDialog.updateOriginal(source.name)}
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => void update('copy')}>
                  {T.exportDialog.updateCopy}
                </button>
              </span>
            </fieldset>
          )}
          {error && <p className="notice notice--error" role="alert">{error}</p>}
        </div>
        <footer className="modal__footer actions">
          <button type="button" className="btn btn--primary" disabled={busy || (format === 'docx' && templates === null)} onClick={() => void run()}>
            {busy ? T.exportDialog.running : T.exportDialog.run}
          </button>
          <button type="button" className="btn" onClick={props.onClose}>
            {T.common.cancel}
          </button>
        </footer>
      </div>
    </div>
  )
}
