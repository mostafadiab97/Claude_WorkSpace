import type { AppInfo, GitInfo, LoadedTheme, UpdateStatus } from '../../../shared/api'
import { DiagnosticsCard } from '../components/DiagnosticsCard'
import { EnvironmentCard } from '../components/EnvironmentCard'
import { FeaturesCard } from '../components/FeaturesCard'
import { VersionsCard } from '../components/VersionsCard'
import { ProblemReportCard } from '../components/ProblemReportCard'
import { ReleaseSelfTestCard } from '../components/ReleaseSelfTestCard'
import { SelfTestCard } from '../components/SelfTestCard'
import { T } from '../../../shared/text'

/** Environment, diagnostics and the data self-test, reachable from the gear button. */
export function SettingsScreen(props: { theme: LoadedTheme; git: GitInfo | null; update: UpdateStatus | null; appInfo: AppInfo | null; onBack: () => void }) {
  return (
    <div className="page">
      <div className="page__inner">
        <div className="page__header">
          <button type="button" className="btn" onClick={props.onBack}>
            {T.settings.back}
          </button>
          <h1 className="page__title">{T.settings.title}</h1>
        </div>
        <EnvironmentCard theme={props.theme} git={props.git} update={props.update} appInfo={props.appInfo} />
        <VersionsCard appInfo={props.appInfo} update={props.update} />
        <ProblemReportCard />
        <DiagnosticsCard appInfo={props.appInfo} />
        <FeaturesCard />
        <ReleaseSelfTestCard />
        <SelfTestCard />
      </div>
    </div>
  )
}
