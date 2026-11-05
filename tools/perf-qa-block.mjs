// Does a big Compare block other window calls? Measures getItem latency while compareVersions(first..HEAD) runs.
//   npm run build && xvfb-run -a node tools/perf-qa-block.mjs <repo-with-at-least-two-commits-and-many-changed-files>
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright-core'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const repo = resolve(process.argv[2])
const g = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim()
const first = g('rev-list', '--max-parents=0', 'HEAD').split('\n')[0]
const app = await electron.launch({ executablePath: (await import('electron')).default, args: ['.', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'rq-'))}`, '--no-sandbox', '--disable-gpu'], cwd: root })
await app.evaluate(({ dialog }, p) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] }) }, repo)
const win = await app.firstWindow()
await win.getByRole('button', { name: 'Open repository…' }).click()
await win.locator('.table__row').first().waitFor({ timeout: 120000 })
const r = await win.evaluate(async ([a, b]) => {
  const id = (await window.reqochet.queryItems({ limit: 1, brief: true })).items[0].id
  const lat = []; let stop = false
  const probe = (async () => { while (!stop) { const t = performance.now(); await window.reqochet.getItem(id); lat.push(performance.now() - t); await new Promise((r) => setTimeout(r, 20)) } })()
  const t = performance.now(); await window.reqochet.compareVersions(a, b); const total = performance.now() - t
  stop = true; await probe
  return { total, max: Math.max(...lat), n: lat.length }
}, [first, g('rev-parse', 'HEAD')])
console.log(`compare ${Math.round(r.total)} ms; getItem probes during it: ${r.n}, slowest ${Math.round(r.max)} ms`)
await app.evaluate(({ app: a }) => a.exit(0)).catch(() => {}); process.exit(0)
