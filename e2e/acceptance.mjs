// Acceptance run (P-41, Mostafa 2 Nov 2026): what Mostafa's manual checklist did, done on GitHub's Windows machine
// with the INSTALLED app. Windows only. Writes a numbered list of everything it did to the job summary.
//
//   node e2e/acceptance.mjs --installer dist/ReqMan-Setup-X.exe --feed dist [--previous old-setup.exe]
//                           [--sandbox <folder>] [--push-url <url> --branch <name>]
//
// 1. Installs the previous release, then lets it update itself to this build from a local feed (only when this build
//    is newer); otherwise installs this build directly.
// 2. Runs the release self-test inside the installed app.
// 3. Opens the 10,000-item sandbox in the installed app.
// 4. Pushes one real commit to a scratch branch, checks it arrived, deletes the branch.
// Every action is listed, numbered, in the summary — nothing happens that is not written down there.
import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { _electron as electron } from 'playwright-core'

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}
const installer = arg('installer')
const feed = arg('feed')
const previous = arg('previous')
const sandbox = arg('sandbox')
const pushUrl = arg('push-url')
const branch = arg('branch')
const version = JSON.parse(readFileSync('package.json', 'utf8')).version

const done = []
let failed = false
const did = (text) => {
  done.push(`${done.length + 1}. ${text}`)
  console.log(`${done.length}. ${text}`)
}
const fail = (text) => {
  failed = true
  did(`**FAILED:** ${text}`)
}
const secret = (s) => (pushUrl ? s.split(pushUrl).join('<repository>') : s)

const installDir = join(process.env.LOCALAPPDATA ?? '', 'Programs', 'ReqMan')
const exe = join(installDir, 'ReqMan.exe')
const installedVersion = () => {
  if (!existsSync(exe)) return null
  const r = spawnSync('powershell', ['-NoProfile', '-Command', `(Get-Item '${exe}').VersionInfo.ProductVersion`], { encoding: 'utf8' })
  return r.stdout.trim() || null
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const killApp = () => spawnSync('taskkill', ['/IM', 'ReqMan.exe', '/F'], { stdio: 'ignore' })
const runInstaller = (file) => execFileSync(file, ['/S'], { stdio: 'ignore', timeout: 300_000 })
const newer = (a, b) => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0)
  return false
}

/** Starts the installed app; `openPath` answers the folder picker. */
async function launchInstalled(openPath) {
  const userData = mkdtempSync(join(tmpdir(), 'reqman-accept-'))
  const app = await electron.launch({ executablePath: exe, args: [`--user-data-dir=${userData}`] })
  if (openPath) await app.evaluate(({ dialog }, p) => void (dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] })), openPath)
  const win = await app.firstWindow()
  await win.setViewportSize({ width: 1400, height: 860 })
  await win.locator('.splash').waitFor({ state: 'detached', timeout: 60_000 }).catch(() => {})
  return { app, win }
}
const close = (app) => app.evaluate(({ app: a }) => a.exit(0)).catch(() => {})

async function step1Install() {
  const prevVersion = previous ? basename(previous).match(/(\d+\.\d+\.\d+)/)?.[1] : undefined
  if (!previous || !prevVersion || !newer(version, prevVersion)) {
    runInstaller(installer)
    const v = installedVersion()
    if (v?.startsWith(version)) did(`Installed this build (${version}) silently into ${installDir}${prevVersion ? ` — no update test: it is not newer than the latest release ${prevVersion}` : ''}.`)
    else fail(`Installing ${basename(installer)} — the installed version is ${v ?? 'missing'}.`)
    return
  }
  runInstaller(previous)
  did(`Installed the previous release ${prevVersion} silently (${basename(previous)}).`)
  // point the installed copy at a local feed holding this build (latest.yml + installer + blockmap)
  const server = createServer((req, res) => {
    const file = join(feed, decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, ''))
    if (!existsSync(file) || !statSync(file).isFile()) return void res.writeHead(404).end()
    res.writeHead(200, { 'Content-Length': statSync(file).size })
    res.end(readFileSync(file))
  })
  await new Promise((r) => server.listen(8765, '127.0.0.1', r))
  writeFileSync(join(installDir, 'resources', 'app-update.yml'), 'provider: generic\nurl: http://127.0.0.1:8765/\nupdaterCacheDirName: reqman-updater\n')
  did('Pointed the installed copy at a local update feed with this build (instead of GitHub Releases).')
  const { app, win } = await launchInstalled()
  let status = null
  for (let i = 0; i < 120 && status?.state !== 'ready'; i++) {
    await sleep(1000)
    status = await win.evaluate(() => window.reqman.getUpdateStatus()).catch(() => status)
  }
  if (status?.state !== 'ready') {
    fail(`The previous release did not download the update (state: ${JSON.stringify(status)}).`)
    await close(app)
    server.close()
    return
  }
  did(`Started ${prevVersion}: it found and downloaded ${status.version}.`)
  await win.evaluate(() => window.reqman.installUpdate()).catch(() => {})
  let v = null
  for (let i = 0; i < 180 && !v?.startsWith(version); i++) {
    await sleep(1000)
    v = installedVersion()
  }
  await sleep(3000)
  killApp() // the updater restarts the app after installing
  server.close()
  if (v?.startsWith(version)) did(`Clicked "restart to update": the installed app is now ${version}.`)
  else fail(`After "restart to update" the installed version is ${v ?? 'missing'}, expected ${version}.`)
}

async function step2SelfTest() {
  const { app, win } = await launchInstalled()
  try {
    await win.getByRole('button', { name: 'Settings and diagnostics' }).click()
    await win.getByRole('button', { name: 'Run release self-test' }).click()
    await win.getByText(/All steps passed|steps failed/).waitFor({ timeout: 300_000 })
    const summary = (await win.getByText(/All steps passed|steps failed/).first().textContent())?.trim()
    const steps = await win.locator('.results tr').count()
    if (/All steps passed/.test(summary ?? '')) did(`Ran the release self-test in the installed app: ${summary} (${steps} steps, practice repository in a temporary folder, deleted afterwards).`)
    else fail(`Release self-test: ${summary} — ${await win.locator('.results').last().textContent()}`)
  } finally {
    await close(app)
  }
}

async function step3Sandbox() {
  if (!sandbox) return did('Skipped the sandbox (no --sandbox folder given).')
  const { app, win } = await launchInstalled(sandbox)
  try {
    const started = Date.now()
    await win.getByRole('button', { name: 'Open repository…' }).click()
    await win.locator('.table__row').first().waitFor({ timeout: 300_000 })
    const secs = ((Date.now() - started) / 1000).toFixed(1)
    const count = (await win.locator('.statusbar').first().textContent())?.match(/([\d,]+) items/)?.[1] ?? '?'
    did(`Opened the sandbox clone in the installed app: ${count} items shown after ${secs} s (first opening, builds the index). Nothing was changed.`)
  } catch (e) {
    fail(`Opening the sandbox: ${e.message}`)
  } finally {
    await close(app)
  }
}

async function step4Push() {
  if (!pushUrl || !branch) return did('Skipped the real push (no --push-url / --branch given).')
  const repo = mkdtempSync(join(tmpdir(), 'reqman-accept-push-'))
  const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' })
  git('init', '-q', '-b', branch)
  git('config', 'user.name', 'ReqMan acceptance run')
  git('config', 'user.email', 'acceptance@example.com')
  git('remote', 'add', 'origin', pushUrl)
  did(`Created a temporary local repository on branch "${branch}" with the project repository as its remote.`)
  const { app, win } = await launchInstalled(repo)
  try {
    await win.getByRole('button', { name: 'Open repository…' }).click()
    await win.getByRole('button', { name: 'Create requirements folder' }).click()
    await win.locator('.table__empty').waitFor()
    await win.getByLabel('New item').selectOption('system-requirement')
    await win.getByPlaceholder('Short name of the requirement').fill('Acceptance run item')
    await win.getByRole('button', { name: 'Save', exact: true }).click()
    await win.getByRole('button', { name: 'Saved ✓' }).waitFor()
    const gitbar = win.getByRole('region', { name: 'Git' })
    await gitbar.getByRole('button', { name: /^Changes/ }).click()
    const commit = win.getByRole('complementary', { name: 'Commit' })
    await commit.getByLabel('Commit message').fill(`Acceptance run ${version}`)
    await commit.getByRole('button', { name: /^Commit \d+ changes?$/ }).click()
    await gitbar.locator('.gitbar__notice', { hasText: 'Committed' }).waitFor()
    did('In the installed app: created the requirements folder and one requirement, committed them.')
    await gitbar.getByRole('button', { name: /^Push/ }).click()
    await gitbar.locator('.gitbar__notice', { hasText: 'Pushed' }).waitFor({ timeout: 120_000 })
    const remote = execFileSync('git', ['ls-remote', pushUrl, `refs/heads/${branch}`], { encoding: 'utf8' }).trim()
    if (remote) did(`Pushed from the app: branch "${branch}" arrived on GitHub.`)
    else fail(`Push: branch "${branch}" is not on GitHub.`)
  } catch (e) {
    fail(`Real push: ${secret(e.message)}`)
  } finally {
    await close(app)
    const del = spawnSync('git', ['push', '--quiet', pushUrl, '--delete', branch], { encoding: 'utf8' })
    if (del.status === 0) did(`Deleted the scratch branch "${branch}" on GitHub again.`)
    else if (/remote ref does not exist/.test(del.stderr)) did(`Scratch branch "${branch}" was not on GitHub — nothing to delete.`)
    else fail(`Could not delete the scratch branch "${branch}": ${secret(del.stderr)}`)
  }
}

for (const [name, step] of [['install', step1Install], ['self-test', step2SelfTest], ['sandbox', step3Sandbox], ['push', step4Push]]) {
  try {
    await step()
  } catch (e) {
    fail(`${name}: ${secret(e.message ?? String(e))}`)
  }
}
killApp()
const report = [`## Acceptance run — ReqMan ${version}`, '', failed ? '**Result: FAILED**' : '**Result: passed**', '', 'What this run did:', '', ...done, ''].join('\n')
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report)
writeFileSync(join(tmpdir(), 'acceptance-report.md'), report)
console.log(`\n${report}`)
process.exit(failed ? 1 : 0)
