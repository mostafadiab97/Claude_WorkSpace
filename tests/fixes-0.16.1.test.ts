// The owner's points on 0.16.0 (4 Nov 2026): brand drawings, the top bar that cut off the Git questions.
import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const brand = (f: string): string => readFileSync(`resources/brand/${f}`, 'utf8')
const pupils = (svg: string): string[] => [...svg.matchAll(/<circle[^>]*r="([\d.]+)"[^>]*fill="(#[0-9A-Fa-f]+)"/g)].map((m) => `${m[1]} ${m[2]}`)

describe('brand drawings (0.16.1)', () => {
  it('BR-02: the small cut exists on the white tile, idle and thinking', () => {
    for (const st of ['idle', 'thinking']) {
      const f = `motion/reqochet-eyes-${st}-light-small.svg`
      expect(existsSync(`resources/brand/${f}`)).toBe(true)
      expect(brand(f)).toContain('fill="#ffffff"/>')
    }
  })
  it('the moving small eyes are as large as the resting small icon (the face keeps its size)', () => {
    const still = pupils(brand('icon/reqochet-icon-light-small.svg')).map((p) => p.split(' ')[0])
    expect(pupils(brand('motion/reqochet-eyes-idle-light-small.svg')).map((p) => p.split(' ')[0])).toEqual(still)
    expect(pupils(brand('motion/reqochet-eyes-thinking-small.svg')).map((p) => p.split(' ')[0])).toEqual(still)
  })
  it('the eyes on the dark tile use the lighter red and green', () => {
    for (const f of ['motion/reqochet-eyes-idle.svg', 'motion/reqochet-eyes-idle-small.svg', 'motion/reqochet-eyes-thinking.svg', 'motion/reqochet-eyes-thinking-small.svg', 'icon/reqochet-icon.svg', 'icon/reqochet-icon-small.svg']) {
      expect(pupils(brand(f)).map((p) => p.split(' ')[1])).toEqual(['#FF5C61', '#3CD873'])
    }
    expect(pupils(brand('motion/reqochet-eyes-idle-light-small.svg')).map((p) => p.split(' ')[1])).toEqual(['#D7262B', '#1F9D48'])
  })
})

describe('top bar (0.16.1)', () => {
  it('clips sideways only, so the Git questions below it stay visible', () => {
    const css = readFileSync('src/renderer/src/styles.css', 'utf8')
    const rules = [...css.matchAll(/\n\.topbar \{([^}]*)\}/g)].map((m) => m[1]).join('')
    expect(rules).not.toMatch(/overflow:\s*hidden/)
    expect(rules).toMatch(/overflow-y:\s*visible/)
  })
})

