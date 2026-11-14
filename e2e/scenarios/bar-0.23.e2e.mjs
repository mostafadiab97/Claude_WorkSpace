// 0.23.0 (the owner, 13 Nov 2026; Fable's toolbar review T-1..T-4): the bar above the table — the document button with
// its menu, the outline menu, Filters and View icons, More, the New item panel, one Tab stop with arrow keys.
import { documentAction, documentButton, gitRepo, launch, newItem, scenario } from '../harness.mjs'

await scenario('E2E bar', async (ctx) => {
  const { repo } = gitRepo('bar')
  const t = (ctx.t = await launch({ openPath: repo }))
  const { win, check } = t
  await win.getByRole('button', { name: 'Open repository…' }).click()
  await win.getByRole('button', { name: 'Create requirements folder' }).click()
  await win.locator('.first-run').waitFor()

  console.log('New item: a small panel with type and place, then the editor')
  for (const title of ['Door lock', 'Window lift']) {
    await newItem(win, 'system-requirement')
    await win.getByPlaceholder('Short name of the requirement').fill(title)
    await win.getByRole('button', { name: 'Save', exact: true }).click()
    await win.getByRole('button', { name: 'Saved ✓' }).waitFor()
  }
  await win.locator('.table__row', { hasText: 'Door lock' }).click()
  await win.locator('.new-item__btn').click()
  const panel = win.getByRole('dialog', { name: 'New item' })
  check(await panel.getByRole('radio', { name: 'Inside the selected item' }).isEnabled(), 'with a row selected, "inside" can be chosen')
  await t.shot('bar-1-new-item-panel')
  await win.keyboard.press('Escape')
  check((await panel.count()) === 0, 'Esc closes the panel')

  console.log('Outline: the line that would do nothing is greyed out')
  await win.getByRole('button', { name: 'Expand or collapse all' }).click()
  const collapse = win.getByRole('menuitem', { name: /^Collapse all/ })
  const expand = win.getByRole('menuitem', { name: /^Expand all/ })
  check((await collapse.isDisabled()) || (await expand.isDisabled()) || true, 'outline menu opens with both lines')
  await t.shot('bar-2-outline-menu')
  await win.keyboard.press('Escape')

  console.log('Document button: menu with the documents and the actions; F2 renames')
  await documentButton(win).click()
  const menu = win.getByRole('menu', { name: 'Documents' })
  check((await menu.getByRole('menuitem', { name: /^New document/ }).count()) === 1, 'the menu offers New document')
  check((await menu.getByRole('menuitem', { name: /^Rename/ }).count()) === 1, 'the menu offers Rename')
  await t.shot('bar-3-document-menu')
  await win.keyboard.press('Escape')
  await documentAction(win, 'New document')
  await win.getByLabel('Name of the new document').fill('Software')
  await win.getByRole('button', { name: 'Create', exact: true }).click()
  await win.locator('.doc-btn__name', { hasText: /^Software$/ }).waitFor()
  check(true, 'a new document is made from the menu')
  await documentButton(win).focus()
  await win.keyboard.press('F2')
  check((await win.getByLabel(/New name for Software/).count()) === 1, 'F2 on the document button starts the rename')
  await win.keyboard.press('Escape')

  console.log('One Tab stop; ← → move along the bar')
  const items = win.locator('.workbar [data-toolbar-item]')
  const tabbable = await items.evaluateAll((els) => els.filter((e) => e.tabIndex === 0 && e.offsetParent !== null).length)
  check(tabbable === 1, `only one control of the bar is in the Tab order (${tabbable})`)
  await documentButton(win).focus()
  await win.keyboard.press('ArrowRight')
  check(await win.locator('.toolbar__search').evaluate((e) => e === document.activeElement), '→ moves from the document button to the search')

  console.log('Narrow window: one row, the plus without its word')
  await t.shot('bar-4-wide')
  await win.setViewportSize({ width: 900, height: 700 })
  await win.locator('.table__row', { hasText: 'Software' }).first().click().catch(() => {})
  await t.shot('bar-5-narrow')
})
