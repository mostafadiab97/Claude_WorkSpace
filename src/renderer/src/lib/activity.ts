// "The app is working" for the brand face in the top bar (the eyes look busy — owner, 4 Nov 2026, R-08): opening a
// repository, pull, push, switching branches, the self-tests, import. Callers mark the start and the end.
import { useSyncExternalStore } from 'react'

let running = 0
const listeners = new Set<() => void>()
const notify = (): void => {
  for (const l of listeners) l()
}

/** Marks the start of a piece of work; call the returned function when it ends (also on failure). */
export function beginActivity(): () => void {
  running += 1
  notify()
  let done = false
  return () => {
    if (done) return
    done = true
    running = Math.max(0, running - 1)
    notify()
  }
}

/** Runs `work` as a marked piece of work. */
export async function withActivity<T>(work: () => Promise<T>): Promise<T> {
  const end = beginActivity()
  try {
    return await work()
  } finally {
    end()
  }
}

export function useActivity(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => running > 0
  )
}

/** True while the window is in front (the eyes rest when it is in the background). */
export function useWindowActive(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('focus', cb)
      window.addEventListener('blur', cb)
      return () => {
        window.removeEventListener('focus', cb)
        window.removeEventListener('blur', cb)
      }
    },
    () => document.hasFocus()
  )
}
