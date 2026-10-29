// M7 import, the pure part: reading the sample workbook, guessing columns, and planning create / update / links.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { guessHeaderRow, guessMapping, planImport, readXlsx, writeXlsx, outlineOf, type ExistingItems } from '../src/modules/import-export'
import { generateId, isValidId, type Item } from '../src/modules/items'
import { parseSchema } from '../src/modules/schema'

const { schema } = parseSchema(readFileSync(join(__dirname, '..', 'config', 'default-schema.yaml'), 'utf8'))
const none: ExistingItems = { byId: new Map(), bySource: new Map() }
const plan = (rows: string[][], headers: string[], existing = none, mapping = guessMapping(headers, schema)) => {
  const taken = new Set<string>()
  return planImport({
    rows,
    firstRow: 2,
    headers,
    mapping,
    schema,
    defaultType: 'system-requirement',
    existing,
    newId: () => {
      const id = generateId((x) => taken.has(x))
      taken.add(id)
      return id
    },
    isValidId
  })
}

describe('Excel import plan (M7)', () => {
  it('reads the sample workbook and guesses every column', async () => {
    const sheets = await readXlsx(readFileSync(join(__dirname, '..', 'samples', 'sample-requirements.xlsx')))
    expect(sheets.map((s) => s.name)).toEqual(['Requirements', 'About'])
    const rows = sheets[0]!.rows
    expect(guessHeaderRow(rows)).toBe(0)
    const headers = rows[0]!
    expect(guessMapping(headers, schema)).toEqual(['id', 'type', 'title', 'text', 'field:status', 'field:priority', 'field:owner', 'parent', 'linkFrom:verifies', 'field:tags'])
    const p = plan(rows.slice(1), headers)
    expect(p.counts).toEqual({ create: 59, update: 0, unchanged: 0, skip: 0 })
    expect(p.problems.filter((x) => x.severity === 'error')).toEqual([])
    const byTitle = new Map(p.items.map((x) => [x.item.title, x.item]))
    const sys = p.items.find((x) => x.item.extra['source-id'] === 'SYS-001')!.item
    expect(sys.id).toMatch(/^REQ-/)
    expect(sys.type).toBe('system-requirement')
    // the parent column held another tool's ID: resolved to the new ID of that row
    expect(sys.parent).toBe(p.items.find((x) => x.item.extra['source-id'] === 'STK-005')!.item.id)
    // "Verified By: TC-012, TC-019" → the two test cases now hold "verifies SYS-001"
    const verifiers = p.items.filter((x) => x.item.links.some((l) => l.type === 'verifies' && l.target === sys.id)).map((x) => x.item.extra['source-id'])
    expect(verifiers.sort()).toEqual(['TC-012', 'TC-019'])
    expect(byTitle.get('Comfortable temperature')?.fields).toMatchObject({ status: 'Approved', priority: 'High', owner: 'R. Nabil' })
  })

  it('re-importing the same file updates by the remembered source ID and finds nothing to change', async () => {
    const sheets = await readXlsx(readFileSync(join(__dirname, '..', 'samples', 'sample-requirements.xlsx')))
    const [headers, ...rows] = sheets[0]!.rows as [string[], ...string[][]]
    const first = plan(rows, headers)
    const byId = new Map(first.items.map((x) => [x.item.id, x.item]))
    const bySource = new Map(first.items.map((x) => [x.item.extra['source-id'] as string, x.item.id]))
    const again = plan(rows, headers, { byId, bySource })
    expect(again.counts).toEqual({ create: 0, update: 0, unchanged: 59, skip: 0 })
    // one changed cell = one update, everything else untouched
    const edited = rows.map((r) => (r[0] === 'SYS-003' ? r.map((c, i) => (i === 4 ? 'Review' : c)) : r))
    const third = plan(edited, headers, { byId, bySource })
    expect(third.counts).toMatchObject({ update: 1, unchanged: 58 })
  })

  it('builds the hierarchy from outline numbers, keeps problems per row', () => {
    const headers = ['No.', 'Heading', 'Requirement text', 'Status', 'Kind']
    const rows = [
      ['1', 'Introduction', '', '', 'Heading / Information'],
      ['1.1', 'Purpose', 'Why this document exists.', 'Draft', 'heading'],
      ['2', 'Functions', '', '', 'information'],
      ['2.1', '', 'The system shall start within 2 s. It shall also log it.', 'Done', ''],
      ['', '', '', '', ''],
      ['3.4.1', 'Orphan', 'x', '', '']
    ]
    const m = guessMapping(headers, schema)
    expect(m).toEqual(['number', 'title', 'text', 'field:status', 'type'])
    const p = plan(rows, headers)
    const [intro, purpose, functions, start, orphan] = p.items.map((x) => x.item)
    expect(purpose!.parent).toBe(intro!.id)
    expect(start!.parent).toBe(functions!.id)
    expect(start!.title).toBe('The system shall start within 2 s.') // made from the text
    expect(intro!.type).toBe('information')
    expect(orphan!.parent).toBeUndefined()
    expect(p.problems.map((x) => [x.row, x.column ?? '', x.message.slice(0, 18)])).toEqual([
      [3, 'Kind', 'Unknown item type '],
      [5, 'Status', '"Done" is not a va'],
      [7, 'No.', 'No row with number']
    ])
    expect(outlineOf('§3.2.1.')).toBe('3.2.1')
    expect(outlineOf('Intro')).toBeNull()
  })

  it('reads its own export back: links in "<type> <ID>" form, ReqMan IDs kept', async () => {
    const a: Item = { id: 'REQ-AAAAAAA', type: 'system-requirement', title: 'A', fields: {}, links: [], text: 't', extra: {} }
    const b: Item = { id: 'REQ-BBBBBBB', type: 'test-case', title: 'B', fields: {}, links: [{ type: 'verifies', target: a.id, confirmed: 'x' }], text: '', extra: {} }
    const xlsx = await writeXlsx([{ name: 'Requirements', header: ['ID', 'Title', 'Type', 'Links'], rows: [[a.id, 'A changed', 'System Requirement', ''], [b.id, 'B', 'Test Case', `verifies ${a.id}`]] }])
    const [sheet] = await readXlsx(xlsx)
    const [headers, ...rows] = sheet!.rows as [string[], ...string[][]]
    const p = plan(rows, headers, { byId: new Map([[a.id, a], [b.id, b]]), bySource: new Map() })
    expect(p.counts).toMatchObject({ update: 1, unchanged: 1 })
    expect(p.items[1]!.item.links).toEqual(b.links) // the confirmation survives
    // the same file in an empty repository creates the items under their IDs
    const fresh = plan(rows, headers)
    expect(fresh.items.map((x) => x.item.id)).toEqual([a.id, b.id])
    expect(fresh.items[1]!.item.links).toEqual([{ type: 'verifies', target: a.id }])
  })
})
