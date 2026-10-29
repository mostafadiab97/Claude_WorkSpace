import { useEffect, useState } from 'react'
import type { BranchInfo, GitState } from '../../../shared/api'
import { errorMessage } from '../lib/hooks'
import { branchGroups } from './mergeAnswers'
import { T } from '../../../shared/text'

/**
 * The branch panel under the Git bar (M8): create a branch from the current one, switch to another (with a
 * question about uncommitted changes — owner's decision M8-1), pull any branch into the current one (M8-6), or see
 * what a branch would bring in, like a pull request (M8-2; the merge itself happens on GitHub).
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
}) {
  const { state, blockedReason } = props
  const [list, setList] = useState<BranchInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [filter, setFilter] = useState('')
  const [asking, setAsking] = useState<string | null>(null)
  const current = state.branch ?? ''
  // the Git bar's state may lag a fresh save by a moment: count uncommitted changes again when the panel opens
  const [fresh, setFresh] = useState<number | null>(null)
  const pending = fresh ?? state.changes.length

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
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props])

  const { local, remote } = branchGroups(list ?? [], filter)
  const locked = blockedReason !== null
  const switchTo = (b: string): void => (pending > 0 ? setAsking(b) : props.onSwitch(b, 'take'))

  const row = (b: BranchInfo) => (
    <li key={`${b.kind}-${b.name}`} className={b.current ? 'branches__row branches__row--current' : 'branches__row'}>
      <span className="branches__name" title={b.name}>
        {b.current && <span aria-label={T.branches.current}>✓ </span>}
        {b.name}
      </span>
      {!b.current && (
        <span className="actions">
          <button type="button" className="btn btn--small" disabled={locked} title={blockedReason ?? T.branches.switchTooltip(b.name)} onClick={() => switchTo(b.name)}>
            {T.branches.switch}
          </button>
          <button type="button" className="btn btn--small" disabled={locked} title={blockedReason ?? T.branches.pullTooltip(b.name, current)} onClick={() => props.onPullFrom(b.name)}>
            {T.branches.pullInto(current)}
          </button>
          <button type="button" className="btn btn--small" title={T.branches.compareTooltip(b.name, current)} onClick={() => props.onCompare(b.name)}>
            {T.branches.compare}
          </button>
        </span>
      )}
    </li>
  )

  return (
    <div className="gitbar__notice branches" role="dialog" aria-label={T.branches.label}>
      {asking ? (
        <div className="branches__ask" role="alertdialog" aria-label={T.branches.askLabel}>
          <p>{T.branches.ask(pending, asking)}</p>
          <span className="actions">
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
      ) : (
        <>
          <form
            className="branches__new"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) props.onCreate(name.trim())
            }}
          >
            <input className="input" value={name} placeholder={T.branches.newPlaceholder} aria-label={T.branches.newLabel} onChange={(e) => setName(e.target.value)} autoFocus />
            <button type="submit" className="btn btn--small btn--primary" disabled={!name.trim() || locked} title={blockedReason ?? T.branches.createTooltip(current)}>
              {T.branches.create}
            </button>
            <span className="toolbar__spacer" />
            {(list?.length ?? 0) > 8 && <input className="input branches__filter" type="search" value={filter} placeholder={T.branches.filter} aria-label={T.branches.filter} onChange={(e) => setFilter(e.target.value)} />}
            <button type="button" className="icon-btn icon-btn--small" aria-label={T.common.close} onClick={props.onClose}>
              ✕
            </button>
          </form>
          {error && <p className="notice notice--error" role="alert">{error}</p>}
          {!list && !error && <p className="muted-inline">{T.branches.loading}</p>}
          {list && (
            <div className="branches__lists">
              <h3 className="branches__group">{T.branches.local}</h3>
              <ul className="branches__list" aria-label={T.branches.local}>
                {local.map(row)}
              </ul>
              {remote.length > 0 && (
                <>
                  <h3 className="branches__group">{T.branches.remote}</h3>
                  <ul className="branches__list" aria-label={T.branches.remote}>
                    {remote.map(row)}
                  </ul>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
