import { useMemo, useState, type ReactNode } from 'react'
import type { RevertPart } from '../../../shared/api'
import type { ItemDiff, Link, Schema } from '../../../shared/domain'
import { textRows, wordDiff, type Segment, type TextRow } from '../lib/textDiff'
import { linkName } from '../lib/schema'
import { T } from '../../../shared/text'

/**
 * What one change did to one item, GitHub style (owner's decision O-05): three blocks — Fields, Text, Links —
 * each with the old version on the left (red) and the new one on the right (green), changed words marked and
 * unchanged text lines folded. With `onRevert` (uncommitted changes only) every field row, the text and every
 * link get a ↶ arrow that takes back just that part. In a narrow column the old version sits above the new one.
 */
export function ChangeView(props: {
  schema: Schema
  diff: ItemDiff
  unreadable?: string | undefined
  onRevert?: (part: RevertPart) => void
  /** Why the arrows are disabled right now (unsaved edit, busy), or null. */
  revertLocked?: string | null
}) {
  const { schema, diff, unreadable, onRevert } = props
  const locked = props.revertLocked ?? null
  const sides = diff.kind === 'added' ? 'new' : diff.kind === 'deleted' ? 'old' : 'both'
  const canRevert = onRevert !== undefined && diff.kind === 'modified'
  const nothing = diff.rows.length === 0 && !diff.text && diff.linksAdded.length === 0 && diff.linksRemoved.length === 0
  const arrow = (label: string, part: RevertPart) =>
    canRevert ? (
      <button type="button" className="icon-btn icon-btn--small diff__revert" aria-label={T.change.revert(label)} title={locked ?? T.change.revertTooltip(label)} disabled={locked !== null} onClick={() => onRevert?.(part)}>
        ↶
      </button>
    ) : null

  return (
    <section className={`diff diff--${sides}`} aria-label={T.change.label}>
      <h4 className="links__title">{diff.kind === 'added' ? T.change.created : diff.kind === 'deleted' ? T.change.deleted : T.change.changed}</h4>
      {unreadable && <p className="notice notice--warn">{T.change.unreadable(unreadable)}</p>}
      {nothing && <p className="muted-inline">{T.change.nothing}</p>}

      {diff.rows.length > 0 && (
        <div className="diff__block" role="table" aria-label={T.change.fields}>
          <div className="diff__row diff__row--head" role="row">
            <span role="columnheader">{T.change.field}</span>
            {sides !== 'new' && <span role="columnheader">{T.change.before}</span>}
            {sides !== 'old' && <span role="columnheader">{sides === 'new' ? T.change.value : T.change.after}</span>}
            {canRevert && <span role="columnheader" />}
          </div>
          {diff.rows.map((r) => {
            const w = wordDiff(r.before, r.after)
            return (
              <div key={r.key} className="diff__row" role="row">
                <span className="diff__label" role="rowheader">{r.label}</span>
                {sides !== 'new' && <Cell segs={w.left} side="old" />}
                {sides !== 'old' && <Cell segs={w.right} side="new" />}
                {canRevert && <span role="cell">{arrow(r.label, { kind: 'row', key: r.key })}</span>}
              </div>
            )
          })}
        </div>
      )}

      {diff.text && <TextBlock before={diff.text.before} after={diff.text.after} sides={sides} arrow={arrow(T.change.text, { kind: 'text' })} />}

      {(diff.linksAdded.length > 0 || diff.linksRemoved.length > 0) && (
        <div className="diff__block" role="table" aria-label={T.change.links}>
          <div className="diff__row diff__row--head" role="row">
            <span role="columnheader">{T.change.links}</span>
            {sides !== 'new' && <span role="columnheader">{T.change.before}</span>}
            {sides !== 'old' && <span role="columnheader">{sides === 'new' ? T.change.value : T.change.after}</span>}
            {canRevert && <span role="columnheader" />}
          </div>
          {[...diff.linksRemoved.map((l) => ({ l, added: false })), ...diff.linksAdded.map((l) => ({ l, added: true }))].map(({ l, added }) => (
            <div key={`${added}-${l.type}-${l.target}`} className="diff__row" role="row">
              <span className="diff__label" role="rowheader">{added ? T.change.linkAdded : T.change.linkRemoved}</span>
              {sides !== 'new' && <Cell segs={added ? [] : [{ text: linkText(schema, l), mark: true }]} side="old" />}
              {sides !== 'old' && <Cell segs={added ? [{ text: linkText(schema, l), mark: true }] : []} side="new" />}
              {canRevert && <span role="cell">{arrow(linkText(schema, l), { kind: 'link', type: l.type, target: l.target })}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const linkText = (schema: Schema, l: Link): string => `${linkName(schema, l.type)} ${l.target}`

function Cell({ segs, side }: { segs: Segment[]; side: 'old' | 'new' }) {
  const empty = segs.every((s) => s.text === '')
  return (
    <span className={`diff__cell diff__cell--${side}${empty ? ' diff__cell--empty' : ''}`} role="cell">
      {empty ? '—' : segs.map((s, i) => (s.mark ? <mark key={i} className={`diff__mark diff__mark--${side}`}>{s.text}</mark> : <span key={i}>{s.text}</span>))}
    </span>
  )
}

function TextBlock({ before, after, sides, arrow }: { before: string; after: string; sides: 'old' | 'new' | 'both'; arrow: ReactNode }) {
  const rows = useMemo(() => textRows(sides === 'new' ? '' : before, sides === 'old' ? '' : after), [before, after, sides])
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set())
  const lines: ReactNode[] = []
  const line = (r: TextRow, key: string): ReactNode => {
    if (r.kind === 'fold') return null
    const left = r.kind === 'same' || r.kind === 'removed' ? [{ text: r.text, mark: r.kind === 'removed' }] : r.kind === 'change' ? r.left : null
    const right = r.kind === 'same' || r.kind === 'added' ? [{ text: r.text, mark: r.kind === 'added' }] : r.kind === 'change' ? r.right : null
    const changed = r.kind !== 'same'
    return (
      <div key={key} className={`diff__line diff__line--${r.kind}`} role="row">
        {sides !== 'new' && (
          <>
            <span className="diff__no" role="cell">{'leftNo' in r ? r.leftNo : ''}</span>
            <TextCell segs={left} side="old" changed={changed} />
          </>
        )}
        {sides !== 'old' && (
          <>
            <span className="diff__no" role="cell">{'rightNo' in r ? r.rightNo : ''}</span>
            <TextCell segs={right} side="new" changed={changed} />
          </>
        )}
      </div>
    )
  }
  rows.forEach((r, i) => {
    if (r.kind !== 'fold') lines.push(line(r, String(i)))
    else if (open.has(i)) r.rows.forEach((x, k) => lines.push(line(x, `${i}.${k}`)))
    else
      lines.push(
        <div key={i} className="diff__line diff__line--fold" role="row">
          <button type="button" className="link-btn diff__unfold" onClick={() => setOpen((s) => new Set(s).add(i))}>
            {T.change.unfold(r.count)}
          </button>
        </div>
      )
  })
  return (
    <div className="diff__block" role="table" aria-label={T.change.text}>
      <div className="diff__texthead">
        <span className="diff__label">{T.change.text}</span>
        {arrow}
      </div>
      <div className="diff__text">{lines}</div>
    </div>
  )
}

function TextCell({ segs, side, changed }: { segs: Segment[] | null; side: 'old' | 'new'; changed: boolean }) {
  if (segs === null) return <span className={`diff__src diff__src--${side} diff__src--blank`} role="cell" />
  return (
    <span className={`diff__src${changed ? ` diff__src--${side}` : ''}`} role="cell">
      {segs.map((s, i) => (s.mark ? <mark key={i} className={`diff__mark diff__mark--${side}`}>{s.text}</mark> : <span key={i}>{s.text}</span>))}
      {segs.every((s) => s.text === '') && ' '}
    </span>
  )
}
