import { useState } from 'react'
import { T } from '../../../../shared/text'
import { errorMessage } from '../../lib/hooks'
import type { Problem } from './problemList'
export { problemsOf, type Problem } from './problemList'

/** The problem list under the table (opened from the status bar). */
export function ProblemList({ problems, onOpen, onFixed }: { problems: Problem[]; onOpen: (id: string) => void; onFixed: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const fix = async (id: string): Promise<void> => {
    setError(null)
    try {
      const r = await window.reqman.fixFileName(id)
      if (r.ok) onFixed()
      else setError(T.workspace.fixFailed(r.message))
    } catch (e) {
      setError(T.workspace.fixFailed(errorMessage(e)))
    }
  }
  return (
    <ul className="problems scroll" aria-label={T.workspace.problems}>
      {problems.map((p) => (
        <li key={p.key}>
          {p.id ? (
            <button type="button" className="link-btn" onClick={() => p.id && onOpen(p.id)}>
              {p.text}
            </button>
          ) : (
            p.text
          )}
          {p.fix === 'file-name' && p.id && (
            <>
              {' '}
              <button type="button" className="btn btn--small" title={T.workspace.fixFileNameTooltip(p.id)} onClick={() => p.id && void fix(p.id)}>
                {T.workspace.fixFileName}
              </button>
            </>
          )}
        </li>
      ))}
      {error && (
        <li className="error-text" role="alert">
          {error}
        </li>
      )}
    </ul>
  )
}
