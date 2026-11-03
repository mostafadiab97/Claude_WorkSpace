import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppInfo, GitInfo, LoadedTheme, UpdateStatus } from '../../../shared/api'
import { DiagnosticsCard } from '../components/DiagnosticsCard'
import { EnvironmentCard } from '../components/EnvironmentCard'
import { FeaturesCard } from '../components/FeaturesCard'
import { ProblemReportCard } from '../components/ProblemReportCard'
import { ReleaseSelfTestCard } from '../components/ReleaseSelfTestCard'
import { SelfTestCard } from '../components/SelfTestCard'
import { VersionsCard } from '../components/VersionsCard'
import { guideHtml, guideSections } from '../lib/guide'
import { useLanguage } from '../lib/language'
import { T } from '../../../shared/text'

type View = { kind: 'settings'; target: string } | { kind: 'guide'; target: string }

/**
 * Settings and help (Mostafa on 0.14.1 step 4): a left panel to move between the settings cards and the user guide
 * (docs/USER-GUIDE.md, bundled into the app) with one entry per guide section.
 */
export function SettingsScreen(props: { theme: LoadedTheme; git: GitInfo | null; update: UpdateStatus | null; appInfo: AppInfo | null; onBack: () => void; startWith?: 'guide' }) {
  const lang = useLanguage()
  const [view, setView] = useState<View>(props.startWith === 'guide' ? { kind: 'guide', target: '' } : { kind: 'settings', target: '' })
  const main = useRef<HTMLDivElement>(null)
  const sections = useMemo(() => guideSections().filter((s) => /^\d+\./.test(s.title)), [])
  const html = useMemo(() => guideHtml(), [])
  // read the texts when rendering (the language switch swaps T in place)
  const cards = useMemo(
    () => [
      { id: 'settings-env', label: T.settings.nav.env },
      { id: 'settings-versions', label: T.settings.nav.versions },
      { id: 'settings-report', label: T.settings.nav.report },
      { id: 'settings-diag', label: T.settings.nav.diag },
      { id: 'settings-features', label: T.settings.nav.features },
      { id: 'settings-release-test', label: T.settings.nav.releaseTest },
      { id: 'settings-data-test', label: T.settings.nav.dataTest }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when the language changes
    [lang]
  )

  useEffect(() => {
    const el = view.target ? document.getElementById(view.target) : null
    if (el) el.scrollIntoView({ block: 'start' })
    else main.current?.scrollTo({ top: 0 })
  }, [view])

  // links inside the guide: "#section" stays in the guide; other links are handled by the window (https → browser)
  const onGuideClick = (e: React.MouseEvent): void => {
    const a = (e.target as Element).closest('a')
    const href = a?.getAttribute('href') ?? ''
    if (href.startsWith('#')) {
      e.preventDefault()
      setView({ kind: 'guide', target: href.slice(1) })
    } else if (href && !href.startsWith('https://')) e.preventDefault()
  }

  const item = (active: boolean, label: string, onClick: () => void, sub = false): ReactNode => (
    <li key={label}>
      <button type="button" className={`settings-nav__item${sub ? ' settings-nav__item--sub' : ''}${active ? ' is-active' : ''}`} aria-current={active ? 'true' : undefined} onClick={onClick}>
        {label}
      </button>
    </li>
  )

  return (
    <div className="page page--split">
      <nav className="settings-nav" aria-label={T.settings.nav.label}>
        <h2 className="settings-nav__group">{T.settings.nav.settings}</h2>
        <ul>{cards.map((c) => item(view.kind === 'settings' && view.target === c.id, c.label, () => setView({ kind: 'settings', target: c.id })))}</ul>
        <h2 className="settings-nav__group">
          <button type="button" className={`settings-nav__item${view.kind === 'guide' && !view.target ? ' is-active' : ''}`} onClick={() => setView({ kind: 'guide', target: '' })}>
            {T.settings.nav.guide}
          </button>
        </h2>
        <ul aria-label={T.settings.nav.guide}>{sections.map((s) => item(view.kind === 'guide' && view.target === s.id, s.title, () => setView({ kind: 'guide', target: s.id }), true))}</ul>
      </nav>
      <div className="page page--main" ref={main}>
        <div className="page__inner">
          <div className="page__header">
            <button type="button" className="btn" onClick={props.onBack}>
              {T.settings.back}
            </button>
            <h1 className="page__title">{view.kind === 'guide' ? T.settings.nav.guide : T.settings.title}</h1>
          </div>
          {view.kind === 'settings' ? (
            <>
              <div id="settings-env">
                <EnvironmentCard theme={props.theme} git={props.git} update={props.update} appInfo={props.appInfo} />
              </div>
              <div id="settings-versions">
                <VersionsCard appInfo={props.appInfo} update={props.update} />
              </div>
              <div id="settings-report">
                <ProblemReportCard />
              </div>
              <div id="settings-diag">
                <DiagnosticsCard appInfo={props.appInfo} />
              </div>
              <div id="settings-features">
                <FeaturesCard />
              </div>
              <div id="settings-release-test">
                <ReleaseSelfTestCard />
              </div>
              <div id="settings-data-test">
                <SelfTestCard />
              </div>
            </>
          ) : (
            <article className="card guide" aria-label={T.settings.nav.guide} dir="ltr" lang="en" onClick={onGuideClick}>
              {lang !== 'en' && <p className="hint hint--flush">{T.settings.nav.guideNote}</p>}
              <div className="guide__body" dangerouslySetInnerHTML={{ __html: html }} />
            </article>
          )}
        </div>
      </div>
    </div>
  )
}
