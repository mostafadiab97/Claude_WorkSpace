// Draws the two mock-up pictures of the commit-graph idea: node docs/reviews/agents/fable-commit-graph/render.mjs [path to config/theme.json]
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../../..')
const require = createRequire(join(root, 'package.json'))
const { chromium } = require('playwright-core')
const theme = JSON.parse(readFileSync(process.argv[2] ?? join(root, 'config/theme.json'), 'utf8')).modes
// the colours come straight from the theme file: L_name -> light, E_name -> ember
const html = readFileSync(join(here, 'mock.html'), 'utf8').replace(/\b([LE])_(\w+)/g, (_, m, k) => theme[m === 'L' ? 'light' : 'ember'][k])
const tmp = join(here, '.mock-filled.html')
writeFileSync(tmp, html)
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
const page = await browser.newPage({ viewport: { width: 1280, height: 780 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.error(String(e)))
for (const [name, query] of [['graph-light', 'mode=light'], ['graph-ember', 'mode=ember'], ['requirement-light', 'mode=light&view=one'], ['requirement-ember', 'mode=ember&view=one']]) {
  await page.goto(pathToFileURL(tmp).href + `?${query}`)
  await page.evaluate(() => document.fonts.ready)
  await (await page.$('body')).screenshot({ path: join(here, `${name}.png`) })
}
await browser.close()
rmSync(tmp)
