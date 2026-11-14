// Acceptance run (P-41, the owner 2 Nov 2026): what the owner's manual checklist did, done on GitHub's Windows machine
// with the INSTALLED app. Windows only. Writes a numbered list of everything it did to the job summary.
//
//   node e2e/acceptance.mjs --installer dist/reqochet-dev-Setup-X.exe --feed dist [--previous old-setup.exe]
//                           [--sandbox <folder>] [--push-url <url> --branch <name>]
//
// 1. Installs the previous release, then lets it update itself to this build from a local feed (only when this build
//    is newer); otherwise installs this build directly.
// 2. Runs the release self-test inside the installed app.
// 3. Opens the 10,000-item sandbox in the installed app.
// 4. Pushes one real commit to a scratch branch, checks it arrived, deletes the branch.
// Every action is listed, numbered, in the summary — nothing happens that is not written down there.
import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
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

// The app's name comes from package.json (reqochet-dev here); releases before 0.16 installed as ReqMan.
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const PRODUCT = pkg.productName
const programs = join(process.env.LOCALAPPDATA ?? '', 'Programs')
// electron-builder's per-user install folder is named after package.json "name"; the program after "productName"
const installDir = join(programs, pkg.name)
const exe = join(installDir, `${PRODUCT}.exe`)
const legacyDir = join(programs, 'reqman')
const legacyExe = join(legacyDir, 'ReqMan.exe')
const installedVersion = (file = exe) => {
  if (!existsSync(file)) return null
  const r = spawnSync('powershell', ['-NoProfile', '-Command', `(Get-Item '${file}').VersionInfo.ProductVersion`], { encoding: 'utf8' })
  return r.stdout.trim() || null
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const killApp = () => {
  spawnSync('taskkill', ['/IM', `${PRODUCT}.exe`, '/F'], { stdio: 'ignore' })
  spawnSync('taskkill', ['/IM', 'ReqMan.exe', '/F'], { stdio: 'ignore' })
}
const runInstaller = (file) => execFileSync(file, ['/S'], { stdio: 'ignore', timeout: 300_000 })
const newer = (a, b) => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0)
  return false
}

/** Starts the installed app; `openPath` answers the folder picker. */
async function launchInstalled(openPath, executablePath = exe) {
  const userData = mkdtempSync(join(tmpdir(), 'reqochet-accept-'))
  const app = await electron.launch({ executablePath, args: [`--user-data-dir=${userData}`] })
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
  // before 0.16 the app was ReqMan: the update must then switch it to the new app (old one removed, settings moved)
  const fromLegacy = !existsSync(exe) && existsSync(legacyExe)
  const prevDir = fromLegacy ? legacyDir : installDir
  const prevExe = fromLegacy ? legacyExe : exe
  did(`Installed the previous release ${prevVersion} silently (${basename(previous)})${fromLegacy ? ' — still named ReqMan' : ''}.`)
  // CI only: a stand-in for the user's ReqMan settings, to check that the new app moves them (never on a real PC)
  const appData = process.env.APPDATA ?? ''
  const legacySettings = join(appData, 'ReqMan')
  if (fromLegacy && process.env.CI) {
    mkdirSync(legacySettings, { recursive: true })
    writeFileSync(join(legacySettings, 'theme.json'), '{"typography":{"fontSizeBase":"14px"}}')
    writeFileSync(join(legacySettings, 'recent-repositories.json'), '[]')
    did('Wrote a stand-in ReqMan settings folder (theme.json, recent list) to check that the settings are moved.')
  }
  // point the installed copy at a local feed holding this build (latest.yml + installer + blockmap)
  const server = createServer((req, res) => {
    const file = join(feed, decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, ''))
    if (!existsSync(file) || !statSync(file).isFile()) return void res.writeHead(404).end()
    res.writeHead(200, { 'Content-Length': statSync(file).size })
    res.end(readFileSync(file))
  })
  await new Promise((r) => server.listen(8765, '127.0.0.1', r))
  writeFileSync(join(prevDir, 'resources', 'app-update.yml'), 'provider: generic\nurl: http://127.0.0.1:8765/\nupdaterCacheDirName: reqochet-updater\n')
  did('Pointed the installed copy at a local update feed with this build (instead of GitHub Releases).')
  const { app, win } = await launchInstalled(undefined, prevExe)
  let status = null
  for (let i = 0; i < 120 && status?.state !== 'ready'; i++) {
    await sleep(1000)
    status = await win.evaluate(() => (window.reqochet ?? window.reqman).getUpdateStatus()).catch(() => status)
  }
  if (status?.state !== 'ready') {
    fail(`The previous release did not download the update (state: ${JSON.stringify(status)}).`)
    await close(app)
    server.close()
    return
  }
  did(`Started ${prevVersion}: it found and downloaded ${status.version}.`)
  await win.evaluate(() => (window.reqochet ?? window.reqman).installUpdate()).catch(() => {})
  let v = null
  for (let i = 0; i < 180 && !v?.startsWith(version); i++) {
    await sleep(1000)
    v = installedVersion()
  }
  await sleep(3000)
  // the updater starts the new app after installing; after the switch from ReqMan give its first start time to move the settings
  for (let i = 0; i < 30 && fromLegacy && process.env.CI && !existsSync(join(appData, PRODUCT, 'moved-from-reqman.txt')); i++) await sleep(1000)
  killApp() // the updater restarts the app after installing
  server.close()
  if (v?.startsWith(version)) did(`Clicked "restart to update": the installed app is now ${PRODUCT} ${version}.`)
  else fail(`After "restart to update" the installed version is ${v ?? 'missing'}, expected ${version}.`)
  if (fromLegacy) {
    // the switch: ReqMan removed by the new installer; settings moved by the new app's first (auto-restarted) start
    if (existsSync(legacyExe)) fail(`The old app is still installed (${legacyExe}).`)
    else did('The old app ReqMan was removed by the new installer.')
    if (process.env.CI) {
      const moved = existsSync(join(appData, PRODUCT, 'theme.json')) && existsSync(join(appData, PRODUCT, 'recent-repositories.json'))
      if (moved && !existsSync(legacySettings)) did(`The settings were moved to %APPDATA%\\${PRODUCT} and the old ReqMan folder removed.`)
      else fail(`Settings move: copied=${moved}, old folder still there=${existsSync(legacySettings)}.`)
    }
  }
}

async function step2SelfTest() {
  const { app, win } = await launchInstalled()
  try {
    await win.getByRole('button', { name: 'Settings and diagnostics' }).click()
    await win.getByRole('navigation', { name: 'Settings and help' }).getByRole('button', { name: 'Diagnostics' }).click()
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
    did(`Opened the sandbox clone in the installed app: ${count} items shown after ${secs} s (first opening, builds the index).`)
    // 0.17.1: the owner's rename of the 10,005-item "items" folder failed on Windows — do it here, in this throw-away
    // clone (committed locally, never pushed)
    const sg = (...a) => execFileSync('git', a, { cwd: sandbox, encoding: 'utf8' })
    sg('config', 'user.name', 'reqochet acceptance run')
    sg('config', 'user.email', 'acceptance@example.invalid')
    if (existsSync(join(sandbox, 'requirements', 'items'))) {
      const t0 = Date.now()
      await win.locator('.document-notice').getByRole('button', { name: 'Name the document' }).click()
      await win.getByLabel(/New name for items/).fill('Acceptance Spec')
      await win.getByRole('button', { name: 'Rename', exact: true }).click()
      await win.locator('.doc-btn', { hasText: 'Acceptance Spec' }).waitFor({ timeout: 900_000 })
      const left = sg('status', '--porcelain', '--', 'requirements').trim()
      const subject = sg('log', '-1', '--format=%s').trim()
      if (existsSync(join(sandbox, 'requirements', 'items')) || left !== '' || !subject.includes('Acceptance Spec')) {
        throw new Error(`the rename of "items" did not finish cleanly (folder left: ${existsSync(join(sandbox, 'requirements', 'items'))}, uncommitted: ${left.split('\n').length}, last commit: ${subject})`)
      }
      did(`Renamed the sandbox document "items" to "Acceptance Spec" in the window: one commit, nothing left uncommitted, after ${((Date.now() - t0) / 1000).toFixed(1)} s (this clone only, not pushed).`)
    }
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
  git('config', 'user.name', 'reqochet acceptance run')
  git('config', 'user.email', 'acceptance@example.com')
  git('remote', 'add', 'origin', pushUrl)
  did(`Created a temporary local repository on branch "${branch}" with the project repository as its remote.`)
  const { app, win } = await launchInstalled(repo)
  try {
    await win.getByRole('button', { name: 'Open repository…' }).click()
    await win.getByRole('button', { name: 'Create requirements folder' }).click()
    await win.locator('.table__empty, .first-run').first().waitFor() // 0.16.4: an empty project shows the first-run card
    await win.locator('.new-item__btn').click()
    await win.getByRole('dialog', { name: 'New item' }).getByRole('combobox').selectOption('system-requirement')
    await win.getByRole('dialog', { name: 'New item' }).getByRole('button', { name: 'Create' }).click()
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
    const pushed = gitbar.locator('.gitbar__notice', { hasText: 'Pushed' })
    const outage = gitbar.locator('.gitbar__notice', { hasText: 'GitHub had a problem' })
    await pushed.or(outage).waitFor({ timeout: 120_000 })
    if (await outage.isVisible()) {
      // GitHub itself failed (server error): the app says so; try once more after a short wait, as a user would
      did('GitHub answered the push with a server error; the app said so. Waited 30 s and pushed again.')
      await win.waitForTimeout(30_000)
      await gitbar.getByRole('button', { name: /^Push/ }).click()
      await pushed.waitFor({ timeout: 120_000 })
    }
    const remote = execFileSync('git', ['ls-remote', pushUrl, `refs/heads/${branch}`], { encoding: 'utf8' }).trim()
    if (remote) did(`Pushed from the app: branch "${branch}" arrived on GitHub.`)
    else fail(`Push: branch "${branch}" is not on GitHub.`)
  } catch (e) {
    // say what the window showed (a red note, a question) — the timeout alone does not tell why
    let shown = ''
    try {
      shown = (await win.locator('.gitbar__notice, .gitbar__ask, [role="alert"]').allTextContents()).join(' | ')
    } catch {
      // the window is gone
    }
    fail(`Real push: ${secret(e.message.split('\n')[0])}${shown ? ` — the window showed: ${secret(shown)}` : ''}`)
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
const report = [`## Acceptance run — ${PRODUCT} ${version}`, '', failed ? '**Result: FAILED**' : '**Result: passed**', '', 'What this run did:', '', ...done, ''].join('\n')
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report)
writeFileSync(join(tmpdir(), 'acceptance-report.md'), report)
console.log(`\n${report}`)
process.exit(failed ? 1 : 0)
