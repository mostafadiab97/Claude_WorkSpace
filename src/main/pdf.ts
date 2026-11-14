import { BrowserWindow } from 'electron'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { T } from '../shared/text'

/**
 * Prints an exported HTML document to PDF (0.25.0, P-17): a hidden window without scripts or a preload loads the file
 * from a temporary folder and Chromium prints it (A4, page numbers in the footer). The folder is removed afterwards.
 */
export async function htmlToPdf(html: string): Promise<Uint8Array> {
  const dir = await mkdtemp(join(tmpdir(), 'reqochet-pdf-'))
  const file = join(dir, 'document.html')
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true, contextIsolation: true, nodeIntegration: false } })
  try {
    await writeFile(file, html, 'utf8')
    await win.loadFile(file)
    const footer = T.docExport.pageOf('<span class="pageNumber"></span>', '<span class="totalPages"></span>')
    const pdf = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#566070">${footer}</div>`,
      margins: { top: 0.6, bottom: 0.7, left: 0.6, right: 0.6 }
    })
    return new Uint8Array(pdf)
  } finally {
    if (!win.isDestroyed()) win.destroy()
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}
