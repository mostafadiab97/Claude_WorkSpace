// QA 0.22.0: old user themes, missing tokens, CSS variables in use, language switch with the new texts.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_THEME, validateTheme } from '../src/modules/theme'
import { tokensToCssVars } from '../src/renderer/src/theme/tokens'
import { setLanguage, T } from '../src/shared/text'

afterEach(() => setLanguage('en'))

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))

describe('old user theme.json', () => {
  it('an old file without the new tokens keeps the shipped values for them', () => {
    const old = { modes: { light: { primary: '#123456' }, dark: {} }, spacing: { lg: '20px', xl: '30px' } }
    const { theme, warnings } = validateTheme(old)
    expect(warnings).toEqual([])
    expect(theme.modes.light.primary).toBe('#123456')
    expect(theme.modes.light.borderStrong).toBe(DEFAULT_THEME.modes.light.borderStrong)
    expect(theme.modes.dark.successBg).toBe(DEFAULT_THEME.modes.dark.successBg)
    expect(theme.spacing.lg).toBe('20px')
    expect(theme.spacing.xxl).toBe('32px')
  })
  it('invalid values are ignored with a warning and never reach the variables as empty', () => {
    const bad = { spacing: { lg: 16, xl: '', md: null }, modes: { light: { borderStrong: ['x'] }, dark: 'nope' }, shape: 5 }
    const { theme, warnings } = validateTheme(bad)
    expect(warnings.length).toBe(6)
    expect(theme.spacing.lg).toBe(DEFAULT_THEME.spacing.lg)
    expect(theme.modes.light.borderStrong).toBe(DEFAULT_THEME.modes.light.borderStrong)
    const vars = tokensToCssVars(theme, 'light')
    expect(Object.values(vars).every((v) => typeof v === 'string' && v.trim() !== '')).toBe(true)
  })
  it('non-object and array files are ignored', () => {
    for (const v of [null, 5, 'x', [], [{ spacing: {} }]]) {
      const r = validateTheme(v)
      expect(r.theme).toEqual(DEFAULT_THEME)
      expect(r.warnings.length).toBe(1)
    }
  })
  it('a __proto__ key in the file does not pollute objects', () => {
    const r = validateTheme(JSON.parse('{"spacing":{"__proto__":"1px"},"modes":{"light":{"constructor":"x"}}}'))
    expect(({} as Record<string, unknown>).x).toBeUndefined()
    expect(Object.keys(r.theme.spacing)).not.toContain('__proto__')
  })
  it('shipped config/theme.json matches the built-in defaults', () => {
    const shipped = JSON.parse(readFileSync('config/theme.json', 'utf8'))
    const r = validateTheme(shipped, DEFAULT_THEME)
    expect(r.warnings).toEqual([])
    expect(r.theme).toEqual(DEFAULT_THEME)
  })
  it('light and dark define the same token names', () => {
    expect(Object.keys(DEFAULT_THEME.modes.light).sort()).toEqual(Object.keys(DEFAULT_THEME.modes.dark).sort())
  })
})

describe('CSS variables in use exist', () => {
  // QA-1 (0.22.0): --rm-font-size-md and --rm-shape-radius had no token (fixed: -medium, -radius-small)
  it('every var(--rm-*) without fallback in the renderer has a token (or is set in CSS/TSX itself)', () => {
    const files = walk('src/renderer/src').filter((f) => /\.(css|tsx?)$/.test(f))
    const text = files.map((f) => readFileSync(f, 'utf8')).join('\n')
    const defined = new Set([
      ...Object.keys(tokensToCssVars(DEFAULT_THEME, 'light')),
      ...[...text.matchAll(/(--rm-[a-z0-9-]+)\s*:/g)].map((m) => m[1])
    ])
    const used = new Set([...text.matchAll(/var\((--rm-[a-z0-9-]+)\)/g)].map((m) => m[1]))
    expect([...used].filter((u) => !defined.has(u))).toEqual([])
  })
})

describe('new texts in both languages', () => {
  it('settings.back, trace.backToTrace, columnsMenu.button and workspace.problemCount', () => {
    for (const lang of ['en', 'ar'] as const) {
      setLanguage(lang)
      for (const t of [T.settings.back, T.trace.backToTrace, T.columnsMenu.button(null, 5), T.columnsMenu.button(2, 5), T.workspace.problemCount(1), T.workspace.problemCount(0), T.workspace.problemCount(10005)]) {
        expect(typeof t).toBe('string')
        expect(t.trim()).not.toBe('')
        expect(t).not.toMatch(/undefined|NaN|\[object/)
      }
      expect(T.workspace.problemCount(10005)).toMatch(/10,?005/)
      expect(T.columnsMenu.button(2, 5)).toContain('2')
    }
    setLanguage('en')
    expect(T.workspace.problemCount(1)).toBe('1 problem')
    expect(T.workspace.problemCount(2)).toBe('2 problems')
  })
  it('settings.goBack text exists and differs per language', () => {
    const en = T.settings.versions.goBack
    setLanguage('ar')
    expect(T.settings.versions.goBack).not.toBe(en)
  })
})
