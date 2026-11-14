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
    // nothing may navigate or open windows from here (security review 0.25.0 S-06); links in the PDF stay links
    win.webContents.on('will-navigate', (e) => e.preventDefault())
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    await writeFile(file, html, 'utf8')
    await withTimeout(win.loadFile(file))
    // the page-number spans are Chromium's; the words around them are escaped (S-07)
    const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // eslint-disable-next-line no-control-regex -- the two markers split the translated words
    const footer = T.docExport.pageOf('\u0001', '\u0002').split(/(\u0001|\u0002)/).map((p) => (p === '\u0001' ? '<span class="pageNumber"></span>' : p === '\u0002' ? '<span class="totalPages"></span>' : esc(p))).join('')
    const pdf = await withTimeout(win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#566070">${footer}</div>`,
      margins: { top: 0.6, bottom: 0.7, left: 0.6, right: 0.6 }
    }))
    return new Uint8Array(pdf)
  } finally {
    if (!win.isDestroyed()) win.destroy()
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/** A very large document may take long, but never forever (S-08): the window is closed in `finally`. */
function withTimeout<V>(p: Promise<V>, ms = 180_000): Promise<V> {
  let timer: NodeJS.Timeout | undefined
  const stop = new Promise<never>((_r, reject) => {
    timer = setTimeout(() => reject(new Error(T.docExport.pdfTimeout)), ms)
  })
  return Promise.race([p, stop]).finally(() => clearTimeout(timer))
}
