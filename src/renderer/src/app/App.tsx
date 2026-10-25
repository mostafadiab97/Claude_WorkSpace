import { useEffect, useState } from 'react'
import type { AppInfo, GitInfo, LoadedTheme, UpdateStatus } from '../../../shared/api'
import { applyTheme, loadSavedMode, saveMode, type ThemeMode } from '../theme/applyTheme'
import { ThemeToggle } from '../components/ThemeToggle'
import { StatusRow } from '../components/StatusRow'
import { DiagnosticsCard } from '../components/DiagnosticsCard'
import { UpdateBanner, describeUpdate } from '../components/UpdateBanner'

export function App() {
  const [theme, setTheme] = useState<LoadedTheme | null>(null)
  const [mode, setMode] = useState<ThemeMode>(loadSavedMode)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [git, setGit] = useState<GitInfo | null>(null)
  const [update, setUpdate] = useState<UpdateStatus | null>(null)

  useEffect(() => {
    void window.reqman.getTheme().then(setTheme)
    void window.reqman.getAppInfo().then(setAppInfo)
    void window.reqman.getGitInfo().then(setGit)
    void window.reqman.getUpdateStatus().then(setUpdate)
    return window.reqman.onUpdateStatus(setUpdate)
  }, [])

  // Re-apply tokens when the theme loads, the mode changes, or (in System mode) Windows switches light/dark.
  useEffect(() => {
    if (!theme) return
    applyTheme(theme.config, mode)
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => applyTheme(theme.config, 'system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme, mode])

  const changeMode = (m: ThemeMode): void => {
    setMode(m)
    saveMode(m)
  }

  if (!theme) return <div className="splash">Loading…</div>
  const brand = theme.config.brand.name

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          {theme.logoDataUrl && <img className="brand__logo" src={theme.logoDataUrl} alt="" />}
          <span className="brand__name">{brand}</span>
        </div>
        <ThemeToggle mode={mode} onChange={changeMode} />
      </header>
      <UpdateBanner status={update} />

      <main className="content">
        <section className="hero">
          <h1>Requirements, versioned like code.</h1>
          <p className="muted">
            {brand} turns a folder in your project&apos;s Git repository into a structured, linkable requirements
            database — no server, no accounts.
          </p>
          <button type="button" className="btn btn--primary" disabled title="Arrives in milestone M2">
            Open requirements repository…
          </button>
          <p className="hint">Opening a repository arrives in milestone M2.</p>
        </section>

        <section className="card" aria-labelledby="env-title">
          <h2 id="env-title">Environment</h2>
          {git === null ? (
            <StatusRow label="Git" tone="neutral">Checking…</StatusRow>
          ) : git.installed ? (
            <StatusRow label="Git" tone="ok">Installed — version {git.version}</StatusRow>
          ) : (
            <StatusRow label="Git" tone="error">
              {git.reason}{' '}
              <a href={git.downloadUrl} target="_blank" rel="noreferrer">
                Download Git for Windows
              </a>
            </StatusRow>
          )}
          <StatusRow label="Theme" tone={theme.warnings.length ? 'warn' : 'ok'}>
            {{ user: 'Your theme.json', file: 'App theme', default: 'Built-in default' }[theme.source]}
            {theme.warnings.length ? ` — ${theme.warnings.length} warning(s)` : ''}
          </StatusRow>
          <StatusRow
            label="Updates"
            tone={update?.state === 'error' ? 'warn' : update?.state === 'ready' || update?.state === 'up-to-date' ? 'ok' : 'neutral'}
          >
            {describeUpdate(update)}
          </StatusRow>
          <StatusRow label="App" tone="neutral">
            {appInfo ? `${brand} ${appInfo.version} · Electron ${appInfo.electronVersion} · ${appInfo.platform}` : '…'}
          </StatusRow>
          {theme.warnings.length > 0 && (
            <ul className="warnings">
              {theme.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </section>

        <DiagnosticsCard appInfo={appInfo} />
      </main>
    </div>
  )
}
