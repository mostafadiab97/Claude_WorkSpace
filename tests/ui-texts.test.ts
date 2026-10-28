// Enforces the owner's decision S-06 (27 Oct 2026): every text the user sees lives in src/shared/text.ts.
// Screen code must not contain English words between JSX tags or in aria-label / title / placeholder / label
// attributes. (Data shown from the repository — titles, field names — is fine: it is never a literal.)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { T } from '../src/shared/text'

const uiDir = join(__dirname, '..', 'src', 'renderer', 'src')
// "<span>Some words</span>" or a line that is only words inside JSX; and attributes with a literal text
const JSX_TEXT = /(?<!=)>\s*[A-Za-z][A-Za-z ,.'’…()-]*[a-z][A-Za-z ,.'’…()-]*\s*</
// a line that is only words (text between tags written on its own line)
const LINE_TEXT = /^\s*[A-Z][a-z]+(?:[ ,]+[A-Za-z…'’.()-]+)*[.…]?\s*$/
const ATTR_TEXT = /\b(aria-label|title|placeholder|label|alt)="[^"]*[A-Za-z]{2}/

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? files(p) : name.endsWith('.tsx') ? [p] : []
  })
}

describe('all UI texts come from src/shared/text.ts', () => {
  it('has no hard-coded words in screen code', () => {
    const offenders: string[] = []
    for (const f of files(uiDir)) {
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const code = line.replace(/\/\/.*$|\{\/\*.*?\*\/\}/g, '')
          if (JSX_TEXT.test(code) || ATTR_TEXT.test(code) || LINE_TEXT.test(code)) offenders.push(`${relative(uiDir, f)}:${i + 1}: ${line.trim()}`)
        })
    }
    expect(offenders).toEqual([])
  })

  it('text functions produce readable sentences', () => {
    expect(T.common.items(1)).toBe('1 item')
    expect(T.common.items(10005)).toBe('10,005 items')
    expect(T.gitMsg.pushed(0)).toBe('Pushed.')
    expect(T.gitMsg.pushed(2)).toBe('Pushed (2 uncommitted changes were not included).')
    expect(T.fields.invalidAfter(1, 'Priority', 'SYS-1')).toMatch(/^1 item has a Priority value the new/)
  })
})
