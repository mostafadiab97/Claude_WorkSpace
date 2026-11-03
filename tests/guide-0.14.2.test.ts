// 0.14.2/0.14.3: the user guide inside the app — one page per section, and every contents link leads to a page.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { slug, splitGuide } from '../src/shared/guide'

const text = readFileSync('docs/USER-GUIDE.md', 'utf8')

describe('user guide pages', () => {
  it('first page = title, introduction and contents; then one page per numbered section, quick start first', () => {
    const pages = splitGuide(text)
    expect(pages[0]?.id).toBe('')
    expect(pages[0]?.md).toContain('## Contents')
    expect(pages[1]?.title).toMatch(/^1\. Quick start/)
    expect(pages.slice(1).every((p) => /^\d+\. /.test(p.title))).toBe(true)
    expect(pages.length).toBe(18)
  })
  it('every contents link points to a page', () => {
    const ids = new Set(splitGuide(text).map((p) => p.id))
    const links = [...text.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1] ?? '')
    expect(links.length).toBeGreaterThan(10)
    for (const l of links) expect(ids.has(l), `link #${l}`).toBe(true)
    expect(slug('16. What ReqMan can do — specification')).toBe('16-what-reqman-can-do--specification')
  })
})
