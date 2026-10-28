// The side-by-side difference of the Changes view (O-05): aligned rows, changed words, folded unchanged lines.
import { describe, expect, it } from 'vitest'
import { textRows, wordDiff } from '../../src/renderer/src/lib/textDiff'

describe('word differences', () => {
  it('marks only the changed words on each side', () => {
    const w = wordDiff('The system shall respond', 'The system must respond fast')
    expect(w.left).toEqual([
      { text: 'The system ', mark: false },
      { text: 'shall', mark: true },
      { text: ' respond', mark: false }
    ])
    expect(w.right.filter((s) => s.mark).map((s) => s.text)).toEqual(['must', ' fast'])
    expect(w.right.map((s) => s.text).join('')).toBe('The system must respond fast')
  })
})

describe('text rows', () => {
  it('pairs a changed line, shows added and removed lines on their side only', () => {
    const rows = textRows('a\nb\nc\n', 'a\nB!\nc\nd\n')
    expect(rows.map((r) => r.kind)).toEqual(['same', 'change', 'same', 'added'])
    const change = rows[1]
    expect(change?.kind === 'change' && [change.leftNo, change.rightNo]).toEqual([2, 2])
    const added = rows[3]
    expect(added?.kind === 'added' && [added.rightNo, added.text]).toEqual([4, 'd'])
    expect(textRows('x\ny', 'x').map((r) => r.kind)).toEqual(['same', 'removed'])
  })

  it('folds long runs of unchanged lines but keeps two lines next to each change', () => {
    const before = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n')
    const after = before.replace('line 10', 'line ten')
    const rows = textRows(before, after)
    expect(rows.map((r) => (r.kind === 'fold' ? `fold ${r.count}` : r.kind))).toEqual(['fold 7', 'same', 'same', 'change', 'same', 'same', 'fold 8'])
    const first = rows[0]
    expect(first?.kind === 'fold' && first.rows).toHaveLength(7) // shown again when unfolded
    // Windows line endings do not count as a change
    expect(textRows('a\r\nb', 'a\nb').every((r) => r.kind === 'same' || r.kind === 'fold')).toBe(true)
  })
})
