// Renders the Windows icon files (PNG sizes + .ico) from the dark-tile icon drawings in resources/brand/icon.
// Run after changing reqochet-icon(-small).svg: node tools/brand-icons.mjs  (needs Python with Pillow for the .ico).
// Small cut at or below 24 px (brand-tokens.json icon.smallCutAtOrBelowPx). A size with a drawing of its own
// (reqochet-icon-16.svg, -20.svg: drawn on the pixel grid, 12 Nov 2026) uses that drawing instead.
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const dir = 'resources/brand/icon'
const sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256, 512]
// a full Playwright with its browser when installed (cloud session), else playwright-core with the system Chrome
const require = createRequire(import.meta.url)
let browser
try {
  browser = await require('playwright').chromium.launch()
} catch {
  browser = await require('playwright-core').chromium.launch({ channel: 'chrome' })
}
const page = await browser.newPage({ deviceScaleFactor: 1 })
// the light Windows icon is drawn from the outlined variant: the grey outline is for the desktop, Start menu and
// taskbar only (the owner, 8 Nov 2026); inside the app the light tile has no outline
// 0.24.3: the Ember tile too — the window icon follows the colour mode chosen in the app (the owner, 14 Nov 2026)
for (const [variant, prefix] of [['', 'reqochet-icon'], ['-light-outlined', 'reqochet-icon-light'], ['-ember', 'reqochet-icon-ember']]) {
  for (const size of sizes) {
    const own = `${dir}/reqochet-icon${variant}-${size}.svg`
    const svg = readFileSync(existsSync(own) ? own : `${dir}/reqochet-icon${variant}${size <= 24 ? '-small' : ''}.svg`, 'utf8')
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<html><body style="margin:0;background:transparent"><img width="${size}" height="${size}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`)
    await page.locator('img').evaluate((i) => i.decode())
    await page.screenshot({ path: `${dir}/png/${prefix}-${size}.png`, omitBackground: true })
  }
}
await browser.close()
const ico = (prefix, out) =>
  execFileSync('python3', ['-c', `
from PIL import Image
sizes=[16,20,24,32,40,48,64,96,128,256]
imgs=[Image.open(f'${dir}/png/${prefix}-{s}.png').convert('RGBA') for s in sizes]
imgs[-1].save('${dir}/${out}', format='ICO', sizes=[(s,s) for s in sizes], append_images=imgs[:-1])
`])
ico('reqochet-icon', 'reqochet.ico')
ico('reqochet-icon-light', 'reqochet-light.ico')
console.log('Icon PNGs and .ico files written.')
