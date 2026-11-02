import { useState } from 'react'
import { T } from '../../../shared/text'

/** Settings → Report a problem (P-40d): the description + diagnostics + end of the log saved as one text file. */
export function ProblemReportCard() {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const save = async (): Promise<void> => {
    setBusy(true)
    setResult(null)
    try {
      const r = await window.reqman.saveProblemReport(text)
      if (r.ok) setResult({ ok: true, message: T.settings.report.saved(r.path) })
      else if (!r.canceled) setResult({ ok: false, message: T.settings.report.failed(r.message ?? '') })
    } catch (e) {
      setResult({ ok: false, message: T.settings.report.failed((e as Error).message) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card" aria-labelledby="report-title">
      <h2 id="report-title">{T.settings.report.title}</h2>
      <p className="hint hint--flush">{T.settings.report.intro}</p>
      <label className="field">
        <span className="field__label">{T.settings.report.label}</span>
        <textarea className="input report__text" rows={4} value={text} placeholder={T.settings.report.placeholder} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="actions">
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void save()}>
          {T.settings.report.save}
        </button>
      </div>
      {result && (
        <p className={result.ok ? 'notice notice--ok' : 'notice notice--error'} role="status">
          {result.message}
        </p>
      )}
    </section>
  )
}
