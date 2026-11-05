// Performance QA measurements (whole-project review, 5 Nov 2026). Drives the BUILT app through window.reqochet.
//   npm run build && xvfb-run -a node tools/perf-qa-whole.mjs <generated-scenario-repo-with-git>
// The repository is modified (edits, commits): pass a throw-away copy. Prints one line per measurement.
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright-core'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const repo = process.argv[2] ? resolve(process.argv[2]) : null
if (!repo) throw new Error('Usage: node tools/perf-qa-whole.mjs <repo>')
const electronPath = (await import('electron')).default
const userData = mkdtempSync(join(tmpdir(), 'reqochet-perfqa-'))
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28 })
const out = (label, ms, extra = '') => console.log(`${label}: ${Math.round(ms * 10) / 10} ms${extra ? ' — ' + extra : ''}`)

async function launch() {
  const app = await electron.launch({ executablePath: electronPath, args: ['.', `--user-data-dir=${userData}`, '--no-sandbox', '--disable-gpu'], cwd: root })
  await app.evaluate(({ dialog }, p) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] }) }, repo)
  const win = await app.firstWindow()
  await win.setViewportSize({ width: 1400, height: 860 })
  return { app, win }
}
async function openRepo(win) {
  const s = Date.now()
  await win.getByRole('button', { name: 'Open repository…' }).click()
  await win.locator('.table__row').first().waitFor({ timeout: 180_000 })
  return Date.now() - s
}
const rssMb = (app) => app.evaluate(({ app: a }) => Math.round(a.getAppMetrics().reduce((n, m) => n + m.memory.workingSetSize, 0) / 1024))
const heapMb = (win) => win.evaluate(() => Math.round(performance.memory.usedJSHeapSize / 1048576))
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]
const call = (win, fn, args = []) => win.evaluate(async ([f, a]) => { const t = performance.now(); const r = await window.reqochet[f](...a); return [performance.now() - t, r] }, [fn, args])

// 1. cold open (no cache), quit, warm open (cache present)
let { app, win } = await launch()
out('open, cold (first index)', await openRepo(win))
await app.evaluate(({ app: a }) => a.exit(0)).catch(() => {})
;({ app, win } = await launch())
out('open, warm (cache present, nothing changed)', await openRepo(win))

// 2. IPC-level calls
const rf = []; for (let i = 0; i < 5; i++) rf.push((await call(win, 'refreshRepository', [true]))[0])
out('refreshRepository(focus) nothing changed (median of 5)', median(rf))
const big = []; for (let i = 0; i < 3; i++) big.push((await call(win, 'queryItems', [{ sort: { by: 'order' }, limit: 10000, offset: 0, brief: true }]))[0])
out('queryItems brief 10,000 rows over the bridge = fetchAll (median of 3)', median(big))
const fullq = (await call(win, 'queryItems', [{ sort: { by: 'order' }, limit: 10000, offset: 0 }]))[0]
out('queryItems NOT brief 10,000 rows', fullq)
for (const [n, q] of [
  ['text search "sensor"', { text: 'sensor', limit: 100 }],
  ['text search "schedule editor" (2 words)', { text: 'schedule editor', limit: 100 }],
  ['sort by title offset 5000', { sort: { by: 'title' }, limit: 100, offset: 5000 }],
  ['suspect filter', { links: 'suspect', limit: 100 }],
  ['no-links filter', { links: 'none', limit: 100 }],
  ['status filter', { fields: { status: ['Approved'] }, limit: 100 }]
]) { const t = []; for (let i = 0; i < 3; i++) t.push((await call(win, 'queryItems', [q]))[0]); const r = (await call(win, 'queryItems', [q]))[1]; out(`query ${n} (bridge, median of 3)`, median(t), `${r.total} matches`) }
const ids = (await call(win, 'queryItems', [{ limit: 200, brief: true, text: 'schedule' }]))[1].items.map((i) => i.id)
const gi = []; for (const id of ids.slice(0, 20)) gi.push((await call(win, 'getItem', [id]))[0])
out('getItem (median of 20)', median(gi))
const hi = []; for (const id of ids.slice(0, 5)) hi.push((await call(win, 'getItemHistory', [id]))[0])
out('getItemHistory (git log for one item, median of 5)', median(hi))
const an = []; for (const id of ids.slice(0, 20)) an.push((await call(win, 'getAncestors', [id]))[0])
out('getAncestors (median of 20)', median(an))

// 3. save / edit
const sv = []
for (const id of ids.slice(0, 20)) {
  const d = (await call(win, 'getItem', [id]))[1]
  const item = { ...d.item, title: d.item.title + ' x' }
  const [ms, r] = await call(win, 'saveItem', [item, d.revision]); if (!r.ok) throw new Error(r.message); sv.push(ms)
}
out('saveItem (median of 20; write + index + git status of file)', median(sv), `max ${Math.round(Math.max(...sv))} ms`)
const ls = []; for (let i = 0; i < 5; i++) ls.push((await call(win, 'refreshRepository', [false]))[0])
out('refreshRepository after saves (median of 5)', median(ls))

// 4. Git state: clean-ish, then with 1,000 / 5,000 files edited outside the app
out('getGitState (20 saved edits uncommitted)', (await call(win, 'getGitState'))[0])
const files = readdirSync(join(repo, 'requirements', 'items')).filter((f) => f.endsWith('.md'))
const edit = (n, tag) => { for (const f of files.slice(0, n)) { const p = join(repo, 'requirements', 'items', f); writeFileSync(p, readFileSync(p, 'utf8').replace(/^title: (.*)$/m, `title: $1 ${tag}`)) } }
edit(1000, 'e1')
const [rfl, ri] = await call(win, 'refreshRepository', [true]); out('refreshRepository(focus) after 1,000 files edited outside', rfl, `changedFiles ${ri.lastSync.changedFiles}`)
out('getGitState with 1,000 uncommitted files', (await call(win, 'getGitState'))[0])
out('getCompareOptions with 1,000 uncommitted', (await call(win, 'getCompareOptions'))[0])
const head = git('rev-parse', 'HEAD').trim()
let [cm, cr] = await call(win, 'compareVersions', [head, 'WORKING']); out('compareVersions HEAD..WORKING, 1,000 edits', cm, `${cr.items?.length ?? cr.changes?.length ?? '?'} entries`)
const [cmt] = await call(win, 'commit', ['perf 1000']); out('commit 1,000 files (app)', cmt)
edit(5000, 'e2')
const [r5] = await call(win, 'refreshRepository', [true]); out('refreshRepository(focus) after 5,000 files edited outside', r5)
out('getGitState with 5,000 uncommitted files', (await call(win, 'getGitState'))[0])
;[cm, cr] = await call(win, 'compareVersions', [git('rev-parse', 'HEAD').trim(), 'WORKING']); out('compareVersions HEAD..WORKING, 5,000 edits', cm)
const [cm2] = await call(win, 'commit', ['perf 5000']); out('commit 5,000 files (app)', cm2)
out('compareVersions first commit..HEAD (≈6,000 changed files)', (await call(win, 'compareVersions', [head, git('rev-parse', 'HEAD').trim()]))[0])
out('getGitState clean', (await call(win, 'getGitState'))[0])

// 5. Expand all + focus x10 (CR2-04) and memory
await win.evaluate(() => { window.__lt = 0; window.__n = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__lt += e.duration; window.__n++ } }).observe({ entryTypes: ['longtask'] }) })
await win.getByRole('button', { name: 'Expand all' }).click()
await win.locator('.table__row[aria-level="2"]').first().waitFor()
await win.waitForFunction(() => document.querySelectorAll('.table__row--loading').length === 0)
await win.locator('.table__scroll').evaluate((e) => { e.scrollTop = e.scrollHeight }); await win.waitForTimeout(500)
const mem0 = [await rssMb(app), await heapMb(win)]
await win.evaluate(() => { window.__lt = 0; window.__n = 0 })
const fo = []
for (let i = 0; i < 10; i++) {
  const t = await win.evaluate(() => new Promise((res) => {
    const s = performance.now(); const orig = window.reqochet.queryItems; let calls = 0
    window.dispatchEvent(new Event('focus'))
    const iv = setInterval(() => { if (performance.now() - s > 200 && !document.querySelector('.table__row--loading')) { clearInterval(iv); res(performance.now() - s) } }, 20)
  }))
  fo.push(t)
}
const lt = await win.evaluate(() => [window.__lt, window.__n])
out('focus event with Expand all on 10k, wall time until quiet (median of 10; includes 200 ms floor)', median(fo), `main-thread long tasks total ${Math.round(lt[0])} ms in ${lt[1]} tasks over 10 focuses`)
const mem1 = [await rssMb(app), await heapMb(win)]
console.log(`memory after Expand all: app working set ${mem0[0]} MB, renderer JS heap ${mem0[1]} MB; after 10 focuses: ${mem1[0]} MB / ${mem1[1]} MB`)
// 30 expand/collapse cycles + 30 focus events
for (let i = 0; i < 30; i++) {
  await win.getByRole('button', { name: 'Collapse all' }).click(); await win.getByRole('button', { name: 'Expand all' }).click()
  await win.waitForFunction(() => document.querySelectorAll('.table__row--loading').length === 0)
  await win.evaluate(() => window.dispatchEvent(new Event('focus')))
}
await win.waitForTimeout(1000)
const mem2 = [await rssMb(app), await heapMb(win)]
console.log(`memory after 30 expand/collapse + 30 focus: app working set ${mem2[0]} MB, renderer JS heap ${mem2[1]} MB`)
await app.evaluate(({ app: a }) => a.exit(0)).catch(() => {})
process.exit(0)
