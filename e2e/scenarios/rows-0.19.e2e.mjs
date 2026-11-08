// 0.19.1 — the owner on 0.19.0 test 2: with Show text off, opening levels left empty space between rows (heights
// measured while the text was shown were kept). 1,500 items with long texts, like the sandbox.
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { gitIn, gitRepo, launch, root, scenario } from '../harness.mjs'

await scenario('E2E rows-0.19', async (ctx) => {
  const { repo } = gitRepo('rows019')
  execFileSync(process.execPath, [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'tools/generate-scenario-repo.mts', repo, '1500'], { cwd: root, stdio: 'ignore' })
  gitIn(repo, 'add', '-A')
  gitIn(repo, 'commit', '-q', '-m', 'data')
  const t = (ctx.t = await launch({ openPath: repo }))
  const { win, check } = t
  await win.getByRole('button', { name: 'Open repository…' }).click()
  await win.locator('.table__row[data-id]').first().waitFor()
  const scroller = win.locator('.table__scroll')
  // text shown (default): open everything and scroll through, so many rows are measured tall
  await win.getByRole('button', { name: 'Expand all' }).click()
  await win.waitForTimeout(800)
  for (let i = 0; i < 6; i++) {
    await scroller.evaluate((el, k) => (el.scrollTop = k * 1500), i)
    await win.waitForTimeout(150)
  }
  await scroller.evaluate((el) => (el.scrollTop = 0))
  // one line per item, then close and open the levels again
  await win.getByRole('button', { name: 'Show text' }).click()
  await win.getByRole('button', { name: 'Collapse all' }).click()
  await win.waitForTimeout(300)
  await win.getByRole('button', { name: 'Expand all' }).click()
  await win.waitForTimeout(800)
  for (let i = 0; i < 4; i++) {
    await scroller.evaluate((el, k) => (el.scrollTop = k * 900), i)
    await win.waitForTimeout(200)
    const tops = await win.locator('.table__row[data-id]').evaluateAll((rs) => rs.map((r) => r.getBoundingClientRect().top).sort((a, b) => a - b))
    const gaps = tops.slice(1).map((x, j) => Math.round(x - tops[j]))
    check(gaps.length > 5 && gaps.every((g) => g <= 40), `screen ${i + 1}: one line per item, no empty space (largest step ${Math.max(...gaps)} px)`)
  }
  await t.shot('rows-0.19-one-line')
  // and back: text shown again, rows never overlap
  await win.getByRole('button', { name: 'Show text' }).click()
  await win.waitForTimeout(800)
  for (let i = 0; i < 3; i++) {
    await scroller.evaluate((el, k) => (el.scrollTop = k * 1200), i)
    await win.waitForTimeout(300)
    const boxes = await win.locator('.table__row[data-id]').evaluateAll((rs) => rs.map((r) => r.getBoundingClientRect()).map((b) => ({ top: b.top, bottom: b.bottom })).sort((a, b) => a.top - b.top))
    const overlap = boxes.slice(1).some((b, j) => b.top < boxes[j].bottom - 1)
    check(boxes.length > 3 && !overlap, `text shown again, screen ${i + 1}: rows do not overlap`)
  }
})
