// End-to-end test of the prototype journey, driving the real built app.
//   npm run build && npm run test:e2e            (screenshots go to e2e/out/)
// Steps 1–3 of the prototype journey: open a cloned repository, create the requirements folder, create a
// hierarchy of items, filter the table, open items. Links (step 2's second half) arrive in M3.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright-core'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e', 'out')
mkdirSync(outDir, { recursive: true })
const electronPath = (await import('electron')).default

const repo = mkdtempSync(join(tmpdir(), 'reqman-e2e-repo-'))
execFileSync('git', ['init', '-q', repo])
const userData = mkdtempSync(join(tmpdir(), 'reqman-e2e-user-'))

let failures = 0
const check = (cond, what) => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${what}`)
  if (!cond) failures++
}

const app = await electron.launch({
  executablePath: electronPath,
  args: ['.', `--user-data-dir=${userData}`, ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-gpu'] : [])],
  cwd: root,
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0' }
})
// The folder picker is a native dialog Playwright cannot click; answer it with the test repository.
await app.evaluate(({ dialog }, path) => {
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
}, repo)

const win = await app.firstWindow()
await win.setViewportSize({ width: 1400, height: 860 })
const shot = (name) => win.screenshot({ path: join(outDir, `${name}.png`) })
const rows = () => win.locator('.table__row')

try {
  console.log('Step 1 — open the repository and create the requirements folder')
  await win.getByRole('button', { name: 'Open repository…' }).click()
  await win.getByText('No requirements folder yet').waitFor()
  check(await win.getByText('This folder is not a Git repository').count() === 0, 'recognised as a Git repository')
  await win.getByRole('button', { name: 'Create requirements folder' }).click()
  await win.locator('.table__empty', { hasText: 'No items yet' }).waitFor()
  check(readdirSync(join(repo, 'requirements')).includes('.reqman'), 'requirements/.reqman created on disk')
  await shot('01-empty-repo')

  console.log('Step 2 — create a hierarchy')
  const save = async () => {
    await win.getByRole('button', { name: 'Save', exact: true }).click()
    await win.getByRole('button', { name: 'Saved ✓' }).waitFor()
  }
  await win.getByLabel('New item').selectOption('stakeholder-need')
  await win.getByPlaceholder('Short name of the requirement').fill('Comfortable temperature')
  await win.getByPlaceholder('The system shall…').fill('Users want the room to stay at the chosen temperature.')
  await save()
  const stkId = (await win.locator('.editor__id').textContent()).trim()
  check(/^STK-[0-9A-Z]{6}$/.test(stkId), `stakeholder need saved as ${stkId}`)

  for (const [title, text] of [
    ['Temperature accuracy', 'The thermostat shall measure room temperature within ±0.5 °C.'],
    ['Display readability', 'The display shall show the current temperature in digits at least 10 mm high.']
  ]) {
    // open the parent, then add a child to it
    await win.locator('.tree__label', { hasText: stkId }).click()
    await win.locator('.editor__id', { hasText: stkId }).waitFor()
    await win.getByLabel('Add child item').selectOption('system-requirement')
    await win.getByPlaceholder('Short name of the requirement').fill(title)
    await win.getByPlaceholder('The system shall…').fill(text)
    await win.locator('.editor').getByLabel('Priority').selectOption('High')
    await save()
  }
  await win.getByLabel('New item').selectOption('test-case')
  await win.getByPlaceholder('Short name of the requirement').fill('Verify accuracy at 20 °C')
  await save()

  const files = readdirSync(join(repo, 'requirements', 'items')).filter((f) => f.endsWith('.md'))
  check(files.length === 4, `4 item files written (${files.length})`)
  const sysFile = files.find((f) => readFileSync(join(repo, 'requirements', 'items', f), 'utf8').includes('Temperature accuracy'))
  const sysText = sysFile ? readFileSync(join(repo, 'requirements', 'items', sysFile), 'utf8') : ''
  check(sysText.includes(`parent: ${stkId}`) && sysText.includes('order: 10') && sysText.includes('priority: High'), 'child file has parent, order and priority')

  // hierarchy in the tree
  await win.locator('.tree__row', { hasText: stkId }).getByRole('button', { name: 'Expand' }).click()
  const childTitles = async () => win.locator('.tree__list .tree__list .tree__title').allTextContents()
  check(JSON.stringify(await childTitles()) === JSON.stringify(['Temperature accuracy', 'Display readability']), 'tree shows the two children in order')

  // reorder: move "Display readability" up
  await win.locator('.tree__label', { hasText: 'Display readability' }).click()
  await win.locator('.editor__body input').first().waitFor()
  await win.getByRole('button', { name: 'Move up' }).click()
  await win.waitForTimeout(400)
  check(JSON.stringify(await childTitles()) === JSON.stringify(['Display readability', 'Temperature accuracy']), 'move up reorders the siblings')
  await shot('02-hierarchy')

  console.log('Step 3 — filter the table and open an item')
  check((await rows().count()) === 4, 'table lists 4 items')
  await win.getByLabel('Type').selectOption('system-requirement')
  await win.waitForTimeout(300)
  check((await rows().count()) === 2, 'type filter: 2 system requirements')
  await win.getByLabel('Search').fill('thermostat')
  await win.waitForTimeout(500)
  check((await rows().count()) === 1, 'search "thermostat": 1 match')
  await rows().first().click()
  await win.locator('.editor__body input').first().waitFor()
  check((await win.locator('.editor__body input').first().inputValue()) === 'Temperature accuracy', 'clicking the row opens the item')
  await win.getByRole('button', { name: 'Clear filters' }).click()
  await win.waitForTimeout(300)
  await win.getByRole('columnheader', { name: /^Priority/ }).click()
  await win.waitForTimeout(300)
  const firstPriority = await rows().first().locator('.table__td').nth(4).textContent()
  check(firstPriority === 'High', 'sorting by priority works')
  await shot('03-table-and-editor')

  console.log('Safety — unsaved changes and outside edits')
  await win.getByPlaceholder('Short name of the requirement').fill('Temperature accuracy (edited)')
  await rows().nth(2).click()
  check(await win.getByText('You have unsaved changes. Discard them?').isVisible(), 'switching items with unsaved changes asks first')
  await shot('04-unsaved-guard')
  await win.getByRole('button', { name: 'Keep editing' }).click()
  await win.getByRole('button', { name: 'Discard changes' }).first().click()

  // someone edits a file outside ReqMan (e.g. git pull); a window refocus picks it up
  const tcFile = files.find((f) => f.startsWith('TC-'))
  const tcPath = join(repo, 'requirements', 'items', tcFile)
  writeFileSync(tcPath, readFileSync(tcPath, 'utf8').replace('Verify accuracy at 20 °C', 'Verify accuracy at 25 °C'))
  await win.evaluate(() => window.dispatchEvent(new Event('focus')))
  await win.getByText('Verify accuracy at 25 °C').first().waitFor({ timeout: 5000 })
  check(true, 'outside edit picked up on refocus')

  console.log('Look — dark mode, wide window, settings page scrollbar')
  await win.getByRole('radio', { name: 'Dark' }).click()
  await shot('05-dark')
  await win.setViewportSize({ width: 1920, height: 1000 })
  await win.getByRole('button', { name: 'Settings and diagnostics' }).click()
  await win.getByText('Settings & diagnostics').waitFor()
  const page = await win.locator('.page').boundingBox()
  check(page !== null && Math.abs(page.x + page.width - 1920) < 2, 'settings page scroll area reaches the right window edge')
  await shot('06-settings-wide')
  await win.getByRole('button', { name: '← Back' }).click()
  await win.waitForTimeout(500)
  check((await rows().count()) === 4, 'workspace kept its state behind the settings page')
} catch (e) {
  failures++
  console.error(e)
  await shot('99-failure').catch(() => {})
} finally {
  // exit directly: a failed run may leave unsaved edits, and the "unsaved changes" dialog would block close()
  await app.evaluate(({ app: a }) => a.exit(0)).catch(() => {})
}

console.log(failures === 0 ? '\nE2E journey passed' : `\nE2E journey: ${failures} failure(s)`)
process.exit(failures === 0 ? 0 : 1)
