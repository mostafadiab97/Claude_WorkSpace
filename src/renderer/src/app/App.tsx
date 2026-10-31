import { useCallback, useEffect, useState } from 'react'
import type { AppInfo, GitInfo, LoadedTheme, RepoInfo, UpdateStatus, ImportFile } from '../../../shared/api'
import { applyTheme, loadSavedMode, saveMode, type ThemeMode } from '../theme/applyTheme'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { ThemeToggle } from '../components/ThemeToggle'
import { LanguageToggle } from '../components/LanguageToggle'
import { applyLanguage, LanguageContext, loadSavedLanguage } from '../lib/language'
import type { Language } from '../../../shared/text'
import { UpdateBanner } from '../components/UpdateBanner'
import { StartScreen } from '../screens/StartScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { WorkspaceScreen } from '../screens/WorkspaceScreen'
import { T } from '../../../shared/text'

export function App() {
  const [theme, setTheme] = useState<LoadedTheme | null>(null)
  const [mode, setMode] = useState<ThemeMode>(loadSavedMode)
  // the saved language is applied once, before the first render (texts and direction)
  const [lang, setLang] = useState<Language>(() => {
    const l = loadSavedLanguage()
    applyLanguage(l)
    return l
  })
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [git, setGit] = useState<GitInfo | null>(null)
  const [update, setUpdate] = useState<UpdateStatus | null>(null)
  const [repo, setRepo] = useState<RepoInfo | null>(null)
  /** "New project from a file": the file the new workspace opens the import wizard with. */
  const [pendingImport, setPendingImport] = useState<ImportFile | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  /** Where the workspace puts its Git controls: inside the top bar (0.13.0 — one bar less). */
  const [gitSlot, setGitSlot] = useState<HTMLDivElement | null>(null)

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
  const changeLanguage = (l: Language): void => {
    applyLanguage(l)
    setLang(l) // everything re-renders with the new texts; nothing is remounted, so unsaved edits stay
  }
  const onInfo = useCallback((i: RepoInfo) => setRepo(i), [])
  const close = async (): Promise<void> => {
    await window.reqman.closeRepository()
    setRepo(null)
  }

  if (!theme) return <div className="splash">{T.common.loading}</div>
  const brand = theme.config.brand.name

  return (
    <LanguageContext.Provider value={lang}>
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          {theme.logoDataUrl && <img className="brand__logo" src={theme.logoDataUrl} alt="" />}
          <span className="brand__name">{brand}</span>
          {repo && !showSettings && (
            <>
              <span className="topbar__sep" aria-hidden="true">/</span>
              <span className="topbar__repo" title={repo.root}>{repo.name}</span>
              <button type="button" className="icon-btn icon-btn--small" aria-label={T.app.closeRepository} title={T.app.closeRepository} onClick={() => void close()}>
                ✕
              </button>
            </>
          )}
        </div>
        <div className="topbar__git" ref={setGitSlot} hidden={!repo || showSettings} />
        <div className="topbar__right">
          <LanguageToggle lang={lang} onChange={changeLanguage} />
          <ThemeToggle mode={mode} onChange={changeMode} />
          <button
            type="button"
            className={showSettings ? 'icon-btn icon-btn--active' : 'icon-btn'}
            aria-label={T.app.settings}
            title={T.app.settingsTooltip}
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
            <ErrorBoundary area={T.app.workspaceArea} key={repo.root}>
              <WorkspaceScreen info={repo} onInfo={onInfo} importFile={pendingImport} gitSlot={gitSlot} />
            </ErrorBoundary>
          </div>
        )}
        {showSettings && (
          <ErrorBoundary area={T.app.settingsArea}>
            <SettingsScreen theme={theme} git={git} update={update} appInfo={appInfo} onBack={() => setShowSettings(false)} />
          </ErrorBoundary>
        )}
        {!repo && !showSettings && (
          <StartScreen
            brand={brand}
            git={git}
            onOpened={(info, file) => {
              setPendingImport(file ?? null)
              setRepo(info)
            }}
          />
        )}
      </main>
    </div>
    </LanguageContext.Provider>
  )
}
