import { useEffect, useRef, useState } from 'react'
import type { BranchInfo, GitState } from '../../../shared/api'
import { errorMessage } from '../lib/hooks'
import { branchGroups } from './mergeAnswers'
import { T } from '../../../shared/text'

/** What a click on a branch name does: switch to it (default), or pick it for "Pull from" / "Compare with". */
type Mode = 'switch' | 'pull' | 'compare'

/**
 * The branch drop-down under the branch button (M8, reworked in 0.12.1 after the owner's test):
 * a compact panel, not a full-width bar. The current branch is on top with its two actions, "Pull from…" and
 * "Compare with…", which turn the list below into a chooser. Otherwise clicking a branch name switches to it
 * (asking about uncommitted changes — owner's decision M8-1). The list has a search box and scrolls inside the
 * panel, so tens of branches never cover the window. A new branch is created at the bottom.
 */
export function BranchMenu(props: {
  state: GitState
  /** Why files cannot change right now (unsaved edit), or null. */
  blockedReason: string | null
  onClose: () => void
  onCreate: (name: string) => void
  onSwitch: (name: string, changes: 'take' | 'discard') => void
  onPullFrom: (name: string) => void
  onCompare: (name: string) => void
  onCommitFirst: () => void
  /** Deletes a branch on this PC; resolves to the result so the panel can ask again for unmerged branches. */
  onDelete: (name: string, force: boolean) => Promise<{ ok: boolean; unmerged?: boolean; message: string }>
}) {
  const { state, blockedReason } = props
  const [list, setList] = useState<BranchInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [filter, setFilter] = useState('')
  const [mode, setMode] = useState<Mode>('switch')
  const [asking, setAsking] = useState<string | null>(null)
  /** Branch whose deletion is being confirmed; `unmerged` after Git said it has commits found nowhere else. */
  const [deleting, setDeleting] = useState<{ name: string; unmerged: boolean; busy: boolean } | null>(null)
  const current = state.branch ?? ''
  // the Git bar's state may lag a fresh save by a moment: count uncommitted changes again when the panel opens
  const [fresh, setFresh] = useState<number | null>(null)
  const pending = fresh ?? state.changes.length
  const box = useRef<HTMLDivElement>(null)
  // a click outside the panel closes it (the branch button toggles it itself)
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      const t = e.target as Element | null
      if (!t || box.current?.contains(t) || t.closest('.gitbar__branch')) return
      props.onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [props])

  useEffect(() => {
    let live = true
    void Promise.all([window.reqman.listBranches(), window.reqman.getGitState()])
      .then(([l, st]) => {
        if (!live) return
        setList(l)
        setFresh(st.changes.length)
      })
      .catch((e: unknown) => live && setError(errorMessage(e)))
    return () => {
      live = false
    }
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (mode !== 'switch') setMode('switch')
      else props.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props, mode])

  const others = (list ?? []).filter((b) => !b.current)
  const { local, remote } = branchGroups(others, filter)
  const locked = blockedReason !== null
  const pick = (b: string): void => {
    if (mode === 'pull') props.onPullFrom(b)
    else if (mode === 'compare') props.onCompare(b)
    else if (pending > 0) setAsking(b)
    else props.onSwitch(b, 'take')
  }
  const tip = (b: string): string =>
    mode === 'pull' ? T.branches.pullTooltip(b, current) : mode === 'compare' ? T.branches.compareTooltip(b, current) : (blockedReason ?? T.branches.switchTooltip(b))
  const choose = (m: Mode): void => setMode((x) => (x === m ? 'switch' : m))

  const group = (title: string, items: BranchInfo[]) =>
    items.length > 0 && (
      <>
        <h3 className="branches__group">{title}</h3>
        <ul className="branches__list" aria-label={title}>
          {items.map((b) => (
            <li key={`${b.kind}-${b.name}`} className="branches__item">
              <button type="button" className="branches__pick" disabled={locked && mode !== 'compare'} title={tip(b.name)} onClick={() => pick(b.name)}>
                {b.name}
              </button>
              {b.kind === 'branch' && mode === 'switch' && (
                <button type="button" className="branches__delete" aria-label={T.branches.deleteLabel(b.name)} title={T.branches.deleteLabel(b.name)} disabled={locked} onClick={() => setDeleting({ name: b.name, unmerged: false, busy: false })}>
                  <span aria-hidden="true">🗑 </span>
                  {T.branches.delete}
                </button>
              )}
            </li>
          ))}
        </ul>
      </>
    )

  if (deleting) {
    const confirm = async (force: boolean): Promise<void> => {
      setDeleting({ ...deleting, busy: true })
      const r = await props.onDelete(deleting.name, force)
      if (r.ok) {
        setDeleting(null)
        setList((l) => (l ? l.filter((x) => !(x.kind === 'branch' && x.name === deleting.name)) : l))
      } else if (r.unmerged) setDeleting({ name: deleting.name, unmerged: true, busy: false })
      else {
        setError(r.message)
        setDeleting(null)
      }
    }
    return (
      <div ref={box} className="branches" role="dialog" aria-label={T.branches.label}>
        <div className="branches__ask" role="alertdialog" aria-label={T.branches.deleteAskLabel}>
          <p>{deleting.unmerged ? T.branches.deleteUnmerged(deleting.name) : T.branches.deleteAsk(deleting.name)}</p>
          <span className="actions actions--wrap">
            <button type="button" className="btn btn--small btn--danger" disabled={deleting.busy} onClick={() => void confirm(deleting.unmerged)}>
              {deleting.unmerged ? T.branches.deleteAnyway : T.branches.delete}
            </button>
            <button type="button" className="btn btn--small" onClick={() => setDeleting(null)}>
              {T.common.cancel}
            </button>
          </span>
        </div>
      </div>
    )
  }

  if (asking) {
    return (
      <div ref={box} className="branches" role="dialog" aria-label={T.branches.label}>
        <div className="branches__ask" role="alertdialog" aria-label={T.branches.askLabel}>
          <p>{T.branches.ask(pending, asking)}</p>
          <span className="actions actions--wrap">
            <button type="button" className="btn btn--small btn--primary" onClick={props.onCommitFirst}>
              {T.branches.commitFirst}
            </button>
            <button type="button" className="btn btn--small" title={T.branches.takeTooltip} onClick={() => props.onSwitch(asking, 'take')}>
              {T.branches.take(pending)}
            </button>
            <button type="button" className="btn btn--small btn--danger" onClick={() => props.onSwitch(asking, 'discard')}>
              {T.branches.discard(pending)}
            </button>
            <button type="button" className="btn btn--small" onClick={() => setAsking(null)}>
              {T.common.cancel}
            </button>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div ref={box} className="branches" role="dialog" aria-label={T.branches.label}>
      <div className="branches__current">
        <span className="branches__name" title={T.branches.current}>
          <span aria-hidden="true">✓ </span>
          {current}
        </span>
        <button type="button" className={mode === 'pull' ? 'btn btn--small btn--active' : 'btn btn--small'} aria-pressed={mode === 'pull'} disabled={locked} title={blockedReason ?? T.branches.pullFromTooltip(current)} onClick={() => choose('pull')}>
          {T.branches.pullFrom}
        </button>
        <button type="button" className={mode === 'compare' ? 'btn btn--small btn--active' : 'btn btn--small'} aria-pressed={mode === 'compare'} title={T.branches.compareWithTooltip(current)} onClick={() => choose('compare')}>
          {T.branches.compareWith}
        </button>
        <span className="toolbar__spacer" />
        <button type="button" className="icon-btn icon-btn--small" aria-label={T.common.close} onClick={props.onClose}>
          ✕
        </button>
      </div>
      <p className="branches__hint" role="status">
        {mode === 'pull' ? T.branches.choosePull(current) : mode === 'compare' ? T.branches.chooseCompare(current) : T.branches.chooseSwitch}
      </p>
      {others.length > 6 && (
        <input className="input branches__filter" type="search" value={filter} placeholder={T.branches.filter} aria-label={T.branches.filter} onChange={(e) => setFilter(e.target.value)} autoFocus />
      )}
      {error && <p className="notice notice--error" role="alert">{error}</p>}
      {!list && !error && <p className="muted-inline">{T.branches.loading}</p>}
      {list && (
        <div className="branches__lists">
          {group(T.branches.local, local)}
          {group(T.branches.remote, remote)}
          {local.length + remote.length === 0 && <p className="muted-inline">{others.length === 0 ? T.branches.noOthers : T.branches.noMatch}</p>}
        </div>
      )}
      <form
        className="branches__new"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) props.onCreate(name.trim())
        }}
      >
        <input className="input" value={name} placeholder={T.branches.newPlaceholder} aria-label={T.branches.newLabel} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn--small btn--primary" disabled={!name.trim() || locked} title={blockedReason ?? T.branches.createTooltip(current)}>
          {T.branches.create}
        </button>
      </form>
    </div>
  )
}
