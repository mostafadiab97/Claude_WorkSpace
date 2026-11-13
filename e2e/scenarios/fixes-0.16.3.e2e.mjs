// 0.16.3 — screen fixes from the whole-project review (docs/reviews/done/2026-11-05-project-review.md):
// CR2-01 the ✕ beside the project name asks about unsaved edits; CR2-05 a list field counts while typing (Ctrl+S).
import { mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gitIn, gitRepo, launch, root, scenario } from '../harness.mjs'

await scenario('E2E fixes-0.16.3', async (ctx) => {
  const { repo } = gitRepo('fix0163')
  const items = join(repo, 'requirements', 'items')
  mkdirSync(join(repo, 'requirements', '.reqochet'), { recursive: true })
  mkdirSync(items, { recursive: true })
  copyFileSync(join(root, 'config', 'default-schema.yaml'), join(repo, 'requirements', '.reqochet', 'schema.yaml'))
  writeFileSync(join(items, 'REQ-AAAAAAA.md'), '---\nid: REQ-AAAAAAA\ntype: system-requirement\ntitle: First\norder: a0\n---\nx\n')
  gitIn(repo, 'add', '-A')
  gitIn(repo, 'commit', '-q', '-m', 'start')

  const t = (ctx.t = await launch({ openPath: repo }))
  const { win, check } = t
  await win.getByRole('button', { name: 'Open repository…' }).click()
  await win.locator('.table__row', { hasText: 'First' }).click()
  const title = win.getByPlaceholder('Short name of the requirement')
  await title.waitFor()

  console.log('CR2-01 — the ✕ beside the project name asks first')
  await title.fill('First (edited)')
  await win.getByRole('button', { name: /Close repository/ }).first().click()
  const ask = win.getByRole('alertdialog')
  check(await ask.waitFor({ timeout: 3000 }).then(() => true, () => false), 'the unsaved-changes question opens')
  await ask.getByRole('button', { name: 'Keep editing' }).click()
  check((await title.inputValue()) === 'First (edited)', 'Keep editing keeps the typed title and the project open')

  console.log('CR2-05 — a list field counts while typing')
  await win.getByPlaceholder('comma, separated').first().fill('alpha, beta')
  await win.keyboard.press('Control+s')
  await win.locator('.editor__footer', { hasText: /Saved/ }).waitFor({ timeout: 5000 }).catch(() => {})
  const file = readFileSync(join(items, 'REQ-AAAAAAA.md'), 'utf8')
  check(file.includes('title: First (edited)'), 'Ctrl+S saved the title')
  check(/tags:\s*\n\s*- alpha\n\s*- beta/.test(file), 'Ctrl+S saved the list typed without leaving the box')

  console.log('CR2-01 — after saving, the ✕ closes at once')
  await win.getByRole('button', { name: /Close repository/ }).first().click()
  check(await win.getByRole('button', { name: 'Open repository…' }).waitFor({ timeout: 5000 }).then(() => true, () => false), 'the start screen is back')
})
