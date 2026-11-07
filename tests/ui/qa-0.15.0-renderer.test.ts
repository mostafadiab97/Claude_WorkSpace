// QA 0.15.0 (helper agent, docs/AGENT-WORKFLOW.md): tries to break the window-side logic of the UI polish version.
// A failing test here shows a product bug — see docs/reviews/agents/0.15.0-qa.md.
import { afterEach, describe, expect, it } from 'vitest'
import type { Schema } from '../../src/shared/domain'
import { setLanguage } from '../../src/shared/text'
import { plainText, renderItemText } from '../../src/renderer/src/lib/markdown'
import { middleEllipsis } from '../../src/renderer/src/lib/statusbar'
import { filterSummary } from '../../src/renderer/src/workspace/screen/useFilters'
import { groupProblems, problemsOf, PROBLEM_GROUPS } from '../../src/renderer/src/workspace/screen/problemList'
import { columnsFor, defaultOrder, optionalColumns, orderColumns, shownColumnKeys, columnOrder } from '../../src/renderer/src/workspace/table/columns'
import { fieldLabel, formatValue, linkName, optionLabel, typeName, typeShort } from '../../src/renderer/src/lib/schema'

afterEach(() => setLanguage('en'))

// ---------------------------------------------------------------- markdown: untrusted text from commits
describe('QA renderItemText never emits active HTML', () => {
  const evil = [
    '<img src=x onerror=alert(1)>',
    '<script>alert(1)</script>',
    '<iframe src="https://evil.example"></iframe>',
    '<a href="javascript:alert(1)">x</a>',
    '<svg onload=alert(1)>',
    '<div style="background:url(javascript:alert(1))">x</div>',
    'inline <b onclick="alert(1)">bold</b> html',
    '[x](javascript:alert(1))',
    '[x](JAVASCRIPT:alert(1))',
    '[x]( javascript:alert(1) )',
    '[x](vbscript:msgbox(1))',
    '[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    '[x](http://plain.example)',
    '[x](//evil.example/path)',
    '[x](file:///C:/Windows/system32)',
    '[ref][1]\n\n[1]: javascript:alert(1)',
    '[x](&#106;avascript:alert(1))',
    '<javascript:alert(1)>',
    '![pic](https://evil.example/x.png)',
    '![pic][p]\n\n[p]: https://evil.example/y.png',
    '[![pic](https://evil.example/z.png)](https://ok.example)',
    '| a | b |\n| - | - |\n| <img src=x onerror=1> | [c](javascript:1) |',
    '```"><script>alert(1)</script>\ncode\n```',
    '> <script>alert(1)</script>',
    '- <img src=x onerror=1>\n- [y](data:x)'
  ]
  for (const md of evil) {
    it(`is safe: ${JSON.stringify(md).slice(0, 70)}`, () => {
      const html = renderItemText(md)
      // only these tags may appear (Markdown formatting), never with event handlers or styles
      const tags = [...html.matchAll(/<\s*([a-zA-Z][\w-]*)([^>]*)>/g)]
      for (const [, name, attrs] of tags) {
        expect(['p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'input']).toContain(name!.toLowerCase())
        expect(attrs).not.toMatch(/\son\w+\s*=|style\s*=|src\s*=/i)
      }
      for (const m of html.matchAll(/href="([^"]*)"/g)) expect(m[1]).toMatch(/^(https:|mailto:)/i)
      expect(html).not.toMatch(/<img|<script|<iframe|<svg/i)
    })
  }

  it('keeps https and mailto links (also autolinks), with the target opened outside', () => {
    expect(renderItemText('see https://example.org/a_b')).toContain('href="https://example.org/a_b"')
    expect(renderItemText('<someone@example.org>')).toContain('href="mailto:someone@example.org"')
  })

  it('a quote in an https link cannot break out of the attribute', () => {
    const html = renderItemText('[x](https://ok.example/"onmouseover="alert(1))')
    expect(html).not.toMatch(/"\s*onmouseover=/i)
  })

  it('task-list check boxes stay disabled (not clickable controls)', () => {
    const html = renderItemText('- [ ] open\n- [x] done')
    for (const m of html.matchAll(/<input[^>]*>/g)) expect(m[0]).toMatch(/disabled/)
  })

  it('image description is shown once, not double-escaped', () => {
    expect(renderItemText('![A & B](https://x/y.png)')).toContain('A &amp; B')
    expect(renderItemText('![A & B](https://x/y.png)')).not.toContain('&amp;amp;')
  })

  it('handles empty and very long text', () => {
    expect(renderItemText('')).toBe('')
    const long = 'word '.repeat(50_000)
    const t0 = Date.now()
    expect(renderItemText(long).length).toBeGreaterThan(long.length - 10)
    expect(Date.now() - t0).toBeLessThan(2000)
  })
})

describe('QA plainText (table Text column) agrees with the formatted preview', () => {
  it('keeps underscores inside words (signal and file names, as Markdown does)', () => {
    // GFM does not treat intraword underscores as emphasis; renderItemText keeps them
    expect(renderItemText('SIG_BRAKE_REQ')).toContain('SIG_BRAKE_REQ')
    expect(plainText('Set SIG_BRAKE_REQ when brake_pedal_pos > 5')).toBe('Set SIG_BRAKE_REQ when brake_pedal_pos > 5')
  })
  it('keeps underscores in bare links and e-mail addresses', () => {
    expect(plainText('See https://example.org/a_b_c and first_last@example.org')).toBe('See https://example.org/a_b_c and first_last@example.org')
  })
  it('keeps arithmetic with stars between words', () => {
    expect(plainText('a*b*c')).toBe(renderItemText('a*b*c').replace(/<[^>]+>/g, '').trim())
  })
  it('handles empty text, only markers and odd input without throwing', () => {
    expect(plainText('')).toBe('')
    expect(plainText('   \n\n  ')).toBe('')
    expect(plainText('**')).toBe('**')
    expect(plainText('```\nonly code\n```')).toBe('only code')
    expect(plainText('# ')).toBe('') // an empty heading, as Markdown renders it
    expect(() => plainText('```unclosed fence\n'.repeat(1000))).not.toThrow()
  })
  it('Arabic text passes through unchanged', () => {
    expect(plainText('**يجب** أن يقيس النظام')).toBe('يجب أن يقيس النظام')
  })
  it('is fast on the 400-character slice and on pathological input', () => {
    const t0 = Date.now()
    plainText('*a'.repeat(5000))
    plainText('_'.repeat(10_000))
    plainText('`'.repeat(10_000))
    expect(Date.now() - t0).toBeLessThan(1000)
  })
})

// ---------------------------------------------------------------- status bar
describe('QA middleEllipsis', () => {
  const p = 'C:\\Users\\someone\\Documents\\Projects\\Customer\\very\\deep\\folder\\Claude_SandBox'
  it('never returns more than max characters, for every small max', () => {
    for (let max = 1; max <= 70; max++) expect(middleEllipsis(p, max).length, `max ${max}`).toBeLessThanOrEqual(max)
  })
  it('max 0 gives at most the ellipsis, never the whole path', () => {
    expect(middleEllipsis(p, 0).length).toBeLessThanOrEqual(1)
  })
  it('does not cut a character made of two UTF-16 units in half', () => {
    const astral = 'C:\\' + '😀'.repeat(40) + '\\end'
    const s = middleEllipsis(astral, 21)
    expect(s).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/)
  })
  it('Arabic folder names are shortened like any other', () => {
    const ar = 'C:\\المستخدمون\\مستندات\\مشاريع\\'.repeat(4) + 'المتطلبات'
    const s = middleEllipsis(ar, 30)
    expect(s.length).toBe(30)
    expect(s.endsWith('المتطلبات')).toBe(true)
  })
})

// ---------------------------------------------------------------- filters in words
describe('QA filterSummary', () => {
  const schema: Schema = {
    version: 1,
    itemTypes: [{ id: 'sys', name: 'System Requirement', requirement: true, labels: { ar: 'متطلب نظام' } }],
    fields: [
      { id: 'status', name: 'Status', type: 'enum', options: ['Draft'], labels: { ar: 'الحالة' }, optionLabels: { ar: { Draft: 'مسودة' } } },
      { id: 'owner', name: 'Owner', type: 'text', labels: { ar: 'المسؤول' } }
    ],
    linkTypes: []
  }
  it('lists fields in schema order, ignores empty and unknown filters, unknown type shows its ID', () => {
    expect(filterSummary(schema, { search: '', types: 'gone-type', linkFilter: 'none', fieldFilters: { owner: 'Ann', status: '', zzz: 'q' } })).toBe('Type = gone-type, Owner = Ann, Without any links')
  })
  it('in Arabic every part is translated and joined with the Arabic comma', () => {
    setLanguage('ar')
    const s = filterSummary(schema, { search: 'باب', types: 'sys', linkFilter: 'suspect', fieldFilters: { status: 'Draft' } })
    expect(s).toContain('«باب»')
    expect(s).toContain('متطلب نظام')
    expect(s).toContain('الحالة = مسودة')
    expect(s).not.toMatch(/Type|Status|Draft/)
    expect(s).not.toContain(', ') // Latin comma in an Arabic sentence
  })
})

// ---------------------------------------------------------------- problems panel
describe('QA problems grouping', () => {
  it('every issue the index reports lands in its own group, none in "other"', () => {
    // the paths that the index cache (sqliteIndex.ts issues()) and item checks really produce
    const p = problemsOf({
      schemaProblems: [{ path: 'fields[0].labels', message: 'bad' }],
      issues: [
        { itemId: 'REQ-1', path: 'id', message: '2 files have the ID REQ-1.', severity: 'error' },
        { itemId: 'REQ-2', path: 'links', message: '"verifies" link to X, which does not exist.', severity: 'error' },
        { itemId: 'REQ-3', path: 'parent', message: 'Parent X does not exist.', severity: 'error' },
        { itemId: 'REQ-4', path: 'file-name', message: 'rename', severity: 'warning', fix: 'file-name' },
        { itemId: 'items/broken.md', path: 'file', message: 'This file could not be read.', severity: 'error' }
      ]
    })
    const groups = groupProblems(p)
    expect(groups.map((g) => g.group)).toEqual(['schema', 'id', 'links', 'parent', 'file', 'file-name'])
    expect(p.find((x) => x.group === 'file')).toMatchObject({ subject: 'items/broken.md' })
    expect(p.find((x) => x.group === 'file')?.id).toBeUndefined()
  })
  it('unknown severities count as errors; empty input gives no groups; group order is fixed', () => {
    const p = problemsOf({ schemaProblems: [], issues: [{ itemId: 'A', path: 'whatever', message: 'm', severity: 'info' as 'error' }] })
    expect(p[0]).toMatchObject({ group: 'other', severity: 'error' })
    expect(groupProblems([])).toEqual([])
    expect(PROBLEM_GROUPS[PROBLEM_GROUPS.length - 1]).toBe('other')
  })
  it('row keys are unique when two files share an ID and both carry the same broken link (React keys)', () => {
    const issue = { itemId: 'REQ-1', path: 'links', message: '"verifies" link to X, which does not exist.', severity: 'error' as const }
    const p = problemsOf({ schemaProblems: [], issues: [issue, { ...issue }] })
    expect(new Set(p.map((x) => x.key)).size).toBe(p.length)
  })
})

// ---------------------------------------------------------------- table columns
describe('QA column order with saved preferences', () => {
  const schema: Schema = {
    version: 1,
    itemTypes: [{ id: 'sys', name: 'System Requirement', requirement: true }],
    fields: [
      { id: 'priority', name: 'Priority', type: 'enum', options: ['High'] },
      { id: 'status', name: 'Status', type: 'enum', options: ['Draft'] },
      { id: 'tags', name: 'Tags', type: 'list' }
    ],
    linkTypes: []
  }
  /** The Columns menu's order list, as FieldsPanel.tsx builds it. */
  const menuOrder = (order: string[]): string[] =>
    orderColumns([...optionalColumns(schema).filter((c) => c.key !== 'number'), { key: 'id', label: 'ID', builtIn: true }], columnOrder(schema, order)).map((c) => c.key) // builder: the menu uses columnOrder since the CR-04 fix
  const tableOrder = (order: string[], hidden: string[] = []): string[] => columnsFor(schema, { hidden: new Set(hidden), order }).map((c) => c.key)

  it('default order: Status first among fields even when it is not the first field', () => {
    expect(defaultOrder(schema)).toEqual(['type', 'field:status', 'links', 'field:priority', 'field:tags', 'id', 'text'])
  })
  it('a schema without Status still gives a complete default order', () => {
    const s2: Schema = { ...schema, fields: [] }
    expect(tableOrder([]).length).toBeGreaterThan(0)
    expect(columnsFor(s2).map((c) => c.key)).toEqual(['number', 'title', 'type', 'links', 'id', 'text'])
  })
  it('a saved order from before 0.15 (no "id" in it) shows the table in the same order as the Columns menu', () => {
    const old = ['number', 'text', 'type', 'links', 'field:status', 'field:priority', 'field:tags']
    expect(tableOrder(old).slice(2)).toEqual(menuOrder(old).filter((k) => k !== 'title'))
  })
  it('moving a column in the menu and showing the table agree for every single move', () => {
    const base = menuOrder([])
    for (let i = 0; i < base.length - 1; i++) {
      const keys = [...base]
      ;[keys[i], keys[i + 1]] = [keys[i + 1]!, keys[i]!]
      expect(tableOrder(keys).slice(2)).toEqual(menuOrder(keys))
    }
  })
  it('a saved order naming a deleted field and duplicates does not lose or repeat columns', () => {
    const cols = tableOrder(['field:gone', 'text', 'text', 'id', 'type'])
    expect(new Set(cols).size).toBe(cols.length)
    expect(cols).toEqual(expect.arrayContaining(['number', 'title', 'type', 'links', 'field:status', 'field:priority', 'field:tags', 'id', 'text']))
  })
  it('the export offers the visible columns in the table order (No. first, as in the table and as before 0.15)', () => {
    expect(shownColumnKeys(schema, { hidden: new Set(), order: [] })[0]).toBe('number')
    const order = ['text', 'field:tags', 'type', 'id', 'links', 'field:status', 'field:priority'] // as the Columns menu saves it (no "number")
    const shown = shownColumnKeys(schema, { hidden: new Set(['links']), order })
    expect(shown).toEqual(tableOrder(order, ['links']).filter((k) => !['title', 'id'].includes(k)))
  })
  it('the Text cell has no Markdown markers and no line breaks', () => {
    const text = columnsFor(schema).find((c) => c.key === 'text')!
    const item = { id: 'REQ-1', type: 'sys', title: 't', text: '## Head\n\n**bold** and `code`\n- one', fields: {}, links: [], incomingCount: 0, suspectCount: 0, childCount: 0, path: '', parent: null, order: 'a0' }
    expect(text.value(item as never)).toBe('Head bold and code one')
  })
})

// ---------------------------------------------------------------- schema names in Arabic
describe('QA schema label helpers', () => {
  const schema: Schema = {
    version: 1,
    itemTypes: [
      { id: 'sys', name: 'System Requirement', short: 'SysReq', requirement: true },
      { id: 'tc', name: 'Test Case', requirement: true, labels: { fr: 'Cas de test' } }
    ],
    fields: [{ id: 'status', name: 'Status', type: 'enum', options: ['Draft', 'constructor', 'toString'], optionLabels: { ar: { Draft: 'مسودة' } } }],
    linkTypes: [{ id: 'verifies', name: 'verifies', reverseName: 'verified by', labels: { ar: 'يتحقق من' } }]
  }
  const f = schema.fields[0]!
  it('Arabic without labels falls back to the English names and Latin short labels', () => {
    setLanguage('ar')
    expect(typeName(schema, 'sys')).toBe('System Requirement')
    expect(typeShort(schema, 'sys')).toBe('SysReq')
    expect(typeName(schema, 'tc')).toBe('Test Case')
    expect(fieldLabel(f)).toBe('Status')
    expect(linkName(schema, 'verifies')).toBe('\u200Fيتحقق من') // 0.16.4: a right-to-left mark before an Arabic link name (AR-13)
    expect(linkName(schema, 'verifies', true)).toBe('verified by') // no reverse label
    expect(typeName(schema, 'unknown')).toBe('unknown')
  })
  it('a choice named like a built-in object property shows itself, not program code', () => {
    setLanguage('ar')
    expect(optionLabel(f, 'constructor')).toBe('constructor')
    expect(optionLabel(f, 'toString')).toBe('toString')
    expect(formatValue(['Draft', 'toString'], f)).toBe('مسودة, toString')
  })
  it('numbers, dates and lists without a field definition format as before', () => {
    setLanguage('ar')
    expect(formatValue(3)).toBe('3')
    expect(formatValue(undefined, f)).toBe('')
    expect(formatValue([], f)).toBe('')
  })
})
