// 0.15 UI polish — window-side rules (type-checked with the renderer's settings).
import { describe, expect, it } from 'vitest'
import type { Schema } from '../../src/shared/domain'
import { filterSummary } from '../../src/renderer/src/workspace/screen/useFilters'
import { middleEllipsis } from '../../src/renderer/src/lib/statusbar'
import { fieldLabel, formatValue, isHeading, linkName, optionLabel, typeName, typeShort } from '../../src/renderer/src/lib/schema'
import { setLanguage } from '../../src/shared/text'
import { columnsFor, defaultOrder } from '../../src/renderer/src/workspace/table/columns'
import { plainText, renderItemText } from '../../src/renderer/src/lib/markdown'
import { groupProblems, problemsOf } from '../../src/renderer/src/workspace/screen/problemList'

const schema: Schema = {
  version: 1,
  itemTypes: [
    { id: 'system-requirement', name: 'System Requirement', short: 'SysReq', requirement: true },
    { id: 'heading', name: 'Heading', requirement: false },
    { id: 'note', name: 'Note', requirement: true }
  ],
  fields: [{ id: 'status', name: 'Status', type: 'enum', options: ['Draft', 'Approved'] }],
  linkTypes: []
}

describe('status bar (UX-36)', () => {
  it('says in words what the table is filtered by', () => {
    expect(filterSummary(schema, { search: ' door ', types: 'system-requirement', linkFilter: 'suspect', fieldFilters: { status: 'Draft', gone: 'x' } })).toBe(
      '“door”, Type = System Requirement, Status = Draft, With suspect links'
    )
    expect(filterSummary(schema, { search: '', types: '', linkFilter: '', fieldFilters: {} })).toBe('')
  })
  it('shortens a long path in the middle and keeps short ones', () => {
    expect(middleEllipsis('C:\\short', 60)).toBe('C:\\short')
    const p = 'C:\\Users\\someone\\Documents\\Projects\\Customer\\very\\deep\\folder\\Claude_SandBox'
    const s = middleEllipsis(p, 40)
    expect(s.length).toBe(40)
    expect(s.startsWith('C:\\Users')).toBe(true)
    expect(s.endsWith('Claude_SandBox')).toBe(true)
  })
})

describe('type column (UX-03)', () => {
  it('uses the short name, the full name when there is none, and nothing for headings', () => {
    expect(typeShort(schema, 'system-requirement')).toBe('SysReq')
    expect(typeShort(schema, 'note')).toBe('Note')
    expect(isHeading(schema, 'heading')).toBe(true)
    expect(isHeading(schema, 'note')).toBe(false)
  })
})

describe('item text shown formatted (UX-08)', () => {
  it('formats Markdown', () => {
    const html = renderItemText('**Objective:** verify\n\n- one\n- two\n\n`path/x`')
    expect(html).toContain('<strong>Objective:</strong>')
    expect(html).toContain('<li>one</li>')
    expect(html).toContain('<code>path/x</code>')
  })
  it('never lets text from a commit run code or load anything', () => {
    const html = renderItemText('<img src=x onerror=alert(1)> <script>alert(2)</script>\n\n![pic](http://evil/x.png) [a](javascript:alert(3)) [b](https://example.org)')
    expect(html).not.toMatch(/<img|<script|javascript:|http:\/\/evil/i)
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('<a href="https://example.org" target="_blank" rel="noreferrer">b</a>')
  })
  it('the table cell shows the text without markers', () => {
    expect(plainText('**Objective:** verify `x`\n- Measured on [site](https://a)\n## Steps')).toBe('Objective: verify x Measured on site Steps')
    expect(plainText('2 * 3 * 4 = 24')).toBe('2 * 3 * 4 = 24')
  })
})

describe('problems panel (UX-11)', () => {
  it('groups problems by kind in a fixed order, with severity', () => {
    const p = problemsOf({
      schemaProblems: [],
      issues: [
        { itemId: 'REQ-1', path: 'links', message: 'link to X, which does not exist.', severity: 'error' },
        { itemId: 'REQ-2', path: 'file-name', message: 'renamed', severity: 'warning', fix: 'file-name' },
        { itemId: 'REQ-3', path: 'links', message: 'link to Y, which does not exist.', severity: 'error' },
        { itemId: 'REQ-4', path: 'id', message: '2 files have the ID REQ-4.', severity: 'error' }
      ]
    })
    expect(groupProblems(p).map((g) => [g.group, g.problems.length])).toEqual([
      ['id', 1],
      ['links', 2],
      ['file-name', 1]
    ])
    expect(p[1]).toMatchObject({ severity: 'warning', message: 'renamed', id: 'REQ-2' })
  })
})

describe('schema names in the window language (UX-22)', () => {
  const s: Schema = {
    version: 1,
    itemTypes: [{ id: 'sys', name: 'System Requirement', short: 'SysReq', requirement: true, labels: { ar: 'متطلب نظام' } }],
    fields: [{ id: 'status', name: 'Status', type: 'enum', options: ['Draft'], labels: { ar: 'الحالة' }, optionLabels: { ar: { Draft: 'مسودة' } } }],
    linkTypes: [{ id: 'verifies', name: 'verifies', reverseName: 'verified by', reverseLabels: { ar: 'متحقَّق منه بـ' } }]
  }
  const f = s.fields[0]!
  it('English shows the names from schema.yaml; Arabic shows the labels, and the stored value stays the choice', () => {
    setLanguage('en')
    expect([typeName(s, 'sys'), typeShort(s, 'sys'), fieldLabel(f), optionLabel(f, 'Draft'), linkName(s, 'verifies', true)]).toEqual(['System Requirement', 'SysReq', 'Status', 'Draft', 'verified by'])
    setLanguage('ar')
    try {
      expect([typeName(s, 'sys'), typeShort(s, 'sys'), fieldLabel(f), optionLabel(f, 'Draft'), linkName(s, 'verifies', true), linkName(s, 'verifies')]).toEqual(['متطلب نظام', 'متطلب نظام', 'الحالة', 'مسودة', '\u200Fمتحقَّق منه بـ', 'verifies']) // RLM since 0.16.4 (AR-13)
      expect(formatValue('Draft', f)).toBe('مسودة')
      expect(optionLabel(f, 'Unknown')).toBe('Unknown')
    } finally {
      setLanguage('en')
    }
  })
})

describe('column order (UX-03)', () => {
  it('No. and Title first, then Type, Status, Links, other fields, ID, Text', () => {
    expect(columnsFor(schema).map((c) => c.key)).toEqual(['number', 'title', 'type', 'field:status', 'links', 'id', 'text'])
  })
  it('a saved order keeps ID where the user put it (the Columns menu lists it)', () => {
    const order = defaultOrder(schema)
    const moved = [...order.filter((k) => k !== 'text').slice(0, -1), 'text', 'id']
    expect(columnsFor(schema, { hidden: new Set(), order: moved }).map((c) => c.key).slice(-2)).toEqual(['text', 'id'])
  })
})
