// 0.14.2: the user guide inside the app — its sections for the left panel and anchors matching the guide's own links.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// the renderer module imports the guide with Vite's ?raw; here the same file is read directly
const text = readFileSync('docs/USER-GUIDE.md', 'utf8')
const slug = (t: string): string =>
  t
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-')

describe('user guide', () => {
  it('starts with the quick start and every table-of-contents link has a matching section', () => {
    const sections = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1] ?? '')
    expect(sections[1]).toMatch(/^1\. Quick start/)
    const ids = new Set(sections.map(slug))
    const links = [...text.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1])
    expect(links.length).toBeGreaterThan(10)
    for (const l of links) expect(ids.has(l ?? ''), `link #${l}`).toBe(true)
  })
})
