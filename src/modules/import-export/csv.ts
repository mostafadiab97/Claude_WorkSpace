/** A field Excel would run as a formula when opening a CSV ("=cmd|…"). Text starting like that gets a leading '. */
const FORMULA_START = /^[=+@\t\r]|^-(?! )/ // "-1+2" too (SEC-WP3-19); a Markdown bullet "- item" stays as it is

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

/** How many cell separators the rest of the line from `from` holds, outside quoted cells. */
function separatorsToLineEnd(t: string, from: number, separator: string): number {
  let count = 0
  let inQuote = false
  let cellStart = false
  for (let i = from; i < t.length && (inQuote || (t[i] !== '\n' && t[i] !== '\r')); i++) {
    const ch = t[i]
    if (inQuote) {
      if (ch === '"' && t[i + 1] === '"') i++
      else if (ch === '"') inQuote = false
    } else if (ch === separator) {
      count++
      cellStart = true
      continue
    } else if (ch === '"' && cellStart) inQuote = true
    cellStart = false
  }
  return count
}

/** How far ahead a quoted cell may run over lines while the reader decides (keeps big files linear). */
const LOOKAHEAD = 16 * 1024
/** …and over this many lines at most (CR-2: 100,000 short rows took 47 s with a 64 KB look-ahead each). */
const LOOKAHEAD_LINES = 50

/**
 * A quote before a line end, in a row that is still short: does the cell go on to the next line? Only when, further on,
 * a quote followed by a separator or line end closes it AND the rest of that line completes the row to exactly the
 * header's column count (the 0.16.3 case: a list line ending in 12" inside a cell that is not the last column).
 * Otherwise the quote closes the cell and the row is simply short (W-05, N-01, N-02, QW21-1).
 */
function cellGoesOn(t: string, quoteAt: number, separator: string, cellsBefore: number, columns: number): boolean {
  const need = columns - cellsBefore - 1
  if (need < 0) return false
  const end = Math.min(t.length, quoteAt + LOOKAHEAD)
  // read the following lines as rows of their own; a quoted cell that opens on one of them is skipped. The first quote
  // that closes something without having opened on its own line is the candidate end of our cell.
  let cellStart = false
  let inLineQuote = false
  let lines = 0
  for (let i = quoteAt + 1; i < end; i++) {
    const ch = t[i]
    const next = t[i + 1]
    if (inLineQuote) {
      // a quoted cell that opened at a cell start on a later line may itself run over lines ("multi⏎line")
      if (ch === '"' && next === '"') i++
      else if (ch === '"') inLineQuote = false
    } else if (ch === '\n' || ch === '\r') {
      cellStart = true
      if (ch === '\n' && ++lines > LOOKAHEAD_LINES) return false
    } else if (ch === separator) {
      cellStart = true
    } else if (ch === ' ' && cellStart) {
      // spaces before a quote still count as the cell's start: ` "y"` opens a quoted cell (CR-1)
    }
    else if (ch === '"' && cellStart) {
      inLineQuote = true
      cellStart = false
    } else if (ch === '"' && next === '"') {
      i++
      cellStart = false
    } else if (ch === '"' && (next === separator || next === '\n' || next === '\r' || next === undefined)) {
      return separatorsToLineEnd(t, i + 1, separator) === need
    } else cellStart = false
  }
  return false
}

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
      } else if (ch === '"') {
        // the closing quote is followed by a separator, a line end or the end of the file; any other " was typed
        // inside the cell (12" in a table or list edited by hand — the owner, 0.16.3) and is kept as text
        const next = t[i + 1]
        // before a line end it closes only if the row then has all its columns: a list line ending in 12" inside a
        // cell that is not the last column keeps going
        // — unless the next line has a full row's separators: then this row is simply short (W-05: a short row ending
        // in a quoted cell swallowed every row after it)
        const rowEndsEarly =
          (next === '\n' || next === '\r') && rows.length > 0 && row.length + 1 < (rows[0]?.length ?? 0) && cellGoesOn(t, i, separator, row.length, rows[0]?.length ?? 0)
        if ((next === undefined || next === separator || next === '\n' || next === '\r') && !rowEndsEarly) quoted = false
        else cell += ch
      } else cell += ch
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
