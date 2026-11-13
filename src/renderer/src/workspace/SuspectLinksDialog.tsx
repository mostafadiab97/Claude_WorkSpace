import { useState } from 'react'
import type { Item } from '../../../shared/domain'
import { textRows, wordDiff, type Segment, type TextRow } from '../lib/textDiff'
import { plainText } from '../lib/markdown'
import { linkName, typeName } from '../lib/schema'
import type { LinkDecision, LinkInfo } from '../../../shared/api'
import type { Schema } from '../../../shared/domain'
import { errorMessage } from '../lib/hooks'
import { T } from '../../../shared/text'
import { Chevron } from '../components/icons'

type Choice = 'keep' | 'unlink'

/**
 * After a save changed an item's type, title or text (the owner's decision O-04): the items that link to it may no
 * longer fit. For each link the user decides Keep (still holds — confirmed against the new version) or Unlink,
 * or all at once; "Decide later" leaves the ⚠ marks, to review with the "With suspect links" filter.
 * Not shown for changes that arrive by pull — those only mark links suspect.
 */
export function SuspectLinksDialog(props: {
  schema: Schema
  itemId: string
  incoming: LinkInfo[]
  /** The item before and after the save, to show what changed (UX-16). */
  before: Item
  after: Item
  onDone: (changed: boolean) => void
  onOpen: (id: string) => void
}) {
  const { schema, itemId, incoming } = props
  const [open, setOpen] = useState<ReadonlyMap<string, string | null>>(new Map())
  const toggle = (l: LinkInfo): void => {
    const k = key(l)
    if (open.has(k)) {
      setOpen((m) => {
        const next = new Map(m)
        next.delete(k)
        return next
      })
      return
    }
    setOpen((m) => new Map(m).set(k, null))
    void window.reqochet.getItem(l.id).then(
      (d) => setOpen((m) => (m.has(k) ? new Map(m).set(k, plainText(d?.item.text ?? '').slice(0, 400) || T.suspect.noText) : m)),
      () => setOpen((m) => (m.has(k) ? new Map(m).set(k, T.suspect.noText) : m))
    )
  }
  const [choice, setChoice] = useState<ReadonlyMap<string, Choice>>(new Map())
  const [askUnlinkAll, setAskUnlinkAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = (l: LinkInfo): string => `${l.id}\u0000${l.type}`
  const relation = (type: string): string => linkName(schema, type, true)

  const apply = async (decisions: LinkDecision[]): Promise<void> => {
    if (decisions.length === 0) return props.onDone(false)
    setBusy(true)
    setError(null)
    try {
      const r = await window.reqochet.decideLinks(decisions)
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
          <WhatChanged schema={schema} itemId={itemId} before={props.before} after={props.after} />
          <ul className="suspect__list" aria-label={T.suspect.list}>
            {incoming.map((l) => {
              const c = choice.get(key(l))
              return (
                <li key={key(l)} className="suspect__row">
                  <span className="muted-inline suspect__rel">{relation(l.type)}</span>
                  <button type="button" className="link-btn tree__id" onClick={() => props.onOpen(l.id)}>
                    {l.id}
                  </button>
                  <button type="button" className="link-btn suspect__name" dir="auto" aria-expanded={open.has(key(l))} title={T.suspect.showText} onClick={() => toggle(l)}>
                    <Chevron open={open.has(key(l))} /> {l.title || T.common.noTitle}
                  </button>
                  {/* UX-16: one segmented control per link; the chosen half is filled */}
                  <span className="choice-pair suspect__choice" role="group" aria-label={T.suspect.choiceFor(l.id)}>
                    <button type="button" className={c === 'keep' ? 'choice-pair__part choice-pair__part--keep' : 'choice-pair__part'} aria-pressed={c === 'keep'} onClick={() => set(l, 'keep')} title={T.suspect.keepTooltip}>
                      {T.suspect.keep}
                    </button>
                    <button type="button" className={c === 'unlink' ? 'choice-pair__part choice-pair__part--unlink' : 'choice-pair__part'} aria-pressed={c === 'unlink'} onClick={() => set(l, 'unlink')} title={T.suspect.unlinkTooltip(l.id)}>
                      {T.suspect.unlink}
                    </button>
                  </span>
                  {open.has(key(l)) && <p className="suspect__text muted">{open.get(key(l)) ?? T.common.ellipsis}</p>}
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
                <span className="muted-inline" role="status">
                  {T.mergeDialog.progress(choice.size, incoming.length)}
                </span>
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

/** What the save changed in the item: title and type in one line each, the text as a few changed lines (UX-16). */
function WhatChanged({ schema, itemId, before, after }: { schema: Schema; itemId: string; before: Item; after: Item }) {
  const [all, setAll] = useState(false)
  const lines = before.text === after.text ? [] : textRows(before.text, after.text, 0).filter((r): r is Exclude<TextRow, { kind: 'same' } | { kind: 'fold' }> => r.kind !== 'same' && r.kind !== 'fold')
  const shown = all ? lines : lines.slice(0, 6)
  const marks = (segs: Segment[], cls: string) =>
    segs.map((s, i) =>
      s.mark ? (
        <span key={i} className={cls}>
          {s.text}
        </span>
      ) : (
        <span key={i}>{s.text}</span>
      )
    )
  return (
    <section className="suspect__changed" aria-label={T.suspect.whatChanged(itemId)}>
      <h3 className="links__title">{T.suspect.whatChanged(itemId)}</h3>
      {before.title !== after.title && (
        <p className="suspect__line">
          <span className="muted-inline">{T.merge.title}</span> <del className="suspect__old">{marks(wordDiff(before.title, after.title).left, 'suspect__mark')}</del>{' '}
          <span aria-hidden="true">→</span> <ins className="suspect__new">{marks(wordDiff(before.title, after.title).right, 'suspect__mark')}</ins>
        </p>
      )}
      {before.type !== after.type && (
        <p className="suspect__line">
          <span className="muted-inline">{T.merge.type}</span> <del className="suspect__old">{typeName(schema, before.type)}</del> <span aria-hidden="true">→</span>{' '}
          <ins className="suspect__new">{typeName(schema, after.type)}</ins>
        </p>
      )}
      {shown.map((r, i) => (
        <p key={i} className="suspect__line">
          {r.kind !== 'added' && <del className="suspect__old">{r.kind === 'change' ? marks(r.left, 'suspect__mark') : r.text}</del>}
          {r.kind === 'change' && <span aria-hidden="true"> → </span>}
          {r.kind !== 'removed' && <ins className="suspect__new">{r.kind === 'change' ? marks(r.right, 'suspect__mark') : r.text}</ins>}
        </p>
      ))}
      {lines.length > 6 && !all && (
        <button type="button" className="link-btn" onClick={() => setAll(true)}>
          {T.suspect.showAll(lines.length)}
        </button>
      )}
    </section>
  )
}
