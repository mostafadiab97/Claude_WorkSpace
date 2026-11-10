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
})
