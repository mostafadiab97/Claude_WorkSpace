import { useState } from 'react'
import type { GitResult, GitState, ItemChange } from '../../../shared/api'
import { errorMessage } from '../lib/hooks'
import { T } from '../../../shared/text'

const KIND: Record<ItemChange['kind'], { letter: string; label: string }> = {
  added: { letter: 'A', label: T.git.kinds.added },
  modified: { letter: 'M', label: T.git.kinds.modified },
  deleted: { letter: 'D', label: T.git.kinds.deleted },
  renamed: { letter: 'R', label: T.git.kinds.renamed },
  conflict: { letter: '!', label: T.git.kinds.conflict }
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
      <div className="gitbar gitbar--off" role="region" aria-label={T.git.region}>
        <span className="muted-inline">{state.reason}</span>
      </div>
    )
  }
  const n = state.changes.length
  return (
    <div role="region" aria-label={T.git.region}>
      <div className="gitbar">
        <span className="gitbar__branch" title={state.upstream ? T.git.remoteBranch(state.upstream) : T.git.notOnRemote}>
          <span aria-hidden="true">⎇</span> {state.detached ? T.git.noBranch : (state.branch ?? '—')}
        </span>
        {state.hasRemote && (
          <span className="gitbar__sync" title={T.git.syncTooltip}>
            {state.upstream ? `↑${state.ahead} ↓${state.behind}` : T.git.notPushed}
          </span>
        )}
        {!state.hasRemote && <span className="muted-inline">{T.git.noRemote}</span>}
        {state.warning && <span className="statusbar__warn" title={state.warning}>{T.git.oldGit}</span>}
        {state.mergeInProgress && <span className="statusbar__warn">{T.git.mergeOutside}</span>}
        <span className="toolbar__spacer" />
        {busy && <span className="muted-inline" role="status">{T.git.busy(busy)}</span>}
        <button
          type="button"
          className={props.compareOpen ? 'btn btn--active' : 'btn'}
          aria-pressed={props.compareOpen}
          disabled={busy !== null || props.compareOpen}
          title={T.git.compareTooltip}
          onClick={props.onCompare}
        >
          {T.git.compare}
        </button>
        <button type="button" className={props.changesOpen ? 'btn btn--active' : 'btn'} aria-pressed={props.changesOpen} onClick={props.onToggleChanges}>
          {T.git.changes(n)}
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy !== null || blockedReason !== null || !state.hasRemote}
          title={blockedReason ?? T.git.pullTooltip}
          onClick={() => props.onRun('pull')}
        >
          {T.git.pull}
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy !== null || !state.hasRemote}
          title={T.git.pushTooltip}
          onClick={() => props.onRun('push')}
        >
          {T.git.push(state.ahead)}
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
          <button type="button" className="icon-btn icon-btn--small" aria-label={T.common.dismiss} onClick={props.onDismiss}>
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
    <aside className="editor changes scroll" aria-label={T.changesPanel.label}>
      <header className="editor__header">
        <div>
          <div className="editor__id">{T.changesPanel.title}</div>
          <div className="editor__type">{T.changesPanel.subtitle}</div>
        </div>
        <button type="button" className="icon-btn" aria-label={T.changesPanel.close} title={T.common.close} onClick={props.onClose}>
          ✕
        </button>
      </header>

      <div className="editor__body">
        {state.changes.length === 0 ? (
          <p className="muted">{T.changesPanel.none}</p>
        ) : (
          <ul className="changes__list" aria-label={T.changesPanel.list}>
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
                      {c.kind === 'added' ? T.changesPanel.deleteIt : T.changesPanel.undoChange}
                    </button>
                    <button type="button" className="btn btn--small" onClick={() => setConfirm(null)}>
                      {T.changesPanel.keep}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="link-btn"
                    disabled={locked}
                    title={c.kind === 'added' ? T.changesPanel.discardNewTooltip : T.changesPanel.discardTooltip}
                    onClick={() => setConfirm(c.path)}
                  >
                    {T.changesPanel.discard}
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
            <p className="notice notice--warn">{T.changesPanel.whoAreYou}</p>
            <label className="field">
              <span className="field__label">{T.changesPanel.yourName}</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
            <label className="field">
              <span className="field__label">{T.changesPanel.yourEmail}</span>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <button type="submit" className="btn" disabled={busy}>
              {T.common.save}
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
                <span className="field__label">{T.changesPanel.message}</span>
                <textarea
                  className="input textarea"
                  rows={3}
                  value={message}
                  placeholder={T.changesPanel.messagePlaceholder}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>
              <p className="muted-inline">
                {T.changesPanel.as(state.identity.name ?? '', state.identity.email ?? '')}
              </p>
              <button type="submit" className="btn btn--primary" disabled={locked || !message.trim()} title={blockedReason ?? undefined}>
                {busy ? T.changesPanel.committing : T.changesPanel.commit(state.changes.length)}
              </button>
              {blockedReason && <p className="muted-inline">{blockedReason}</p>}
            </form>
          )
        )}
        {state.canUndoCommit && state.lastCommitMessage && (
          <div className="changes__undo">
            {confirm === '#undo' ? (
              <span className="actions">
                <span>{T.changesPanel.undoAsk(state.lastCommitMessage)}</span>
                <button type="button" className="btn btn--small" disabled={locked} onClick={() => void run(() => window.reqman.undoLastCommit(), () => setConfirm(null))}>
                  {T.changesPanel.undoCommit}
                </button>
                <button type="button" className="btn btn--small" onClick={() => setConfirm(null)}>
                  {T.changesPanel.keep}
                </button>
              </span>
            ) : (
              <button type="button" className="link-btn" disabled={locked} onClick={() => setConfirm('#undo')} title={T.changesPanel.undoTooltip}>
                {T.changesPanel.undoLast(state.lastCommitMessage)}
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
