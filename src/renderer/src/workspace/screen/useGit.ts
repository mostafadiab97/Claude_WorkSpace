// The Git bar's state and actions (review S-03: grouped out of WorkspaceScreen). No automatic pulls: Push first
// offers to pull (owner's decision O-06).
import { useCallback, useEffect, useState } from 'react'
import type { GitResult, GitState, MergePlan } from '../../../../shared/api'
import { T } from '../../../../shared/text'
import { errorMessage } from '../../lib/hooks'
import type { GitNotice } from '../GitPanels'

export function useGit(opts: { dataVersion: number; dirty: boolean; afterChange: () => Promise<void> }) {
  const { dataVersion, dirty, afterChange } = opts
  const [state, setState] = useState<GitState | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<GitNotice | null>(null)
  const [pushOffer, setPushOffer] = useState(false)
  /** A pull that needs decisions (M8): the merge window is open while this is set. */
  const [plan, setPlan] = useState<MergePlan | null>(null)

  // Git status follows every change of the data (saves, moves, links, refresh on window focus).
  useEffect(() => {
    let live = true
    const t = window.setTimeout(() => {
      void window.reqman
        .getGitState()
        .then((st) => live && setState(st))
        .catch(() => {})
    }, 250)
    return () => {
      live = false
      window.clearTimeout(t)
    }
  }, [dataVersion])

  const blocked = dirty ? T.git.blocked : null
  const dismiss = useCallback(() => setNotice(null), [])

  /** Runs a Git action that may change files and shows its outcome; true when it worked. */
  const perform = async (label: string, op: () => Promise<GitResult>): Promise<boolean> => {
    setBusy(label)
    setNotice(null)
    try {
      const r = await op()
      setState(r.state)
      if (!r.ok && r.plan) {
        setPlan(r.plan) // the merge window asks; nothing changed yet
        return false
      }
      setNotice({ ok: r.ok, message: r.message, ...(!r.ok && r.items ? { items: r.items } : {}) })
      if (r.ok) await afterChange() // a pull or a switch changes items; a push may tidy positions
      return r.ok
    } catch (e) {
      setNotice({ ok: false, message: errorMessage(e) })
      return false
    } finally {
      setBusy(null)
    }
  }
  /** Runs pull or push; true when it worked. */
  const run = (action: 'pull' | 'push'): Promise<boolean> => perform(action === 'pull' ? T.git.pulling : T.git.pushing, () => window.reqman[action]())

  /** The merge window closed: finished (result) or cancelled (null). */
  const mergeDone = (r: GitResult | null): void => {
    setPlan(null)
    if (!r) return
    setState(r.state)
    setNotice({ ok: r.ok, message: r.message, ...(!r.ok && r.items ? { items: r.items } : {}) })
    if (r.ok) void afterChange()
  }

  /** "Publish to GitHub": add the remote and push for the first time. */
  const publish = async (url: string): Promise<void> => {
    setBusy(T.git.pushing)
    setNotice(null)
    try {
      const r = await window.reqman.publishToRemote(url)
      setState(r.state)
      setNotice({ ok: r.ok, message: r.message })
    } catch (e) {
      setNotice({ ok: false, message: errorMessage(e) })
    } finally {
      setBusy(null)
    }
  }

  /** The Push button: offers to pull first when the branch is on the remote already (first push: nothing to pull). */
  const requestPush = (): void => {
    if (state?.upstream) {
      setNotice(null)
      setPushOffer(true)
    } else void run('push')
  }
  const answerPush = async (choice: 'pull-first' | 'push' | 'cancel'): Promise<void> => {
    setPushOffer(false)
    if (choice === 'cancel') return
    if (choice === 'pull-first' && !(await run('pull'))) return
    await run('push')
  }

  const onPanelResult = (r: GitResult): void => {
    setState(r.state)
    if (r.ok) {
      setNotice({ ok: true, message: r.message })
      void afterChange()
    }
  }

  return {
    state,
    reload: () => void window.reqman.getGitState().then(setState),
    busy,
    notice,
    dismiss,
    blocked,
    run,
    onPanelResult,
    requestPush,
    publish: (url: string) => void publish(url),
    pushOffer,
    answerPush: (c: 'pull-first' | 'push' | 'cancel') => void answerPush(c),
    plan,
    mergeDone,
    pullFrom: (name: string) => perform(T.git.pulling, () => window.reqman.pullFrom(name)),
    createBranch: (name: string) => perform(T.git.switching, () => window.reqman.createBranch(name)),
    switchBranch: (name: string, changes: 'take' | 'discard') => perform(T.git.switching, () => window.reqman.switchBranch(name, changes)),
    /** Delete a branch: the panel asks again when Git says it has unmerged commits (no notice for that question). */
    deleteBranch: async (name: string, force: boolean): Promise<{ ok: boolean; unmerged?: boolean; message: string }> => {
      try {
        const r = await window.reqman.deleteBranch(name, force)
        setState(r.state)
        const unmerged = !r.ok && r.unmerged === true
        if (!unmerged) setNotice({ ok: r.ok, message: r.message })
        return { ok: r.ok, message: r.message, ...(unmerged ? { unmerged } : {}) }
      } catch (e) {
        return { ok: false, message: errorMessage(e) }
      }
    }
  }
}
