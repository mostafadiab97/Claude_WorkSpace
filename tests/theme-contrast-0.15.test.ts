// 0.15 (UI review UX-05): the text colours of the built-in theme are readable — WCAG contrast 4.5:1 for normal text —
// on the window background and on cards, in Light and Dark; button text on the primary colour as well.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const theme = JSON.parse(readFileSync('config/theme.json', 'utf8')) as { modes: Record<'light' | 'dark' | 'ember', Record<string, string>> }

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string): number => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number]
  return (x + 0.05) / (y + 0.05)
}

describe('theme contrast (UX-05)', () => {
  for (const mode of ['light', 'dark', 'ember'] as const) {
    const m = theme.modes[mode]
    for (const fg of ['text', 'textMuted', 'primary', 'success', 'warning', 'danger']) {
      for (const bg of ['background', 'surface']) {
        it(`${mode}: ${fg} on ${bg} ≥ 4.5`, () => {
          expect(contrast(m[fg] as string, m[bg] as string)).toBeGreaterThanOrEqual(4.5)
        })
      }
    }
    it(`${mode}: button text on primary ≥ 4.5`, () => {
      expect(contrast(m['primaryText'] as string, m['primary'] as string)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
