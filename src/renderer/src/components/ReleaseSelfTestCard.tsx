import { useState } from 'react'
import type { ReleaseSelfTestResult } from '../../../shared/api'
import { T } from '../../../shared/text'
import { errorMessage } from '../lib/hooks'

/** The plain-text report the owner pastes into his test feedback. */
export function selfTestReport(r: ReleaseSelfTestResult): string {
  return [
    T.settings.releaseTest.reportTitle(r.version),
    `Git: ${r.gitVersion ?? '—'} · ${r.startedAt} · ${(r.totalMs / 1000).toFixed(1)} s · ${r.ok ? 'PASSED' : 'FAILED'}`,
    ...r.steps.map((s, i) => `${String(i + 1).padStart(2)}. ${s.ok ? 'OK  ' : 'FAIL'} ${s.name} (${s.ms} ms)${s.detail ? ` — ${s.detail}` : ''}`)
  ].join('\n')
}

/**
 * The release self-test (Settings & diagnostics): the main actions on a practice repository in a temporary
 * folder, on the owner's own PC, with pass/fail per step and a report to copy.
 */
export function ReleaseSelfTestCard() {
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'running' } | { kind: 'done'; r: ReleaseSelfTestResult } | { kind: 'failed'; message: string }>({ kind: 'idle' })
  const [copied, setCopied] = useState(false)

  const run = async (): Promise<void> => {
    setState({ kind: 'running' })
    setCopied(false)
    try {
      setState({ kind: 'done', r: await window.reqman.runReleaseSelfTest() })
    } catch (e) {
      setState({ kind: 'failed', message: errorMessage(e) })
    }
  }
  const copy = async (r: ReleaseSelfTestResult): Promise<void> => {
    try {
      await navigator.clipboard.writeText(selfTestReport(r))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const tx = T.settings.releaseTest
  return (
    <section className="card" aria-labelledby="release-test-title">
      <h2 id="release-test-title">{tx.title}</h2>
      <p className="hint hint--flush">{tx.intro}</p>
      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={() => void run()} disabled={state.kind === 'running'}>
          {state.kind === 'running' ? tx.running : tx.run}
        </button>
        {state.kind === 'done' && (
          <button type="button" className="btn" onClick={() => void copy(state.r)}>
            {copied ? T.common.copied : tx.copyReport}
          </button>
        )}
      </div>
      {state.kind === 'failed' && <p className="error-text">{tx.error(state.message)}</p>}
      {state.kind === 'done' && (
        <>
          <p className={state.r.ok ? 'notice notice--ok' : 'notice notice--error'} role="status">
            {state.r.ok ? tx.passed(state.r.totalMs) : tx.failed(state.r.steps.filter((s) => !s.ok).length, state.r.steps.length)}
          </p>
          <table className="results" aria-label={tx.title}>
            <tbody>
              {state.r.steps.map((s) => (
                <tr key={s.name} className={s.ok ? undefined : 'results__row--bad'}>
                  <th>
                    <span aria-hidden="true">{s.ok ? '✓ ' : '✗ '}</span>
                    {s.name}
                    {s.detail && <span className="muted-inline"> — {s.detail}</span>}
                  </th>
                  <td>{s.ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
