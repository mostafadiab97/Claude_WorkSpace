import { useEffect, useState } from 'react'

/** Returns `value` once it has stopped changing for `ms` milliseconds (e.g. search-as-you-type). */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  // Electron prefixes errors that cross the bridge with "Error invoking remote method '…': Error: ".
  return raw.replace(/^Error invoking remote method '[^']+': (\w*Error: )?/, '')
}
