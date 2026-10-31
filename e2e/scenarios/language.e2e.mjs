// 0.13.0 in the window: the English / العربية switch (owner, 31 Oct 2026). The whole window flips to right-to-left,
// texts from the window and from the core (Git messages) follow, an unsaved edit survives the switch, and the choice
// is remembered at the next start.
import { gitIn, gitRepo, launch, scenario, temp } from '../harness.mjs'

await scenario('E2E language', async (ctx) => {
  const { repo } = gitRepo('language')
  const userData = temp('language-user')
  let t = (ctx.t = await launch({ openPath: repo, userData }))
  let { win, check } = t

  await win.getByRole('button', { name: 'Open repository…' }).click()
  await win.getByRole('button', { name: 'Create requirements folder' }).click()
  await win.locator('.table__empty', { hasText: 'No items yet' }).waitFor()
  await win.getByLabel('New item').selectOption('system-requirement')
  await win.getByPlaceholder('Short name of the requirement').fill('Door lock')
  await win.getByRole('button', { name: 'Save', exact: true }).click()
  await win.getByRole('button', { name: 'Saved ✓' }).waitFor()
  // an unsaved edit that must survive the switch
  await win.getByPlaceholder('The system shall…').fill('Not saved yet.')

  console.log('Switch to Arabic')
  const lang = win.getByRole('radiogroup', { name: 'Language' })
  await lang.getByRole('radio', { name: 'العربية' }).click()
  check((await win.evaluate(() => document.documentElement.dir)) === 'rtl', 'the window flips to right-to-left')
  check((await win.locator('.table__th').allTextContents()).some((x) => x.includes('العنوان')), 'column headers are in Arabic')
  check((await win.getByPlaceholder('يجب على النظام أن…').inputValue()) === 'Not saved yet.', 'the unsaved edit survived the switch')
  const brand = await win.locator('.brand').boundingBox()
  const view = win.viewportSize()
  check(brand !== null && view !== null && brand.x > view.width / 2, 'the logo moved to the right side')
  await t.shot('language-1-arabic')
  await win.getByRole('button', { name: 'حفظ', exact: true }).click()
  await win.getByRole('button', { name: 'تم الحفظ ✓' }).waitFor()
  // a message made by the core (Git), not the window
  gitIn(repo, 'config', 'user.name', 'Alice')
  const gitbar = win.getByRole('region', { name: 'Git' })
  await gitbar.locator('.gitbar__branch').waitFor()
  check(/[؀-ۿ]/.test(await gitbar.textContent()), 'the Git bar speaks Arabic')

  console.log('Restart: the choice is remembered')
  await t.close()
  t = ctx.t = await launch({ userData })
  ;({ win, check } = t)
  await win.locator('.splash').waitFor({ state: 'detached' })
  check((await win.evaluate(() => document.documentElement.dir)) === 'rtl', 'after a restart the window is still in Arabic')
  await win.getByRole('radiogroup', { name: 'اللغة' }).getByRole('radio', { name: 'English' }).click()
  check((await win.evaluate(() => document.documentElement.dir)) === 'ltr', 'English switches back to left-to-right')
  check((await win.getByRole('radiogroup', { name: 'Language' }).count()) === 1, '…and English texts')
})
