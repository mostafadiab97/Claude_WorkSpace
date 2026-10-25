import { useEffect, useState } from 'react'
import type { HistoryEntry, ItemVersionCompare } from '../../../shared/api'
import type { Link, Schema } from '../../../shared/domain'
import { errorMessage } from '../lib/hooks'
import { linkName } from '../lib/schema'

const when = (iso: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
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
  if (!entries) return <p className="muted-inline">Loading history…</p>
  if (entries.length === 0) return <p className="muted">No history yet — the item has never been committed.</p>

  const shown = compare && compare.hash === selected ? compare.data : null
  return (
    <div className="history">
      <ul className="history__list" aria-label="Versions">
        {entries.map((e) => (
          <li key={e.hash}>
            <button type="button" className={e.hash === selected ? 'history__entry history__entry--selected' : 'history__entry'} aria-pressed={e.hash === selected} onClick={() => setSelected(e.hash)}>
              <span className="history__message">{e.message}</span>
              <span className="history__meta">
                {e.hash === 'working' ? 'your saved, uncommitted version' : `${e.author} · ${when(e.date)} · ${e.hash.slice(0, 7)}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {shown && <ChangeView schema={schema} data={shown} />}
    </div>
  )
}

function ChangeView({ schema, data }: { schema: Schema; data: ItemVersionCompare }) {
  const { diff } = data
  const links = (ls: Link[], sign: string): string[] => ls.map((l) => `${sign} ${linkName(schema, l.type)} ${l.target}`)
  const nothing = diff.rows.length === 0 && !diff.text && diff.linksAdded.length === 0 && diff.linksRemoved.length === 0
  return (
    <section className="change" aria-label="What changed">
      <h4 className="links__title">{diff.kind === 'added' ? 'Created with' : diff.kind === 'deleted' ? 'Deleted' : 'What changed'}</h4>
      {data.unreadable && <p className="notice notice--warn">One version could not be read: {data.unreadable}</p>}
      {nothing && <p className="muted-inline">Nothing visible changed (e.g. only a link confirmation or formatting).</p>}
      {diff.rows.length > 0 && (
        <table className="change__table">
          <thead>
            <tr>
              <th scope="col">Field</th>
              {diff.kind !== 'added' && <th scope="col">Before</th>}
              <th scope="col">{diff.kind === 'added' ? 'Value' : 'After'}</th>
            </tr>
          </thead>
          <tbody>
            {diff.rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.label}</th>
                {diff.kind !== 'added' && <td className="change__before">{r.before || '—'}</td>}
                <td className="change__after">{r.after || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {diff.text && (
        <div className="change__text">
          <span className="field__label">Text</span>
          {diff.kind !== 'added' && <pre className="change__before">{diff.text.before || '(empty)'}</pre>}
          <pre className="change__after">{diff.text.after || '(empty)'}</pre>
        </div>
      )}
      {(diff.linksAdded.length > 0 || diff.linksRemoved.length > 0) && (
        <ul className="change__links">
          {links(diff.linksAdded, '+').map((t) => (
            <li key={t} className="change__after">{t}</li>
          ))}
          {links(diff.linksRemoved, '−').map((t) => (
            <li key={t} className="change__before">{t}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
