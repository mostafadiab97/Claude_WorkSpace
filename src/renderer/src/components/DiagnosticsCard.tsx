import { useState } from 'react'
import type { AppInfo } from '../../../shared/api'

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
      <h2 id="diag-title">Diagnostics</h2>
      <dl className="paths">
        <dt>Log file</dt>
        <dd>
          <code>{appInfo?.logFile ?? '…'}</code>
        </dd>
        <dt>Your theme</dt>
        <dd>
          <code>{appInfo?.themeFile ?? '…'}</code>
        </dd>
      </dl>
      <div className="actions">
        <button type="button" className="btn" onClick={() => void window.reqman.openLogFolder()}>
          Open log folder
        </button>
        <button type="button" className="btn" onClick={() => void window.reqman.openThemeFolder()}>
          Edit my theme…
        </button>
        <button type="button" className="btn" onClick={() => void window.reqman.checkForUpdates()}>
          Check for updates
        </button>
        <button type="button" className="btn" onClick={() => void copy()}>
          {copied === 'done' ? 'Copied ✓' : copied === 'failed' ? 'Copy failed' : 'Copy diagnostics'}
        </button>
      </div>
    </section>
  )
}
