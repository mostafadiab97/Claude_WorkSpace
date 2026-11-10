import { useState } from 'react'
import type { AppInfo, UpdateStatus } from '../../../shared/api'
import { T } from '../../../shared/text'

type List = { state: 'closed' } | { state: 'loading' } | { state: 'failed'; message: string } | { state: 'open'; versions: { version: string; date: string }[] }

/**
 * Settings → Versions (the owner, 3 Nov 2026): go back to an earlier published version when a new one causes trouble.
 * Automatic updates pause at that version until "Resume" — otherwise it would update itself straight back.
 */
export function VersionsCard({ appInfo, update }: { appInfo: AppInfo | null; update: UpdateStatus | null }) {
  const tx = T.settings.versions
  const [list, setList] = useState<List>({ state: 'closed' })
  const [pick, setPick] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const open = async (): Promise<void> => {
    setList({ state: 'loading' })
    setError(null)
    const r = await window.reqochet.listEarlierVersions()
    setList(r.ok ? { state: 'open', versions: r.versions } : { state: 'failed', message: r.message })
    setPick(r.ok ? (r.versions[0]?.version ?? null) : null)
  }
  const install = async (version: string): Promise<void> => {
    setBusy(version)
    const r = await window.reqochet.installEarlierVersion(version)
    if (!r.ok) {
      setBusy(null)
      // canceled: the user chose "Keep editing" in the unsaved-changes question — nothing to report (CR-15)
      if (!r.canceled) setError(r.message)
    }
  }

  return (
    <section className="card" aria-labelledby="versions-title">
      <h2 id="versions-title">{tx.title}</h2>
      <p className="hint hint--flush">
        {appInfo ? `${tx.current(appInfo.version)} ` : ''}
        {tx.intro}
      </p>
      {update?.state === 'held' && (
        <div className="notice" role="status">
          {tx.held(update.version)}{' '}
          <button type="button" className="btn btn--small" onClick={() => void window.reqochet.resumeUpdates()}>
            {tx.resume}
          </button>
        </div>
      )}
      {list.state === 'closed' && (
        <div className="actions">
          <button type="button" className="btn" onClick={() => void open()}>
            {tx.goBack}
          </button>
        </div>
      )}
      {list.state === 'loading' && <p className="muted-inline">{tx.loading}</p>}
      {list.state === 'failed' && <p className="notice notice--error">{list.message}</p>}
      {list.state === 'open' && list.versions.length === 0 && <p className="muted-inline">{tx.none}</p>}
      {list.state === 'open' && list.versions.length > 0 && (
        <fieldset className="versions">
          <legend>{tx.pick}</legend>
          {list.versions.map((v) => (
            <label key={v.version} className="check">
              <input type="radio" name="version" checked={pick === v.version} onChange={() => setPick(v.version)} />
              <span>
                {v.version} <span className="muted-inline">{v.date ? tx.released(new Date(v.date).toLocaleDateString()) : ''}</span>
              </span>
            </label>
          ))}
          <p className="hint hint--flush">{tx.warning}</p>
          <div className="actions">
            <button type="button" className="btn btn--primary" disabled={!pick || busy !== null} onClick={() => pick && void install(pick)}>
              {pick ? tx.install(pick) : tx.pick}
            </button>
            <button type="button" className="btn" disabled={busy !== null} onClick={() => setList({ state: 'closed' })}>
              {tx.cancel}
            </button>
          </div>
        </fieldset>
      )}
      {busy && <p className="notice" role="status">{tx.installing(busy)}</p>}
      {error && <p className="notice notice--error" role="alert">{error}</p>}
    </section>
  )
}
