/** A field Excel would run as a formula when opening a CSV ("=cmd|…"). Text starting like that gets a leading '. */
const FORMULA_START = /^[=+@\t\r]/

/**
 * One CSV cell, as Excel (comma separator) reads it: quoted when it contains a comma, a quote, a line break or
 * leading/trailing spaces; quotes doubled.
 */
export function csvCell(value: string, separator = ',', protect = true): string {
  const v = protect && FORMULA_START.test(value) ? `'${value}` : value
  return /["\r\n]|^\s|\s$/.test(v) || v.includes(separator) ? `"${v.replace(/"/g, '""')}"` : v
}

/**
 * The whole file: UTF-8 with a byte-order mark (so Excel shows Arabic, umlauts, ° correctly), comma-separated,
 * CRLF line ends. Line breaks inside a cell stay inside the quoted cell.
 */
export function toCsv(rows: string[][], separator = ',', protect: (row: number, col: number) => boolean = () => true): string {
  return `\uFEFF${rows.map((r, i) => r.map((c, j) => csvCell(c, separator, protect(i, j))).join(separator)).join('\r\n')}\r\n`
}

/**
 * The separator of a CSV file: Excel writes ";" where the comma is the decimal sign (e.g. German settings).
 * Decided by the first line, outside quotes.
 */
export function detectSeparator(text: string): ',' | ';' | '\t' {
  const first = (text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '').replace(/"[^"]*"/g, '')
  const count = (c: string): number => first.split(c).length - 1
  const [best] = ([',', ';', '\t'] as const).map((c) => [c, count(c)] as const).sort((a, b) => b[1] - a[1])
  return best && best[1] > 0 ? best[0] : ','
}

/** The protecting ' an export put before a formula-like value comes off again on import (CR3-06b). */
const unprotect = (cell: string): string => (cell.startsWith("'") && FORMULA_START.test(cell.slice(1)) ? cell.slice(1) : cell)

/** Reads CSV text (RFC 4180; BOM and CRLF tolerated; comma unless another separator is given). */
export function parseCsv(text: string, separator = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const t = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < t.length; i++) {
    const ch = t[i] as string
    if (quoted) {
      if (ch === '"' && t[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true // a quote opens a quoted cell only at its start (CR3-02: 12" display)
    else if (ch === separator) {
      row.push(unprotect(cell))
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++
      row.push(unprotect(cell))
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length > 0) {
    row.push(unprotect(cell))
    rows.push(row)
  }
  return rows
}
