// 0.20.1 — the owner on SEC20-05 (9 Nov 2026): exported cells that start like a formula are marked as text.
import { Workbook } from 'exceljs'
import { describe, expect, it } from 'vitest'
import { readXlsx, writeXlsx } from '../src/modules/import-export'

describe('Excel cells that start like a formula', () => {
  it('are stored as text with the Text format; other cells are left alone; the text reads back unchanged', async () => {
    const data = await writeXlsx([{ name: 'S', header: ['A', 'B'], rows: [['=HYPERLINK("x")', 'plain'], ['+1', '@SUM(A1)'], ['-x', 'a=b']] }])
    const wb = new Workbook()
    await wb.xlsx.load(Buffer.from(data) as unknown as ArrayBuffer)
    const ws = wb.worksheets[0]
    expect(ws?.getCell('A2').value).toBe('=HYPERLINK("x")')
    expect(ws?.getCell('A2').numFmt).toBe('@')
    expect(ws?.getCell('A3').numFmt).toBe('@')
    expect(ws?.getCell('B3').numFmt).toBe('@')
    expect(ws?.getCell('A4').numFmt).toBe('@')
    expect(ws?.getCell('B2').numFmt).not.toBe('@')
    expect(ws?.getCell('B4').numFmt).not.toBe('@')
    expect((await readXlsx(data))[0]?.rows[1]).toEqual(['=HYPERLINK("x")', 'plain'])
  })
})
