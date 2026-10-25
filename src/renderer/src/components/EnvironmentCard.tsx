import type { AppInfo, GitInfo, LoadedTheme, UpdateStatus } from '../../../shared/api'
import { StatusRow } from './StatusRow'
import { describeUpdate } from './UpdateBanner'

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
  )
}
