// Runs the end-to-end scenarios (e2e/scenarios/*.e2e.mjs), two at a time, each with its own repository and
// profile, and prints one summary. A failing scenario does not stop the others (review T-01).
//   npm run build && npm run test:e2e [-- name ...]     (e.g. npm run test:e2e -- fixes)
import { spawn } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { root } from './harness.mjs'

const dir = join(root, 'e2e', 'scenarios')
const wanted = process.argv.slice(2)
const all = readdirSync(dir)
  .filter((f) => f.endsWith('.e2e.mjs'))
  .filter((f) => wanted.length === 0 || wanted.some((w) => f.startsWith(w)))
const PARALLEL = Number(process.env.E2E_PARALLEL ?? 2)

const results = []
const run = (file) =>
  new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(process.execPath, [join(dir, file)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('exit', (code) => {
      // print each scenario's output in one block, so parallel runs stay readable
      console.log(`\n===== ${file} (${Math.round((Date.now() - started) / 1000)} s) =====\n${out.trim()}`)
      results.push({ file, ok: code === 0 })
      resolve()
    })
  })

const queue = [...all]
await Promise.all(
  Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
    while (queue.length) await run(queue.shift())
  })
)
console.log('\nE2E summary:')
for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.file}`)
const failed = results.filter((r) => !r.ok).length
console.log(failed === 0 ? 'All E2E scenarios passed' : `${failed} scenario(s) failed`)
process.exit(failed === 0 ? 0 : 1)
