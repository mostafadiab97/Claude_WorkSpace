// Renders the sting SVGs to MP4 (on the theme's background) and WebM with transparency.
// Usage: node render-sting.mjs [light|dark|ember ...] [--still 1.2]   (needs playwright and ffmpeg)
import { spawn } from 'node:child_process'
import { renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { stingSvg, THEMES, DURATION } from './build-sting.mjs'

const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) } catch { ({ chromium } = require('playwright-core')) }
const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..')
const FPS = 30
const args = process.argv.slice(2)
const stillAt = args.includes('--still') ? Number(args[args.indexOf('--still') + 1]) : null
const themes = args.filter((a) => a in THEMES)
const todo = themes.length ? themes : Object.keys(THEMES)

function ffmpeg(ffArgs) {
  const p = spawn('ffmpeg', ['-loglevel', 'error', '-y', ...ffArgs], { stdio: ['pipe', 'inherit', 'inherit'] })
  const done = new Promise((res, rej) => p.on('exit', (code) => (code === 0 ? res() : rej(new Error('ffmpeg ' + code)))))
  return { stdin: p.stdin, done }
}

const browser = await chromium.launch()
for (const theme of todo) {
  const c = THEMES[theme]
  for (const transparent of stillAt === null ? [false, true] : [false]) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    // a soft light behind the word on the opaque versions; the transparent one is the bare animation
    const glow = theme === 'light' ? 'transparent' : theme === 'dark' ? 'rgba(124,156,255,.08)' : 'rgba(255,138,61,.13)'
    const bg = transparent ? 'transparent' : `radial-gradient(ellipse 60% 55% at 50% 50%, ${glow}, transparent 70%), ${c.bg}`
    await page.setContent(`<html><body style="margin:0;background:${bg}">${stingSvg(theme).replace('<svg ', '<svg width="1920" height="1080" ')}</body></html>`)
    await page.evaluate(() => { window.anims = document.getAnimations(); window.anims.forEach((a) => a.pause()) })
    const seek = (t) => page.evaluate((ms) => window.anims.forEach((a) => { a.currentTime = ms }), t * 1000)
    if (stillAt !== null) {
      await seek(stillAt)
      writeFileSync(join(out, `still-${theme}.png`), await page.screenshot())
      await page.close()
      continue
    }
    const name = `reqochet-sting-${theme}`
    const tmp = join(out, transparent ? `${name}.tmp.webm` : `${name}.tmp.mp4`)
    const enc = transparent
      ? ffmpeg(['-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '32', '-row-mt', '1', '-an', tmp])
      : ffmpeg(['-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', tmp])
    for (let f = 0; f < DURATION * FPS; f++) {
      await seek(f / FPS)
      const shot = transparent ? await page.screenshot({ type: 'png', omitBackground: true }) : await page.screenshot({ type: 'jpeg', quality: 95 })
      if (!enc.stdin.write(shot)) await new Promise((r) => enc.stdin.once('drain', r))
    }
    enc.stdin.end()
    await enc.done
    renameSync(tmp, tmp.replace('.tmp.', '.'))
    console.log('rendered', tmp.replace('.tmp.', '.'))
    await page.close()
  }
}
await browser.close()
