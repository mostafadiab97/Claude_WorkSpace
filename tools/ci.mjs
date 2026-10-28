// GitHub Actions from the command line, with the REST API only (works in cloud sessions where `gh run` sub-commands
// that use GraphQL are refused). Needs the GitHub CLI (`gh`), signed in.
//
//   node tools/ci.mjs status              latest runs (build, release, Dependabot)
//   node tools/ci.mjs wait [run id]       wait for a run (default: newest) and print the result
//   node tools/ci.mjs failures [run id]   failed steps and their annotations (failed e2e scenarios write theirs)
//   node tools/ci.mjs release             start the Release workflow by hand (after a fix on an unchanged version)
//   node tools/ci.mjs released [version]  is v<version> (default: package.json) published, with which files?
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const REPO = 'mostafadiab97/Claude_WorkSpace'
const api = (path, ...args) => JSON.parse(execFileSync('gh', ['api', ...args, `repos/${REPO}/${path}`], { encoding: 'utf8' }) || 'null')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const runs = (n = 5) => api(`actions/runs?per_page=${n}`).workflow_runs
const line = (r) => `${r.id}  ${(r.conclusion ?? r.status).padEnd(11)} ${r.name.padEnd(8)} ${r.event.padEnd(17)} ${r.display_title.slice(0, 70)}`

const [cmd = 'status', arg] = process.argv.slice(2)
if (cmd === 'status') {
  for (const r of runs(8)) console.log(line(r))
} else if (cmd === 'wait') {
  const id = arg ?? runs(1)[0].id
  let r
  for (;;) {
    r = api(`actions/runs/${id}`)
    if (r.status === 'completed') break
    await sleep(30_000)
  }
  console.log(line(r))
  process.exit(r.conclusion === 'success' ? 0 : 1)
} else if (cmd === 'failures') {
  const id = arg ?? runs(1)[0].id
  for (const job of api(`actions/runs/${id}/jobs`).jobs) {
    for (const s of job.steps.filter((x) => x.conclusion === 'failure')) console.log(`✗ ${job.name} → ${s.name}`)
    for (const a of api(`check-runs/${job.id}/annotations`)) {
      if (/Node\.js 20 is deprecated/.test(a.message)) continue
      console.log(`\n[${a.annotation_level}] ${a.title ?? ''}\n${a.message}`)
    }
  }
} else if (cmd === 'release') {
  execFileSync('gh', ['api', '-X', 'POST', `repos/${REPO}/actions/workflows/release.yml/dispatches`, '-f', 'ref=main'], { stdio: 'inherit' })
  console.log('Release workflow started; `node tools/ci.mjs wait` follows it.')
} else if (cmd === 'released') {
  const v = arg ?? JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
  try {
    const r = api(`releases/tags/v${v}`)
    console.log(`v${v}: ${r.assets.map((a) => a.name).join(', ')}`)
  } catch {
    console.log(`v${v} is not released.`)
    process.exit(1)
  }
} else {
  console.error('Commands: status | wait [id] | failures [id] | release | released [version]')
  process.exit(1)
}
