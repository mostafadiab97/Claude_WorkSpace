import { useCallback, useEffect, useState } from 'react'
import type { AppInfo, GitInfo, LoadedTheme, RepoInfo, UpdateStatus } from '../../../shared/api'
import { applyTheme, loadSavedMode, saveMode, type ThemeMode } from '../theme/applyTheme'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { ThemeToggle } from '../components/ThemeToggle'
import { UpdateBanner } from '../components/UpdateBanner'
import { StartScreen } from '../screens/StartScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { WorkspaceScreen } from '../screens/WorkspaceScreen'

export function App() {
  const [theme, setTheme] = useState<LoadedTheme | null>(null)
  const [mode, setMode] = useState<ThemeMode>(loadSavedMode)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [git, setGit] = useState<GitInfo | null>(null)
  const [update, setUpdate] = useState<UpdateStatus | null>(null)
  const [repo, setRepo] = useState<RepoInfo | null>(null)
  const [showSettings, setShowSettings] = useState(false)

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

  useEffect(() => {
    document.title = repo ? `${repo.name} — ${theme?.config.brand.name ?? 'ReqMan'}` : (theme?.config.brand.name ?? 'ReqMan')
  }, [repo, theme])

  const changeMode = (m: ThemeMode): void => {
    setMode(m)
    saveMode(m)
  }
  const onInfo = useCallback((i: RepoInfo) => setRepo(i), [])
  const close = async (): Promise<void> => {
    await window.reqman.closeRepository()
    setRepo(null)
  }

  if (!theme) return <div className="splash">Loading…</div>
  const brand = theme.config.brand.name

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          {theme.logoDataUrl && <img className="brand__logo" src={theme.logoDataUrl} alt="" />}
          <span className="brand__name">{brand}</span>
          {repo && !showSettings && (
            <>
              <span className="topbar__sep" aria-hidden="true">/</span>
              <span className="topbar__repo" title={repo.root}>{repo.name}</span>
              <button type="button" className="btn btn--small" onClick={() => void close()}>
                Close repository
              </button>
            </>
          )}
        </div>
        <div className="topbar__right">
          <ThemeToggle mode={mode} onChange={changeMode} />
          <button
            type="button"
            className={showSettings ? 'icon-btn icon-btn--active' : 'icon-btn'}
            aria-label="Settings and diagnostics"
            title="Settings & diagnostics"
            onClick={() => setShowSettings((s) => !s)}
          >
            ⚙
          </button>
        </div>
      </header>
      <UpdateBanner status={update} />

      <main className="main">
        {/* The workspace stays mounted while settings are shown, so unsaved edits are not lost. */}
        {repo && (
          <div className="main__view" hidden={showSettings}>
            <ErrorBoundary area="the workspace" key={repo.root}>
              <WorkspaceScreen info={repo} onInfo={onInfo} />
            </ErrorBoundary>
          </div>
        )}
        {showSettings && (
          <ErrorBoundary area="settings">
            <SettingsScreen theme={theme} git={git} update={update} appInfo={appInfo} onBack={() => setShowSettings(false)} />
          </ErrorBoundary>
        )}
        {!repo && !showSettings && <StartScreen brand={brand} git={git} onOpened={setRepo} />}
      </main>
    </div>
  )
}
