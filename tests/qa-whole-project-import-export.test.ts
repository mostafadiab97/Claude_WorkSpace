// QA whole-project review: import / export / main-process / CI findings (CR3-xx, SEC-02..05), written to FAIL today.
// `it.fails` keeps the suite green; when a defect is fixed the test starts passing and Vitest reports it — then change
// `it.fails` to `it`. Details: docs/reviews/agents/whole-project-qa-tester.md
import { readFileSync } from 'node:fs'
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { backupName, writeSourceUpdate, type LoadedFile } from '../src/main/importFiles'
import { guessMapping, parseCsv, planImport, readReqif, readXlsx, toCsv, writeReqif, writeXlsx, updateXlsx } from '../src/modules/import-export'
import { generateId, isValidId } from '../src/modules/items'
import { buildProblemReport } from '../src/modules/logger'
import { parseSchema } from '../src/modules/schema'
import type { IndexedItem } from '../src/shared/domain'

const root = join(__dirname, '..')
const { schema } = parseSchema(readFileSync(join(root, 'config', 'default-schema.yaml'), 'utf8'))
const mk = (id: string, title: string, extra: Partial<IndexedItem> = {}): IndexedItem => ({
  id, type: 'system-requirement', title, fields: {}, links: [], text: '', path: `items/${id}.md`, childCount: 0, incomingCount: 0, suspectCount: 0, ...extra
})
const planWith = (s: typeof schema, rows: string[][], existing: Parameters<typeof planImport>[0]['existing'] = { byId: new Map(), bySource: new Map() }) => {
  const [headers, ...data] = rows as [string[], ...string[][]]
  const taken = new Set<string>()
  return planImport({
    rows: data, firstRow: 2, headers, mapping: guessMapping(headers, s), schema: s, defaultType: 'system-requirement', existing,
    newId: () => { const id = generateId((x) => taken.has(x)); taken.add(id); return id }, isValidId
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('CR3-01: ReqIF round trip with a numeric or spaced source ID', () => {
  for (const sourceId of ['123', 'DOORS 1']) {
    it.fails(`CR3-01: source-id "${sourceId}" is recognised again after export → import (no duplicate)`, () => {
      const xml = writeReqif(schema, [{ item: mk('REQ-AAAAAAA', 'One'), sourceId, depth: 0 }], 'T')
      const sheet = readReqif(xml)[0]!
      const plan = planWith(schema, sheet.rows, { byId: new Map(), bySource: new Map([[sourceId, 'REQ-AAAAAAA']]) })
      expect(plan.items.map((p) => p.action)).not.toContain('create')
    })
  }
})

describe('CR3-02: a stray quote inside an unquoted CSV cell', () => {
  it.fails('CR3-02: 12" display does not swallow the following rows', () => {
    const rows = parseCsv('ID,Title\nA-1,12" display\nA-2,Second row\nA-3,Third\n')
    expect(rows).toHaveLength(4)
    expect(rows[3]).toEqual(['A-3', 'Third'])
  })
})

describe('CR3-03: non-Latin choice values and type names', () => {
  const arSchema = {
    ...schema,
    itemTypes: [...schema.itemTypes, { id: 'ar-type', name: 'متطلب', requirement: true }],
    fields: [...schema.fields, { id: 'rating', name: 'Rating', type: 'enum' as const, options: ['عالي', 'منخفض'] }]
  } as typeof schema
  it.fails('CR3-03a: the Arabic option that was typed is the one stored', () => {
    const latin = planWith({ ...arSchema, fields: [...schema.fields, { id: 'rating', name: 'Rating', type: 'enum' as const, options: ['High', 'Low'] }] } as typeof schema, [['Title', 'Rating'], ['Row', 'Low']])
    expect(latin.items[0]!.item.fields['rating']).toBe('Low') // control: the same table works with Latin options
    const plan = planWith(arSchema, [['Title', 'Rating'], ['Row', 'منخفض']])
    expect(plan.items[0]!.item.fields['rating']).toBe('منخفض')
  })
  it.fails('CR3-03b: an unknown non-Latin type name is reported, not silently mapped to the Arabic-named type', () => {
    const plan = planWith(arSchema, [['Title', 'Type'], ['Row', 'Требование']])
    expect(plan.items[0]!.item.type).not.toBe('ar-type')
  })
})

describe('CR3-04: "Update the Excel file" on a macro workbook', () => {
  it.fails('CR3-04: vbaProject.bin and the macro content type are still in the file', async () => {
    const base = await writeXlsx([{ name: 'Sheet1', header: ['ID', 'Title'], rows: [['A', 'One']] }])
    const zip = await JSZip.loadAsync(base)
    zip.file('xl/vbaProject.bin', new Uint8Array([1, 2, 3]))
    const ct = await zip.file('[Content_Types].xml')!.async('string')
    zip.file('[Content_Types].xml', ct.replace('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml', 'application/vnd.ms-excel.sheet.macroEnabled.main+xml'))
    const macroBook = await zip.generateAsync({ type: 'uint8array' })
    const sheetName = (await readXlsx(macroBook))[0]!.name
    const out = await JSZip.loadAsync(await updateXlsx(macroBook, sheetName, [], [['x']]))
    expect(out.file('xl/vbaProject.bin')).not.toBeNull()
    expect(await out.file('[Content_Types].xml')!.async('string')).toContain('macroEnabled')
  })
})

describe('CR3-05: the backup before "Update the original"', () => {
  it.fails('CR3-05a: two updates in the same minute keep the true original as a backup', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-05T08:35:10'))
    const dir = await mkdtemp(join(tmpdir(), 'qa-wp-bak-'))
    const path = join(dir, 'Req.csv')
    const original = 'ID,Title\r\nA,Original\r\n'
    await writeFile(path, original)
    const src: LoadedFile = { path, name: 'Req.csv', kind: 'csv', separator: ',', sheets: [{ name: 'Req', rows: parseCsv(original) }] }
    await writeSourceUpdate(src, 'Req', [{ row: 2, col: 2, value: 'First update' }], [], path)
    vi.setSystemTime(new Date('2026-11-05T08:35:50'))
    await writeSourceUpdate({ ...src, sheets: [{ name: 'Req', rows: parseCsv(await readFile(path, 'utf8')) }] }, 'Req', [{ row: 2, col: 2, value: 'Second update' }], [], path)
    const backups = (await readdir(dir)).filter((f) => f.includes('before reqochet update'))
    const contents = await Promise.all(backups.map((f) => readFile(join(dir, f), 'utf8')))
    expect(contents).toContain(original)
  })
  it.fails('CR3-05b: the date and the time of the backup name come from the same (local) clock', () => {
    const old = process.env['TZ']
    process.env['TZ'] = 'Asia/Riyadh'
    try {
      expect(backupName('C:\\x\\Req.xlsx', new Date('2026-11-04T23:30:00Z'))).toContain('2026-11-05 0230')
    } finally {
      if (old === undefined) delete process.env['TZ']
      else process.env['TZ'] = old
    }
  })
})

describe('CR3-06: "Update the CSV file" leaves unchanged cells as they were', () => {
  it.fails('CR3-06a: a phone number and a mention are not given a leading apostrophe', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qa-wp-csv-'))
    const rows = [['ID', 'Title', 'Note'], ['A', 'One', '+49 170 1234'], ['B', 'Two', '@anna']]
    const src: LoadedFile = { path: join(dir, 'in.csv'), name: 'in.csv', kind: 'csv', separator: ',', sheets: [{ name: 'in', rows }] }
    const target = join(dir, 'out.csv')
    await writeSourceUpdate(src, 'in', [{ row: 2, col: 2, value: 'One (edited)' }], [], target)
    const back = parseCsv(await readFile(target, 'utf8'))
    expect(back[1]![2]).toBe('+49 170 1234')
    expect(back[2]![2]).toBe('@anna')
  })
  it.fails('CR3-06b: export → import of a title starting with "=" gives the same title back', () => {
    expect(parseCsv(toCsv([['=SUM(1)']]))[0]![0]).toBe('=SUM(1)')
  })
})

describe('SEC-02: no secret in a problem report', () => {
  it.fails('SEC-02: a token inside a Git address is masked', () => {
    const r = buildProblemReport({ description: 'd', diagnostics: 'x', log: 'Added remote origin https://anna:ghp_SECRET123@github.com/team/repo.git' })
    expect(r).not.toContain('ghp_SECRET123')
  })
})

describe('CI findings (workflow files read as text)', () => {
  const wf = (n: string): string => readFileSync(join(root, '.github', 'workflows', n), 'utf8')
  it.fails('CR3-25: release.yml runs the privacy check', () => {
    expect(wf('release.yml')).toMatch(/check-privacy/)
  })
  it.fails('SEC-03: build.yml has read-only default permissions and checkouts do not keep the token', () => {
    const b = wf('build.yml')
    expect(b).toMatch(/permissions:\s*\n\s+contents: read/)
    expect(b).toMatch(/persist-credentials: false/)
  })
  it.fails('SEC-04: every action is pinned to a full commit ID', () => {
    for (const f of ['build.yml', 'release.yml']) {
      for (const m of wf(f).matchAll(/uses:\s*(\S+)@(\S+)/g)) expect(m[2], `${f} ${m[1]}`).toMatch(/^[0-9a-f]{40}$/)
    }
  })
  it.fails('SEC-05: the unlicensed library "buffers" is not in the lock file', () => {
    expect(readFileSync(join(root, 'package-lock.json'), 'utf8')).not.toContain('"node_modules/buffers"')
  })
})
