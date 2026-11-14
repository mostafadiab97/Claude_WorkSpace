// 0.24.0 (the owner, 13 Nov 2026): the theme editor — every value of the theme file, live preview, reset, contrast
// warning, Save writes only the changes to the user's theme.json.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, scenario, temp } from '../harness.mjs'

await scenario('E2E theme editor', async (ctx) => {
  const userData = temp('theme-user')
  const t = (ctx.t = await launch({ userData }))
  const { win, check } = t
  const cssVar = (name) => win.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name)

  await win.getByRole('button', { name: 'Settings and diagnostics' }).click()
  await win.getByRole('navigation', { name: 'Settings and help' }).getByRole('button', { name: 'Appearance' }).click()
  const editor = win.getByRole('region', { name: 'Theme editor' })
  await editor.waitFor()
  check((await editor.getByRole('tab').count()) === 4, 'four groups: Colours, Fonts, Sizes and shapes, Spacing')
  await editor.getByRole('radio', { name: 'Light' }).check()
  await t.shot('theme-editor-0-colours')

  console.log('Live preview: a colour changes the whole window at once')
  const primary = editor.getByLabel('primary', { exact: true }).last()
  const before = await cssVar('--rm-color-primary')
  await primary.fill('#aa00aa')
  check((await cssVar('--rm-color-primary')) === '#aa00aa', `the window shows the new colour at once (${before} → #aa00aa)`)
  check((await editor.locator('.theme-row--changed').count()) === 1, 'the changed value is marked')

  console.log('Contrast warning')
  await editor.getByLabel('text muted', { exact: true }).last().fill('#eeeeee')
  check(await editor.locator('.notice--warn', { hasText: 'text muted on surface' }).isVisible(), 'pale grey text on white is reported as hard to read')
  await editor.locator('.theme-row', { hasText: 'text muted' }).getByRole('button', { name: 'Reset' }).click()
  check((await editor.locator('.theme-row--changed').count()) === 1, 'Reset puts one value back')
  await t.shot('theme-editor-1-changed')

  console.log('Save writes only the change')
  await editor.getByRole('button', { name: 'Save my theme' }).click()
  await editor.getByText('Saved — your theme is in use.').waitFor()
  const file = join(userData, 'theme.json')
  check(existsSync(file), 'your theme.json exists')
  const saved = JSON.parse(readFileSync(file, 'utf8'))
  check(JSON.stringify(saved.modes) === JSON.stringify({ light: { primary: '#aa00aa' } }), `only the change is written (${JSON.stringify(saved.modes)})`)

  console.log('Fonts tab, then leaving without saving shows the saved theme again')
  await editor.getByRole('tab', { name: 'Fonts' }).click()
  await editor.getByLabel('font size base', { exact: true }).fill('20px')
  check((await cssVar('--rm-font-size-base')) === '20px', 'a font size shows at once')
  await win.getByRole('navigation', { name: 'Settings and help' }).getByRole('button', { name: 'Environment' }).click()
  check((await cssVar('--rm-font-size-base')) !== '20px', 'leaving the editor without saving shows the saved theme again')
  check((await cssVar('--rm-color-primary')) === '#aa00aa', '…with the saved colour')

  console.log('Reset everything')
  await win.getByRole('navigation', { name: 'Settings and help' }).getByRole('button', { name: 'Appearance' }).click()
  await editor.getByRole('button', { name: 'Reset everything to the app theme' }).click()
  await editor.getByRole('button', { name: 'Save my theme' }).click()
  await editor.getByText('Saved — your theme is in use.').waitFor()
  check((await cssVar('--rm-color-primary')) === before, 'everything follows the app theme again')
})
