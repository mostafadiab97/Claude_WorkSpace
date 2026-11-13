// 0.22.0 (the owner, 13 Nov 2026): German, French and Spanish join English and Arabic. Every language swaps every text,
// texts with values give strings, and only Arabic is right-to-left.
import { afterEach, describe, expect, it } from 'vitest'
import { isLanguage, isRtl, LANGUAGES, setLanguage, T } from '../src/shared/text'

/** Every leaf of T as [path, value]; functions are called with sample values. */
function leaves(v: unknown, path = ''): [string, unknown][] {
  if (typeof v === 'function') {
    try {
      return [[path, (v as (...a: unknown[]) => unknown)(2, 'X', 'Y', 'Z')]]
    } catch {
      return [] // a function that needs other values (objects, lists) — the compiler checks its type
    }
  }
  if (typeof v !== 'object' || v === null) return [[path, v]]
  return Object.entries(v).flatMap(([k, x]) => leaves(x, path ? `${path}.${k}` : k))
}

describe('languages (0.22.0)', () => {
  afterEach(() => setLanguage('en'))

  it('lists five languages, each named in its own language', () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(['en', 'de', 'fr', 'es', 'ar'])
    expect(isLanguage('de')).toBe(true)
    expect(isLanguage('xx')).toBe(false)
    expect(LANGUAGES.filter((l) => isRtl(l.code)).map((l) => l.code)).toEqual(['ar'])
  })

  it.each(['de', 'fr', 'es'] as const)('%s: every text is a non-empty string and most differ from English', (code) => {
    setLanguage('en')
    const english = new Map(leaves(T))
    setLanguage(code)
    const translated = leaves(T)
    expect(translated.length).toBe(english.size)
    for (const [path, value] of translated) {
      if (Array.isArray(value)) continue
      expect(typeof value, path).toBe('string')
      if (english.get(path) !== '') expect((value as string).length, path).toBeGreaterThan(0)
    }
    const same = translated.filter(([p, x]) => typeof x === 'string' && x === english.get(p)).length
    expect(same / translated.length).toBeLessThan(0.25) // names like reqochet, Git, CSV stay the same
  })
})
