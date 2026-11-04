// QA 0.16.0 (helper agent, docs/AGENT-WORKFLOW.md): the window's brand helpers (which drawing for which mode, size and
// state) and the "app is working" counter behind the top-bar face. See docs/reviews/agents/0.16.0-qa.md.
import { describe, expect, it, vi } from 'vitest'

// useActivity reads a module-level counter through useSyncExternalStore; outside React, read the snapshot directly.
vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), useSyncExternalStore: (_s: unknown, get: () => unknown) => get() }))

const { BrandFace, BrandName, BrandBusy } = await import('../../src/renderer/src/components/Brand')
const { beginActivity, useActivity, withActivity } = await import('../../src/renderer/src/lib/activity')

type El = { props: Record<string, unknown> }
const srcOf = (el: unknown): string => String((el as El).props.src)
// Vite inlines small SVGs as data URLs: map each URL back to its file name with the same imports
const brandFiles = (import.meta as unknown as { glob(p: string, o: object): unknown }).glob('../../resources/brand/**/*.svg', { eager: true, import: 'default' }) as Record<string, string>
const byUrl = new Map(Object.entries(brandFiles).map(([path, url]) => [url, path.split('/').pop() ?? path]))
const file = (el: unknown): string => byUrl.get(srcOf(el)) ?? `unknown:${srcOf(el).slice(0, 40)}`

describe('QA BrandFace picks the right drawing', () => {
  const states = ['idle', 'thinking', 'still'] as const
  it('every mode / state / size gives a drawing from resources/brand, never empty', () => {
    for (const mode of ['light', 'dark'] as const)
      for (const state of states)
        for (const size of [16, 24, 28, 31, 32, 88]) {
          const el = BrandFace({ mode, state, size })
          expect(file(el), `${mode}/${state}/${size}`).toMatch(/^reqochet-.*\.svg/)
          expect((el as El).props.width).toBe(size)
          expect((el as El).props['data-state']).toBe(state)
        }
  })

  it('dark window uses the white-tile ("light") files; light window the dark-tile files', () => {
    for (const state of states) {
      expect(file(BrandFace({ mode: 'dark', state, size: 88 })), state).toMatch(/-light[.-]/)
      expect(file(BrandFace({ mode: 'light', state, size: 88 })), state).not.toMatch(/-light[.-]/)
    }
  })

  it('light window: small cut below 32 px, full drawing from 32 px (brand rule)', () => {
    for (const state of states) {
      expect(file(BrandFace({ mode: 'light', state, size: 28 })), state).toMatch(/-small/)
      expect(file(BrandFace({ mode: 'light', state, size: 32 })), state).not.toMatch(/-small/)
    }
  })

  it('the states differ: idle eyes, thinking eyes, still = plain icon', () => {
    expect(file(BrandFace({ mode: 'light', state: 'idle', size: 28 }))).toMatch(/eyes-idle/)
    expect(file(BrandFace({ mode: 'light', state: 'thinking', size: 28 }))).toMatch(/eyes-thinking/)
    expect(file(BrandFace({ mode: 'light', state: 'still', size: 28 }))).toMatch(/icon/)
    expect(file(BrandFace({ mode: 'dark', state: 'still', size: 28 }))).toMatch(/icon-light-small/)
  })

  it('the name is never drawn narrower than 100 px; the busy icon has a default size', () => {
    expect((BrandName({ mode: 'light', width: 40 }) as El).props.width).toBe(100)
    expect((BrandName({ mode: 'dark', width: 240 }) as El).props.width).toBe(240)
    expect(file(BrandName({ mode: 'dark', width: 240 }))).toMatch(/on-dark/)
    expect((BrandBusy({}) as El).props.width).toBe(24)
  })
})

describe('QA activity counter (top-bar face "thinking")', () => {
  it('starts idle; nested work stays busy until the last one ends', () => {
    expect(useActivity()).toBe(false)
    const a = beginActivity()
    const b = beginActivity()
    expect(useActivity()).toBe(true)
    a()
    expect(useActivity()).toBe(true)
    b()
    expect(useActivity()).toBe(false)
  })

  it('ending twice does not end someone else\'s work, and the count never goes below zero', () => {
    const a = beginActivity()
    const b = beginActivity()
    a()
    a()
    a()
    expect(useActivity()).toBe(true) // b is still running
    b()
    b()
    expect(useActivity()).toBe(false)
    const c = beginActivity()
    expect(useActivity()).toBe(true) // no negative balance swallowed the new start
    c()
    expect(useActivity()).toBe(false)
  })

  it('withActivity ends on failure and passes the error on', async () => {
    await expect(withActivity(async () => { throw new Error('pull failed') })).rejects.toThrow('pull failed')
    expect(useActivity()).toBe(false)
    let during = false
    expect(await withActivity(async () => { during = useActivity(); return 7 })).toBe(7)
    expect(during).toBe(true)
    expect(useActivity()).toBe(false)
  })

  it('many overlapping pieces of work (100) end cleanly in any order', () => {
    const ends = Array.from({ length: 100 }, () => beginActivity())
    for (let i = ends.length - 1; i >= 0; i -= 2) ends[i]!()
    expect(useActivity()).toBe(true)
    for (const e of ends) e()
    expect(useActivity()).toBe(false)
  })
})
