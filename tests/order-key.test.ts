import { describe, expect, it } from 'vitest'
import { isOrderKey, keyBetween, keyOfNumber, keysBetween } from '../src/modules/items'

describe('order keys (S-04)', () => {
  it('starts at a0 and counts up after the last key', () => {
    expect(keyBetween(null, null)).toBe('a0')
    expect(keyBetween('a0', null)).toBe('a1')
    expect(keyBetween('az', null)).toBe('b00')
    expect(keyBetween(null, 'a0')).toBe('Zz')
  })
  it('always finds a key between two neighbours, without touching them', () => {
    expect(keyBetween('a0', 'a1')).toBe('a0V')
    expect(keyBetween('a0', 'a0V')).toBe('a0G')
    expect(keyBetween('a0V', 'a1')).toBe('a0l')
    // 200 inserts into the same gap stay sorted and short enough
    let lo = 'a0'
    const hi = 'a1'
    for (let i = 0; i < 200; i++) {
      const k = keyBetween(lo, hi)
      expect(k > lo && k < hi).toBe(true)
      lo = k
    }
    expect(lo.length).toBeLessThan(45)
  })
  it('sorts like the old numbers, so old and new files mix', () => {
    const nums = [0, 5, 10, 20, 61, 62, 100, 1000, 3843, 3844, 100000]
    const keys = nums.map(keyOfNumber)
    expect([...keys].sort()).toEqual(keys)
    expect(keyOfNumber(10)).toBe('aA')
    expect(keyOfNumber(30)).toBe('aU')
    expect(keys.every(isOrderKey)).toBe(true)
    // a new key between two converted numbers
    const k = keyBetween(keyOfNumber(10), keyOfNumber(20))
    expect(k > 'aA' && k < 'aK').toBe(true)
  })
  it('spaces many keys evenly and short', () => {
    const ks = keysBetween(null, null, 100)
    expect(new Set(ks).size).toBe(100)
    expect([...ks].sort()).toEqual(ks)
    expect(Math.max(...ks.map((k) => k.length))).toBeLessThanOrEqual(3)
    const inner = keysBetween('a0', 'a1', 10)
    expect(inner.every((k) => k > 'a0' && k < 'a1')).toBe(true)
    expect([...inner].sort()).toEqual(inner)
  })
  it('rejects malformed keys', () => {
    expect(isOrderKey('a0')).toBe(true)
    expect(isOrderKey('a00')).toBe(false) // trailing zero
    expect(isOrderKey('b1')).toBe(false) // too short for its head
    expect(isOrderKey('a-')).toBe(false)
    expect(isOrderKey('')).toBe(false)
    expect(() => keyBetween('a1', 'a0')).toThrow()
  })
})
