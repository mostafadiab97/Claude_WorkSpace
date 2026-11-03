import { useEffect, useState } from 'react'
import type { HistoryEntry, ItemVersionCompare } from '../../../shared/api'
import { ChangeView } from './ChangeView'
import type { Schema } from '../../../shared/domain'
import { errorMessage } from '../lib/hooks'
import { T } from '../../../shared/text'

const when = (iso: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/** While Git reads the history: three placeholder rows, and after 5 s a word that it is still working (UX-26). */
function HistoryLoading() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 5000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="history-loading" role="status">
      <p className="muted-inline">
        <span className="spinner" aria-hidden="true" /> {slow ? T.history.slow : T.history.loading}
      </p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="history-loading__row" aria-hidden="true">
          <span className="skeleton skeleton--short" />
          <span className="skeleton skeleton--short" />
          <span className="skeleton" />
        </div>
      ))}
    </div>
  )
}

/**
 * Who changed this item, when and why (from Git), and what each change did — field by field, not file lines.
 * Journey step 7.
 */
export function HistoryView({ schema, itemId, reloadToken }: { schema: Schema; itemId: string; reloadToken: number }) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [compare, setCompare] = useState<{ hash: string; data: ItemVersionCompare } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void window.reqman
      .getItemHistory(itemId)
      .then((h) => {
        if (!live) return
        setEntries(h)
        setSelected((s) => (s && h.some((e) => e.hash === s) ? s : (h[0]?.hash ?? null)))
      })
      .catch((e: unknown) => live && setError(errorMessage(e)))
    return () => {
      live = false
    }
  }, [itemId, reloadToken])

  useEffect(() => {
    if (!selected) return
    let live = true
    void window.reqman
      .compareItemVersion(itemId, selected)
      .then((data) => live && setCompare({ hash: selected, data }))
      .catch((e: unknown) => live && setError(errorMessage(e)))
    return () => {
      live = false
    }
  }, [itemId, selected, reloadToken])

  if (error) return <p className="notice notice--error">{error}</p>
  if (!entries) return <HistoryLoading />
  if (entries.length === 0) return <p className="muted">{T.history.none}</p>

  const shown = compare && compare.hash === selected ? compare.data : null
  return (
    <div className="history">
      <ul className="history__list" aria-label={T.history.versions}>
        {entries.map((e) => (
          <li key={e.hash}>
            <button type="button" className={e.hash === selected ? 'history__entry history__entry--selected' : 'history__entry'} aria-pressed={e.hash === selected} onClick={() => setSelected(e.hash)}>
              <span className="history__message">{e.message}</span>
              <span className="history__meta">
                {e.hash === 'working' ? T.history.working : `${e.author} · ${when(e.date)} · ${e.hash.slice(0, 7)}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {shown && <ChangeView schema={schema} diff={shown.diff} unreadable={shown.unreadable} />}
    </div>
  )
}
