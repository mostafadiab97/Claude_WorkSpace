// The app's one icon set (visual review V-31/V-32, 12 Nov 2026): small line drawings in place of typed characters
// (gear, triangles, arrows…), so every icon has the same weight and size in every font and on every PC.
// Each icon is 16 px by default, drawn with the text colour of its place (currentColor) and hidden from screen
// readers — the button around it carries the name (aria-label), exactly as before.
//
// The paths are from Lucide (https://lucide.dev), used unchanged. No package is installed; the licence notice
// that must travel with the paths follows.
//
//   ISC License
//
//   Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
//   All other copyright (c) for Lucide are held by Lucide Contributors 2022.
//
//   Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby
//   granted, provided that the above copyright notice and this permission notice appear in all copies.
//
//   THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING
//   ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL,
//   DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
//   WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE
//   USE OR PERFORMANCE OF THIS SOFTWARE.
import type { ReactNode } from 'react'

const line = (x1: number, y1: number, x2: number, y2: number): ReactNode => <line x1={x1} y1={y1} x2={x2} y2={y2} />
const dot = (cx: number, cy: number): ReactNode => <circle cx={cx} cy={cy} r={1} />

/** Icon name → its shapes on a 24 × 24 grid (Lucide's grid; the stroke is set once on the <svg>). */
const SHAPES = {
  settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx={12} cy={12} r={3} />
    </>
  ),
  close: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronUp: <path d="m18 15-6-6-6 6" />,
  /** Points in the reading direction (mirrored in Arabic by the `icon--dir` class). */
  chevronForward: <path d="m9 18 6-6-6-6" />,
  arrowUp: (
    <>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </>
  ),
  arrowDown: (
    <>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </>
  ),
  /** Points against the reading direction: "back" (mirrored in Arabic). */
  arrowBack: (
    <>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </>
  ),
  branch: (
    <>
      {line(6, 3, 6, 15)}
      <circle cx={18} cy={6} r={3} />
      <circle cx={6} cy={18} r={3} />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
    </>
  ),
  warning: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      {line(10, 11, 10, 17)}
      {line(14, 11, 14, 17)}
    </>
  ),
  grip: (
    <>
      {dot(9, 12)}
      {dot(9, 5)}
      {dot(9, 19)}
      {dot(15, 12)}
      {dot(15, 5)}
      {dot(15, 19)}
    </>
  ),
  expandAll: (
    <>
      <path d="m7 15 5 5 5-5" />
      <path d="m7 9 5-5 5 5" />
    </>
  ),
  collapseAll: (
    <>
      <path d="m7 20 5-5 5 5" />
      <path d="m7 4 5 5 5-5" />
    </>
  ),
  filter: (
    <>
      <path d="M3 6h18" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </>
  ),
  columns: (
    <>
      <rect width={18} height={18} x={3} y={3} rx={2} />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  // 0.23.0: the colour-mode switch (sun = Light, moon = Dark, flame = Ember, monitor = System)
  sun: (
    <>
      <circle cx={12} cy={12} r={4} />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </>
  ),
  // opens in the web browser (0.22.1)
  external: <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />,
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
  monitor: (
    <>
      <rect width={20} height={14} x={2} y={3} rx={2} />
      {line(8, 21, 16, 21)}
      {line(12, 17, 12, 21)}
    </>
  )
} as const

export type IconName = keyof typeof SHAPES

/** The icons that follow the reading direction: drawn for left-to-right, mirrored in the right-to-left window. */
const DIRECTIONAL: ReadonlySet<IconName> = new Set<IconName>(['chevronForward', 'arrowBack'])

/**
 * One icon of the set. `size` in px (16 by default; 14 inside small buttons). Decorative: the control around it
 * has the accessible name.
 */
export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  const classes = ['icon', DIRECTIONAL.has(name) ? 'icon--dir' : '', className ?? ''].filter(Boolean).join(' ')
  return (
    <svg className={classes} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {SHAPES[name]}
    </svg>
  )
}

/** The open / closed mark of a foldable row: down when open, pointing in the reading direction when closed. */
export function Chevron({ open, size = 14 }: { open: boolean; size?: number }) {
  return <Icon name={open ? 'chevronDown' : 'chevronForward'} size={size} />
}
