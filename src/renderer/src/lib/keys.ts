// Arrow keys that follow the reading direction: in Arabic (right-to-left) the right arrow goes back (W-51, UW-06).
import type { KeyboardEvent } from 'react'
import { isRtlDocument } from './language'

/** "forward" / "back" for the left and right arrows in the window's reading direction; null for other keys. */
export function arrowDirection(key: string): 'forward' | 'back' | null {
  if (key !== 'ArrowRight' && key !== 'ArrowLeft') return null
  const right = key === 'ArrowRight'
  return right !== isRtlDocument() ? 'forward' : 'back'
}

/**
 * Keyboard for a row of tabs (put it on the element with role="tablist"): the arrows move to the next or previous tab
 * in the reading direction, Home and End to the first and last; the tab is focused and chosen (UW-06).
 */
export function onTabListKeyDown(e: KeyboardEvent<HTMLElement>): void {
  const tabs = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])')]
  if (tabs.length < 2) return
  const at = tabs.indexOf(document.activeElement as HTMLElement)
  if (at < 0) return
  const dir = arrowDirection(e.key)
  const to = dir === 'forward' ? (at + 1) % tabs.length : dir === 'back' ? (at - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1
  if (to < 0) return
  e.preventDefault()
  tabs[to]?.focus()
  tabs[to]?.click()
}

/** The "closed" triangle points in the reading direction: ▸ in English, ◂ in Arabic (W-51). */
export const closedMark = (): string => (isRtlDocument() ? '◂' : '▸')
