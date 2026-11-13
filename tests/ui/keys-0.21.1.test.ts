// 0.21.1 (review W-51, UW-06): arrow keys follow the reading direction (the closed mark is an icon mirrored by CSS since the visual polish).
import { afterEach, describe, expect, it } from 'vitest'
import { arrowDirection } from '../../src/renderer/src/lib/keys'

const setDir = (dir: string): void => {
  ;(globalThis as { document?: unknown }).document = { documentElement: { dir } }
}

describe('reading-direction keys', () => {
  afterEach(() => {
    delete (globalThis as { document?: unknown }).document
  })
  it('left-to-right: → forward (open, wider, next tab), ← back', () => {
    setDir('ltr')
    expect(arrowDirection('ArrowRight')).toBe('forward')
    expect(arrowDirection('ArrowLeft')).toBe('back')
    expect(arrowDirection('ArrowDown')).toBeNull()
  })
  it('right-to-left (Arabic): ← forward, → back', () => {
    setDir('rtl')
    expect(arrowDirection('ArrowLeft')).toBe('forward')
    expect(arrowDirection('ArrowRight')).toBe('back')
  })
})
