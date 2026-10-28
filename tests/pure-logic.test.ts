// Logic that used to live only inside components and handlers, now in small pure functions (review T-02).
// The window-side (renderer) part is in tests/ui/ui-logic.test.ts.
import { describe, expect, it } from 'vitest'
import type { IndexedItem } from '../src/shared/domain'
import { InvalidInput, exportRequest, fieldDefs, item, query } from '../src/main/validate'
import { documentOrderOf, planInsert, planSwap } from '../src/modules/workspace'

const it_ = (id: string, parent?: string, childCount = 0, order?: number): IndexedItem => ({
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
describe('ordering siblings (structure.ts)', () => {
  const sibs = [
    { id: 'A', order: 10 },
    { id: 'B', order: 20 },
    { id: 'C', order: 21 }
  ]
  it('places at the end, in a gap (one file), or renumbers when there is no room', () => {
    expect(planInsert(sibs, 'X', null)).toEqual([{ id: 'X', order: 30 }])
    expect(planInsert(sibs, 'X', 'B')).toEqual([{ id: 'X', order: 15 }])
    expect(planInsert(sibs, 'X', 'A')).toEqual([{ id: 'X', order: 5 }])
    const tight = planInsert(sibs, 'X', 'C')
    expect(tight).toEqual([
      { id: 'X', order: 30 },
      { id: 'C', order: 40 }
    ])
  })
  it('swaps two neighbours, or renumbers when values are missing or equal', () => {
    expect(planSwap(sibs, 0, 1)).toEqual([
      { id: 'A', order: 20 },
      { id: 'B', order: 10 }
    ])
    expect(planSwap([{ id: 'A' }, { id: 'B' }], 0, 1)).toEqual([
      { id: 'B', order: 10 },
      { id: 'A', order: 20 }
    ])
  })
  it('lists items depth-first in document order; loops come last', () => {
    const rows = documentOrderOf([it_('A', undefined, 1, 10), it_('A1', 'A', 0, 10), it_('B', undefined, 0, 20), it_('L1', 'L2'), it_('L2', 'L1')])
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
