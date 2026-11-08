// 0.19.0 — SEC-19-01/02: the table formats every row's text, so formatting must never throw or hang.
import { describe, expect, it } from 'vitest'
import { renderItemText } from '../../src/renderer/src/lib/markdown'

describe('0.19.0 text formatting limits', () => {
  it('SEC-19-01/02: formatting never throws, and the table formats only the start of a long text', () => {
    const deep = '>'.repeat(2002)
    expect(() => renderItemText(deep)).not.toThrow()
    const t0 = performance.now()
    const html = renderItemText('_'.repeat(100_001), 3000)
    expect(performance.now() - t0).toBeLessThan(2000)
    expect(html).toContain('markdown__more')
  })
})
