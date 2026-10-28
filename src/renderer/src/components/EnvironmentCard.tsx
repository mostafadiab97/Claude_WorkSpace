import type { AppInfo, GitInfo, LoadedTheme, UpdateStatus } from '../../../shared/api'
import { StatusRow } from './StatusRow'
import { describeUpdate } from './UpdateBanner'
import { T } from '../../../shared/text'

export function EnvironmentCard(props: {
  theme: LoadedTheme
  git: GitInfo | null
  update: UpdateStatus | null
  appInfo: AppInfo | null
}) {
  const { theme, git, update, appInfo } = props
  const brand = theme.config.brand.name
  return (
    <section className="card" aria-labelledby="env-title">
      <h2 id="env-title">{T.settings.env.title}</h2>
      {git === null ? (
        <StatusRow label={T.settings.env.git} tone="neutral">{T.common.checking}</StatusRow>
      ) : git.installed ? (
        <StatusRow label={T.settings.env.git} tone="ok">{T.settings.env.gitInstalled(git.version)}</StatusRow>
      ) : (
        <StatusRow label={T.settings.env.git} tone="error">
          {git.reason}{' '}
          <a href={git.downloadUrl} target="_blank" rel="noreferrer">
            {T.settings.env.downloadGit}
          </a>
        </StatusRow>
      )}
      <StatusRow label={T.settings.env.theme} tone={theme.warnings.length ? 'warn' : 'ok'}>
        {T.settings.env.themeSource[theme.source]}
        {theme.warnings.length ? T.settings.env.themeWarnings(theme.warnings.length) : ''}
      </StatusRow>
      <StatusRow
        label={T.settings.env.updates}
        tone={update?.state === 'error' ? 'warn' : update?.state === 'ready' || update?.state === 'up-to-date' ? 'ok' : 'neutral'}
      >
        {describeUpdate(update)}
      </StatusRow>
      <StatusRow label={T.settings.env.app} tone="neutral">
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
  )
}
