// The Git bar's state and actions, and Compare's "pull first" (review S-03: grouped out of WorkspaceScreen).
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
  const [comparePulling, setComparePulling] = useState(false)
  const [comparePull, setComparePull] = useState<{ ok: boolean; message: string } | null>(null)

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

  const run = async (action: 'pull' | 'push'): Promise<void> => {
    setBusy(action === 'pull' ? T.git.pulling : T.git.pushing)
    setNotice(null)
    try {
      const r = await window.reqman[action]()
      setState(r.state)
      setNotice({ ok: r.ok, message: r.message, ...(!r.ok && r.items ? { items: r.items } : {}) })
      if (action === 'pull' && r.ok) await afterChange()
    } catch (e) {
      setNotice({ ok: false, message: errorMessage(e) })
    } finally {
      setBusy(null)
    }
  }

  const onPanelResult = (r: GitResult): void => {
    setState(r.state)
    if (r.ok) {
      setNotice({ ok: true, message: r.message })
      void afterChange()
    }
  }

  // Compare pulls first (owner's decision for M5), so "what the last pull brought in" is current.
  const pullForCompare = async (): Promise<void> => {
    const st = state ?? (await window.reqman.getGitState())
    if (!st.available || !st.hasRemote) {
      setComparePull(null)
      return
    }
    if (dirty) {
      setComparePull({ ok: false, message: T.git.blocked })
      return
    }
    setComparePulling(true)
    try {
      const r = await window.reqman.pull()
      setState(r.state)
      setComparePull({ ok: r.ok, message: r.message })
      if (r.ok) await afterChange()
    } catch (e) {
      setComparePull({ ok: false, message: errorMessage(e) })
    } finally {
      setComparePulling(false)
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
    pullForCompare,
    comparePulling,
    comparePull
  }
}
