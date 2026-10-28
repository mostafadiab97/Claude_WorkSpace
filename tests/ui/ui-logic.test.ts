// Window-side logic that used to live inside components, now in small pure functions (review T-02).
// Type-checked with the renderer's settings (tsconfig.web.json).
import { describe, expect, it } from 'vitest'
import type { CompareOptions } from '../../src/shared/api'
import type { IndexedItem, Schema } from '../../src/shared/domain'
import { columnTemplate, columnsFor, shownColumnKeys, tableMinWidth, withWidth } from '../../src/renderer/src/workspace/table/columns'
import { dropMove, dropZone } from '../../src/renderer/src/workspace/table/drag'
import { treeRows, type Level, type Row } from '../../src/renderer/src/workspace/table/rows'
import { buildQuery, nextSort } from '../../src/renderer/src/workspace/screen/useFilters'
import { describeSchema, rangeOf } from '../../src/renderer/src/workspace/compareRange'
import { problemsOf } from '../../src/renderer/src/workspace/screen/problemList'

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
const level = (...items: IndexedItem[]): Level => ({ items, total: items.length, limit: 500 })
const schema: Schema = {
  version: 1,
  itemTypes: [{ id: 'system-requirement', name: 'System Requirement', requirement: true }],
  fields: [
    { id: 'status', name: 'Status', type: 'enum', options: ['Draft', 'Approved'] },
    { id: 'owner', name: 'Owner', type: 'text' }
  ],
  linkTypes: [{ id: 'verifies', name: 'verifies', reverseName: 'verified by' }]
}

describe('column widths (table/columns.ts)', () => {
  const bare: Schema = { version: 1, itemTypes: [], fields: [], linkTypes: [] }
  it('a dragged width is fixed, other columns keep growing; double-click returns to automatic', () => {
    const auto = columnsFor(bare, { hidden: new Set(['type', 'links', 'text']), order: [] })
    expect(columnTemplate(auto)).toBe('130px 90px minmax(260px, 3fr)')
    const widths = withWidth(undefined, 'number', 160.4)
    const wide = columnsFor(bare, { hidden: new Set(['type', 'links', 'text']), order: [], widths })
    expect(columnTemplate(wide)).toBe('130px 160px minmax(260px, 3fr)')
    expect(tableMinWidth(wide)).toBe(130 + 160 + 260)
    expect(withWidth(widths, 'number', null)).toEqual({})
    // never narrower than a grip, never absurdly wide
    expect(withWidth({}, 'title', 3)).toEqual({ title: 48 })
    expect(withWidth({}, 'title', 99999)).toEqual({ title: 1200 })
  })
})

describe('tree rows (table/rows.ts) — lazy "Expand all" (P-04)', () => {
  const levels = new Map<string, Level>([
    ['', level(it_('A', undefined, 2), it_('B', undefined, 1))],
    ['A', level(it_('A1', 'A'), it_('A2', 'A'))]
  ])
  const kinds = (rows: Row[]): string[] => rows.map((r) => (r.kind === 'item' ? `${r.item.id}@${r.depth}` : `${r.kind}:${r.parent}`))
  it('shows open parents with their children', () => {
    expect(kinds(treeRows(levels, { all: false, ids: new Set(['A']) }))).toEqual(['A@0', 'A1@1', 'A2@1', 'B@0'])
  })
  it('with everything open, an unloaded level is one "loading" row', () => {
    expect(kinds(treeRows(levels, { all: true, ids: new Set() }))).toEqual(['A@0', 'A1@1', 'A2@1', 'B@0', 'loading:B'])
    // closing one parent while everything is open
    expect(kinds(treeRows(levels, { all: true, ids: new Set(['A']) }))).toEqual(['A@0', 'B@0', 'loading:B'])
  })
  it('ends a wide level with a "more" row', () => {
    const wide = new Map<string, Level>([['', { items: [it_('A')], total: 3, limit: 1 }]])
    expect(treeRows(wide, { all: false, ids: new Set() })).toContainEqual({ kind: 'more', parent: '', depth: 0, hidden: 2 })
  })
})

describe('drag and drop rules (table/drag.ts)', () => {
  const row = (id: string, path: string[]): Row & { kind: 'item' } => ({ kind: 'item', item: it_(id, path.at(-1)), depth: path.length, path })
  it('cannot drop an item onto itself or below itself', () => {
    expect(dropZone('A', row('A', []), 0.5, true)).toBeNull()
    expect(dropZone('A', row('A1', ['A']), 0.5, true)).toBeNull()
  })
  it('top quarter = before, bottom quarter = after, middle = into; a search result only allows into', () => {
    expect(dropZone('X', row('B', []), 0.1, true)).toBe('before')
    expect(dropZone('X', row('B', []), 0.9, true)).toBe('after')
    expect(dropZone('X', row('B', []), 0.5, true)).toBe('into')
    expect(dropZone('X', row('B', []), 0.1, false)).toBe('into')
  })
  it('"after" an open parent means its first child; otherwise before the next sibling', () => {
    const levels = new Map<string, Level>([
      ['', level(it_('A', undefined, 1), it_('X'), it_('B'))],
      ['A', level(it_('A1', 'A'))]
    ])
    expect(dropMove('X', row('A', []), 'after', true, levels, (id) => id === 'A')).toEqual({ parent: 'A', before: 'A1' })
    // the dragged item itself is skipped when finding the next sibling
    expect(dropMove('X', row('A', []), 'after', true, levels, () => false)).toEqual({ parent: null, before: 'B' })
    expect(dropMove('X', row('B', []), 'before', true, levels, () => false)).toEqual({ parent: null, before: 'B' })
    expect(dropMove('X', row('B', []), 'into', true, levels, () => false)).toEqual({ parent: 'B', before: null })
  })
})

describe('table filters and sorting (screen/useFilters.ts)', () => {
  it('cycles a column: ascending → descending → document order', () => {
    let s = { by: 'order' as const as 'order' | 'title', descending: false }
    s = nextSort(s, 'title') as typeof s
    expect(s).toEqual({ by: 'title', descending: false })
    s = nextSort(s, 'title') as typeof s
    expect(s).toEqual({ by: 'title', descending: true })
    expect(nextSort(s, 'title')).toEqual({ by: 'order', descending: false })
  })
  it('a search sorts by best match; filters for unknown fields are ignored', () => {
    const r = buildQuery(schema, { search: 'temp', types: '', linkFilter: '', fieldFilters: { status: 'Draft', gone: 'x' }, sort: { by: 'order', descending: false } })
    expect(r.filtered).toBe(true)
    expect(r.query).toEqual({ text: 'temp', fields: { status: ['Draft'] }, sort: { by: 'relevance' } })
    expect(buildQuery(schema, { search: ' ', types: '', linkFilter: '', fieldFilters: { gone: 'x' }, sort: { by: 'order', descending: false } }).filtered).toBe(false)
  })
})

describe('Compare default range (compareRange.ts)', () => {
  const base: CompareOptions = { lastPull: null, hasUncommitted: false, commits: [], refs: [], head: null }
  const c = (hash: string) => ({ hash, author: '', email: '', date: '', message: '' })
  it('uncommitted changes are always possible, before the first commit too (O-06)', () => {
    expect(rangeOf('uncommitted', base, { from: '', to: '' })).toEqual({ from: 'EMPTY', to: 'WORKING' })
    expect(rangeOf('lastPull', base, { from: '', to: '' })).toBeNull()
  })
  it('turns a preset into two versions', () => {
    const o = { ...base, head: 'h', commits: [c('2'), c('1')] }
    expect(rangeOf('uncommitted', o, { from: '', to: '' })).toEqual({ from: 'h', to: 'WORKING' })
    expect(rangeOf('lastCommit', o, { from: '', to: '' })).toEqual({ from: '1', to: '2' })
    expect(rangeOf('custom', o, { from: '', to: 'WORKING' })).toBeNull()
    expect(describeSchema({ fieldsAdded: ['safety'], fieldsRemoved: [], typesAdded: [], typesRemoved: [], linkTypesAdded: [], linkTypesRemoved: ['mitigates'], otherChanges: false })).toBe(
      'fields added: safety; link types removed: mitigates'
    )
  })
})

describe('export columns and problems list', () => {
  it('exports the visible optional columns in the user\'s order', () => {
    expect(shownColumnKeys(schema, { hidden: new Set(['field:owner']), order: ['text', 'type'] })).toEqual(['text', 'type', 'number', 'links', 'field:status'])
  })
  it('file problems are not clickable; renamed files offer a fix', () => {
    const p = problemsOf({
      schemaProblems: [],
      issues: [
        { itemId: 'items/bad.md', path: 'file', message: 'This file could not be read.', severity: 'error' },
        { itemId: 'RSK-1', path: 'file-name', message: 'renamed', severity: 'warning', fix: 'file-name' }
      ]
    })
    expect(p[0]?.id).toBeUndefined()
    expect(p[1]).toMatchObject({ id: 'RSK-1', fix: 'file-name' })
  })
})
