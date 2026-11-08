// 0.17.2 — All documents shows one collapsible group per document (the owner, 8 Nov 2026)
import { describe, expect, it } from 'vitest'
import type { IndexedItem } from '../../src/shared/domain'
import { GROUP_KEY, treeRows, type Level, type Row } from '../../src/renderer/src/workspace/table/rows'

const it_ = (id: string, document: string): IndexedItem => ({ id, type: 't', title: id, text: '', path: `${document}/${id}.md`, document, fields: {}, childCount: 0 }) as unknown as IndexedItem
const level = (...items: IndexedItem[]): Level => ({ items, total: items.length, limit: 500 })
const show = (rows: Row[]): string[] => rows.map((r) => (r.kind === 'group' ? `[${r.name}${r.open ? '' : ' closed'}]` : r.kind === 'item' ? `${r.item.id}@${r.depth}` : r.kind))

describe('document groups', () => {
  const groups = [
    { name: 'Software', count: 1 },
    { name: 'System', count: 2 }
  ]
  const levels = new Map([
    [GROUP_KEY('Software'), level(it_('S1', 'Software'))],
    [GROUP_KEY('System'), level(it_('Y1', 'System'), it_('Y2', 'System'))]
  ])
  it('each document is a group row with its items inside, one level deeper', () => {
    expect(show(treeRows(levels, { all: false, ids: new Set() }, groups))).toEqual(['[Software]', 'S1@1', '[System]', 'Y1@1', 'Y2@1'])
  })
  it('a closed group hides only its own items; a group not loaded yet shows a loading row', () => {
    expect(show(treeRows(levels, { all: false, ids: new Set() }, groups, new Set(['System'])))).toEqual(['[Software]', 'S1@1', '[System closed]'])
    expect(show(treeRows(new Map(), { all: false, ids: new Set() }, groups))).toEqual(['[Software]', 'loading', '[System]', 'loading'])
  })
})
