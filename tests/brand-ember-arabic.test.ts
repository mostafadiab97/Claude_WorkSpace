// The Ember set of the brand drawings and the Arabic name (owner, 13 Nov 2026): made by tools/brand-ember.mjs and
// tools/brand-wordmark-ar.py — same shapes as the originals, colours only. Which file the window picks is tested in
// tests/ui/qa-0.16.0-brand.test.ts.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const brand = (f: string): string => readFileSync(`resources/brand/${f}`, 'utf8')
const shape = (svg: string): string => svg.replace(/#[0-9a-fA-F]{6}/g, '#')
const outlines = (svg: string): string[] => [...svg.matchAll(/ d="([^"]+)"/g)].flatMap((m) => (m[1] ?? '').split(/(?=M)/)).sort()
const tokens = JSON.parse(brand('brand-tokens.json')) as { ember: Record<string, string>; logo: { arabic: { widthOfEnglish: number } } }
const theme = JSON.parse(readFileSync('config/theme.json', 'utf8')) as { modes: { ember: Record<string, string> }; typography: Record<string, string> }

describe('Ember brand set', () => {
  it('tile, eyes and busy icon are the dark-tile drawings with other colours', () => {
    for (const [ember, original] of [
      ['icon/reqochet-icon-ember.svg', 'icon/reqochet-icon.svg'],
      ['icon/reqochet-icon-ember-small.svg', 'icon/reqochet-icon-small.svg'],
      ['icon/reqochet-icon-ember-16.svg', 'icon/reqochet-icon-16.svg'],
      ['icon/reqochet-icon-ember-20.svg', 'icon/reqochet-icon-20.svg'],
      ['motion/reqochet-eyes-idle-ember.svg', 'motion/reqochet-eyes-idle.svg'],
      ['motion/reqochet-eyes-idle-ember-small.svg', 'motion/reqochet-eyes-idle-small.svg'],
      ['motion/reqochet-eyes-thinking-ember.svg', 'motion/reqochet-eyes-thinking.svg'],
      ['motion/reqochet-eyes-thinking-ember-small.svg', 'motion/reqochet-eyes-thinking-small.svg'],
      ['motion/reqochet-loading-icon-ember.svg', 'motion/reqochet-loading-icon.svg']
    ] as const)
      expect(shape(brand(ember)), ember).toBe(shape(brand(original)))
  })

  it('the name keeps every outline of the English logo (the q and o in a path of their own)', () => {
    expect(outlines(brand('logo/reqochet-logo-on-ember.svg'))).toEqual(outlines(brand('logo/reqochet-logo-on-light.svg')))
    expect(outlines(brand('motion/reqochet-loading-on-ember.svg'))).toEqual(outlines(brand('motion/reqochet-loading-on-light.svg')))
  })

  it('uses the colours of the Ember mode; the eyes stay red and green', () => {
    expect(tokens.ember['orange']).toBe(theme.modes.ember['primary'])
    expect(tokens.ember['warmWhite']).toBe(theme.modes.ember['text'])
    expect(tokens.ember['tile']).toBe(theme.modes.ember['surfaceAlt'])
    expect(tokens.ember['background']).toBe(theme.modes.ember['background'])
    for (const f of ['logo/reqochet-logo-on-ember.svg', 'icon/reqochet-icon-ember.svg', 'logo/reqochet-logo-ar-on-ember.svg']) {
      expect(brand(f), f).toMatch(/<circle[^>]*fill="#FF5C61"\/>\s*<circle[^>]*fill="#3CD873"\/>/)
      expect(brand(f), f).toContain(theme.modes.ember['primary'] ?? '?')
    }
  })
})

describe('Arabic name', () => {
  it('carries the q and o of the English logo unchanged, with their dots', () => {
    const english = outlines(brand('logo/reqochet-logo-on-light.svg'))
    const sizes = (o: string): string => {
      // an outline without its place: every x made relative to the first one
      const n = (o.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
      return o.replace(/[\d.\s-]+/g, '') + (n[1] ?? 0)
    }
    for (const mode of ['light', 'dark', 'ember']) {
      const svg = brand(`logo/reqochet-logo-ar-on-${mode}.svg`)
      const eyes = (svg.match(/ d="([^"]+)"/g) ?? []).pop() ?? ''
      const parts = eyes.replace(/^ d="|"$/g, '').split(/(?=M)/)
      expect(parts.length, mode).toBe(4) // q: ring and counter; o: ring and counter
      for (const p of parts) expect(english.map(sizes), mode).toContain(sizes(p))
      expect(svg.match(/r="93\.3"/g)?.length, mode).toBe(2)
    }
    expect(brand('logo/reqochet-logo-ar-on-light.svg')).toMatch(/fill="#D7262B"\/>\s*<circle[^>]*fill="#1F9D48"\/>/)
  })

  it('has the width the window counts with (same letter height as the English name)', () => {
    const box = (f: string): number[] => (brand(f).match(/viewBox="([^"]+)"/)?.[1] ?? '').split(' ').map(Number)
    const width = (box('logo/reqochet-logo-ar-on-light.svg')[2] ?? 0) / (box('logo/reqochet-logo-on-light.svg')[2] ?? 1)
    expect(width).toBeCloseTo(tokens.logo.arabic.widthOfEnglish, 3)
    expect(readFileSync('src/renderer/src/components/Brand.tsx', 'utf8')).toContain(`ARABIC_WIDTH = ${tokens.logo.arabic.widthOfEnglish}`)
  })
})

describe('Ember heading typeface', () => {
  it('is a theme token, bundled with its licence, with a fallback that can draw Arabic', () => {
    expect(theme.typography['fontFamilyHeadingEmber']).toMatch(/^'Source Serif 4', .*'Segoe UI'/)
    const dir = 'src/renderer/src/assets/fonts/source-serif-4'
    expect(readFileSync(`${dir}/OFL.txt`, 'utf8')).toContain('SIL Open Font License, Version 1.1')
    const css = readFileSync('src/renderer/src/styles.css', 'utf8')
    for (const f of css.match(/source-serif-4-[a-z-]+\.woff2/g) ?? ['missing']) expect(readFileSync(`${dir}/${f}`).length).toBeGreaterThan(10000)
    expect(css).toContain('font-family: var(--rm-font-family-heading-ember)')
  })
})
