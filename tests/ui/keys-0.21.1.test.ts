// 0.21.1 (review W-51, UW-06): arrow keys and the closed triangle follow the reading direction.
import { afterEach, describe, expect, it } from 'vitest'
import { arrowDirection, closedMark } from '../../src/renderer/src/lib/keys'

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
    expect(closedMark()).toBe('▸')
  })
  it('right-to-left (Arabic): ← forward, → back, and the triangle points left', () => {
    setDir('rtl')
    expect(arrowDirection('ArrowLeft')).toBe('forward')
    expect(arrowDirection('ArrowRight')).toBe('back')
    expect(closedMark()).toBe('◂')
  })
})
