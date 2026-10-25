import { useState } from 'react'
import type { DataSelfTestResult } from '../../../shared/api'

const SIZES = [1_000, 10_000, 50_000]

const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)} s`

/**
 * Lets a tester measure the data layer on their own PC: generates fictional items in a temporary folder,
 * indexes them, runs typical table queries, then deletes everything. Nothing in any real repository is touched.
 */
export function SelfTestCard() {
  const [size, setSize] = useState(10_000)
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'running'; size: number } | { kind: 'done'; r: DataSelfTestResult } | { kind: 'failed'; message: string }>({ kind: 'idle' })

  const run = async (): Promise<void> => {
    setState({ kind: 'running', size })
    try {
      setState({ kind: 'done', r: await window.reqman.runDataSelfTest(size) })
    } catch (e) {
      setState({ kind: 'failed', message: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <section className="card" aria-labelledby="selftest-title">
      <h2 id="selftest-title">Data self-test</h2>
      <p className="hint hint--flush">
        Creates fictional requirements in a temporary folder, indexes them and runs typical searches and filters,
        then deletes them. Your repositories are not touched.
      </p>
      <div className="actions">
        <label className="select">
          <span>Items</span>
          <select value={size} onChange={(e) => setSize(Number(e.target.value))} disabled={state.kind === 'running'}>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s.toLocaleString('en')}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn--primary" onClick={() => void run()} disabled={state.kind === 'running'}>
          {state.kind === 'running' ? `Running with ${state.size.toLocaleString('en')} items…` : 'Run self-test'}
        </button>
      </div>

      {state.kind === 'failed' && <p className="error-text">Self-test failed: {state.message}</p>}
      {state.kind === 'done' && (
        <table className="results">
          <tbody>
            <tr>
              <th>Writing {state.r.items.toLocaleString('en')} item files</th>
              <td>{seconds(state.r.writeMs)}</td>
            </tr>
            <tr>
              <th>First indexing (once per PC, per repository)</th>
              <td>{seconds(state.r.firstIndexMs)}</td>
            </tr>
            <tr>
              <th>Re-opening (nothing changed)</th>
              <td>{seconds(state.r.resyncMs)}</td>
            </tr>
            {state.r.queries.map((q) => (
              <tr key={q.name}>
                <th>Query: {q.name}</th>
                <td>
                  {q.ms} ms <span className="muted-inline">({q.total.toLocaleString('en')} matches)</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
