/** A field Excel would run as a formula when opening a CSV ("=cmd|…"). Text starting like that gets a leading '. */
const FORMULA_START = /^[=+@\t\r]/

/**
 * One CSV cell, as Excel (comma separator) reads it: quoted when it contains a comma, a quote, a line break or
 * leading/trailing spaces; quotes doubled.
 */
export function csvCell(value: string): string {
  const v = FORMULA_START.test(value) ? `'${value}` : value
  return /[",\r\n]|^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/**
 * The whole file: UTF-8 with a byte-order mark (so Excel shows Arabic, umlauts, ° correctly), comma-separated,
 * CRLF line ends. Line breaks inside a cell stay inside the quoted cell.
 */
export function toCsv(rows: string[][]): string {
  return `\uFEFF${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`
}

/** Reads CSV text (RFC 4180, comma; BOM and CRLF tolerated). Used by tests now and by the Excel/CSV import later. */
export function parseCsv(text: string): string[][] {
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
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}
