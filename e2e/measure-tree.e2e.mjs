// Times the tree table on a large repository (e.g. the Claude_SandBox clone with 10,005 items).
//   npm run build && npm run measure:ui -- <path-to-repository>
// Prints open / expand all / scroll / collapse / reveal timings; screenshots go to e2e/out/.
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright-core'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const repo = process.argv[2] ? resolve(process.argv[2]) : null
if (!repo) {
  console.error('Usage: npm run measure:ui -- <path-to-repository>')
  process.exit(1)
}
const outDir = join(root, 'e2e', 'out')
mkdirSync(outDir, { recursive: true })
const electronPath = (await import('electron')).default
const userData = mkdtempSync(join(tmpdir(), 'reqman-measure-'))
const app = await electron.launch({
  executablePath: electronPath,
  args: ['.', `--user-data-dir=${userData}`, ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-gpu'] : [])],
  cwd: root
})
await app.evaluate(({ dialog }, p) => {
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] })
}, repo)
const win = await app.firstWindow()
await win.setViewportSize({ width: 1400, height: 860 })
let failed = false
const time = async (label, fn) => {
  const s = Date.now()
  await fn()
  console.log(`${label}: ${Date.now() - s} ms`)
}
try {
  await time('open + first tree (includes first indexing)', async () => {
    await win.getByRole('button', { name: 'Open repository…' }).click()
    await win.locator('.table__row').first().waitFor({ timeout: 120_000 })
  })
  console.log('top-level rows:', await win.locator('.table__row').count())
  // "Expand all" opens every level at once and loads levels as they scroll into view (P-04, 0.8.0)
  await time('expand all (first screen ready)', async () => {
    await win.getByRole('button', { name: 'Expand all' }).click()
    await win.locator('.table__row[aria-level="2"]').first().waitFor()
    await win.waitForFunction(() => document.querySelectorAll('.table__row--loading').length === 0)
  })
  await time('scroll to the bottom (levels load on the way)', async () => {
    // keep jumping to the end until nothing is left to load there
    for (let i = 0; i < 50; i++) {
      await win.locator('.table__scroll').evaluate((e) => {
        e.scrollTop = e.scrollHeight
      })
      await win.waitForTimeout(30)
      const loading = await win.locator('.table__row--loading').count()
      if (loading === 0) break
    }
  })
  console.log('rows known after scrolling to the bottom:', Math.round((await win.locator('.table__scroll').evaluate((e) => e.scrollHeight)) / 34))
  await win.screenshot({ path: join(outDir, 'measure-expanded-bottom.png') })
  await time('collapse all', async () => {
    await win.getByRole('button', { name: 'Collapse all' }).click()
    await win.waitForFunction(() => (document.querySelector('.table__scroll')?.scrollHeight ?? 0) < 5000)
  })
  await time('search "level 10", open it, clear → hierarchy opened down to it', async () => {
    await win.getByLabel('Search').fill('level 10')
    await win.locator('.table-mode').waitFor()
    await win.locator('.table__row').first().click()
    await win.getByRole('button', { name: 'Clear filters' }).click()
    await win.locator('.table__row[aria-selected="true"]').waitFor({ timeout: 10_000 })
  })
  await win.screenshot({ path: join(outDir, 'measure-reveal.png') })
  await time('filter "With suspect links"', async () => {
    await win.getByRole('button', { name: /^Filters/ }).click() // 0.13.0: filters live in a pop-up
    await win.getByLabel('Links filter').selectOption('suspect')
    await win.locator('.table-mode').waitFor()
    await win.waitForTimeout(300)
  })
} catch (e) {
  console.error(e)
  await win.screenshot({ path: join(outDir, 'measure-failure.png') })
  failed = true
}
await app.evaluate(({ app: a }) => a.exit(0)).catch(() => {})
process.exit(failed ? 1 : 0)
