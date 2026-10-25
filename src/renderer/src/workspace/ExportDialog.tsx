import { useState } from 'react'
import type { ExportItemsRequest, ExportResult } from '../../../shared/api'
import type { ItemQuery } from '../../../shared/domain'
import { errorMessage } from '../lib/hooks'

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
      <div className="modal__panel modal__panel--narrow" role="dialog" aria-modal="true" aria-label="Export">
        <header className="modal__header">
          <div>
            <h2 className="modal__title">Export</h2>
            <p className="muted">A file for people and tools outside the repository. Nothing in the repository changes.</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={props.onClose}>
            ✕
          </button>
        </header>
        <div className="modal__body">
          <fieldset className="choice">
            <legend className="field__label">Which items</legend>
            <label className="check">
              <input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />
              All {props.totalCount.toLocaleString('en')} items, in document order (the hierarchy)
            </label>
            <label className="check">
              <input type="radio" name="scope" checked={scope === 'filtered'} disabled={!props.filtered} onChange={() => setScope('filtered')} />
              {props.filtered ? `Only the ${props.filteredCount.toLocaleString('en')} items of the current search / filters` : 'Only the current search / filter result (no search or filter active)'}
            </label>
          </fieldset>
          <fieldset className="choice">
            <legend className="field__label">Columns — ID, Title and the columns shown in the table, plus:</legend>
            <label className="check">
              <input type="checkbox" checked={hierarchy} onChange={(e) => setHierarchy(e.target.checked)} />
              Level and Parent (the hierarchy)
            </label>
            <label className="check">
              <input type="checkbox" checked={text} onChange={(e) => setText(e.target.checked)} />
              The full text
            </label>
            <label className="check">
              <input type="checkbox" checked={links} onChange={(e) => setLinks(e.target.checked)} />
              Links (both directions)
            </label>
          </fieldset>
          <fieldset className="choice">
            <legend className="field__label">Format</legend>
            <label className="check">
              <input type="radio" name="format" checked={format === 'csv'} onChange={() => setFormat('csv')} />
              CSV — opens in Excel (comma-separated, UTF-8)
            </label>
            <label className="check">
              <input type="radio" name="format" checked={format === 'markdown'} onChange={() => setFormat('markdown')} />
              Markdown — one readable document, e.g. to give to an AI tool
            </label>
          </fieldset>
          {error && <p className="notice notice--error" role="alert">{error}</p>}
        </div>
        <footer className="modal__footer actions">
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void run()}>
            {busy ? 'Exporting…' : 'Export…'}
          </button>
          <button type="button" className="btn" onClick={props.onClose}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  )
}
