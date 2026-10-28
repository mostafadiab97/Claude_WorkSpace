import { useState } from 'react'
import type { LinkDecision, LinkInfo } from '../../../shared/api'
import type { Schema } from '../../../shared/domain'
import { errorMessage } from '../lib/hooks'
import { T } from '../../../shared/text'

type Choice = 'keep' | 'unlink'

/**
 * After a save changed an item's type, title or text (owner's decision O-04): the items that link to it may no
 * longer fit. For each link the user decides Keep (still holds — confirmed against the new version) or Unlink,
 * or all at once; "Decide later" leaves the ⚠ marks, to review with the "With suspect links" filter.
 * Not shown for changes that arrive by pull — those only mark links suspect.
 */
export function SuspectLinksDialog(props: { schema: Schema; itemId: string; incoming: LinkInfo[]; onDone: (changed: boolean) => void; onOpen: (id: string) => void }) {
  const { schema, itemId, incoming } = props
  const [choice, setChoice] = useState<ReadonlyMap<string, Choice>>(new Map())
  const [askUnlinkAll, setAskUnlinkAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = (l: LinkInfo): string => `${l.id}\u0000${l.type}`
  const relation = (type: string): string => schema.linkTypes.find((t) => t.id === type)?.reverseName ?? type

  const apply = async (decisions: LinkDecision[]): Promise<void> => {
    if (decisions.length === 0) return props.onDone(false)
    setBusy(true)
    setError(null)
    try {
      const r = await window.reqman.decideLinks(decisions)
      if (r.ok) props.onDone(true)
      else setError(r.message)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const all = (keep: boolean): LinkDecision[] => incoming.map((l) => ({ source: l.id, type: l.type, target: itemId, keep }))
  const chosen = (): LinkDecision[] =>
    incoming.filter((l) => choice.has(key(l))).map((l) => ({ source: l.id, type: l.type, target: itemId, keep: choice.get(key(l)) === 'keep' }))
  const set = (l: LinkInfo, c: Choice): void =>
    setChoice((m) => {
      const next = new Map(m)
      if (next.get(key(l)) === c) next.delete(key(l))
      else next.set(key(l), c)
      return next
    })

  return (
    <div className="modal" role="presentation">
      <div className="modal__panel modal__panel--narrow" role="dialog" aria-modal="true" aria-label={T.suspect.title}>
        <header className="modal__header">
          <div>
            <h2 className="modal__title">{T.suspect.title}</h2>
            <p className="muted">{T.suspect.intro(itemId, incoming.length)}</p>
          </div>
        </header>
        <div className="modal__body">
          <ul className="suspect__list" aria-label={T.suspect.list}>
            {incoming.map((l) => {
              const c = choice.get(key(l))
              return (
                <li key={key(l)} className="suspect__row">
                  <span className="muted-inline suspect__rel">{relation(l.type)}</span>
                  <button type="button" className="link-btn tree__id" onClick={() => props.onOpen(l.id)}>
                    {l.id}
                  </button>
                  <span className="suspect__name">{l.title || T.common.noTitle}</span>
                  <span className="actions suspect__choice" role="group" aria-label={T.suspect.choiceFor(l.id)}>
                    <button type="button" className={c === 'keep' ? 'btn btn--small btn--active' : 'btn btn--small'} aria-pressed={c === 'keep'} onClick={() => set(l, 'keep')} title={T.suspect.keepTooltip}>
                      {T.suspect.keep}
                    </button>
                    <button type="button" className={c === 'unlink' ? 'btn btn--small btn--active btn--danger' : 'btn btn--small'} aria-pressed={c === 'unlink'} onClick={() => set(l, 'unlink')} title={T.suspect.unlinkTooltip(l.id)}>
                      {T.suspect.unlink}
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
          {error && <p className="notice notice--error" role="alert">{error}</p>}
        </div>
        <footer className="modal__footer actions actions--spread">
          {askUnlinkAll ? (
            <span className="actions">
              <span>{T.suspect.unlinkAllAsk(incoming.length)}</span>
              <button type="button" className="btn btn--danger" disabled={busy} onClick={() => void apply(all(false))}>
                {T.suspect.unlinkAll}
              </button>
              <button type="button" className="btn" onClick={() => setAskUnlinkAll(false)}>
                {T.suspect.back}
              </button>
            </span>
          ) : (
            <>
              <span className="actions">
                <button type="button" className="btn" disabled={busy} onClick={() => void apply(all(true))}>
                  {T.suspect.keepAll}
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => setAskUnlinkAll(true)}>
                  {T.suspect.unlinkAll}
                </button>
              </span>
              <span className="actions">
                <button type="button" className="btn" disabled={busy} onClick={() => props.onDone(false)} title={T.suspect.laterTooltip}>
                  {T.suspect.later}
                </button>
                <button type="button" className="btn btn--primary" disabled={busy || choice.size === 0} onClick={() => void apply(chosen())}>
                  {T.suspect.apply(choice.size)}
                </button>
              </span>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}
