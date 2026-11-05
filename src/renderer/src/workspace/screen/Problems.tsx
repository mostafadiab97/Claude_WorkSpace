import { useState } from 'react'
import { T } from '../../../../shared/text'
import { errorMessage } from '../../lib/hooks'
import { groupProblems, type Problem } from './problemList'
export { problemsOf, type Problem } from './problemList'

/**
 * The problem list under the table (opened from the status bar): a header with a close button, then the problems
 * grouped by kind with a count — each row with a severity mark, the item ID and the message, and a fix button where
 * ReqMan can fix it (UI review UX-11).
 */
export function ProblemList({
  problems,
  onOpen,
  onFixed,
  onClose,
  guard = (then) => then()
}: {
  problems: Problem[]
  onOpen: (id: string) => void
  onFixed: () => void
  onClose: () => void
  /** Asks about unsaved edits before a file is renamed (CR2-03). */
  guard?: (then: () => void) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fix = async (ids: string[]): Promise<void> => {
    setError(null)
    setBusy(true)
    try {
      for (const id of ids) {
        const r = await window.reqochet.fixFileName(id)
        if (!r.ok) {
          setError(T.workspace.fixFailed(r.message))
          break
        }
      }
      onFixed()
    } catch (e) {
      setError(T.workspace.fixFailed(errorMessage(e)))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="problems" aria-label={T.workspace.problems}>
      <header className="problems__head">
        <strong>{T.workspace.problemsTitle(problems.length)}</strong>
        <button type="button" className="icon-btn icon-btn--small" aria-label={T.common.close} title={T.common.close} onClick={onClose}>
          ✕
        </button>
      </header>
      <div className="problems__body scroll">
        {groupProblems(problems).map((g) => {
          const fixable = g.problems.filter((p) => p.fix === 'file-name' && p.id).map((p) => p.id as string)
          return (
            <details key={g.group} className="problems__group" open>
              <summary>
                {T.workspace.problemGroup[g.group]} ({g.problems.length})
                {fixable.length > 1 && (
                  <button type="button" className="btn btn--small problems__fix-all" disabled={busy} onClick={() => guard(() => void fix(fixable))}>
                    {T.workspace.fixAll(fixable.length)}
                  </button>
                )}
              </summary>
              <ul>
                {g.problems.map((p) => (
                  <li key={p.key} className={`problems__row problems__row--${p.severity}`}>
                    <span className="problems__mark" aria-label={p.severity === 'error' ? T.workspace.severityError : T.workspace.severityWarning}>
                      {p.severity === 'error' ? '✕' : '⚠'}
                    </span>
                    {p.id ? (
                      <button type="button" className="link-btn problems__id" onClick={() => p.id && onOpen(p.id)}>
                        {p.id}
                      </button>
                    ) : (
                      <span className="problems__id">{p.subject}</span>
                    )}
                    <span className="problems__msg">{p.message}</span>
                    {p.fix === 'file-name' && p.id && (
                      <button type="button" className="btn btn--small" disabled={busy} title={T.workspace.fixFileNameTooltip(p.id)} onClick={() => p.id && guard(() => void fix([p.id as string]))}>
                        {T.workspace.fixFileName}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )
        })}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
