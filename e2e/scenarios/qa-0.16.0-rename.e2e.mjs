// QA 0.16.0 (helper agent, docs/AGENT-WORKFLOW.md): the rename seen from the window — a project made with ReqMan
// (requirements/.reqman) opens, the "Update this project" notice shows, Later hides it, Update renames the folder in one
// commit and the notice goes; the top-bar face looks busy ("thinking") while a slow pull runs.
import { chmodSync, copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gitIn, gitRepo, launch, root, scenario } from '../harness.mjs'

await scenario('E2E qa-0.16.0-rename', async (ctx) => {
  const { repo, remote } = gitRepo('qa016')
  const items = join(repo, 'requirements', 'items')
  mkdirSync(join(repo, 'requirements', '.reqman'), { recursive: true })
  mkdirSync(items, { recursive: true })
  copyFileSync(join(root, 'config', 'default-schema.yaml'), join(repo, 'requirements', '.reqman', 'schema.yaml'))
  writeFileSync(join(items, 'REQ-AAAAAAA.md'), '---\nid: REQ-AAAAAAA\ntype: system-requirement\ntitle: Made with ReqMan\norder: a0\n---\nx\n')
  gitIn(repo, 'add', '-A')
  gitIn(repo, 'commit', '-q', '-m', 'made with ReqMan')
  gitIn(repo, 'push', '-q', '-u', 'origin', 'main')
  // a slow server: every fetch waits 3 s, so the window has time to show that it is working
  if (process.platform !== 'win32') {
    const slow = join(remote, 'slow-upload-pack.sh')
    writeFileSync(slow, '#!/bin/sh\nsleep 3\nexec git-upload-pack "$@"\n')
    chmodSync(slow, 0o755)
    gitIn(repo, 'config', 'remote.origin.uploadpack', slow)
  }

  const t = (ctx.t = await launch({ openPath: repo }))
  const { win, check } = t
  await win.getByRole('button', { name: 'Open repository…' }).click()
  await win.locator('.table__row').first().waitFor()

  console.log('R-02 — a ReqMan project opens and is offered the rename')
  const notice = win.locator('.folder-notice--ask')
  check((await win.locator('.table__row', { hasText: 'Made with ReqMan' }).count()) === 1, 'the items of the ReqMan project are shown')
  check((await notice.count()) === 1, 'the "Update this project" notice is shown')
  await t.shot('qa-0.16.0-legacy-notice')
  await notice.getByRole('button', { name: 'Not now' }).click()
  check((await notice.count()) === 0, 'Later hides the notice')

  console.log('R-08 — the top-bar face while a slow pull runs')
  const face = win.locator('.topbar .brand-face')
  await win.bringToFront()
  check((await face.count()) === 1, 'the top bar shows the face (no company logo)')
  const before = await face.getAttribute('data-state')
  check(before === 'idle' || before === 'still', `face at rest before the pull (${before})`)
  await win.getByRole('button', { name: 'Pull', exact: true }).click()
  const thinking = await win.locator('.topbar .brand-face[data-state="thinking"]').waitFor({ timeout: 2500 }).then(() => true, () => false)
  const during = await face.getAttribute('data-state')
  check(thinking || during === 'still', `the face looks busy while pulling (${during}; "still" only if the window has no focus)`)
  await win.locator('.topbar .brand-face[data-state="thinking"]').waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {})
  const after = await face.getAttribute('data-state')
  check(after !== 'thinking', `the face rests again after the pull (${after})`)

  console.log('R-02 — Update this project after reopening')
  await win.getByRole('button', { name: /Close repository/ }).first().click()
  await win.getByRole('button', { name: 'Open repository…' }).click()
  await win.locator('.table__row').first().waitFor()
  check((await notice.count()) === 1, 'after reopening the notice is offered again (Later is not forever)')
  await notice.getByRole('button', { name: 'Rename folder' }).click()
  await notice.waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {})
  check((await notice.count()) === 0, 'the notice goes after the update')
  check(existsSync(join(repo, 'requirements', '.reqochet', 'schema.yaml')) && !existsSync(join(repo, 'requirements', '.reqman')), 'the folder is renamed on disk')
  const subject = gitIn(repo, 'log', '-1', '--format=%s').trim()
  check(/\.reqman to \.reqochet/.test(subject), `one commit names the rename (${subject})`)
  check((await win.locator('.table__row', { hasText: 'Made with ReqMan' }).count()) === 1, 'the items are still shown after the rename')
  await t.shot('qa-0.16.0-after-update')
})
