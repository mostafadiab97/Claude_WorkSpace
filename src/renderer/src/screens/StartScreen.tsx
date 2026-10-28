import { useEffect, useState } from 'react'
import type { FolderCheck, GitInfo, RecentRepository, RepoInfo } from '../../../shared/api'
import { errorMessage } from '../lib/hooks'
import { T } from '../../../shared/text'

type Pending = { kind: 'idle' } | { kind: 'busy'; label: string } | { kind: 'confirm-init'; check: FolderCheck } | { kind: 'error'; message: string }

/** Opening screen: open or create a requirements repository, or reopen a recent one. */
export function StartScreen({ brand, git, onOpened }: { brand: string; git: GitInfo | null; onOpened: (info: RepoInfo) => void }) {
  const [recent, setRecent] = useState<RecentRepository[]>([])
  const [pending, setPending] = useState<Pending>({ kind: 'idle' })

  useEffect(() => {
    void window.reqman.getRecentRepositories().then(setRecent)
  }, [])

  const openPath = async (path: string): Promise<void> => {
    setPending({ kind: 'busy', label: T.start.checkingFolder })
    try {
      const check = await window.reqman.checkFolder(path)
      if (check.state === 'missing') return setPending({ kind: 'error', message: T.start.missing(path) })
      if (check.state === 'not-initialized') return setPending({ kind: 'confirm-init', check })
      setPending({ kind: 'busy', label: T.start.opening })
      onOpened(await window.reqman.openRepository(check.root))
    } catch (e) {
      setPending({ kind: 'error', message: errorMessage(e) })
    }
  }

  const choose = async (): Promise<void> => {
    const path = await window.reqman.pickFolder()
    if (path) await openPath(path)
  }

  const initialize = async (root: string): Promise<void> => {
    setPending({ kind: 'busy', label: T.start.creating })
    try {
      onOpened(await window.reqman.initializeRepository(root))
    } catch (e) {
      setPending({ kind: 'error', message: errorMessage(e) })
    }
  }

  const forget = async (root: string): Promise<void> => {
    await window.reqman.forgetRecentRepository(root)
    setRecent(await window.reqman.getRecentRepositories())
  }

  const busy = pending.kind === 'busy'
  return (
    <div className="page">
      <div className="page__inner">
        <section className="hero">
          <h1>{T.start.headline}</h1>
          <p className="muted">{T.start.intro(brand)}</p>
          <button type="button" className="btn btn--primary" onClick={() => void choose()} disabled={busy}>
            {T.start.open}
          </button>
          {git && !git.installed && <p className="hint">{T.start.noGit}</p>}
        </section>

        {pending.kind === 'busy' && <p className="notice">{pending.label}</p>}
        {pending.kind === 'error' && (
          <p className="notice notice--error" role="alert">
            {pending.message}
          </p>
        )}
        {pending.kind === 'confirm-init' && (
          <section className="card card--accent" aria-labelledby="init-title">
            <h2 id="init-title">{T.start.initTitle}</h2>
            <p>
              {T.start.initBefore}<code>{pending.check.root}</code>{T.start.initAfter}
            </p>
            {!pending.check.isGitRepository && (
              <p className="notice notice--warn">{T.start.notGit}</p>
            )}
            <div className="actions">
              <button type="button" className="btn btn--primary" onClick={() => void initialize(pending.check.root)}>
                {T.start.create}
              </button>
              <button type="button" className="btn" onClick={() => setPending({ kind: 'idle' })}>
                {T.common.cancel}
              </button>
            </div>
          </section>
        )}

        <section className="card" aria-labelledby="recent-title">
          <h2 id="recent-title">{T.start.recentTitle}</h2>
          {recent.length === 0 ? (
            <p className="muted muted--flush">{T.start.recentEmpty}</p>
          ) : (
            <ul className="recent">
              {recent.map((r) => (
                <li key={r.root} className="recent__row">
                  <button type="button" className="recent__open" onClick={() => void openPath(r.root)} disabled={busy}>
                    <span className="recent__name">{r.name}</span>
                    <span className="recent__path">{r.root}</span>
                  </button>
                  <button type="button" className="icon-btn" aria-label={T.start.forget(r.name)} title={T.start.forgetTooltip} onClick={() => void forget(r.root)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
