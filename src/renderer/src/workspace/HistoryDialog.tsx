import { useCallback, useEffect, useState } from 'react'
import type { Baseline, GitResult, HistoryPage } from '../../../shared/api'
import { T } from '../../../shared/text'
import { errorMessage } from '../lib/hooks'
import { onTabListKeyDown } from '../lib/keys'

const when = (iso: string): string => iso.slice(0, 16).replace('T', ' ')

/**
 * History and baselines (1a part 2 — the owner's decisions S-06 a, S-08 a, S-09 a): the baselines of the repository
 * and the history of the current branch. An old commit is opened read-only, compared with now, made a baseline or a
 * branch is started there; the working folder never moves to an old commit.
 */
export function HistoryDialog(props: { onClose: () => void; onCompare: (ref: string) => void; onOpenSnapshot: (ref: string) => void; onResult: (r: GitResult) => void }) {
  const [tab, setTab] = useState<'baselines' | 'history'>('baselines')
  const [baselines, setBaselines] = useState<Baseline[] | null>(null)
  const [history, setHistory] = useState<HistoryPage | null>(null)
  const [search, setSearch] = useState('')
  const [asked, setAsked] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [note, setNoteMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // the "new baseline" form: at the latest commit (commit undefined) or at a commit from the history
  const [form, setForm] = useState<null | { commit?: string; name: string; note: string; ask?: boolean; commitMessage: string }>(null)
  const [branchAt, setBranchAt] = useState<null | { commit: string; name: string }>(null)

  const loadBaselines = useCallback(async () => {
    try {
      setBaselines(await window.reqochet.listBaselines())
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])
  const loadHistory = useCallback(async (q: string, skip: number) => {
    try {
      const page = await window.reqochet.getHistory({ ...(q ? { search: q } : {}), skip })
      setHistory((prev) => (skip > 0 && prev ? { commits: [...prev.commits, ...page.commits], more: page.more } : page))
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])
  useEffect(() => {
    let live = true
    window.reqochet.listBaselines().then(
      (b) => live && setBaselines(b),
      (e: unknown) => live && setError(errorMessage(e))
    )
    return () => {
      live = false
    }
  }, [])
  useEffect(() => {
    if (tab !== 'history') return
    let live = true
    window.reqochet.getHistory(asked ? { search: asked } : {}).then(
      (page) => live && setHistory(page),
      (e: unknown) => live && setError(errorMessage(e))
    )
    return () => {
      live = false
    }
  }, [tab, asked])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || busy) return
      if (form) setForm(null)
      else if (branchAt) setBranchAt(null)
      else props.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, props, form, branchAt])
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    return () => before?.focus?.()
  }, [])

  const create = async (uncommitted?: 'commit' | 'without'): Promise<void> => {
    if (!form) return
    setBusy(true)
    setError(null)
    try {
      const r = await window.reqochet.createBaseline({
        name: form.name,
        note: form.note,
        ...(form.commit ? { commit: form.commit } : {}),
        ...(uncommitted ? { uncommitted } : {}),
        ...(uncommitted === 'commit' && form.commitMessage.trim() ? { commitMessage: form.commitMessage } : {})
      })
      if (!r.ok && r.needs === 'uncommitted-decision') {
        setForm({ ...form, ask: true })
        setNoteMsg(r.message)
        return
      }
      props.onResult(r)
      if (!r.ok) return setError(r.message)
      setNoteMsg(r.message)
      setForm(null)
      setTab('baselines')
      await loadBaselines()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const makeBranch = async (): Promise<void> => {
    if (!branchAt) return
    setBusy(true)
    setError(null)
    try {
      const r = await window.reqochet.createBranchAt(branchAt.name, branchAt.commit)
      props.onResult(r)
      if (!r.ok) return setError(r.message)
      setNoteMsg(r.message)
      setBranchAt(null)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // each button names its commit or baseline for screen readers (UX18-04)
  const actions = (ref: string, what: string): React.ReactNode => (
    <span className="actions history__actions">
      <button type="button" className="btn btn--small" aria-label={T.baselines.openFor(what)} onClick={() => props.onOpenSnapshot(ref)}>
        {T.baselines.open}
      </button>
      <button type="button" className="btn btn--small" aria-label={T.baselines.compareFor(what)} onClick={() => props.onCompare(ref)}>
        {T.baselines.compare}
      </button>
    </span>
  )

  return (
    <div className="modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && !form && !branchAt && props.onClose()}>
      <div className="modal__panel history" role="dialog" aria-modal="true" aria-label={T.baselines.title}>
        <header className="modal__header">
          <h2 className="modal__title">{T.baselines.title}</h2>
          <button type="button" className="icon-btn" aria-label={T.common.close} onClick={props.onClose}>
            ✕
          </button>
        </header>
        <div className="history__tabs" role="tablist" onKeyDown={onTabListKeyDown}>
          {(['baselines', 'history'] as const).map((t) => (
            <button
              key={t}
              id={`history-tab-${t}`}
              type="button"
              role="tab"
              aria-selected={tab === t}
              aria-controls="history-panel"
              tabIndex={tab === t ? 0 : -1}
              autoFocus={t === 'baselines'}
              className={tab === t ? 'tab tab--active' : 'tab'}
              onClick={() => setTab(t)}
            >
              {t === 'baselines' ? T.baselines.tabBaselines : T.baselines.tabHistory}
            </button>
          ))}
        </div>
        <div className="modal__body scroll" id="history-panel" role="tabpanel" aria-labelledby={`history-tab-${tab}`}>
          {note && (
            <p className="notice" role="status">
              {note}
            </p>
          )}
          {error && (
            <p className="notice notice--error" role="alert">
              {error}
            </p>
          )}
          {form && (
            <form
              className="history__form card"
              onSubmit={(e) => {
                e.preventDefault()
                if (!form.ask) void create()
              }}
            >
              <p className="hint hint--flush">{form.commit ? T.baselines.atCommit(form.commit.slice(0, 7)) : T.baselines.atLatest}</p>
              <label className="field">
                <span>{T.baselines.name}</span>
                <input className="input" autoFocus value={form.name} placeholder={T.baselines.namePlaceholder} aria-describedby="baseline-name-rule" onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <small id="baseline-name-rule" className="muted">
                  {T.baselines.nameRule}
                </small>
              </label>
              <label className="field">
                <span>{T.baselines.note}</span>
                <textarea className="input" rows={2} value={form.note} placeholder={T.baselines.notePlaceholder} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </label>
              {form.ask ? (
                <div className="history__ask">
                  <label className="field">
                    <span>{T.baselines.commitMessageLabel}</span>
                    <input className="input" value={form.commitMessage} placeholder={T.baselines.commitMessage(form.name)} onChange={(e) => setForm({ ...form, commitMessage: e.target.value })} />
                  </label>
                  <div className="actions">
                    <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void create('commit')}>
                      {T.baselines.commitFirst}
                    </button>
                    <button type="button" className="btn" disabled={busy} onClick={() => void create('without')}>
                      {T.baselines.without}
                    </button>
                    <button type="button" className="btn" disabled={busy} onClick={() => setForm(null)}>
                      {T.common.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="actions">
                  <button type="submit" className="btn btn--primary" disabled={busy || !form.name.trim()}>
                    {T.baselines.create}
                  </button>
                  <button type="button" className="btn" disabled={busy} onClick={() => setForm(null)}>
                    {T.common.cancel}
                  </button>
                </div>
              )}
            </form>
          )}

          {tab === 'baselines' && (
            <>
              <p className="hint hint--flush">{T.baselines.intro}</p>
              {!form && (
                <button type="button" className="btn btn--primary" onClick={() => setForm({ name: '', note: '', commitMessage: '' })}>
                  {T.baselines.newBaseline}
                </button>
              )}
              {baselines && baselines.length === 0 && <p className="muted">{T.baselines.none}</p>}
              <ul className="history__list">
                {(baselines ?? []).map((b) => (
                  <li key={b.name} className="history__row">
                    <div className="history__main">
                      <strong>{b.name}</strong>
                      {b.refused && (
                        <span className="badge" title={T.baselines.refusedTooltip}>
                          {T.baselines.refused}
                        </span>
                      )}
                      {b.pending && (
                        <span className="badge" title={T.baselines.pendingTooltip}>
                          {T.baselines.pending}
                        </span>
                      )}
                      <span className="muted-inline">
                        {b.commit.slice(0, 7)} · {T.baselines.by(b.by, when(b.date))}
                      </span>
                      {b.note && <span className="history__note">{b.note}</span>}
                    </div>
                    {actions(b.commit, b.name)}
                  </li>
                ))}
              </ul>
            </>
          )}

          {tab === 'history' && (
            <>
              <form
                className="history__search"
                onSubmit={(e) => {
                  e.preventDefault()
                  setAsked(search.trim())
                }}
              >
                <input className="input" type="search" value={search} aria-label={T.baselines.search} placeholder={T.baselines.search} onChange={(e) => setSearch(e.target.value)} />
                <button type="submit" className="btn">
                  {T.baselines.searchButton}
                </button>
              </form>
              {history && history.commits.length === 0 && <p className="muted">{T.baselines.noCommits}</p>}
              <ul className="history__list">
                {(history?.commits ?? []).map((c) => (
                  <li key={c.hash} className="history__row">
                    <div className="history__main">
                      <code>{c.hash.slice(0, 7)}</code>
                      <span className="history__message">{c.message}</span>
                      <span className="muted-inline">{T.baselines.by(c.author, when(c.date))}</span>
                    </div>
                    <span className="actions history__actions">
                      {actions(c.hash, c.hash.slice(0, 7))}
                      <button type="button" className="btn btn--small" aria-label={T.baselines.baselineFor(c.hash.slice(0, 7))} onClick={() => setForm({ commit: c.hash, name: '', note: '', commitMessage: '' })}>
                        {T.baselines.makeBaseline}
                      </button>
                      <button type="button" className="btn btn--small" aria-label={T.baselines.branchFor(c.hash.slice(0, 7))} onClick={() => setBranchAt({ commit: c.hash, name: '' })}>
                        {T.baselines.branchHere}
                      </button>
                    </span>
                    {branchAt?.commit === c.hash && (
                      <form
                        className="history__branch"
                        onSubmit={(e) => {
                          e.preventDefault()
                          void makeBranch()
                        }}
                      >
                        <input className="input" autoFocus aria-label={T.baselines.branchName} placeholder={T.baselines.branchName} value={branchAt.name} onChange={(e) => setBranchAt({ ...branchAt, name: e.target.value })} />
                        <button type="submit" className="btn btn--small btn--primary" disabled={busy || !branchAt.name.trim()}>
                          {T.baselines.createBranch}
                        </button>
                        <button type="button" className="btn btn--small" onClick={() => setBranchAt(null)}>
                          {T.common.cancel}
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
              {history?.more && (
                <button type="button" className="btn" onClick={() => void loadHistory(asked, history.commits.length)}>
                  {T.baselines.more}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
