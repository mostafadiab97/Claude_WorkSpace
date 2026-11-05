// CR2-04 cost: what one window focus costs with Expand all on a 10k repository (counts and times the main-process calls).
//   npm run build && xvfb-run -a node tools/perf-qa-focus.mjs <repo>
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright-core'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const repo = resolve(process.argv[2])
const userData = mkdtempSync(join(tmpdir(), 'reqochet-perfqa-focus-'))
const app = await electron.launch({ executablePath: (await import('electron')).default, args: ['.', `--user-data-dir=${userData}`, '--no-sandbox', '--disable-gpu'], cwd: root })
await app.evaluate(({ dialog, ipcMain }, p) => {
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] })
  globalThis.__calls = []
  const h = ipcMain._invokeHandlers
  for (const [ch, fn] of [...h.entries()]) h.set(ch, async (...a) => { const t = Date.now(); try { return await fn(...a) } finally { globalThis.__calls.push([ch, Date.now() - t, Date.now()]) } })
}, repo)
const win = await app.firstWindow()
await win.setViewportSize({ width: 1400, height: 860 })
await win.getByRole('button', { name: 'Open repository…' }).click()
await win.locator('.table__row').first().waitFor({ timeout: 120000 })
const run = async (label) => {
  await app.evaluate(() => { globalThis.__calls = [] })
  await win.evaluate(() => { window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)) }).observe({ entryTypes: ['longtask'] }) })
  const t0 = Date.now()
  await win.evaluate(() => window.dispatchEvent(new Event('focus')))
  await win.waitForTimeout(2500)
  const calls = await app.evaluate(() => globalThis.__calls)
  const lt = await win.evaluate(() => window.__lt)
  const by = {}; for (const [c, ms] of calls) { by[c] ??= [0, 0]; by[c][0]++; by[c][1] += ms }
  const end = Math.max(...calls.map((c) => c[2])) - t0
  console.log(`${label}: ${calls.length} main-process calls, last finished ${end} ms after focus; renderer long tasks (>50 ms): ${JSON.stringify(lt)}`)
  for (const [c, [n, ms]] of Object.entries(by)) console.log(`    ${c} x${n} = ${ms} ms`)
}
await run('focus, collapsed tree (10 top rows)')
await win.getByRole('button', { name: 'Expand all' }).click()
await win.waitForFunction(() => document.querySelectorAll('.table__row--loading').length === 0)
await win.waitForTimeout(500)
await run('focus, Expand all (10k)')
await win.locator('.table__row').nth(3).click(); await win.waitForTimeout(500)
await run('focus, Expand all + item open in the editor')
await app.evaluate(({ app: a }) => a.exit(0)).catch(() => {})
process.exit(0)
