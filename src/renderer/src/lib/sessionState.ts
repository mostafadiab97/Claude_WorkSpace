// State that outlives a component for as long as the window is open (owner, 0.15.0 step 1: a self-test started in
// Settings must still be running — and show its result — after visiting another page). A running action keeps
// writing here even while its card is not shown. Not for texts (they change with the language).
import { useCallback, useSyncExternalStore } from 'react'

const values = new Map<string, unknown>()
const listeners = new Map<string, Set<() => void>>()

export function useSessionState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const subscribe = useCallback(
    (cb: () => void) => {
      const set = listeners.get(key) ?? new Set()
      set.add(cb)
      listeners.set(key, set)
      return () => set.delete(cb)
    },
    [key]
  )
  const value = useSyncExternalStore(subscribe, () => (values.has(key) ? (values.get(key) as T) : initial))
  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = values.has(key) ? (values.get(key) as T) : initial
      values.set(key, typeof next === 'function' ? (next as (p: T) => T)(prev) : next)
      for (const cb of listeners.get(key) ?? []) cb()
    },
    [key, initial]
  )
  return [value, setValue]
}
