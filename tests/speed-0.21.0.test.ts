// 0.21.0 speed (review 2026-11-10, W-20…W-23): correctness of the fast paths; timings are in the perf tests.
import { describe, expect, it } from 'vitest'
import { parseItemFile, readStructure } from '../src/modules/items'

describe('readStructure (W-20)', () => {
  const file = (header: string): string => `---\n${header}\n---\nText\n`
  it('reads id, parent and order exactly like the full parser for reqochet\'s own files', () => {
    for (const h of [
      'id: REQ-AAAAAAA\ntype: system-requirement\ntitle: T\nparent: REQ-BBBBBBB\norder: a3',
      'id: REQ-AAAAAAA\ntype: information\ntitle: Top',
      'id: SYS-000001\ntype: x\ntitle: Old\norder: 30',
      'id: REQ-AAAAAAA\ntype: x\ntitle: "quoted: title"\nparent: REQ-CCCCCCC\norder: a0V\nlinks:\n  - type: refines\n    target: REQ-DDDDDDD'
    ]) {
      const full = parseItemFile(file(h), new Set())
      expect(full.ok).toBe(true)
      if (!full.ok) continue
      const want = { id: full.item.id, ...(full.item.parent ? { parent: full.item.parent } : {}), ...(full.item.order !== undefined ? { order: full.item.order } : {}) }
      expect(readStructure(file(h))).toEqual(want)
      expect(readStructure(`\uFEFF${file(h).replace(/\n/g, '\r\n')}`)).toEqual(want)
    }
  })
  it('gives up (null) on headers it cannot read safely, so the full parser decides', () => {
    expect(readStructure(file("id: 'REQ-AAAAAAA'"))).toBeNull()
    expect(readStructure(file('id: REQ-AAAAAAA\nparent: REQ-B # note'))).toBeNull()
    expect(readStructure(file('id: REQ-AAAAAAA\nparent: null'))).toBeNull()
    expect(readStructure('no header')).toBeNull()
    expect(readStructure('---\nid: REQ-AAAAAAA\n')).toBeNull()
  })
  it('is either null or equal to the full parser, for awkward headers too (0.21.0 review R1–R5)', () => {
    const base = 'type: x\ntitle: T'
    const headers = [
      'id: REQ-AAAAAAA\norder: 1e3', 'id: REQ-AAAAAAA\norder: +5', 'id: REQ-AAAAAAA\norder: 5.', 'id: REQ-AAAAAAA\norder: 0x1F',
      'id: REQ-AAAAAAA\norder: 007', 'id: REQ-AAAAAAA\norder: -3', 'id: REQ-AAAAAAA\norder: 2.5', 'id: REQ-AAAAAAA\norder: 30',
      'id: REQ-AAAAAAA\norder: a1\norder: a2', 'id: 123', 'id: REQ-AAAAAAA\nparent: 007', 'id: REQ-AAAAAAA\tx',
      'id: REQ-AAAAAAA\t# c', 'id: REQ-AAAAAAA\nparent: REQ-BBBBBBB\u2028', 'id: REQ-AAAAAAA\norder: a1 ',
      'id: REQ-AAAAAAA\ntitle: again'
    ]
    for (const h of headers) {
      for (const text of [`---\n${h}\n${base}\n---\nx\n`, `---\n${h}\ntitle: T\n---\nx\n`]) {
        const fast = readStructure(text)
        if (fast === null) continue
        const full = parseItemFile(text, new Set())
        expect(full.ok, `fast path accepted a file the parser refuses: ${JSON.stringify(text)}`).toBe(true)
        if (!full.ok) continue
        expect(fast, JSON.stringify(text)).toEqual({ id: full.item.id, ...(full.item.parent ? { parent: full.item.parent } : {}), ...(full.item.order !== undefined ? { order: full.item.order } : {}) })
      }
    }
  })
})
