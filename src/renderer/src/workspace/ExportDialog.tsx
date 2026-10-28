import { useState } from 'react'
import type { ExportItemsRequest, ExportResult } from '../../../shared/api'
import type { ItemQuery } from '../../../shared/domain'
import { errorMessage } from '../lib/hooks'
import { T } from '../../../shared/text'

/**
 * Export the requirements to a file: CSV for Excel (comma-separated, UTF-8) or Markdown for AI tools and documents.
 * Columns follow the table (what is shown, in that order); text, links and hierarchy can be added.
 */
export function ExportDialog(props: {
  /** Optional columns shown in the table, in table order (type, links, text, field:<id>). */
  shownColumns: string[]
  filtered: boolean
  filteredCount: number
  totalCount: number
  query: Omit<ItemQuery, 'limit' | 'offset'>
  onDone: (r: ExportResult & { ok: true }) => void
  onClose: () => void
}) {
  const [scope, setScope] = useState<'all' | 'filtered'>(props.filtered ? 'filtered' : 'all')
  const [format, setFormat] = useState<'csv' | 'markdown'>('csv')
  const [hierarchy, setHierarchy] = useState(true)
  const [text, setText] = useState(true)
  const [links, setLinks] = useState(true)
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
      const request: ExportItemsRequest = { scope, columns: columns(), format, ...(scope === 'filtered' ? { query: props.query } : {}) }
      const r = await window.reqman.exportItems(request)
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
      <div className="modal__panel modal__panel--narrow" role="dialog" aria-modal="true" aria-label={T.exportDialog.title}>
        <header className="modal__header">
          <div>
            <h2 className="modal__title">{T.exportDialog.title}</h2>
            <p className="muted">{T.exportDialog.intro}</p>
          </div>
          <button type="button" className="icon-btn" aria-label={T.common.close} onClick={props.onClose}>
            ✕
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
              <input type="radio" name="format" checked={format === 'csv'} onChange={() => setFormat('csv')} />
              {T.exportDialog.csv}
            </label>
            <label className="check">
              <input type="radio" name="format" checked={format === 'markdown'} onChange={() => setFormat('markdown')} />
              {T.exportDialog.markdown}
            </label>
          </fieldset>
          {error && <p className="notice notice--error" role="alert">{error}</p>}
        </div>
        <footer className="modal__footer actions">
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void run()}>
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
