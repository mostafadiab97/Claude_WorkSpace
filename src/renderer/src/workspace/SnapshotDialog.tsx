import { useEffect, useMemo, useState } from 'react'
import type { Snapshot } from '../../../shared/api'
import type { Schema } from '../../../shared/domain'
import { T } from '../../../shared/text'
import { errorMessage } from '../lib/hooks'
import { renderItemText } from '../lib/markdown'
import { fieldLabel, linkName, typeName } from '../lib/schema'

/** Outline numbers part by part ("1.10" after "1.9"); items without a number last. */
const byNumber = (a?: string, b?: string): number => {
  if (a === b) return 0
  if (a === undefined) return 1
  if (b === undefined) return -1
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? -1) !== (pb[i] ?? -1)) return (pa[i] ?? -1) - (pb[i] ?? -1)
  return 0
}

/**
 * An older version, to look at only (S-09: "open read-only"): every item as it was in that commit or baseline,
 * read from Git — the working folder and the table stay as they are.
 */
export function SnapshotDialog(props: { gitRef: string; schema: Schema; onClose: () => void }) {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    window.reqochet.getSnapshot(props.gitRef).then(
      (s) => live && setSnap(s),
      (e: unknown) => live && setError(errorMessage(e))
    )
    return () => {
      live = false
    }
  }, [props.gitRef])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        props.onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [props])

  const items = useMemo(() => {
    const all = [...(snap?.items ?? [])].sort((a, b) => (a.document < b.document ? -1 : a.document > b.document ? 1 : 0) || byNumber(a.number, b.number) || (a.id < b.id ? -1 : 1))
    const s = q.trim().toLowerCase()
    return s ? all.filter((i) => i.id.toLowerCase().includes(s) || i.title.toLowerCase().includes(s)) : all
  }, [snap, q])
  const item = snap?.items.find((i) => `${i.document}/${i.id}` === picked) ?? null

  return (
    <div className="modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="modal__panel snapshot" role="dialog" aria-modal="true" aria-label={snap ? T.baselines.snapshotTitle(snap.label) : T.baselines.loading}>
        <header className="modal__header">
          <div>
            <h2 className="modal__title">{snap ? T.baselines.snapshotTitle(snap.label) : T.baselines.loading}</h2>
            <p className="muted">{T.baselines.snapshotHint}</p>
          </div>
          <button type="button" className="icon-btn" aria-label={T.common.close} onClick={props.onClose}>
            ✕
          </button>
        </header>
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        <div className="snapshot__body">
          <div className="snapshot__list">
            <input className="input" type="search" autoFocus aria-label={T.baselines.snapshotSearch} placeholder={T.baselines.snapshotSearch} value={q} onChange={(e) => setQ(e.target.value)} />
            <p className="muted-inline">{T.baselines.snapshotCount(items.length)}</p>
            <ul className="scroll">
              {items.map((i) => (
                <li key={`${i.document}/${i.id}`}>
                  <button
                    type="button"
                    className={picked === `${i.document}/${i.id}` ? 'snapshot__row is-picked' : 'snapshot__row'}
                    aria-current={picked === `${i.document}/${i.id}` ? 'true' : undefined}
                    onClick={() => setPicked(`${i.document}/${i.id}`)}
                  >
                    <span className="snapshot__num">{i.number ?? ''}</span>
                    <span className="snapshot__title" dir="auto">
                      {i.title}
                    </span>
                    <span className="muted-inline">{i.document || T.documents.loose}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="snapshot__item scroll" aria-live="polite">
            {item ? (
              <>
                <h3 dir="auto">
                  {item.number ? `${item.number} ` : ''}
                  {item.title}
                </h3>
                <p className="muted-inline">
                  {item.id} · {typeName(props.schema, item.type)} · {item.document || T.documents.loose}
                </p>
                <dl className="snapshot__fields">
                  {props.schema.fields
                    .filter((f) => item.fields[f.id] !== undefined && item.fields[f.id] !== '')
                    .map((f) => (
                      <div key={f.id}>
                        <dt>{fieldLabel(f)}</dt>
                        <dd dir="auto">{Array.isArray(item.fields[f.id]) ? (item.fields[f.id] as string[]).join(', ') : String(item.fields[f.id])}</dd>
                      </div>
                    ))}
                </dl>
                <div className="snapshot__text" dir="auto" dangerouslySetInnerHTML={{ __html: renderItemText(item.text) }} />
                {item.links.length > 0 && (
                  <ul className="snapshot__links">
                    {item.links.map((l) => (
                      <li key={`${l.type}-${l.target}`}>
                        {linkName(props.schema, l.type)}: <code>{l.target}</code>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="muted">{T.baselines.snapshotPick}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
