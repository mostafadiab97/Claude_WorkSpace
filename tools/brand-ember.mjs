// Makes the Ember set of the brand drawings (owner, 13 Nov 2026) from the existing files — same shapes, colours only:
//   name: the letters r e c h e t in Ember orange, the q and o (the eyes) in Ember's warm white, light red/green dots;
//   tile: Ember's raised surface with an Ember-orange outline, warm-white q and o, light red/green dots.
// Run after changing a dark-tile drawing or the name logo: node tools/brand-ember.mjs
// (writes resources/brand/{logo,icon,motion}/*-ember*.svg and the 2000 px PNGs, also of the Arabic names; needs Playwright's Chromium for the PNG).
import { createRequire } from 'node:module'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const dir = 'resources/brand'
const tokens = JSON.parse(readFileSync(`${dir}/brand-tokens.json`, 'utf8')).ember
const { orange, warmWhite, tile, background } = tokens
const read = (f) => readFileSync(`${dir}/${f}`, 'utf8')
const write = (f, text) => writeFileSync(`${dir}/${f}`, text)

// --- the name: one path of all letters → two paths (q and o apart), so the eyes keep a calm warm-white ring
const QO_FROM = 1150 // the q and o start between these x values of the logo drawing (the first point of each outline)
const QO_TO = 2500
function emberName(svg) {
  return svg
    .replace(/<path d="([^"]+)" fill="(#[0-9a-f]{6})" stroke="\2"([^>]*)\/>/i, (_all, d, _ink, rest) => {
      const outlines = d.split(/(?=M)/)
      const eye = (o) => parseFloat(o.slice(1)) > QO_FROM && parseFloat(o.slice(1)) < QO_TO
      const part = (list, colour) => `<path d="${list.join('')}" fill="${colour}" stroke="${colour}"${rest}/>`
      return `${part(outlines.filter((o) => !eye(o)), orange)}\n${part(outlines.filter(eye), warmWhite)}`
    })
    .replace('#D7262B', '#FF5C61')
    .replace('#1F9D48', '#3CD873')
}
write('logo/reqochet-logo-on-ember.svg', emberName(read('logo/reqochet-logo-on-light.svg')))
write('motion/reqochet-loading-on-ember.svg', emberName(read('motion/reqochet-loading-on-light.svg')))

// --- the tile: every dark-tile drawing, recoloured
const emberTile = (svg) =>
  svg
    .replace('#1b1f27', tile) // tile
    .replace(/#7a8499|#aab3c2/, orange) // outline
    .replaceAll('#ffffff', warmWhite) // q and o
for (const [from, to] of [
  ['icon/reqochet-icon.svg', 'icon/reqochet-icon-ember.svg'],
  ['icon/reqochet-icon-small.svg', 'icon/reqochet-icon-ember-small.svg'],
  ['icon/reqochet-icon-16.svg', 'icon/reqochet-icon-ember-16.svg'],
  ['icon/reqochet-icon-20.svg', 'icon/reqochet-icon-ember-20.svg'],
  ['motion/reqochet-eyes-idle.svg', 'motion/reqochet-eyes-idle-ember.svg'],
  ['motion/reqochet-eyes-idle-small.svg', 'motion/reqochet-eyes-idle-ember-small.svg'],
  ['motion/reqochet-eyes-thinking.svg', 'motion/reqochet-eyes-thinking-ember.svg'],
  ['motion/reqochet-eyes-thinking-small.svg', 'motion/reqochet-eyes-thinking-ember-small.svg'],
  ['motion/reqochet-loading-icon.svg', 'motion/reqochet-loading-icon-ember.svg']
])
  write(to, emberTile(read(from)))

// --- 2000 px PNGs: the Ember name and the Arabic names (made by tools/brand-wordmark-ar.py), transparent like the other two
const require = createRequire(import.meta.url)
let browser
try {
  browser = await require('playwright').chromium.launch()
} catch {
  browser = await require('playwright-core').chromium.launch({ channel: 'chrome' })
}
const page = await browser.newPage({ deviceScaleFactor: 1 })
const arabic = ['light', 'dark', 'ember'].map((m) => `reqochet-logo-ar-on-${m}`).filter((n) => existsSync(`${dir}/logo/${n}.svg`))
for (const name of ['reqochet-logo-on-ember', ...arabic]) {
  const svg = read(`logo/${name}.svg`)
  const [, , w, h] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number)
  const height = Math.round((2000 * h) / w)
  await page.setViewportSize({ width: 2000, height })
  await page.setContent(`<html><body style="margin:0;background:transparent"><img width="2000" height="${height}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`)
  await page.locator('img').evaluate((i) => i.decode())
  await page.screenshot({ path: `${dir}/logo/${name}-2000.png`, omitBackground: true })
}
await browser.close()
console.log(`Ember brand drawings written (background they are made for: ${background}).`)
