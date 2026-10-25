import { useState } from 'react'
import type { GitResult, GitState, ItemChange } from '../../../shared/api'
import { errorMessage } from '../lib/hooks'

const KIND: Record<ItemChange['kind'], { letter: string; label: string }> = {
  added: { letter: 'A', label: 'new' },
  modified: { letter: 'M', label: 'changed' },
  deleted: { letter: 'D', label: 'deleted' },
  renamed: { letter: 'R', label: 'renamed' },
  conflict: { letter: '!', label: 'conflict' }
}

/** Last Git action's outcome, shown under the Git bar until dismissed. */
export interface GitNotice {
  ok: boolean
  message: string
  items?: ItemChange[]
}

/**
 * The Git bar above the table: current branch, commits to push / pull, and the Changes / Pull / Push actions.
 * Only the requirements folder is ever committed.
 */
export function GitBar(props: {
  state: GitState | null
  busy: string | null
  /** Why actions that change files are blocked right now (unsaved edits), or null. */
  blockedReason: string | null
  changesOpen: boolean
  onToggleChanges: () => void
  onRun: (action: 'pull' | 'push') => void
  notice: GitNotice | null
  onDismiss: () => void
  onOpenItem: (id: string) => void
  onCompare: () => void
  compareOpen: boolean
}) {
  const { state, busy, blockedReason, notice } = props
  if (!state) return null
  if (!state.available) {
    return (
      <div className="gitbar gitbar--off" role="region" aria-label="Git">
        <span className="muted-inline">{state.reason}</span>
      </div>
    )
  }
  const n = state.changes.length
  return (
    <div role="region" aria-label="Git">
      <div className="gitbar">
        <span className="gitbar__branch" title={state.upstream ? `Remote branch: ${state.upstream}` : 'Not on the remote yet — Push publishes it'}>
          <span aria-hidden="true">⎇</span> {state.detached ? '(no branch)' : (state.branch ?? '—')}
        </span>
        {state.hasRemote && (
          <span className="gitbar__sync" title="Commits to push ↑ and to pull ↓ (as of the last pull)">
            {state.upstream ? `↑${state.ahead} ↓${state.behind}` : 'not pushed yet'}
          </span>
        )}
        {!state.hasRemote && <span className="muted-inline">No remote (e.g. GitHub) — commits stay on this PC</span>}
        {state.warning && <span className="statusbar__warn" title={state.warning}>Old Git version</span>}
        {state.mergeInProgress && <span className="statusbar__warn">Merge with conflicts in progress (outside ReqMan)</span>}
        <span className="toolbar__spacer" />
        {busy && <span className="muted-inline" role="status">{busy}…</span>}
        <button
          type="button"
          className={props.compareOpen ? 'btn btn--active' : 'btn'}
          aria-pressed={props.compareOpen}
          disabled={busy !== null || props.compareOpen}
          title="Pulls first, then shows what changed per requirement and per link"
          onClick={props.onCompare}
        >
          Compare
        </button>
        <button type="button" className={props.changesOpen ? 'btn btn--active' : 'btn'} aria-pressed={props.changesOpen} onClick={props.onToggleChanges}>
          Changes{n > 0 ? ` (${n})` : ''}
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy !== null || blockedReason !== null || !state.hasRemote}
          title={blockedReason ?? 'Get the changes others pushed'}
          onClick={() => props.onRun('pull')}
        >
          Pull
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy !== null || !state.hasRemote}
          title="Send your commits to the remote (never forced)"
          onClick={() => props.onRun('push')}
        >
          Push{state.ahead > 0 ? ` (${state.ahead})` : ''}
        </button>
      </div>
      {notice && (
        <div className={notice.ok ? 'gitbar__notice' : 'gitbar__notice gitbar__notice--error'} role={notice.ok ? 'status' : 'alert'}>
          <div className="gitbar__notice-text">
            <span>{notice.message}</span>
            {notice.items && notice.items.length > 0 && (
              <ul className="gitbar__items">
                {notice.items.map((i) => (
                  <li key={i.path}>
                    {i.id ? (
                      <button type="button" className="link-btn" onClick={() => i.id && props.onOpenItem(i.id)}>
                        {i.label}
                      </button>
                    ) : (
                      i.label
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" className="icon-btn icon-btn--small" aria-label="Dismiss" onClick={props.onDismiss}>
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

/** Uncommitted changes in the requirements folder, per item, with Commit and Discard. Shown instead of the editor. */
export function ChangesPanel(props: {
  state: GitState
  blockedReason: string | null
  onResult: (r: GitResult) => void
  onOpenItem: (id: string) => void
  onClose: () => void
}) {
  const { state, blockedReason } = props
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const needsIdentity = !state.identity.name || !state.identity.email

  const run = async (op: () => Promise<GitResult>, after?: (r: GitResult) => void): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const r = await op()
      props.onResult(r)
      if (!r.ok) setError(r.message)
      after?.(r)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const locked = busy || blockedReason !== null || !state.available || state.mergeInProgress

  return (
    <aside className="editor changes scroll" aria-label="Changes">
      <header className="editor__header">
        <div>
          <div className="editor__id">Changes</div>
          <div className="editor__type">Not committed yet · only the requirements folder is committed</div>
        </div>
        <button type="button" className="icon-btn" aria-label="Close changes" title="Close" onClick={props.onClose}>
          ✕
        </button>
      </header>

      <div className="editor__body">
        {state.changes.length === 0 ? (
          <p className="muted">No uncommitted changes. Everything you saved is committed.</p>
        ) : (
          <ul className="changes__list" aria-label="Changed items">
            {state.changes.map((c) => (
              <li key={c.path} className="changes__item">
                <span className={`changes__kind changes__kind--${c.kind}`} title={KIND[c.kind].label}>
                  {KIND[c.kind].letter}
                </span>
                <span className="changes__label">
                  {c.id && c.kind !== 'deleted' ? (
                    <button type="button" className="link-btn" onClick={() => c.id && props.onOpenItem(c.id)}>
                      {c.label}
                    </button>
                  ) : (
                    <span>{c.label}</span>
                  )}
                  <span className="muted-inline"> · {KIND[c.kind].label}</span>
                </span>
                {confirm === c.path ? (
                  <span className="actions">
                    <button
                      type="button"
                      className="btn btn--small btn--danger"
                      disabled={locked}
                      onClick={() => void run(() => window.reqman.discardChanges([c.path]), () => setConfirm(null))}
                    >
                      {c.kind === 'added' ? 'Delete it' : 'Undo change'}
                    </button>
                    <button type="button" className="btn btn--small" onClick={() => setConfirm(null)}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="link-btn"
                    disabled={locked}
                    title={c.kind === 'added' ? 'Delete this new, never committed item' : 'Go back to the last committed version'}
                    onClick={() => setConfirm(c.path)}
                  >
                    Discard
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {needsIdentity ? (
          <form
            className="changes__identity"
            onSubmit={(e) => {
              e.preventDefault()
              void run(() => window.reqman.setGitIdentity(name, email))
            }}
          >
            <p className="notice notice--warn">Git does not know who you are yet. Your name and e-mail are stored in your Git settings and appear in the history of every change you commit.</p>
            <label className="field">
              <span className="field__label">Your name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
            <label className="field">
              <span className="field__label">Your e-mail</span>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <button type="submit" className="btn" disabled={busy}>
              Save
            </button>
          </form>
        ) : (
          state.changes.length > 0 && (
            <form
              className="changes__commit"
              onSubmit={(e) => {
                e.preventDefault()
                void run(() => window.reqman.commit(message), (r) => r.ok && setMessage(''))
              }}
            >
              <label className="field">
                <span className="field__label">Commit message</span>
                <textarea
                  className="input textarea"
                  rows={3}
                  value={message}
                  placeholder="What changed and why, e.g. “Tighten temperature accuracy after customer review”"
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>
              <p className="muted-inline">
                As {state.identity.name} &lt;{state.identity.email}&gt;
              </p>
              <button type="submit" className="btn btn--primary" disabled={locked || !message.trim()} title={blockedReason ?? undefined}>
                {busy ? 'Committing…' : `Commit ${state.changes.length} change${state.changes.length === 1 ? '' : 's'}`}
              </button>
              {blockedReason && <p className="muted-inline">{blockedReason}</p>}
            </form>
          )
        )}
        {state.canUndoCommit && state.lastCommitMessage && (
          <div className="changes__undo">
            {confirm === '#undo' ? (
              <span className="actions">
                <span>Take back “{state.lastCommitMessage}”? Its changes stay, as uncommitted changes.</span>
                <button type="button" className="btn btn--small" disabled={locked} onClick={() => void run(() => window.reqman.undoLastCommit(), () => setConfirm(null))}>
                  Undo commit
                </button>
                <button type="button" className="btn btn--small" onClick={() => setConfirm(null)}>
                  Keep
                </button>
              </span>
            ) : (
              <button type="button" className="link-btn" disabled={locked} onClick={() => setConfirm('#undo')} title="Only for commits that are not pushed yet">
                Undo last commit “{state.lastCommitMessage}”
              </button>
            )}
          </div>
        )}
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
      </div>
    </aside>
  )
}
