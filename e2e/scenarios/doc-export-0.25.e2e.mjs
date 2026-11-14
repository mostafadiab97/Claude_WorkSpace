// 0.25.0 (P-17…P-19): export the requirements as a Word document, a PDF and a web page from the Export dialog.
import { copyFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import { gitRepo, launch, more, newItem, outDir, scenario, temp } from '../harness.mjs'

await scenario('E2E document export', async (ctx) => {
  const { repo } = gitRepo('docexp')
  const t = (ctx.t = await launch({ openPath: repo }))
  const { win, check } = t
  await win.getByRole('button', { name: 'Open repository…' }).click()
  await win.getByRole('button', { name: 'Create requirements folder' }).click()
  await win.locator('.first-run').waitFor()
  for (const title of ['Door lock', 'Window lift']) {
    await newItem(win, 'system-requirement')
    await win.getByPlaceholder('Short name of the requirement').fill(title)
    await win.getByRole('button', { name: 'Save', exact: true }).click()
    await win.getByRole('button', { name: 'Saved ✓' }).waitFor()
  }
  const out = temp('docexp-out')
  const exp = win.getByRole('dialog', { name: /^Export/ })
  const notice = (name) => win.locator('.table-notice--ok', { hasText: name })

  console.log('Word: the document options appear; the file has the name and both items')
  await more(win, 'Export…')
  await exp.getByRole('radio', { name: /^Word document/ }).check()
  check((await exp.getByLabel('Document name (on the title page)').count()) === 1, 'Word shows the document name field')
  check((await exp.getByLabel('Word template').count()) === 1, 'Word shows the template choice (built-in layout)')
  await exp.getByLabel('Document name (on the title page)').fill('Body spec')
  await exp.getByRole('checkbox', { name: /traceability table/ }).check()
  await t.shot('docexp-1-dialog')
  const docx = join(out, 'spec.docx')
  await t.saveAs(docx)
  await exp.getByRole('button', { name: 'Export…' }).click()
  await notice('spec.docx').waitFor()
  const xml = await (await JSZip.loadAsync(readFileSync(docx))).file('word/document.xml').async('string')
  check(xml.includes('Body spec') && xml.includes('Door lock') && xml.includes('Window lift') && !xml.includes('{{'), 'the Word file holds the name and both items, every placeholder filled')

  console.log('PDF: printed by the app')
  await more(win, 'Export…')
  await exp.getByRole('radio', { name: /^PDF/ }).check()
  check((await exp.getByLabel('Word template').count()) === 0, 'no template choice for PDF')
  const pdf = join(out, 'spec.pdf')
  await t.saveAs(pdf)
  await exp.getByRole('button', { name: 'Export…' }).click()
  await notice('spec.pdf').waitFor({ timeout: 30_000 })
  const bytes = readFileSync(pdf)
  check(bytes.subarray(0, 5).toString('latin1') === '%PDF-' && bytes.length > 2000, `a real PDF file (${bytes.length} bytes)`)

  console.log('Web page: one file with the items')
  await more(win, 'Export…')
  await exp.getByRole('radio', { name: /^Web page/ }).check()
  const html = join(out, 'spec.html')
  await t.saveAs(html)
  await exp.getByRole('button', { name: 'Export…' }).click()
  await notice('spec.html').waitFor()
  const page = readFileSync(html, 'utf8')
  // copies next to the screenshots, for the reviewers
  for (const f of [docx, pdf, html]) copyFileSync(f, join(outDir, `docexp-${f.split(/[\\/]/).pop()}`))
  check(page.startsWith('<!doctype html>') && page.includes('Door lock'), 'the web page holds the items')
})
