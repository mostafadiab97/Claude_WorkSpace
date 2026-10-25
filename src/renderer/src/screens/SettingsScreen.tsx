import type { AppInfo, GitInfo, LoadedTheme, UpdateStatus } from '../../../shared/api'
import { DiagnosticsCard } from '../components/DiagnosticsCard'
import { EnvironmentCard } from '../components/EnvironmentCard'
import { SelfTestCard } from '../components/SelfTestCard'

/** Environment, diagnostics and the data self-test, reachable from the gear button. */
export function SettingsScreen(props: { theme: LoadedTheme; git: GitInfo | null; update: UpdateStatus | null; appInfo: AppInfo | null; onBack: () => void }) {
  return (
    <div className="page">
      <div className="page__inner">
        <div className="page__header">
          <button type="button" className="btn" onClick={props.onBack}>
            ← Back
          </button>
          <h1 className="page__title">Settings &amp; diagnostics</h1>
        </div>
        <EnvironmentCard theme={props.theme} git={props.git} update={props.update} appInfo={props.appInfo} />
        <DiagnosticsCard appInfo={props.appInfo} />
        <SelfTestCard />
      </div>
    </div>
  )
}
