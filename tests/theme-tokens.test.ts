// Enforces NFR-11: UI code must use theme tokens (var(--rm-...)), never literal colours.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const uiDir = join(__dirname, '..', 'src', 'renderer', 'src')
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? files(p) : /\.(css|tsx?)$/.test(name) ? [p] : []
  })
}

describe('UI uses theme tokens only', () => {
  it('has no hard-coded colours in renderer code', () => {
    const offenders: string[] = []
    for (const f of files(uiDir)) {
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const code = line.replace(/\/\/.*$|\/\*.*?\*\//g, '')
          if (COLOUR.test(code)) offenders.push(`${relative(uiDir, f)}:${i + 1}: ${line.trim()}`)
        })
    }
    expect(offenders).toEqual([])
  })
})
