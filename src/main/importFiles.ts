// Reading the files the user chose for an import, and writing "Update the Excel file" (M7). The window never sees
// paths it could misuse: it gets a token for a file it picked in the dialog, and the contents stay here.
import { randomBytes } from 'node:crypto'
import { constants as fsConstants } from 'node:fs'
import { copyFile, readFile, stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import type { ImportFile } from '../shared/api'
import JSZip from 'jszip'
import { detectSeparator, parseCsv, readReqif, readXlsx, toCsv, updateXlsx, type CellEdit } from '../modules/import-export'
import { writeFileAtomic } from '../modules/safe-files'
import { T } from '../shared/text'

export interface LoadedFile {
  path: string
  name: string
  kind: 'xlsx' | 'csv' | 'reqif'
  separator: string
  sheets: { name: string; rows: string[][] }[]
}

/** CSV text: UTF-8 when it decodes cleanly, otherwise Windows-1252 (what older Excel versions write). */
function decodeText(data: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data)
  } catch {
    return new TextDecoder('windows-1252').decode(data)
  }
}

/** Import files and an unpacked .reqif entry are refused above this size (SEC-WP3-07: a zip bomb). */
const MAX_IMPORT_MB = 200

export async function loadImportFile(path: string): Promise<LoadedFile> {
  if ((await stat(path)).size > MAX_IMPORT_MB * 1_000_000) throw new Error(T.importMsg.fileTooBig(MAX_IMPORT_MB))
  const data = new Uint8Array(await readFile(path))
  const ext = extname(path).toLowerCase()
  if (ext === '.reqif' || ext === '.reqifz') {
    // .reqifz = a zip with the .reqif file (and its attachments)
    let xml: string
    if (ext === '.reqifz') {
      const zip = await JSZip.loadAsync(data)
      const entry = Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith('.reqif'))
      if (!entry) throw new Error(T.importMsg.reqifzEmpty)
      const bytes = await entry.async('uint8array')
      if (bytes.length > MAX_IMPORT_MB * 1_000_000) throw new Error(T.importMsg.fileTooBig(MAX_IMPORT_MB))
      xml = decodeText(bytes)
    } else xml = decodeText(data)
    return { path, name: basename(path), kind: 'reqif', separator: ',', sheets: readReqif(xml) }
  }
  const kind = ext === '.xlsx' || ext === '.xlsm' ? 'xlsx' : 'csv'
  if (kind === 'xlsx') return { path, name: basename(path), kind, separator: ',', sheets: await readXlsx(data) }
  const text = decodeText(data)
  const separator = detectSeparator(text)
  const rows = parseCsv(text, separator)
  while (rows.length && rows[rows.length - 1]?.every((c) => c === '')) rows.pop()
  return { path, name: basename(path), kind, separator, sheets: [{ name: basename(path, extname(path)), rows }] }
}

/** Keeps the last few chosen files by token. */
export function createImportFiles() {
  const files = new Map<string, LoadedFile>()
  return {
    add(f: LoadedFile): ImportFile {
      const token = randomBytes(8).toString('hex')
      files.set(token, f)
      while (files.size > 3) files.delete(files.keys().next().value as string)
      return {
        token,
        name: f.name,
        path: f.path,
        kind: f.kind,
        // a preview for the wizard: the first rows, long cells shortened
        sheets: f.sheets.map((s) => ({ name: s.name, rowCount: s.rows.length, sample: s.rows.slice(0, 25).map((r) => r.slice(0, 60).map((c) => (c.length > 160 ? `${c.slice(0, 157)}…` : c))) }))
      }
    },
    get: (token: string): LoadedFile | undefined => files.get(token)
  }
}

/**
 * Where "Update the Excel file" may write (CR3-04, the owner 5 Nov 2026): a workbook with macros (.xlsm) is never
 * rewritten, because the macros cannot be kept; its copy always gets the .xlsx name. null = refused.
 */
export function updateTarget(source: string, mode: 'original' | 'copy', chosen?: string): string | null {
  const macros = /\.xlsm$/i.test(source)
  if (mode === 'original') return macros ? null : source
  return macros && chosen ? chosen.replace(/\.xlsm$/i, '.xlsx') : (chosen ?? null)
}

/** A backup name next to the file: "Requirements (before reqochet update 2026-10-29 0835).xlsx". */
export function backupName(path: string, now = new Date()): string {
  const ext = extname(path)
  // local date and time from the same clock, with seconds (CR3-05)
  const two = (n: number): string => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())} ${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`
  return `${path.slice(0, path.length - ext.length)} (before reqochet update ${stamp})${ext}`
}

/**
 * Writes the changed cells and new rows into `target` — the original file (after a backup copy) or a copy the user
 * chose. Excel files keep their formatting; a CSV file is written again with its own separator.
 */
export async function writeSourceUpdate(source: LoadedFile, sheet: string, edits: CellEdit[], append: string[][], target: string): Promise<void> {
  if (target === source.path) {
    // never replace an earlier backup: COPYFILE_EXCL refuses an existing name, then " (2)", " (3)" … (CR3-05)
    const name = backupName(source.path)
    for (let n = 1; ; n++) {
      const candidate = n === 1 ? name : name.replace(/(\.[^.\\/]+)$/, ` (${n})$1`)
      try {
        await copyFile(source.path, candidate, fsConstants.COPYFILE_EXCL)
        break
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST' || n > 50) throw e
      }
    }
  }
  if (source.kind === 'xlsx') {
    const data = new Uint8Array(await readFile(source.path))
    await writeFileAtomic(target, await updateXlsx(data, sheet, edits, append))
    return
  }
  const rows = (source.sheets[0]?.rows ?? []).map((r) => [...r])
  for (const e of edits) {
    const row = (rows[e.row - 1] ??= [])
    while (row.length < e.col) row.push('')
    row[e.col - 1] = e.value
  }
  const firstNew = rows.length
  rows.push(...append)
  const changed = new Set(edits.map((e) => `${e.row - 1}:${e.col - 1}`))
  await writeFileAtomic(target, toCsv(rows, source.separator, (r, c) => r >= firstNew || changed.has(`${r}:${c}`)))
}
