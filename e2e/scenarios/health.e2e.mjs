// 0.14.0 health tools in the window (P-40, Mostafa 2 Nov 2026): a feature turned off in Settings disappears from the
// window and comes back when turned on; a team switch in schema.yaml turns it off for the repository and Settings says
// so; "Report a problem" saves one text file with the description, diagnostics and log.
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gitRepo, launch, scenario, temp } from '../harness.mjs'

await scenario('E2E health', async (ctx) => {
  const { repo } = gitRepo('health')
  const t = (ctx.t = await launch({ openPath: repo }))
  const { win, check } = t
  await win.getByRole('button', { name: 'Open repository…' }).click()
  await win.getByRole('button', { name: 'Create requirements folder' }).click()
  await win.locator('.table__empty', { hasText: 'No items yet' }).waitFor()
  const exportBtn = win.getByRole('button', { name: 'Export…' })
  const gitbar = win.getByRole('region', { name: 'Git' })
  await gitbar.locator('.gitbar__branch').waitFor()
  check((await exportBtn.count()) === 1, 'Export is there at first')

  console.log('Turn Export off on this PC')
  await win.getByRole('button', { name: 'Settings and diagnostics' }).click()
  const features = win.getByRole('region', { name: 'Features' })
  await features.getByRole('checkbox', { name: /^Export/ }).uncheck()
  await t.shot('health-1-settings')
  await win.getByRole('button', { name: '← Back' }).click()
  await win.locator('.table__empty').waitFor()
  check((await exportBtn.count()) === 0, 'Export is gone from the toolbar')
  check((await win.getByRole('button', { name: 'Import…' }).count()) === 1, '…the other features stay')
  await win.getByRole('button', { name: 'Settings and diagnostics' }).click()
  await features.getByRole('checkbox', { name: /^Export/ }).check()
  await win.getByRole('button', { name: '← Back' }).click()
  await exportBtn.waitFor()
  check(true, 'turned on again, Export is back')

  console.log('The team turns Branches off in schema.yaml')
  appendFileSync(join(repo, 'requirements', '.reqman', 'schema.yaml'), '\nfeatures:\n  branches: false\n')
  await win.getByRole('button', { name: 'Close repository' }).click()
  await win.getByRole('button', { name: 'Open repository…' }).click()
  await win.locator('.table__empty').waitFor()
  await gitbar.locator('.gitbar__branch').waitFor()
  check(await gitbar.locator('.gitbar__branch').isDisabled(), 'the branch button no longer opens the branch panel')
  await win.getByRole('button', { name: 'Settings and diagnostics' }).click()
  check((await features.textContent()).includes('Turned off for this repository by the team'), 'Settings says the team turned it off')

  console.log('Report a problem')
  const file = join(temp('health-report'), 'report.txt')
  await t.saveAs(file)
  const report = win.getByRole('region', { name: 'Report a problem' })
  await report.getByLabel('What happened?').fill('The branch button does nothing.')
  await report.getByRole('button', { name: 'Save report…' }).click()
  await report.getByText(/Report saved/).waitFor()
  const text = existsSync(file) ? readFileSync(file, 'utf8') : ''
  check(text.includes('The branch button does nothing.'), 'the report holds the description')
  check(/ReqMan \d+\.\d+\.\d+/.test(text) && text.includes('Git:'), '…the diagnostics')
  check(text.includes('== Log (last'), '…and the end of the log')
  await t.shot('health-2-report')
})
