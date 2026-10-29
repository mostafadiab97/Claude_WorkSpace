// State of the Changes view (owner's decision O-06): which versions are shown, the result, the selected item.
// Shared by the middle area (ChangesView) and the side panel (ChangesSide), so it lives in WorkspaceScreen.
import { useEffect, useMemo, useState } from 'react'
import type { CompareEntry, CompareOptions, CompareResult } from '../../../../shared/api'
import { errorMessage } from '../../lib/hooks'
import { rangeOf, WORKING, type Preset } from '../compareRange'

export function useChanges(open: boolean, dataVersion: number) {
  const [options, setOptions] = useState<CompareOptions | null>(null)
  const [preset, setPreset] = useState<Preset>('uncommitted')
  const [custom, setCustom] = useState({ from: '', to: WORKING })
  const [result, setResult] = useState<{ key: string; data: CompareResult } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** Whether the user already answered "pull first?" since opening the view. */
  const [pullAnswered, setPullAnswered] = useState(false)
  /** The branch reviewed like a pull request (M8-2) and its range (common ancestor → branch). */
  const [branch, setBranch] = useState<{ name: string; range: { from: string; to: string } | null } | null>(null)

  // options (commits, last pull) follow every change of the data while the view is open
  useEffect(() => {
    if (!open) return
    let live = true
    void window.reqman
      .getCompareOptions()
      .then((o) => {
        if (!live) return
        setOptions(o)
        setCustom((c) => (c.from ? c : { from: o.commits[1]?.hash ?? o.commits[0]?.hash ?? '', to: WORKING }))
      })
      .catch((e: unknown) => live && setError(errorMessage(e)))
    return () => {
      live = false
    }
  }, [open, dataVersion])

  const range = options ? rangeOf(preset, options, custom, branch?.range ?? null) : null
  const key = range ? `${range.from}..${range.to}` : ''
  // the working folder changes with every save, so uncommitted changes are compared again then
  const reload = range?.to === WORKING ? dataVersion : 0
  useEffect(() => {
    if (!open || !range) return
    let live = true
    void window.reqman
      .compareVersions(range.from, range.to)
      .then((data) => {
        if (!live) return
        setResult({ key: `${range.from}..${range.to}`, data })
        setError(null)
      })
      .catch((e: unknown) => live && setError(errorMessage(e)))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key stands for range
  }, [open, key, reload])

  const data = result && result.key === key ? result.data : null
  // the selected item, or the first one, so a difference is always shown
  const selected: CompareEntry | null = useMemo(() => data?.entries.find((e) => e.id === selectedId) ?? data?.entries[0] ?? null, [data, selectedId])

  return {
    options,
    preset,
    choose: (p: Preset): void => {
      setPreset(p)
      setSelectedId(null)
      if (p !== 'lastPull') setPullAnswered(false)
    },
    branch,
    /** Shows what `name` would bring into the current branch. */
    chooseBranch: async (name: string): Promise<void> => {
      setSelectedId(null)
      setPreset('branch')
      setBranch({ name, range: null })
      try {
        const r = await window.reqman.branchRange(name)
        setBranch({ name, range: r })
      } catch (e) {
        setError(errorMessage(e))
      }
    },
    custom,
    setCustom,
    range,
    data,
    loading: open && range !== null && !data && !error,
    error,
    setError,
    selected,
    select: setSelectedId,
    pullAnswered,
    answerPull: () => setPullAnswered(true),
    reset: (): void => {
      setPreset('uncommitted')
      setSelectedId(null)
      setPullAnswered(false)
    }
  }
}

export type ChangesState = ReturnType<typeof useChanges>
