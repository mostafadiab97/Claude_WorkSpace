import { useEffect, useRef, useState, type RefObject } from 'react'

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

/**
 * Keyboard for a modal dialog (UI review 0.25.0 U8): the focus moves into the panel when it opens, Tab stays inside it,
 * Esc closes it, and the focus goes back to where it was when it closes.
 */
export function useModalKeys(panel: RefObject<HTMLElement | null>, onClose: () => void): void {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    const box = panel.current
    const focusable = (): HTMLElement[] =>
      [...(box?.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])') ?? [])].filter((e) => !(e as HTMLButtonElement).disabled && e.offsetParent !== null)
    // the first control of the body (a checked radio rather than the first of its group), else the panel itself
    const body = focusable().filter((e) => e.closest('.modal__body') && (!(e instanceof HTMLInputElement) || e.type !== 'radio' || e.checked))
    if (box && !box.contains(document.activeElement)) (body[0] ?? focusable()[0] ?? box).focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close.current()
      } else if (e.key === 'Tab') {
        const list = focusable()
        const first = list[0]
        const last = list[list.length - 1]
        if (!first || !last) return
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    box?.addEventListener('keydown', onKey)
    return () => {
      box?.removeEventListener('keydown', onKey)
      if (before && document.contains(before)) before.focus()
    }
  }, [panel])
}
