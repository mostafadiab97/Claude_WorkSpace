// Excel files (M7) with ExcelJS (MIT): writing an export, reading a sheet as text cells for the import, and
// changing single cells of an existing file ("Update the Excel file") while keeping its formatting.
// No file access here: bytes in, bytes out (the main process reads and writes the files the user chose).
import { Workbook, type CellValue, type Worksheet } from 'exceljs'
import JSZip from 'jszip'

/**
 * Some programs (e.g. Python's openpyxl, used for many generated sheets) point to tables and drawings with absolute
 * paths inside the file ("/xl/tables/table1.xml"); ExcelJS 4.4 only finds relative ones and fails. This rewrites
 * those paths relative to their folder, which is what Excel itself writes.
 */
async function loadWorkbook(data: Uint8Array): Promise<Workbook> {
  const zip = await JSZip.loadAsync(data)
  let changed = false
  for (const path of Object.keys(zip.files).filter((p) => p.endsWith('.rels') && p !== '_rels/.rels')) {
    const xml = await (zip.file(path) as JSZip.JSZipObject).async('string')
    // xl/worksheets/_rels/sheet1.xml.rels describes files next to xl/worksheets/sheet1.xml
    const base = path.replace(/_rels\/[^/]+$/, '')
    const fixed = xml.replace(/Target="\/([^"]+)"/g, (_m, target: string) => {
      changed = true
      return `Target="${relativePath(base, target)}"`
    })
    if (fixed !== xml) zip.file(path, fixed)
  }
  const wb = new Workbook()
  const bytes = changed ? await zip.generateAsync({ type: 'uint8array' }) : data
  await wb.xlsx.load(bytes as unknown as ArrayBuffer)
  return wb
}

/** "xl/worksheets/" + "xl/tables/table1.xml" → "../tables/table1.xml" */
function relativePath(fromDir: string, to: string): string {
  const a = fromDir.split('/').filter(Boolean)
  const b = to.split('/').filter(Boolean)
  let i = 0
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++
  return [...a.slice(i).map(() => '..'), ...b.slice(i)].join('/')
}

/** One sheet to write: a header row and text rows; optional hierarchy level per row (Excel row groups). */
export interface SheetData {
  name: string
  header: string[]
  rows: string[][]
  /** Column widths in characters (default from the content, 8–60). */
  widths?: number[]
  /** 0-based level per row: indents the column `indentColumn` and groups rows (Data → Outline in Excel). */
  levels?: number[]
  indentColumn?: number
  /** Columns whose long text wraps (e.g. the requirement text). */
  wrapColumns?: number[]
}

/** A workbook with one sheet per entry: bold, frozen header row with filters; numbers stay text. */
export async function writeXlsx(sheets: SheetData[]): Promise<Uint8Array> {
  const wb = new Workbook()
  wb.creator = 'ReqMan'
  for (const s of sheets) {
    const ws = wb.addWorksheet(safeSheetName(s.name), { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.addRow(s.header)
    for (const r of s.rows) ws.addRow(r)
    const head = ws.getRow(1)
    head.font = { bold: true }
    head.alignment = { vertical: 'middle' }
    if (s.header.length > 0) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.header.length } }
    s.header.forEach((h, c) => {
      const col = ws.getColumn(c + 1)
      const longest = Math.max(h.length, ...s.rows.slice(0, 500).map((r) => Math.min(80, (r[c] ?? '').split('\n')[0]?.length ?? 0)))
      col.width = s.widths?.[c] ?? Math.max(8, Math.min(60, longest + 2))
      if (s.wrapColumns?.includes(c)) col.alignment = { wrapText: true, vertical: 'top' }
    })
    if (s.levels) {
      s.levels.forEach((level, i) => {
        const row = ws.getRow(i + 2)
        if (level > 0) row.outlineLevel = Math.min(7, level)
        if (s.indentColumn !== undefined && level > 0) row.getCell(s.indentColumn + 1).alignment = { indent: Math.min(15, level * 2) }
      })
      ws.properties.outlineProperties = { summaryBelow: false, summaryRight: false }
    }
  }
  return new Uint8Array(await wb.xlsx.writeBuffer())
}

/** Excel allows 31 characters and no : \ / ? * [ ] in sheet names. */
const safeSheetName = (name: string): string => name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Sheet'

/** The text a person sees in a cell (formulas: their result; dates as YYYY-MM-DD; rich text joined). */
export function cellText(v: CellValue): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    if ('richText' in v && Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('')
    if ('formula' in v || 'sharedFormula' in v) return 'result' in v && v.result !== undefined ? cellText(v.result as CellValue) : ''
    if ('text' in v && typeof v.text === 'string') return v.text // hyperlink
    if ('error' in v) return ''
  }
  return String(v)
}

/** Every sheet of a workbook as rows of text cells (empty trailing cells and rows trimmed). */
export async function readXlsx(data: Uint8Array): Promise<{ name: string; rows: string[][] }[]> {
  const wb = await loadWorkbook(data)
  return wb.worksheets.map((ws) => ({ name: ws.name, rows: sheetRows(ws) }))
}

function sheetRows(ws: Worksheet): string[][] {
  const rows: string[][] = []
  ws.eachRow({ includeEmpty: true }, (row, n) => {
    const cells: string[] = []
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      cells[c - 1] = cellText(cell.value).replace(/\r\n/g, '\n')
    })
    for (let i = 0; i < cells.length; i++) cells[i] ??= ''
    while (cells.length && cells[cells.length - 1] === '') cells.pop()
    rows[n - 1] = cells
  })
  for (let i = 0; i < rows.length; i++) rows[i] ??= []
  while (rows.length && (rows[rows.length - 1] as string[]).length === 0) rows.pop()
  return rows
}

/** A cell to change: 1-based row and column of the sheet. */
export interface CellEdit {
  row: number
  col: number
  value: string
}

/**
 * The same workbook with some cells changed and rows added at the end of one sheet — everything else (other
 * sheets, styles, widths, filters) as ExcelJS reads it. ExcelJS does not keep charts and pivot tables.
 */
export async function updateXlsx(data: Uint8Array, sheet: string, edits: CellEdit[], append: string[][]): Promise<Uint8Array> {
  const wb = await loadWorkbook(data)
  const ws = wb.getWorksheet(sheet)
  if (!ws) throw new Error(`The sheet "${sheet}" is not in the file any more.`)
  for (const e of edits) ws.getCell(e.row, e.col).value = e.value
  let last = ws.actualRowCount === 0 ? 0 : ws.lastRow?.number ?? 0
  for (const r of append) {
    last++
    r.forEach((v, c) => {
      if (v !== '') ws.getCell(last, c + 1).value = v
    })
  }
  return new Uint8Array(await wb.xlsx.writeBuffer())
}
