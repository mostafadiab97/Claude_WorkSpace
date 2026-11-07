import { BrandFace, BrandLoading, BrandName } from '../components/Brand'
import { useActivity, useWindowActive } from '../lib/activity'
import { QUICK_START_PAGE, SHORTCUTS_PAGE } from '../../../shared/guide'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppInfo, GitInfo, LoadedTheme, RepoInfo, UpdateStatus, ImportFile } from '../../../shared/api'
import { applyTheme, loadSavedMode, resolveMode, saveMode, useEffectiveMode, type ThemeMode } from '../theme/applyTheme'
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

/** One loop of the brand's loading animation (brand-tokens.json motion.loading.loopSeconds). */
const SPLASH_MIN_MS = 1400

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
  // Settings may open straight on a user-guide page (start screen → "Read the quick start", UX-24)
  const [settingsStart, setSettingsStart] = useState<string | undefined>(undefined)
  /** Where the workspace puts its Git controls: inside the top bar (0.13.0 — one bar less). */
  const [gitSlot, setGitSlot] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    // the loading animation plays at least one loop (1.4 s) so it can be seen (owner, 0.16.0 step 3)
    const shown = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : SPLASH_MIN_MS
    const minimum = new Promise((done) => setTimeout(done, shown))
    void Promise.all([window.reqochet.getTheme(), minimum]).then(([loaded]) => setTheme(loaded))
    void window.reqochet.getAppInfo().then(setAppInfo)
    void window.reqochet.getGitInfo().then(setGit)
    void window.reqochet.getUpdateStatus().then(setUpdate)
    return window.reqochet.onUpdateStatus(setUpdate)
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
    const name = theme?.config.brand.name || T.brand.name
    document.title = repo ? `${repo.name} — ${name}` : name
  }, [repo, theme, lang])
  const effective = useEffectiveMode(mode)
  const working = useActivity()
  const active = useWindowActive()

  const changeMode = (m: ThemeMode): void => {
    setMode(m)
    saveMode(m)
  }
  const changeLanguage = (l: Language): void => {
    applyLanguage(l)
    setLang(l) // everything re-renders with the new texts; nothing is remounted, so unsaved edits stay
  }
  const onInfo = useCallback((i: RepoInfo) => setRepo(i), [])
  // the ✕ beside the project name: unsaved edits are asked about first, and it waits for a running pull/push (CR2-01)
  const leaveGuard = useRef<((leave: () => void) => void) | null>(null)
  const [gitBusy, setGitBusy] = useState(false)
  const onLeaveGuard = useCallback((g: ((leave: () => void) => void) | null) => {
    leaveGuard.current = g
  }, [])
  const close = (): void => {
    const leave = (): void =>
      void window.reqochet.closeRepository().then(() => {
        setRepo(null)
        setGitBusy(false)
      })
    if (leaveGuard.current) leaveGuard.current(leave)
    else leave()
  }

  // the loading animation while the app starts (before the theme is known: the Windows colour mode decides)
  if (!theme) return <div className="splash"><BrandLoading mode={resolveMode(mode)} width={320} label={T.common.loading} /></div>
  const brand = theme.config.brand.name || T.brand.name

  return (
    <LanguageContext.Provider value={lang}>
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          {/* a company theme may bring its own logo and name; otherwise the reqochet face and name (R-03, R-08) */}
          {theme.logoDataUrl ? (
            <>
              <img className="brand__logo" src={theme.logoDataUrl} alt="" />
              <span className="brand__name">{brand}</span>
            </>
          ) : (
            <>
              <BrandFace mode={effective} state={!active ? 'still' : working ? 'thinking' : 'idle'} size={28} />
              <BrandName mode={effective} width={112} />
              {/* the development tool (reqochet-dev) wears a small mark, so the owner always knows which one is open */}
              {appInfo?.name.endsWith('-dev') && <span className="brand__edition">{T.brand.dev}</span>}
            </>
          )}
          {repo && !showSettings && (
            <>
              <span className="topbar__sep" aria-hidden="true">/</span>
              <span className="topbar__repo" title={repo.root}>{repo.name}</span>
              <button type="button" className="icon-btn icon-btn--small" aria-label={T.app.closeRepository} title={T.app.closeRepository} disabled={gitBusy} onClick={close}>
                ✕
              </button>
            </>
          )}
        </div>
        <div className="topbar__git" ref={setGitSlot} hidden={!repo || showSettings} />
        <div className="topbar__right">
          {/* UX-13: language and colours are on the start screen and in Settings → Appearance, not beside daily Git work */}
          {!repo && !showSettings && (
            <>
              <LanguageToggle lang={lang} onChange={changeLanguage} />
              <ThemeToggle mode={mode} onChange={changeMode} />
            </>
          )}
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
              <WorkspaceScreen
                info={repo}
                onInfo={onInfo}
                importFile={pendingImport}
                gitSlot={gitSlot}
                onShortcuts={() => {
                  setSettingsStart(SHORTCUTS_PAGE)
                  setShowSettings(true)
                }}
                onLeaveGuard={onLeaveGuard}
                onQuickStart={() => {
                  setSettingsStart(QUICK_START_PAGE)
                  setShowSettings(true)
                }}
                onGitBusy={setGitBusy}
              />
            </ErrorBoundary>
          </div>
        )}
        {showSettings && (
          <ErrorBoundary area={T.app.settingsArea}>
            <SettingsScreen
              theme={theme}
              git={git}
              update={update}
              appInfo={appInfo}
              startGuidePage={settingsStart}
              appearance={
                <>
                  {/* each switch with its name (UXN-08) */}
                  <div className="field">
                    <span className="field__label">{T.app.language.label}</span>
                    <LanguageToggle lang={lang} onChange={changeLanguage} />
                  </div>
                  <div className="field">
                    <span className="field__label">{T.app.theme.label}</span>
                    <ThemeToggle mode={mode} onChange={changeMode} />
                  </div>
                </>
              }
              onBack={() => {
                setShowSettings(false)
                setSettingsStart(undefined)
              }}
            />
          </ErrorBoundary>
        )}
        {!repo && !showSettings && (
          <StartScreen
            brand={brand}
            mode={effective}
            showBrand={!theme.logoDataUrl}
            git={git}
            onQuickStart={() => {
              setSettingsStart(QUICK_START_PAGE)
              setShowSettings(true)
            }}
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
