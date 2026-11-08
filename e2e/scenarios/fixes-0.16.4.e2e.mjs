// 0.16.4 — first run, the row menu from the keyboard, where a new item goes, the Text box cursor, the Changes counter.
import { mkdirSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { gitIn, gitRepo, launch, root, scenario } from '../harness.mjs'

await scenario('E2E fixes-0.16.4', async (ctx) => {
  const { repo } = gitRepo('fix0164')
  mkdirSync(join(repo, 'requirements', '.reqochet'), { recursive: true })
  mkdirSync(join(repo, 'requirements', 'items'), { recursive: true })
  copyFileSync(join(root, 'config', 'default-schema.yaml'), join(repo, 'requirements', '.reqochet', 'schema.yaml'))
  gitIn(repo, 'add', '-A')
  gitIn(repo, 'commit', '-q', '-m', 'start')

  const t = (ctx.t = await launch({ openPath: repo }))
  const { win, check } = t
  await win.getByRole('button', { name: 'Open repository…' }).click()

  console.log('UX-W01 — first run')
  const card = win.getByRole('region', { name: 'This project has no requirements yet' })
  check(await card.waitFor({ timeout: 10_000 }).then(() => true, () => false), 'an empty project shows the first-run card')
  check((await card.getByRole('button', { name: /Import from Excel/ }).count()) === 1, 'the card offers Import')
  await t.shot('fixes-0.16.4-first-run')
  await card.getByRole('button', { name: 'Add the first requirement' }).click()
  const title = win.getByPlaceholder('Short name of the requirement')
  await title.fill('Alpha')
  await win.keyboard.press('Control+s')
  await win.locator('.table__row', { hasText: 'Alpha' }).first().waitFor()

  console.log('owner 5 Nov — where a new item goes')
  const newIn = async (name) => {
    await win.getByLabel('New item').selectOption({ label: 'System Requirement' })
    await title.fill(name)
    await win.keyboard.press('Control+s')
    await win.locator('.table__row', { hasText: name }).first().waitFor()
  }
  await win.getByLabel('Insert position').selectOption('end')
  await newIn('Charlie')
  await win.locator('.table__row', { hasText: 'Alpha' }).first().click()
  await win.getByLabel('Insert position').selectOption('after')
  await newIn('Bravo')
  const order = await win.locator('.table__row').evaluateAll((rows) => rows.map((r) => r.textContent ?? ''))
  const pos = (x) => order.findIndex((r) => r.includes(x))
  check(pos('Alpha') < pos('Bravo') && pos('Bravo') < pos('Charlie'), `"Below the selected item" puts Bravo between Alpha and Charlie (${order.length} rows)`)

  console.log('UX-W05 — the Changes counter counts items')
  // the Git bar refreshes a moment after the save (slow on the Windows runner): wait for the count
  await win.locator('.gitbar button', { hasText: /^Changes \(3\)/ }).first().waitFor({ timeout: 15_000 }).catch(() => {})
  const changes = await win.locator('.gitbar button', { hasText: /^Changes/ }).first().textContent()
  check(/Changes \(3\)/.test(changes ?? ''), `the counter says 3 items (${changes})`)

  console.log('UX-W03 — the row menu from the keyboard')
  await win.locator('.table__row', { hasText: 'Charlie' }).first().click()
  await win.locator('.table').first().focus()
  await win.keyboard.press('Shift+F10')
  const menu = win.getByRole('menu')
  check(await menu.waitFor({ timeout: 3000 }).then(() => true, () => false), 'Shift+F10 opens the row menu')
  check((await menu.getByRole('menuitem', { name: 'Delete…' }).count()) === 1, 'the menu offers Delete')
  await win.keyboard.press('ArrowDown')
  await win.keyboard.press('Escape')

  console.log('owner 0.16.3 — the Text box cursor goes where the preview was clicked')
  await win.locator('.table__row', { hasText: 'Alpha' }).first().click()
  await win.locator('#editor-text, .editor__preview').first().waitFor()
  const box = win.locator('#editor-text')
  if (await box.count()) {
    await box.fill('first line\nsecond line')
    await win.keyboard.press('Control+s')
    // wait until the save is done (Save greys out): on a slow runner the next click otherwise asks "unsaved changes?"
    const save = win.locator('.editor').getByRole('button', { name: 'Save', exact: true }).first()
    for (let i = 0; i < 100 && !(await save.isDisabled().catch(() => true)); i++) await win.waitForTimeout(100)
    await win.locator('.table__row', { hasText: 'Bravo' }).first().click()
    await win.locator('.table__row', { hasText: 'Alpha' }).first().click()
  }
  const preview = win.locator('.text-preview').first()
  await preview.waitFor({ timeout: 5000 })
  await preview.getByText('second line').click()
  const at = await win.locator('#editor-text').evaluate((el) => el.selectionStart)
  check(at > 0, `the cursor is not at the start after clicking the second line (${at})`)
})
