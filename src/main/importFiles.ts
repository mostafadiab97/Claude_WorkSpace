// Reading the files the user chose for an import, and writing "Update the Excel file" (M7). The window never sees
// paths it could misuse: it gets a token for a file it picked in the dialog, and the contents stay here.
import { randomBytes } from 'node:crypto'
import { copyFile, readFile } from 'node:fs/promises'
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

export async function loadImportFile(path: string): Promise<LoadedFile> {
  const data = new Uint8Array(await readFile(path))
  const ext = extname(path).toLowerCase()
  if (ext === '.reqif' || ext === '.reqifz') {
    // .reqifz = a zip with the .reqif file (and its attachments)
    let xml: string
    if (ext === '.reqifz') {
      const zip = await JSZip.loadAsync(data)
      const entry = Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith('.reqif'))
      if (!entry) throw new Error(T.importMsg.reqifzEmpty)
      xml = await entry.async('string')
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

/** A backup name next to the file: "Requirements (before ReqMan update 2026-10-29 0835).xlsx". */
export function backupName(path: string, now = new Date()): string {
  const ext = extname(path)
  const stamp = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5).replace(':', '')}`
  return `${path.slice(0, path.length - ext.length)} (before ReqMan update ${stamp})${ext}`
}

/**
 * Writes the changed cells and new rows into `target` — the original file (after a backup copy) or a copy the user
 * chose. Excel files keep their formatting; a CSV file is written again with its own separator.
 */
export async function writeSourceUpdate(source: LoadedFile, sheet: string, edits: CellEdit[], append: string[][], target: string): Promise<void> {
  if (target === source.path) await copyFile(source.path, backupName(source.path))
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
  rows.push(...append)
  await writeFileAtomic(target, toCsv(rows, source.separator))
}
