// 0.22.0 (the owner, 13 Nov 2026): the colour switch with icons (sun / moon / flame / monitor), the Ember mode, and
// the language drop-down (English, Deutsch, Français, Español, العربية). Screenshots of Ember in English and Arabic for the owner.
import { gitRepo, launch, scenario, temp } from '../harness.mjs'

await scenario('E2E ember', async (ctx) => {
  const { repo } = gitRepo('ember')
  const userData = temp('ember-user')
  const t = (ctx.t = await launch({ openPath: repo, userData }))
  const { win, check } = t

  console.log('Start screen: the switches show icons and short names')
  const colours = win.getByRole('radiogroup', { name: 'Colour theme' })
  check((await colours.getByRole('radio').count()) === 4, 'four colour options: Light, Dark, Ember, System')
  check((await colours.locator('svg').count()) === 4, 'each colour option is an icon')
  const lang = win.getByRole('combobox', { name: 'Language' })
  const names = (await lang.locator('option').allTextContents()).map((x) => x.trim())
  check(names.join('|') === 'English|Deutsch|Français|Español|العربية', 'five languages, each named in its own language')
  await lang.selectOption('de')
  check((await win.getByRole('combobox', { name: 'Sprache' }).count()) === 1, 'German texts at once')
  await t.shot('ember-0-german')
  await win.getByRole('combobox', { name: 'Sprache' }).selectOption('en')

  await colours.getByRole('radio', { name: 'Ember' }).click()
  check((await win.evaluate(() => document.documentElement.dataset['theme'])) === 'ember', 'Ember is shown')
  check((await win.evaluate(() => document.documentElement.style.colorScheme)) === 'dark', 'Ember is a dark colour scheme')
  await t.shot('ember-0-start')

  console.log('A repository in Ember')
  await win.getByRole('button', { name: 'Open repository…' }).click()
  await win.getByRole('button', { name: 'Create requirements folder' }).click()
  await win.locator('.first-run').waitFor()
  for (const title of ['Door lock', 'Window lift']) {
    await win.getByLabel('New item').selectOption('system-requirement')
    await win.getByPlaceholder('Short name of the requirement').fill(title)
    await win.getByRole('button', { name: 'Save', exact: true }).click()
    await win.getByRole('button', { name: 'Saved ✓' }).waitFor()
  }
  await t.shot('ember-1-workspace')

  console.log('Ember is remembered and works in Arabic')
  await win.getByRole('button', { name: 'Settings and diagnostics' }).click()
  await win.getByRole('navigation', { name: 'Settings and help' }).getByRole('button', { name: 'Appearance' }).click()
  check((await win.getByRole('radio', { name: 'Ember' }).getAttribute('aria-checked')) === 'true', 'Ember is the chosen option in Settings')
  await win.getByRole('combobox', { name: 'Language' }).selectOption('ar')
  await t.shot('ember-2-settings-arabic')
  await win.locator('.settings-nav__back').click()
  check((await win.evaluate(() => document.documentElement.dir)) === 'rtl', 'right-to-left in Arabic')
  await t.shot('ember-3-workspace-arabic')
})
