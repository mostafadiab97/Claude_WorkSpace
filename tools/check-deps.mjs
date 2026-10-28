// Checks the libraries ReqMan uses: known security problems (npm audit) and available updates (npm outdated).
// Runs before every build (npm run build) and in CI. It only WARNS — it never stops a build (owner's decision,
// 28 Oct 2026). Without network it says so and carries on.
//   npm run check:deps
import { spawnSync } from 'node:child_process'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const run = (args) => spawnSync(npm, args, { encoding: 'utf8', shell: process.platform === 'win32', timeout: 60_000 })
const line = '-'.repeat(72)
let warnings = 0
// On GitHub, also show warnings on the build's summary page
const annotate = (msg) => process.env.GITHUB_ACTIONS && console.log(`::warning title=Libraries::${msg}`)

// 1. security
const audit = run(['audit', '--json'])
try {
  const report = JSON.parse(audit.stdout || '{}')
  const v = report.metadata?.vulnerabilities ?? {}
  const total = (v.low ?? 0) + (v.moderate ?? 0) + (v.high ?? 0) + (v.critical ?? 0)
  if (total > 0) {
    warnings++
    annotate(`${total} known security problem(s) in libraries — run npm run check:deps`)
    console.warn(`${line}\nWARNING: ${total} known security problem(s) in libraries — critical ${v.critical ?? 0}, high ${v.high ?? 0}, moderate ${v.moderate ?? 0}, low ${v.low ?? 0}.`)
    for (const [name, info] of Object.entries(report.vulnerabilities ?? {})) {
      console.warn(`  - ${name} (${info.severity})${info.fixAvailable ? ' — fix available: npm audit fix' : ''}`)
    }
  } else if (report.metadata) {
    console.log('Libraries: no known security problems.')
  } else {
    throw new Error('no report')
  }
} catch {
  warnings++
  console.warn(`${line}\nWARNING: could not check libraries for security problems (offline?). ${(audit.stderr || '').trim().split('\n')[0] ?? ''}`)
}

// 2. updates
const outdated = run(['outdated', '--json'])
try {
  const list = Object.entries(JSON.parse(outdated.stdout || '{}'))
  if (list.length > 0) {
    console.log(`${line}\nLibrary updates available (${list.length}):`)
    for (const [name, info] of list) console.log(`  - ${name}: ${info.current ?? '—'} → ${info.latest}`)
  } else {
    console.log('Libraries: all up to date.')
  }
} catch {
  console.warn('Note: could not check for library updates (offline?).')
}

if (warnings > 0) console.warn(`${line}\nThe build continues. Review the warnings above (see docs/DEVELOPING.md, "Libraries").\n${line}`)
process.exit(0)
