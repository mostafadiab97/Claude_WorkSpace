// 0.15 UI polish (UI/UX review of 0.14.5, docs/reviews/agents/0.14.5-ui-ux.md): the small rules behind it.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { importPath } from '../src/main/validate'
import { QUICK_START_PAGE, splitGuide } from '../src/shared/guide'

const guide = readFileSync('docs/USER-GUIDE.md', 'utf8')

describe('user guide (UX-12, UX-24)', () => {
  it('the start screen link leads to the quick start page', () => {
    expect(splitGuide(guide).some((p) => p.id === QUICK_START_PAGE)).toBe(true)
  })
  it('has no placeholder links such as <owner>', () => {
    expect(guide).not.toMatch(/github\.com\/<owner>|\(<owner>|%3Cowner%3E/i)
  })
})

describe('a file dropped on the import window (UX-23)', () => {
  const ext = ['xlsx', 'csv', 'reqif']
  it('accepts an absolute path with an import extension', () => {
    expect(importPath('C:\\Users\\x\\Reqs.XLSX', ext)).toBe('C:\\Users\\x\\Reqs.XLSX')
    expect(importPath('/home/x/r.csv', ext)).toBe('/home/x/r.csv')
    expect(importPath('\\\\server\\share\\r.reqif', ext)).toBe('\\\\server\\share\\r.reqif')
  })
  it('refuses relative paths, other file types and odd values', () => {
    expect(() => importPath('r.csv', ext)).toThrow()
    expect(() => importPath('C:\\x\\evil.exe', ext)).toThrow()
    expect(() => importPath('C:\\x\\a.csv\0.exe', ext)).toThrow()
    expect(() => importPath(42, ext)).toThrow()
  })
})
