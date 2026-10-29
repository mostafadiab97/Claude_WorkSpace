import { useState } from 'react'
import type { GitResult, MergeAnswers, MergeChoice, MergePart, MergePlan } from '../../../shared/api'
import { errorMessage } from '../lib/hooks'
import { decidedCount, isDecided } from './mergeAnswers'
import { T } from '../../../shared/text'

/**
 * A pull found items both sides changed in the same part (owner's decisions M8-3 / M8-7). Everything else was
 * combined automatically; here the user decides each highlighted part: keep yours, take theirs, or write the
 * value yourself. Nothing changes until "Finish the pull"; Cancel leaves everything as it was.
 */
export function MergeDialog(props: { plan: MergePlan; onDone: (r: GitResult | null) => void; onOpen: (id: string) => void }) {
  const { plan } = props
  const [answers, setAnswers] = useState<MergeAnswers>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const total = plan.questions.reduce((n, q) => n + q.parts.length, 0)
  const decided = decidedCount(plan, answers)

  const set = (path: string, key: string, c: MergeChoice | undefined): void =>
    setAnswers((a) => {
      const parts = { ...(a[path] ?? {}) }
      if (c === undefined) delete parts[key]
      else parts[key] = c
      return { ...a, [path]: parts }
    })
  const all = (c: 'mine' | 'theirs'): void => setAnswers(Object.fromEntries(plan.questions.map((q) => [q.path, Object.fromEntries(q.parts.map((p) => [p.key, c]))])))

  const finish = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const r = await window.reqman.finishPull(plan, answers)
      if (r.ok) props.onDone(r)
      else {
        setError(r.message)
        if (!r.plan) props.onDone(r) // the plan is stale (or something else failed): back to the Git bar
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal" role="presentation">
      <div className="modal__panel merge" role="dialog" aria-modal="true" aria-label={T.mergeDialog.title(plan.source)}>
        <header className="modal__header">
          <div>
            <h2 className="modal__title">{T.mergeDialog.title(plan.source)}</h2>
            <p className="muted">{T.mergeDialog.intro(plan.incoming, plan.combined.length, plan.questions.length)}</p>
            {plan.duplicates.length > 0 && <p className="muted">{T.mergeDialog.duplicates(plan.duplicates.map((d) => d.label).join(', '))}</p>}
          </div>
        </header>
        <div className="modal__body merge__body">
          {plan.questions.map((q) => (
            <section key={q.path} className="merge__item" aria-label={q.label}>
              <h3 className="merge__item-title">
                {q.id ? (
                  <button type="button" className="link-btn" onClick={() => q.id && props.onOpen(q.id)} title={T.mergeDialog.openTooltip}>
                    {q.label}
                  </button>
                ) : (
                  q.label
                )}
              </h3>
              {q.parts.map((p) => (
                <PartRow key={p.key} part={p} choice={answers[q.path]?.[p.key]} onChoose={(c) => set(q.path, p.key, c)} />
              ))}
            </section>
          ))}
          {error && <p className="notice notice--error" role="alert">{error}</p>}
        </div>
        <footer className="modal__footer actions actions--spread">
          <span className="actions">
            <button type="button" className="btn" disabled={busy} onClick={() => all('mine')}>
              {T.mergeDialog.allMine}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => all('theirs')}>
              {T.mergeDialog.allTheirs}
            </button>
          </span>
          <span className="actions">
            <span className="muted-inline" role="status">
              {T.mergeDialog.progress(decided, total)}
            </span>
            <button type="button" className="btn" disabled={busy} onClick={() => props.onDone(null)} title={T.mergeDialog.cancelTooltip}>
              {T.common.cancel}
            </button>
            <button type="button" className="btn btn--primary" disabled={busy || decided < total} onClick={() => void finish()}>
              {busy ? T.mergeDialog.finishing : T.mergeDialog.finish}
            </button>
          </span>
        </footer>
      </div>
    </div>
  )
}

function PartRow(props: { part: MergePart; choice: MergeChoice | undefined; onChoose: (c: MergeChoice | undefined) => void }) {
  const { part, choice } = props
  const editing = typeof choice === 'object'
  const cls = (on: boolean): string => (on ? 'btn btn--small btn--active' : 'btn btn--small')
  return (
    <div className={isDecided(choice) ? 'merge__part merge__part--done' : 'merge__part'} role="group" aria-label={T.mergeDialog.partLabel(part.label)}>
      <div className="merge__part-head">
        <strong>{part.label}</strong>
        {part.base && <span className="muted-inline">{T.mergeDialog.before(part.base)}</span>}
      </div>
      <div className="merge__sides">
        <div className={choice === 'mine' ? 'merge__side merge__side--picked' : 'merge__side'}>
          <span className="merge__who">{T.mergeDialog.yours}</span>
          <div className="merge__value">{part.mine || T.mergeDialog.empty}</div>
        </div>
        <div className={choice === 'theirs' ? 'merge__side merge__side--picked' : 'merge__side'}>
          <span className="merge__who">{T.mergeDialog.theirs}</span>
          <div className="merge__value">{part.theirs || T.mergeDialog.empty}</div>
        </div>
      </div>
      <div className="actions">
        <button type="button" className={cls(choice === 'mine')} aria-pressed={choice === 'mine'} onClick={() => props.onChoose(choice === 'mine' ? undefined : 'mine')}>
          {T.mergeDialog.keepYours}
        </button>
        <button type="button" className={cls(choice === 'theirs')} aria-pressed={choice === 'theirs'} onClick={() => props.onChoose(choice === 'theirs' ? undefined : 'theirs')}>
          {T.mergeDialog.takeTheirs}
        </button>
        {part.editable && (
          <button type="button" className={cls(editing)} aria-pressed={editing} onClick={() => props.onChoose(editing ? undefined : { edit: part.mine })}>
            {T.mergeDialog.edit}
          </button>
        )}
      </div>
      {editing && (
        <textarea
          className="input textarea merge__edit"
          rows={part.key === 'text' ? 6 : 2}
          aria-label={T.mergeDialog.editLabel(part.label)}
          value={choice.edit}
          onChange={(e) => props.onChoose({ edit: e.target.value })}
        />
      )}
    </div>
  )
}
