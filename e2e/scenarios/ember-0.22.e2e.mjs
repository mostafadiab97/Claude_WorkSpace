// 0.22.0 (the owner, 13 Nov 2026): the colour switch with icons (sun / moon / flame / monitor), the Ember mode, and
// the language drop-down (English, Deutsch, Français, Español, العربية). Screenshots of Ember in English and Arabic for the owner.
import { gitRepo, launch, scenario, temp, newItem } from '../harness.mjs'

await scenario('E2E ember', async (ctx) => {
  const { repo } = gitRepo('ember')
  const userData = temp('ember-user')
  const t = (ctx.t = await launch({ openPath: repo, userData }))
  const { win, check } = t
  const brandName = () => win.locator('.brand-name').first()
  // small drawings are inlined in the page: the Ember tile is known by its tile colour
  const emberTile = async () => decodeURIComponent((await win.locator('.brand-face').first().getAttribute('src')) ?? '').includes('#2a231d')

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
  // 13 Nov 2026: the Arabic name «ريكوشيه» on the start screen while the window is in Arabic
  await lang.selectOption('ar')
  check(((await win.locator('.hero .brand-name').getAttribute('src')) ?? '').includes('logo-ar-on-ember'), 'Arabic start screen: the Arabic Ember name')
  await t.shot('ember-0-start-arabic')
  await win.getByRole('combobox', { name: 'اللغة' }).selectOption('en')
  check(((await win.locator('.hero .brand-name').getAttribute('src')) ?? '').includes('logo-on-ember'), 'English again: the English Ember name')

  console.log('A repository in Ember')
  await win.getByRole('button', { name: 'Open repository…' }).click()
  await win.getByRole('button', { name: 'Create requirements folder' }).click()
  await win.locator('.first-run').waitFor()
  for (const title of ['Door lock', 'Window lift']) {
    await newItem(win, 'system-requirement')
    await win.getByPlaceholder('Short name of the requirement').fill(title)
    await win.getByRole('button', { name: 'Save', exact: true }).click()
    await win.getByRole('button', { name: 'Saved ✓' }).waitFor()
  }
  await t.shot('ember-1-workspace')

  console.log('Ember is remembered and works in Arabic')
  await win.getByRole('button', { name: 'Settings and diagnostics' }).click()
  await win.getByRole('navigation', { name: 'Settings and help' }).getByRole('button', { name: 'Appearance' }).click()
  check((await win.getByRole('radiogroup', { name: 'Colour theme' }).getByRole('radio', { name: 'Ember' }).getAttribute('aria-checked')) === 'true', 'Ember is the chosen option in Settings')
  // 13 Nov 2026: Ember's headings are set in the bundled serif; body text keeps the interface font
  check((await win.locator('.page__title').evaluate((e) => getComputedStyle(e).fontFamily)).includes('Source Serif 4'), 'the page title asks for Source Serif 4 in Ember')
  check(await win.evaluate(() => document.fonts.load("600 18px 'Source Serif 4'").then((f) => f.length > 0)), 'Source Serif 4 is bundled and loads')
  check(!(await win.locator('body').evaluate((e) => getComputedStyle(e).fontFamily)).includes('Source Serif'), 'body text keeps the interface font')
  check(((await brandName().getAttribute('src')) ?? '').includes('logo-on-ember'), 'the top bar shows the Ember name')
  check(await emberTile(), 'the top bar shows the Ember tile')
  await win.getByRole('combobox', { name: 'Language' }).selectOption('ar')
  await t.shot('ember-2-settings-arabic')
  await win.locator('.settings-nav__back').click()
  check((await win.evaluate(() => document.documentElement.dir)) === 'rtl', 'right-to-left in Arabic')
  await t.shot('ember-3-workspace-arabic')

  console.log('The Arabic name in the top bar (13 Nov 2026): Ember, then Light')
  check(((await brandName().getAttribute('src')) ?? '').includes('logo-ar-on-ember'), 'Arabic + Ember: the Arabic Ember name')
  const ratio = await brandName().evaluate((i) => i.naturalWidth / i.naturalHeight)
  check(Math.abs(ratio - 3.35) < 0.05, `the Arabic name is drawn (width / height ${ratio.toFixed(2)})`)
  await win.locator('.topbar').screenshot({ path: 'e2e/out/ember-4-topbar-arabic-ember.png' })
  await win.locator('.topbar__right > .icon-btn').last().click() // Settings (its name is Arabic now)
  await win.locator('.settings-nav__item').first().waitFor()
  await win.locator('.switch[role=radiogroup] [role=radio]').filter({ has: win.locator('svg') }).first().click()
  check((await win.evaluate(() => document.documentElement.dataset['theme'])) === 'light', 'Light is shown')
  await win.locator('.settings-nav__back').click()
  check(((await brandName().getAttribute('src')) ?? '').includes('logo-ar-on-light'), 'Arabic + Light: the Arabic name on light')
  check(!(await emberTile()), 'the tile is the usual one again')
  await t.shot('ember-5-workspace-arabic-light')
  await win.locator('.topbar').screenshot({ path: 'e2e/out/ember-5-topbar-arabic-light.png' })
})
