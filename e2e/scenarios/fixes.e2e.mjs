// Fixes of the project review, seen from the window (0.8.0): an item in a renamed file opens and its file name
// can be fixed with one click (D-01); "Expand all" opens every level and loads them as they scroll into view
// (P-04); a second start brings the open window forward instead of starting a second ReqMan (D-02); and the
// release self-test runs from Settings & diagnostics.
import { spawn } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gitIn, gitRepo, launch, root, scenario } from '../harness.mjs'

await scenario('E2E fixes', async (ctx) => {
  const { repo } = gitRepo('fixes')
  // a small hierarchy written directly as files: 3 chapters × 2 sections × 2 requirements
  const items = join(repo, 'requirements', 'items')
  mkdirSync(join(repo, 'requirements', '.reqman'), { recursive: true })
  mkdirSync(items, { recursive: true })
  copyFileSync(join(root, 'config', 'default-schema.yaml'), join(repo, 'requirements', '.reqman', 'schema.yaml'))
  const file = (id, type, title, parent, order) =>
    writeFileSync(join(items, `${id}.md`), `---\nid: ${id}\ntype: ${type}\ntitle: ${title}\n${parent ? `parent: ${parent}\n` : ''}order: ${order}\n---\nText of ${title}.\n`)
  const L = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  const id6 = (p, n) => `${p}-${L[n % 32]}${L[(n >> 5) % 32]}AAAA`
  let n = 1
  for (let c = 1; c <= 3; c++) {
    const ch = id6('INFO', n++)
    file(ch, 'information', `Chapter ${c}`, null, c * 10)
    for (let s = 1; s <= 2; s++) {
      const sec = id6('INFO', n++)
      file(sec, 'information', `Section ${c}.${s}`, ch, s * 10)
      for (let r = 1; r <= 2; r++) file(id6('SYS', n++), 'system-requirement', `Requirement ${c}.${s}.${r}`, sec, r * 10)
    }
  }
  const renamedId = id6('SYS', n - 1)
  const editedId = id6('SYS', 3)
  gitIn(repo, 'add', '-A')
  gitIn(repo, 'commit', '-q', '-m', 'test data')
  renameSync(join(items, `${renamedId}.md`), join(items, 'RENAMED-BY-HAND.md'))

  const t = (ctx.t = await launch({ openPath: repo, prefix: '' }))
  const { win, check } = t
  await win.getByRole('button', { name: 'Open repository…' }).click()
  await win.locator('.table__row').first().waitFor()

  console.log('D-01 — item in a renamed file')
  await win.getByRole('button', { name: /1 problem/ }).click()
  check(await win.getByText(`${renamedId}: The file items/RENAMED-BY-HAND.md holds ${renamedId}`).isVisible(), 'the renamed file is listed as a problem')
  await win.getByRole('button', { name: new RegExp(`${renamedId}: The file`) }).click()
  await win.locator('.editor__id', { hasText: renamedId }).waitFor()
  check((await win.getByPlaceholder('Short name of the requirement').inputValue()) === 'Requirement 3.2.2', 'it opens normally in the editor')
  await win.getByRole('button', { name: 'Fix file name' }).click()
  await win.locator('.statusbar__ok', { hasText: 'No problems' }).waitFor()
  check(true, 'one click renames the file; no problems left')

  console.log('P-04 — Expand all opens every level')
  await win.getByRole('button', { name: 'Collapse all' }).click()
  await win.getByRole('button', { name: 'Expand all' }).click()
  await win.locator('.table__row[aria-level="3"]').first().waitFor()
  await win.waitForFunction(() => document.querySelectorAll('.table__row--loading').length === 0)
  check((await win.locator('.table__row[data-id]').count()) === 21, 'all 21 items have a row (3 levels)')
  await t.shot('fixes-expanded')

  console.log('Column width — drag the edge of the No. column (owner, 28 Oct 2026)')
  const numberHead = win.locator('[data-column="number"]')
  const before = await numberHead.boundingBox()
  const grip = await win.getByRole('separator', { name: /Width of the No\. column/ }).boundingBox()
  await win.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await win.mouse.down()
  await win.mouse.move(grip.x + 80, grip.y + grip.height / 2, { steps: 5 })
  await win.mouse.up()
  const after = await numberHead.boundingBox()
  check(Math.abs(after.width - before.width - 80) < 6, `dragging widens the column (${Math.round(before.width)} → ${Math.round(after.width)} px)`)
  const cell = await win.locator('.table__row[data-id]').first().locator('.table__td').nth(1).boundingBox()
  check(Math.abs(cell.width - after.width) < 2, 'the rows follow the header')
  const saved = await win.evaluate(() => Object.entries(localStorage).find(([k]) => k.startsWith('reqman.columns:'))?.[1] ?? '')
  check(/"number":\d+/.test(saved), 'the width is remembered for this repository')
  await win.getByRole('separator', { name: /Width of the No\. column/ }).dblclick()
  check(Math.abs((await numberHead.boundingBox()).width - before.width) < 2, 'double-click returns to the automatic width')

  console.log('D-02 — a second start')
  const electronPath = (await import('electron')).default
  const second = spawn(electronPath, ['.', `--user-data-dir=${t.userData}`, ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-gpu'] : [])], { cwd: root, stdio: 'ignore' })
  const code = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      second.kill()
      resolve('still running')
    }, 20_000)
    second.on('exit', (c) => {
      clearTimeout(timer)
      resolve(c)
    })
  })
  check(code === 0, `the second ReqMan quits at once (exit ${code})`)
  check((await win.locator('.table__row[data-id]').count()) === 21, 'the first window keeps working')

  console.log('Compare, then Changes (owner\'s bug report on 0.8.0)')
  const edited = join(items, `${editedId}.md`)
  writeFileSync(edited, readFileSync(edited, 'utf8').replace('Text of', 'Changed text of'))
  await win.evaluate(() => window.dispatchEvent(new Event('focus')))
  await win.getByRole('button', { name: 'Compare', exact: true }).click()
  const compare = win.getByRole('region', { name: 'Compare' })
  await compare.getByLabel('What to compare').selectOption('uncommitted')
  await compare.locator('.compare__row').first().click()
  await win.locator('.editor__header', { hasText: editedId }).first().waitFor()
  await win.getByRole('button', { name: /^Changes/ }).click()
  await win.getByRole('complementary', { name: 'Changes' }).waitFor()
  check((await compare.count()) === 0, 'opening Changes closes Compare and its detail panel')
  const panel = await win.getByRole('complementary', { name: 'Changes' }).boundingBox()
  check(panel !== null && panel.y < 120, 'the Changes panel sits in the right-hand column, not below the table')
  await t.shot('fixes-compare-then-changes')
  await win.getByRole('button', { name: /^Changes/ }).click()

  console.log('Release self-test')
  await win.getByRole('button', { name: 'Settings and diagnostics' }).click()
  await win.getByRole('button', { name: 'Run release self-test' }).click()
  await win.getByText(/All steps passed|steps failed/).waitFor({ timeout: 180_000 })
  const passed = await win.getByText(/All steps passed/).count()
  if (!passed) console.log(await win.locator('.results').last().textContent())
  check(passed === 1, 'every step of the release self-test passes')
  await t.shot('fixes-release-self-test')
})
