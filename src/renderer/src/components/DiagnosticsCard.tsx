import { useState } from 'react'
import type { AppInfo } from '../../../shared/api'
import { T } from '../../../shared/text'

/** Gives testers one-click access to the log file, the theme file and a copyable environment summary. */
export function DiagnosticsCard({ appInfo }: { appInfo: AppInfo | null }) {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(await window.reqman.getDiagnostics())
      setCopied('done')
    } catch {
      setCopied('failed')
    }
    setTimeout(() => setCopied('idle'), 2500)
  }

  return (
    <section className="card" aria-labelledby="diag-title">
      <h2 id="diag-title">{T.settings.diag.title}</h2>
      <dl className="paths">
        <dt>{T.settings.diag.logFile}</dt>
        <dd>
          <code>{appInfo?.logFile ?? '…'}</code>
        </dd>
        <dt>{T.settings.diag.yourTheme}</dt>
        <dd>
          <code>{appInfo?.themeFile ?? '…'}</code>
        </dd>
      </dl>
      <div className="actions">
        <button type="button" className="btn" onClick={() => void window.reqman.openLogFolder()}>
          {T.settings.diag.openLog}
        </button>
        <button type="button" className="btn" onClick={() => void window.reqman.openThemeFolder()}>
          {T.settings.diag.editTheme}
        </button>
        <button type="button" className="btn" onClick={() => void window.reqman.checkForUpdates()}>
          {T.settings.diag.checkUpdates}
        </button>
        <button type="button" className="btn" onClick={() => void copy()}>
          {copied === 'done' ? T.common.copied : copied === 'failed' ? T.common.copyFailed : T.settings.diag.copy}
        </button>
      </div>
    </section>
  )
}
