// QA 0.24.0: contrastRatio / isHexColour with short, long and bad input.
import { describe, expect, it } from 'vitest'
import { contrastRatio, isHexColour } from '../../src/renderer/src/lib/contrast'

describe('contrast', () => {
  it('black on white is 21, same colour is 1, order does not matter', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#000')).toBeCloseTo(21, 5)
    expect(contrastRatio('#abc', '#abc')).toBeCloseTo(1, 10)
  })
  it('#rgb equals #rrggbb, upper case and spaces are fine', () => {
    expect(contrastRatio('#f80', '#000')).toBeCloseTo(contrastRatio('#ff8800', '#000000'), 10)
    expect(contrastRatio(' #FFF ', '#000')).toBeCloseTo(21, 5)
  })
  it('isHexColour', () => {
    for (const ok of ['#fff', '#FFFFFF', ' #123abc ']) expect(isHexColour(ok)).toBe(true)
    for (const no of ['', '#', '#ff', '#ffff', '#fffff', '#fffffff', 'fff', '#ggg', 'red', 'rgb(0,0,0)', '#12345g', '#fff;'])
      expect(isHexColour(no)).toBe(false)
  })
  it('bad input gives NaN, never a throw (the caller must check isHexColour first)', () => {
    expect(() => contrastRatio('red', '#fff')).not.toThrow()
    expect(Number.isNaN(contrastRatio('red', '#fff'))).toBe(true)
    expect(Number.isNaN(contrastRatio('', ''))).toBe(true)
  })
  it.fails('#rgba / #rrggbbaa are not hex colours here, yet CSS accepts them (editor treats them as non-colour)', () => {
    expect(isHexColour('#ffff')).toBe(true)
  })
})
