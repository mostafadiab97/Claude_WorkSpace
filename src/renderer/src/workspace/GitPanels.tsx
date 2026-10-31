import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { GitResult, GitState, ItemChange } from '../../../shared/api'
import { errorMessage } from '../lib/hooks'
import { BranchMenu } from './BranchMenu'
import { T } from '../../../shared/text'

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
  /** The top bar's slot (0.13.0): the Git controls live there, so the workspace has one bar less. */
  slot?: HTMLElement | null
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
  /** Push was clicked: "pull first?" is shown until answered (owner's decision O-06: no automatic pulls). */
  pushOffer: boolean
  onPushOffer: (choice: 'pull-first' | 'push' | 'cancel') => void
  /** "Publish to GitHub" (M7): connect a repository without a remote to an empty GitHub repository. */
  onPublish: (url: string) => void
  /** Branches (M8): create, switch, pull from, compare. */
  onCreateBranch: (name: string) => Promise<boolean>
  onSwitchBranch: (name: string, changes: 'take' | 'discard') => Promise<boolean>
  onPullFrom: (name: string) => Promise<boolean>
  onCompareBranch: (name: string) => void
  onCommitFirst: () => void
  onDeleteBranch: (name: string, force: boolean) => Promise<{ ok: boolean; unmerged?: boolean; message: string }>
}) {
  const { state, busy, blockedReason, notice, onDismiss } = props
  // a success message goes away by itself after a while; errors stay until dismissed
  useEffect(() => {
    if (!notice?.ok) return
    const t = window.setTimeout(onDismiss, 9000)
    return () => window.clearTimeout(t)
  }, [notice, onDismiss])
  const place = (node: ReactNode): ReactNode => (props.slot ? createPortal(node, props.slot) : node)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [branches, setBranches] = useState(false)
  const closeAfter = (p: Promise<boolean>): void => {
    void p.then((ok) => ok && setBranches(false))
  }
  if (!state) return null
  if (!state.available) {
    return place(
      <div className="gitbar gitbar--off" role="region" aria-label={T.git.region}>
        <span className="muted-inline">{state.reason}</span>
      </div>
    )
  }
  const n = state.changes.length
  return place(
    <div role="region" aria-label={T.git.region} className="gitbar-region">
      <div className="gitbar gitbar--anchor">
        {branches && (
          <BranchMenu
            state={state}
            blockedReason={blockedReason}
            onClose={() => setBranches(false)}
            onCreate={(n) => closeAfter(props.onCreateBranch(n))}
            onSwitch={(n, c) => closeAfter(props.onSwitchBranch(n, c))}
            onPullFrom={(n) => {
              setBranches(false)
              void props.onPullFrom(n)
            }}
            onCompare={(n) => {
              setBranches(false)
              props.onCompareBranch(n)
            }}
            onCommitFirst={() => {
              setBranches(false)
              props.onCommitFirst()
            }}
            onDelete={props.onDeleteBranch}
          />
        )}
        <button
          type="button"
          className={branches ? 'btn btn--small btn--active gitbar__branch' : 'btn btn--small gitbar__branch'}
          aria-expanded={branches}
          aria-label={T.branches.open(state.branch ?? '')}
          title={`${T.branches.open(state.branch ?? '')}\n${state.upstream ? T.git.remoteBranch(state.upstream) : T.git.notOnRemote}`}
          disabled={busy !== null || state.detached || state.mergeInProgress}
          onClick={() => setBranches((v) => !v)}
        >
          <span aria-hidden="true">⎇</span> {state.detached ? T.git.noBranch : (state.branch ?? '—')} <span aria-hidden="true">▾</span>
        </button>
        {state.hasRemote && (
          <span className="gitbar__sync" title={T.git.syncTooltip}>
            {state.upstream ? `↑${state.ahead} ↓${state.behind}` : T.git.notPushed}
          </span>
        )}
        {!state.hasRemote && <span className="muted-inline gitbar__noremote" title={T.git.noRemote}>{T.git.noRemoteShort}</span>}
        {!state.hasRemote && publishing === null && (
          <button type="button" className="link-btn" disabled={busy !== null} onClick={() => setPublishing('')} title={T.git.publishTooltip}>
            {T.git.publish}
          </button>
        )}
        {state.warning && <span className="statusbar__warn" title={state.warning}>{T.git.oldGit}</span>}
        {state.mergeInProgress && <span className="statusbar__warn">{T.git.mergeOutside}</span>}
        <span className="toolbar__spacer" />
        {busy && <span className="muted-inline" role="status">{T.git.busy(busy)}</span>}
        <button type="button" className={props.changesOpen ? 'btn btn--active' : 'btn'} aria-pressed={props.changesOpen} onClick={props.onToggleChanges} title={T.git.changesTooltip}>
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
      <div className="gitbar__float">
      {publishing !== null && !state.hasRemote && (
        <form
          className="gitbar__notice gitbar__publish"
          aria-label={T.git.publishLabel}
          onSubmit={(e) => {
            e.preventDefault()
            props.onPublish(publishing)
            setPublishing(null)
          }}
        >
          <span className="gitbar__notice-text">{T.git.publishIntro}</span>
          <input className="input gitbar__url" value={publishing} placeholder={T.git.publishPlaceholder} aria-label={T.git.publishAddress} onChange={(e) => setPublishing(e.target.value)} autoFocus />
          <button type="submit" className="btn btn--small btn--primary" disabled={!publishing.trim()}>
            {T.git.publishRun}
          </button>
          <button type="button" className="icon-btn icon-btn--small" aria-label={T.common.cancel} onClick={() => setPublishing(null)}>
            ✕
          </button>
        </form>
      )}
      {props.pushOffer && (
        <div className="gitbar__notice gitbar__offer" role="alertdialog" aria-label={T.git.pullFirstLabel}>
          <span className="gitbar__notice-text">{T.git.pullFirstPush}</span>
          <span className="actions">
            <button type="button" className="btn btn--small btn--primary" disabled={blockedReason !== null} title={blockedReason ?? undefined} onClick={() => props.onPushOffer('pull-first')}>
              {T.git.pullThenPush}
            </button>
            <button type="button" className="btn btn--small" onClick={() => props.onPushOffer('push')}>
              {T.git.pushWithoutPull}
            </button>
            <button type="button" className="icon-btn icon-btn--small" aria-label={T.common.cancel} onClick={() => props.onPushOffer('cancel')}>
              ✕
            </button>
          </span>
        </div>
      )}
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
    </div>
  )
}

/**
 * Commit tools of the Changes view's side panel (uncommitted changes): the commit message and Commit, the name /
 * e-mail form when Git does not know the user yet, and Undo last commit while it is not pushed.
 * The changed items themselves are listed in the middle area (ChangesView).
 */
export function CommitTools(props: { state: GitState; blockedReason: string | null; onResult: (r: GitResult) => void }) {
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
    <div className="commit-tools">
      {state.changes.length === 0 && <p className="muted">{T.changesPanel.none}</p>}
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
  )
}
