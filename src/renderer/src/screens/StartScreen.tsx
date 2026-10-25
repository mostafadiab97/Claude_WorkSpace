import { useEffect, useState } from 'react'
import type { FolderCheck, GitInfo, RecentRepository, RepoInfo } from '../../../shared/api'
import { errorMessage } from '../lib/hooks'

type Pending = { kind: 'idle' } | { kind: 'busy'; label: string } | { kind: 'confirm-init'; check: FolderCheck } | { kind: 'error'; message: string }

/** Opening screen: open or create a requirements repository, or reopen a recent one. */
export function StartScreen({ brand, git, onOpened }: { brand: string; git: GitInfo | null; onOpened: (info: RepoInfo) => void }) {
  const [recent, setRecent] = useState<RecentRepository[]>([])
  const [pending, setPending] = useState<Pending>({ kind: 'idle' })

  useEffect(() => {
    void window.reqman.getRecentRepositories().then(setRecent)
  }, [])

  const openPath = async (path: string): Promise<void> => {
    setPending({ kind: 'busy', label: 'Checking folder…' })
    try {
      const check = await window.reqman.checkFolder(path)
      if (check.state === 'missing') return setPending({ kind: 'error', message: `The folder ${path} no longer exists.` })
      if (check.state === 'not-initialized') return setPending({ kind: 'confirm-init', check })
      setPending({ kind: 'busy', label: 'Opening — the first time on this PC, every requirement file is indexed…' })
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
    setPending({ kind: 'busy', label: 'Creating requirements folder…' })
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
          <h1>Requirements, versioned like code.</h1>
          <p className="muted">
            {brand} turns a folder in your project&apos;s Git repository into a structured, linkable requirements
            database — no server, no accounts.
          </p>
          <button type="button" className="btn btn--primary" onClick={() => void choose()} disabled={busy}>
            Open repository…
          </button>
          {git && !git.installed && <p className="hint">Git is not installed; you can edit requirements, but not share them yet.</p>}
        </section>

        {pending.kind === 'busy' && <p className="notice">{pending.label}</p>}
        {pending.kind === 'error' && (
          <p className="notice notice--error" role="alert">
            {pending.message}
          </p>
        )}
        {pending.kind === 'confirm-init' && (
          <section className="card card--accent" aria-labelledby="init-title">
            <h2 id="init-title">No requirements folder yet</h2>
            <p>
              <code>{pending.check.root}</code> has no ReqMan requirements. Create a <code>requirements</code> folder
              there with the default item types, fields and link types?
            </p>
            {!pending.check.isGitRepository && (
              <p className="notice notice--warn">
                This folder is not a Git repository. ReqMan will work, but history, branches and sharing need Git —
                usually you would pick the folder of an existing project clone.
              </p>
            )}
            <div className="actions">
              <button type="button" className="btn btn--primary" onClick={() => void initialize(pending.check.root)}>
                Create requirements folder
              </button>
              <button type="button" className="btn" onClick={() => setPending({ kind: 'idle' })}>
                Cancel
              </button>
            </div>
          </section>
        )}

        <section className="card" aria-labelledby="recent-title">
          <h2 id="recent-title">Recent repositories</h2>
          {recent.length === 0 ? (
            <p className="muted muted--flush">Repositories you open appear here.</p>
          ) : (
            <ul className="recent">
              {recent.map((r) => (
                <li key={r.root} className="recent__row">
                  <button type="button" className="recent__open" onClick={() => void openPath(r.root)} disabled={busy}>
                    <span className="recent__name">{r.name}</span>
                    <span className="recent__path">{r.root}</span>
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Remove ${r.name} from the list`} title="Remove from list" onClick={() => void forget(r.root)}>
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
