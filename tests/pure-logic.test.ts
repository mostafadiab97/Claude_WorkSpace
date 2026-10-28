// Logic that used to live only inside components and handlers, now in small pure functions (review T-02).
// The window-side (renderer) part is in tests/ui/ui-logic.test.ts.
import { describe, expect, it } from 'vitest'
import type { IndexedItem } from '../src/shared/domain'
import { InvalidInput, exportRequest, fieldDefs, item, query } from '../src/main/validate'
import { compareOutline, documentOrderOf, outlineNumbers, planInsert, planSwap, planTidy } from '../src/modules/workspace'

const it_ = (id: string, parent?: string, childCount = 0, order?: string): IndexedItem => ({
  id,
  type: 'system-requirement',
  title: id,
  fields: {},
  links: [],
  text: '',
  path: `items/${id}.md`,
  childCount,
  incomingCount: 0,
  suspectCount: 0,
  ...(parent ? { parent } : {}),
  ...(order !== undefined ? { order } : {})
})
describe('ordering siblings with order keys (structure.ts, S-04)', () => {
  const sibs = [
    { id: 'A', order: 'a0' },
    { id: 'B', order: 'a1' },
    { id: 'C', order: 'a2' }
  ]
  it('a move writes exactly one key — the moved item\'s — wherever it goes', () => {
    expect(planInsert(sibs, 'X', null)).toEqual([{ id: 'X', order: 'a3' }])
    const mid = planInsert(sibs, 'X', 'B')
    expect(mid).toHaveLength(1)
    expect(mid[0]!.order > 'a0' && mid[0]!.order < 'a1').toBe(true)
    const first = planInsert(sibs, 'X', 'A')
    expect(first).toHaveLength(1)
    expect(first[0]!.order < 'a0').toBe(true)
  })
  it('moving up or down: one new key between the new neighbours', () => {
    const up = planSwap(sibs, 1, 0) // B up → before A
    expect(up).toHaveLength(1)
    expect(up[0]!.id).toBe('B')
    expect(up[0]!.order < 'a0').toBe(true)
    const down = planSwap(sibs, 1, 2) // B down → after C
    expect(down).toEqual([{ id: 'B', order: 'a3' }])
    const downMid = planSwap(sibs, 0, 1) // A down → between B and C
    expect(downMid[0]!.order > 'a1' && downMid[0]!.order < 'a2').toBe(true)
  })
  it('re-spaces a hand-edited group with missing or equal keys', () => {
    const plan = planInsert([{ id: 'A' }, { id: 'B', order: 'a1' }, { id: 'C', order: 'a1' }], 'X', 'C')
    // A, B, X, C get a0, a1, a2, a3; B already has a1, so it is not written
    expect(plan).toEqual([
      { id: 'A', order: 'a0' },
      { id: 'X', order: 'a2' },
      { id: 'C', order: 'a3' }
    ])
  })
  it('tidies long keys at push time only when a key is longer than 4 characters', () => {
    expect(planTidy(sibs)).toEqual([])
    const long = [{ id: 'A', order: 'a0' }, { id: 'B', order: 'a0VVV' }, { id: 'C', order: 'a1' }]
    const t = planTidy(long)
    expect(t.every((p) => p.order.length <= 4)).toBe(true)
    expect(t.map((p) => p.id)).toEqual(['B', 'C']) // A keeps a0; only changed keys are written
  })
  it('outline numbers follow parent and position; orphans and loops get none', () => {
    const rows = [{ id: 'A' }, { id: 'A1', parent: 'A' }, { id: 'A2', parent: 'A' }, { id: 'A21', parent: 'A2' }, { id: 'B' }, { id: 'O', parent: 'GONE' }, { id: 'L1', parent: 'L2' }, { id: 'L2', parent: 'L1' }]
    const n = outlineNumbers(rows)
    expect(Object.fromEntries(n)).toEqual({ A: '1', A1: '1.1', A2: '1.2', A21: '1.2.1', B: '2' })
    expect(['1.10', '1.9', '2', '1', '1.2.1'].sort(compareOutline)).toEqual(['1', '1.2.1', '1.9', '1.10', '2'])
  })
  it('lists items depth-first in document order; loops come last', () => {
    const rows = documentOrderOf([it_('A', undefined, 1, 'a0'), it_('A1', 'A', 0, 'a0'), it_('B', undefined, 0, 'a1'), it_('L1', 'L2'), it_('L2', 'L1')])
    expect(rows.map((r) => `${r.item.id}:${r.depth}`)).toEqual(['A:0', 'A1:1', 'B:0', 'L1:0', 'L2:0'])
  })
})

describe('input checks of window calls (main/validate.ts, review X-01)', () => {
  it('accepts a well-formed item and refuses broken ones', () => {
    const ok = item({ id: 'SYS-1', type: 't', title: 'x', fields: { a: 'b', n: 2, l: ['x'] }, links: [{ type: 'v', target: 'T-1' }], text: '', extra: {} })
    expect(ok.fields).toEqual({ a: 'b', n: 2, l: ['x'] })
    expect(() => item({ id: 'SYS-1', type: 't', title: 'x', fields: { a: { nested: 1 } }, links: [], text: '' })).toThrow(InvalidInput)
    expect(() => item({ id: '', type: 't', title: '', fields: {}, links: [], text: '' })).toThrow('Invalid item ID.')
    expect(() => item({ id: 'A', type: 't', title: '', fields: {}, links: [{ type: 'v' }], text: '' })).toThrow('Invalid link target.')
  })
  it('cleans queries, field lists and export requests', () => {
    expect(query({ text: 'x', sort: { by: 'field:status', descending: true }, limit: 50, brief: true, junk: 1 })).toEqual({ text: 'x', sort: { by: 'field:status', descending: true }, limit: 50, brief: true })
    expect(() => query({ sort: { by: 'DROP TABLE' } })).toThrow('Invalid sort.')
    expect(() => query({ limit: 1e9 })).toThrow('Invalid limit.')
    expect(() => fieldDefs([{ id: 'a', name: 'A', type: 'colour' }])).toThrow('Invalid field kind.')
    expect(exportRequest({ scope: 'filtered', columns: ['id'], format: 'csv', query: { text: 'a', limit: 5 } })).toEqual({ scope: 'filtered', columns: ['id'], format: 'csv', query: { text: 'a' } })
    expect(() => exportRequest({ scope: 'some', columns: [], format: 'csv' })).toThrow('Invalid export scope.')
  })
})
