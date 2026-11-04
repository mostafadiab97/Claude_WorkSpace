// QA 0.15.0 (helper agent, docs/AGENT-WORKFLOW.md): the UI polish version seen from the window — item text from a
// commit with hostile Markdown is shown formatted but harmless, the Text column has no markers, a click on the
// preview opens the plain text, the Problems panel closes with its button, and Ctrl+N focuses the New list.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gitIn, gitRepo, launch, root, scenario } from '../harness.mjs'

await scenario('E2E qa-0.15.0-polish', async (ctx) => {
  const { repo } = gitRepo('qa015')
  const items = join(repo, 'requirements', 'items')
  mkdirSync(join(repo, 'requirements', '.reqman'), { recursive: true })
  mkdirSync(items, { recursive: true })
  copyFileSync(join(root, 'config', 'default-schema.yaml'), join(repo, 'requirements', '.reqman', 'schema.yaml'))
  const evilId = 'SYS-AAAAAA'
  const text = [
    '**Objective:** set SIG_BRAKE_REQ',
    '',
    '<img src=x onerror="window.__qaPwned=1"> <script>window.__qaPwned=2</script>',
    '',
    '[run](javascript:window.__qaPwned=3) [site](https://example.org) ![pic](https://example.org/x.png)'
  ].join('\n')
  writeFileSync(join(items, `${evilId}.md`), `---\nid: ${evilId}\ntype: system-requirement\ntitle: Hostile text\norder: a0\n---\n${text}\n`)
  // a link to an item that does not exist → one problem
  writeFileSync(join(items, 'SYS-BBBBBB.md'), `---\nid: SYS-BBBBBB\ntype: system-requirement\ntitle: Broken link\norder: a1\nlinks:\n  - type: verifies\n    target: SYS-ZZZZZZ\n---\nx\n`)
  gitIn(repo, 'add', '-A')
  gitIn(repo, 'commit', '-q', '-m', 'test data')

  const t = (ctx.t = await launch({ openPath: repo }))
  const { win, check } = t
  await win.getByRole('button', { name: 'Open repository…' }).click()
  await win.locator('.table__row').first().waitFor()

  console.log('UX-08 — formatted text from a commit is harmless')
  const cell = await win.locator('.table__row', { hasText: 'Hostile text' }).locator('[role=gridcell]').last().textContent() // Text is the last column by default (UX-03)
  check(!/\*\*/.test(cell ?? ''), `the Text cell shows no Markdown markers (${JSON.stringify(cell?.slice(0, 60))})`)
  check((cell ?? '').includes('SIG_BRAKE_REQ'), 'the Text cell keeps underscores in signal names')
  await win.locator('.table__row', { hasText: 'Hostile text' }).click()
  const preview = win.locator('.text-preview')
  await preview.waitFor()
  check((await preview.locator('strong', { hasText: 'Objective:' }).count()) === 1, 'bold text is formatted')
  check((await preview.locator('img, script, iframe').count()) === 0, 'no image or script element in the preview')
  check((await preview.locator('a[href^="javascript:"]').count()) === 0, 'no javascript: link')
  check((await preview.locator('a[href="https://example.org"]').count()) === 1, 'the https link is a link')
  check((await win.evaluate(() => window.__qaPwned ?? null)) === null, 'nothing in the text ran')
  await preview.click()
  await win.locator('textarea.textarea').waitFor()
  check((await win.locator('textarea.textarea').inputValue()).includes('<script>'), 'a click on the preview opens the plain text')
  await t.shot('qa-0.15.0-preview')

  console.log('UX-11 — Problems panel closes with its button')
  await win.keyboard.press('Escape')
  await win.getByRole('button', { name: /1 problem/ }).click()
  const panel = win.getByRole('region', { name: 'Problems' })
  await panel.waitFor()
  await panel.getByRole('button', { name: 'Close' }).click()
  await panel.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
  check((await panel.count()) === 0, 'the Close button hides the panel')

  console.log('UX-25 — Ctrl+N focuses the New list')
  await win.locator('.table__row').first().click()
  await win.keyboard.press('Control+n')
  const focused = await win.evaluate(() => document.activeElement?.tagName ?? '')
  check(focused === 'SELECT', `Ctrl+N puts the focus on the New list (${focused})`)
})
