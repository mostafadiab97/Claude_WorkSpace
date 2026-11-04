import { BrandFace, BrandLoading, BrandName, type Mode } from '../components/Brand'
import { beginActivity, useActivity, useWindowActive } from '../lib/activity'
import { useEffect, useState } from 'react'
import type { FolderCheck, GitInfo, RecentRepository, RepoInfo, ImportFile } from '../../../shared/api'
import { errorMessage } from '../lib/hooks'
import { T } from '../../../shared/text'

type Pending = { kind: 'idle' } | { kind: 'busy'; label: string } | { kind: 'confirm-init'; check: FolderCheck } | { kind: 'error'; message: string }

/** Opening screen: open or create a requirements repository, or reopen a recent one. */
export function StartScreen({
  brand,
  git,
  onOpened,
  onQuickStart,
  mode,
  showBrand
}: {
  brand: string
  git: GitInfo | null
  onOpened: (info: RepoInfo, importFile?: ImportFile) => void
  onQuickStart: () => void
  /** Light or dark as shown now (picks the brand files). */
  mode: Mode
  /** False when a company theme brings its own logo. */
  showBrand: boolean
}) {
  const [recent, setRecent] = useState<RecentRepository[]>([])
  const [pending, setPending] = useState<Pending>({ kind: 'idle' })

  useEffect(() => {
    void window.reqochet.getRecentRepositories().then(setRecent)
  }, [])

  const openPath = async (path: string): Promise<void> => {
    setPending({ kind: 'busy', label: T.start.checkingFolder })
    try {
      const check = await window.reqochet.checkFolder(path)
      if (check.state === 'missing') return setPending({ kind: 'error', message: T.start.missing(path) })
      if (check.state === 'not-initialized') return setPending({ kind: 'confirm-init', check })
      setPending({ kind: 'busy', label: T.start.opening })
      onOpened(await window.reqochet.openRepository(check.root))
    } catch (e) {
      setPending({ kind: 'error', message: errorMessage(e) })
    }
  }

  const choose = async (): Promise<void> => {
    const path = await window.reqochet.pickFolder()
    if (path) await openPath(path)
  }

  const initialize = async (root: string): Promise<void> => {
    setPending({ kind: 'busy', label: T.start.creating })
    try {
      onOpened(await window.reqochet.initializeRepository(root))
    } catch (e) {
      setPending({ kind: 'error', message: errorMessage(e) })
    }
  }

  // M7: choose an Excel/CSV file and an empty folder; ReqMan makes the Git repository and opens the import wizard
  const fromFile = async (): Promise<void> => {
    setPending({ kind: 'busy', label: T.start.creating })
    try {
      const r = await window.reqochet.newProjectFromFile()
      if (r.ok) onOpened(r.info, r.file)
      else setPending(r.canceled ? { kind: 'idle' } : { kind: 'error', message: r.message })
    } catch (e) {
      setPending({ kind: 'error', message: errorMessage(e) })
    }
  }

  const forget = async (root: string): Promise<void> => {
    await window.reqochet.forgetRecentRepository(root)
    setRecent(await window.reqochet.getRecentRepositories())
  }

  const busy = pending.kind === 'busy'
  const working = useActivity()
  const active = useWindowActive()
  // opening or creating a repository counts as "the app is working": the eyes look busy (R-08)
  useEffect(() => (busy ? beginActivity() : undefined), [busy])
  return (
    <div className="page">
      <div className="page__inner">
        <section className="hero">
          {/* while a repository opens only the loading animation moves (BR-01, UX16-09); smaller once there are
              recent repositories to reach (UX16-12) */}
          {showBrand && !busy && (
            <div className="hero__brand">
              <BrandFace mode={mode} state={!active ? 'still' : working ? 'thinking' : 'idle'} size={recent.length > 0 ? 64 : 88} />
              <BrandName mode={mode} width={recent.length > 0 ? 200 : 264} />
            </div>
          )}
          <h1>{T.start.headline}</h1>
          <p className="muted">{T.start.intro(brand)}</p>
          <span className="actions">
            <button type="button" className="btn btn--primary" onClick={() => void choose()} disabled={busy}>
              {T.start.open}
            </button>
            <button type="button" className="btn" onClick={() => void fromFile()} disabled={busy} title={T.start.fromFileTooltip}>
              {T.start.fromFile}
            </button>
            <button type="button" className="link-btn" onClick={onQuickStart}>
              {T.start.quickStart}
            </button>
          </span>
          {/* UX-24: the Git check right where the first step happens */}
          {git && !git.installed && <p className="hint notice--warn">{T.start.noGit}</p>}
          {git?.installed && <p className="hint start__git">{T.start.gitFound(git.version)}</p>}
        </section>

        {pending.kind === 'busy' &&
          (showBrand ? (
            <div className="start-opening">
              <BrandLoading mode={mode} width={260} label={pending.label} />
            </div>
          ) : (
            <p className="notice">{pending.label}</p>
          ))}
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
