// 0.20.0 — theme 1b traceability views (the owner's decisions T-01…T-08, 8 Nov 2026) in the real window.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gitIn, gitRepo, launch, root, scenario } from '../harness.mjs'

const item = (id, type, title, order, extra = '') => `---\nid: ${id}\ntype: ${type}\ntitle: ${title}\norder: ${order}\n${extra}---\ntext of ${title}\n`

await scenario('E2E trace-0.20', async (ctx) => {
  const { repo } = gitRepo('trace020')
  const req = join(repo, 'requirements')
  mkdirSync(join(req, '.reqochet'), { recursive: true })
  mkdirSync(join(req, 'Spec'), { recursive: true })
  // a project made before 0.20: its schema has no rules yet
  writeFileSync(join(req, '.reqochet', 'schema.yaml'), readFileSync(join(root, 'config', 'default-schema.yaml'), 'utf8').replace(/\n# Coverage rules[\s\S]*$/, '\n'))
  writeFileSync(join(req, 'Spec', 'REQ-NEED001.md'), item('REQ-NEED001', 'stakeholder-need', 'Warm room', 'a0'))
  writeFileSync(join(req, 'Spec', 'REQ-SYSA001.md'), item('REQ-SYSA001', 'system-requirement', 'Heat the room', 'a1', 'links:\n  - type: refines\n    target: REQ-NEED001\n'))
  writeFileSync(join(req, 'Spec', 'REQ-SYSB001.md'), item('REQ-SYSB001', 'system-requirement', 'Show the temperature', 'a2'))
  writeFileSync(join(req, 'Spec', 'REQ-TEST001.md'), item('REQ-TEST001', 'test-case', 'Measure the heating', 'a3', 'links:\n  - type: verifies\n    target: REQ-SYSA001\n'))
  gitIn(repo, 'add', '-A')
  gitIn(repo, 'commit', '-q', '-m', 'data')

  const t = (ctx.t = await launch({ openPath: repo }))
  const { win, check } = t
  await win.getByRole('button', { name: 'Open repository…' }).click()
  await win.locator('.table__row', { hasText: 'Heat the room' }).waitFor()

  console.log('T-02 — an older project is offered the starter rules once')
  await win.getByRole('button', { name: 'Add the rules' }).click()
  await win.locator('.table__gap').first().waitFor()
  check(readFileSync(join(req, '.reqochet', 'schema.yaml'), 'utf8').includes('system-verified'), 'the rules are written into schema.yaml')
  check((await win.getByRole('button', { name: 'Add the rules' }).count()) === 0, 'the offer is gone')
  const gapRows = await win.locator('.table__row', { has: win.locator('.table__gap') }).locator('.table__text, .table__main-title').allTextContents()
  check(gapRows.some((x) => x.includes('Show the temperature')) && !gapRows.some((x) => x.includes('Heat the room')), `T-08: the untested requirement has the gap mark (${gapRows.join(' | ')})`)

  console.log('T-01 — Traceability: Coverage')
  await win.getByRole('button', { name: 'Traceability', exact: true }).click()
  const view = win.getByRole('region', { name: 'Traceability' })
  await view.locator('.trace__rule').first().waitFor()
  const sysRule = view.locator('.trace__rule', { hasText: 'Every System Requirement is verified by at least 1 Test Case' })
  check((await sysRule.textContent()).includes('1 of 2 covered'), 'the system rule: 1 of 2 covered')
  await t.shot('trace-0.20-coverage')
  await sysRule.getByRole('button', { name: /1 gap/ }).click()
  check((await sysRule.locator('.trace__gap').allTextContents()).some((x) => x.includes('REQ-SYSB001')), 'the gap list names the untested requirement')

  console.log('P-08 — Matrix')
  await view.getByRole('tab', { name: 'Matrix' }).click()
  await view.locator('table.matrix').waitFor()
  check((await view.locator('.matrix__cell--on').count()) === 1, 'one link mark in the grid')
  check((await view.locator('.matrix__row--empty').count()) === 1, 'the row without a test is marked')
  await t.shot('trace-0.20-matrix')

  console.log('T-08 — Show the gaps in the table')
  await view.getByRole('tab', { name: 'Coverage' }).click()
  await view.locator('.trace__rule', { hasText: 'System Requirement is verified' }).getByRole('button', { name: 'Show the gaps in the table' }).click()
  await win.locator('.table-mode').waitFor()
  await win.waitForTimeout(400)
  const shown = await win.locator('.table__row[data-id]').evaluateAll((rs) => rs.map((r) => r.getAttribute('data-id')))
  check(JSON.stringify(shown) === JSON.stringify(['REQ-SYSB001']), `the table shows only the gap (${shown.join(', ')})`)
  await win.getByRole('button', { name: /Clear filters/ }).click()

  console.log('T-06 — Impact tab')
  await win.locator('.table__row', { hasText: 'Warm room' }).click()
  await win.locator('.editor').getByRole('tab', { name: 'Impact' }).click()
  await win.locator('.impact__node').first().waitFor()
  const chain = await win.locator('.impact__node').allTextContents()
  check(chain.length === 2 && chain[0].includes('REQ-SYSA001') && chain[1].includes('REQ-TEST001'), `the need's impact: the requirement, then its test (${chain.join(' | ')})`)
  await t.shot('trace-0.20-impact')

  console.log('T-03 — Rules tab')
  await win.getByRole('button', { name: 'Traceability', exact: true }).click()
  await view.getByRole('button', { name: 'Edit rules…' }).click()
  const dlg = win.getByRole('dialog', { name: 'Item and link types' })
  await dlg.locator('.rules__row').first().waitFor()
  const before = await dlg.locator('.rules__row').count()
  await dlg.getByRole('button', { name: /^Remove the rule: Every Risk/ }).click()
  await dlg.getByRole('button', { name: 'Save' }).click()
  await dlg.waitFor({ state: 'detached' })
  check(!readFileSync(join(req, '.reqochet', 'schema.yaml'), 'utf8').includes('risk-mitigated') && before === 6, 'a removed rule is gone from schema.yaml')
})
