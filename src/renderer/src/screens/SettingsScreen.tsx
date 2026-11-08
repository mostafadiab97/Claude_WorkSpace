import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppInfo, GitInfo, LoadedTheme, UpdateStatus } from '../../../shared/api'
import { DiagnosticsCard } from '../components/DiagnosticsCard'
import { EnvironmentCard } from '../components/EnvironmentCard'
import { FeaturesCard } from '../components/FeaturesCard'
import { ProblemReportCard } from '../components/ProblemReportCard'
import { ReleaseSelfTestCard } from '../components/ReleaseSelfTestCard'
import { SelfTestCard } from '../components/SelfTestCard'
import { VersionsCard } from '../components/VersionsCard'
import { guidePages } from '../lib/guide'
import { useLanguage } from '../lib/language'
import { T } from '../../../shared/text'

type SettingsPage = 'env' | 'appearance' | 'report' | 'features' | 'tests' | 'privacy'
type View = { kind: 'settings'; page: SettingsPage } | { kind: 'guide'; page: string; anchor?: string }

/**
 * Settings and help (the owner on 0.14.1 step 4 and 0.14.2 step 2): a left panel (its own shade, Back on top) that
 * switches between pages — related settings grouped on one page, and the user guide one section per page.
 */
export function SettingsScreen(props: {
  theme: LoadedTheme
  git: GitInfo | null
  update: UpdateStatus | null
  appInfo: AppInfo | null
  onBack: () => void
  /** The language and colour switches (UX-13: Settings → Appearance). */
  appearance: ReactNode
  /** Open straight on this user-guide page (start screen → quick start). */
  startGuidePage?: string
}) {
  const lang = useLanguage()
  const [view, setView] = useState<View>(props.startGuidePage !== undefined ? { kind: 'guide', page: props.startGuidePage } : { kind: 'settings', page: 'env' })
  const main = useRef<HTMLDivElement>(null)
  // the guide's topics fold under "User guide" (the owner on 0.14.4 step 2); open while a guide page is shown
  const [guideOpen, setGuideOpen] = useState(false)
  const pages = useMemo(() => guidePages(), [])
  const nav = T.settings.nav
  const settingsPages: { id: SettingsPage; label: string }[] = [
    { id: 'env', label: nav.env },
    { id: 'appearance', label: nav.appearance },
    { id: 'report', label: nav.report },
    { id: 'features', label: nav.features },
    { id: 'tests', label: nav.tests },
    { id: 'privacy', label: nav.privacy }
  ]
  const guidePage = view.kind === 'guide' ? (pages.find((p) => p.id === view.page) ?? pages[0]) : undefined

  // a new page starts at its top (or at the sub-section a link pointed to)
  useEffect(() => {
    const el = view.kind === 'guide' && view.anchor ? document.getElementById(view.anchor) : null
    if (el) el.scrollIntoView({ block: 'start' })
    else main.current?.scrollTo({ top: 0 })
  }, [view])

  // links inside the guide: "#section" opens that section's page; other links are handled by the window (https → browser)
  const onGuideClick = (e: React.MouseEvent): void => {
    const href = (e.target as Element).closest('a')?.getAttribute('href') ?? ''
    if (href.startsWith('#')) {
      e.preventDefault()
      const id = href.slice(1)
      const target = pages.find((p) => p.id === id) ?? pages.find((p) => p.anchors.includes(id))
      if (target) setView({ kind: 'guide', page: target.id, ...(target.id !== id ? { anchor: id } : {}) })
    } else if (href && !href.startsWith('https://')) e.preventDefault()
  }

  const entry = (key: string, label: string, active: boolean, onClick: () => void, sub = false): ReactNode => (
    <li key={key}>
      <button type="button" className={`settings-nav__item${sub ? ' settings-nav__item--sub' : ''}${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={onClick}>
        {label}
      </button>
    </li>
  )

  return (
    <div className="page page--split">
      <nav className="settings-nav" aria-label={nav.label}>
        {/* a bar of its own that stays at the top; the entries scroll under it, not behind the button (owner, 0.15.1 step 4) */}
        <div className="settings-nav__top">
          <button type="button" className="btn btn--primary settings-nav__back" onClick={props.onBack}>
            {T.settings.back}
          </button>
        </div>
        <h2 className="settings-nav__group">{nav.settings}</h2>
        <ul>{settingsPages.map((p) => entry(p.id, p.label, view.kind === 'settings' && view.page === p.id, () => setView({ kind: 'settings', page: p.id })))}</ul>
        <h2 className="settings-nav__group">
          <button type="button" className="settings-nav__fold" aria-expanded={guideOpen || view.kind === 'guide'} onClick={() => setGuideOpen((o) => !(o || view.kind === 'guide'))}>
            <span aria-hidden="true">{guideOpen || view.kind === 'guide' ? '▾' : '▸'}</span> {nav.guide}
          </button>
        </h2>
        {(guideOpen || view.kind === 'guide') && (
          <ul aria-label={nav.guide}>
            {pages.map((p) => entry(`g-${p.id}`, p.id === '' ? nav.guideHome : p.title, guidePage?.id === p.id, () => setView({ kind: 'guide', page: p.id }), true))}
          </ul>
        )}
      </nav>
      <div className="settings-main" ref={main}>
        <div className="page__inner">
          <h1 className="page__title">{view.kind === 'guide' ? nav.guide : (settingsPages.find((p) => p.id === view.page)?.label ?? T.settings.title)}</h1>
          {view.kind === 'settings' && view.page === 'env' && (
            <>
              <EnvironmentCard theme={props.theme} git={props.git} update={props.update} appInfo={props.appInfo} />
              <VersionsCard appInfo={props.appInfo} update={props.update} />
            </>
          )}
          {view.kind === 'settings' && view.page === 'appearance' && (
            <section className="card" aria-label={nav.appearance}>
              <p className="hint hint--flush">{nav.appearanceIntro}</p>
              <div className="actions actions--wrap appearance">{props.appearance}</div>
            </section>
          )}
          {view.kind === 'settings' && view.page === 'report' && (
            <>
              <ProblemReportCard />
              <DiagnosticsCard appInfo={props.appInfo} />
            </>
          )}
          {view.kind === 'settings' && view.page === 'features' && <FeaturesCard />}
          {view.kind === 'settings' && view.page === 'privacy' && (
            // what the app sees, keeps, sends and may change (the owner, 8 Nov 2026)
            <section className="card privacy" aria-label={nav.privacy}>
              <p className="hint hint--flush">{T.settings.privacy.intro}</p>
              {T.settings.privacy.sections.map((sec) => (
                <div key={sec.title}>
                  <h2 className="privacy__title">{sec.title}</h2>
                  <ul className="privacy__list">
                    {sec.points.map((pt) => (
                      <li key={pt}>{pt}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
          {view.kind === 'settings' && view.page === 'tests' && (
            <>
              <ReleaseSelfTestCard />
              <SelfTestCard />
            </>
          )}
          {guidePage && (
            <article key={guidePage.id} className="card guide" aria-label={nav.guide} dir="ltr" lang="en" onClick={onGuideClick}>
              {lang !== 'en' && <p className="hint hint--flush">{nav.guideNote}</p>}
              <div className="guide__body" dangerouslySetInnerHTML={{ __html: guidePage.html }} />
            </article>
          )}
        </div>
      </div>
    </div>
  )
}
