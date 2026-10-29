// The Git bar's state and actions (review S-03: grouped out of WorkspaceScreen). No automatic pulls: Push first
// offers to pull (owner's decision O-06).
import { useEffect, useState } from 'react'
import type { GitResult, GitState } from '../../../../shared/api'
import { T } from '../../../../shared/text'
import { errorMessage } from '../../lib/hooks'
import type { GitNotice } from '../GitPanels'

export function useGit(opts: { dataVersion: number; dirty: boolean; afterChange: () => Promise<void> }) {
  const { dataVersion, dirty, afterChange } = opts
  const [state, setState] = useState<GitState | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<GitNotice | null>(null)
  const [pushOffer, setPushOffer] = useState(false)

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

  /** Runs pull or push; true when it worked. */
  const run = async (action: 'pull' | 'push'): Promise<boolean> => {
    setBusy(action === 'pull' ? T.git.pulling : T.git.pushing)
    setNotice(null)
    try {
      const r = await window.reqman[action]()
      setState(r.state)
      setNotice({ ok: r.ok, message: r.message, ...(!r.ok && r.items ? { items: r.items } : {}) })
      if (r.ok) await afterChange() // a pull changes items; a push may tidy positions
      return r.ok
    } catch (e) {
      setNotice({ ok: false, message: errorMessage(e) })
      return false
    } finally {
      setBusy(null)
    }
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
    dismiss: () => setNotice(null),
    blocked,
    run,
    onPanelResult,
    requestPush,
    publish: (url: string) => void publish(url),
    pushOffer,
    answerPush: (c: 'pull-first' | 'push' | 'cancel') => void answerPush(c)
  }
}
