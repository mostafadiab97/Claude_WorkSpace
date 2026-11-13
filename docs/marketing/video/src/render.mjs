// Renders the film page to MP4 with Playwright (one screenshot per frame) and ffmpeg.
//   node render.mjs                 both formats  -> ../reqochet-45s.mp4, ../reqochet-45s-square.mp4, ../reqochet-45s-poster.png
//   node render.mjs wide|square     one format
//   node render.mjs --stills 2,10.5,20 [wide|square]   PNG stills into ./stills/ (look before a full render)
//   node render.mjs --serve         only serve the page: http://localhost:4173/docs/marketing/video/src/index.html
//   node render.mjs --sound-only    keep the pictures of the MP4s that are there, only put the sound in again
//   node render.mjs --no-voice      sound effects without the narrator      --silent   no sound at all
// The sound is audio/film.wav, made by `node sound.mjs` (run it first; it is made here when it is missing).
// Needs: playwright (or playwright-core with a Chromium) and ffmpeg on the PATH.
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { createReadStream, existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '../../../..')
const out = join(here, '..')
const FPS = 30
const POSTER_AT = 10.9
const SIZES = { wide: [1920, 1080], square: [1080, 1080] }
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.otf': 'font/otf', '.ttf': 'font/ttf', '.woff2': 'font/woff2' }

// a tiny read-only file server for the repository folder (the page uses the brand files and the app's serif font)
const server = createServer((req, res) => {
  const file = normalize(join(repo, decodeURIComponent(new URL(req.url, 'http://x').pathname)))
  if (!file.startsWith(repo) || !existsSync(file) || !statSync(file).isFile()) return res.writeHead(404).end()
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).pipe(res)
})
const args = process.argv.slice(2)
const names = { wide: 'reqochet-45s', square: 'reqochet-45s-square' }

const LOUDNESS = -16 // LUFS, the usual loudness for video on the web
/** Puts the sound under the pictures: AAC 128 kbit/s, brought to the usual loudness, peaks held under -2 dB. */
function addSound(pictures, target) {
  if (args.includes('--silent')) return renameSync(pictures, target)
  const wav = join(here, 'audio', args.includes('--no-voice') ? 'film-effects.wav' : 'film.wav')
  if (!existsSync(wav)) spawnSync(process.execPath, [join(here, 'sound.mjs')], { stdio: 'inherit' })
  const tmp = target.replace(/\.mp4$/, '.snd.mp4')
  // one fixed gain for the whole film (so the effects keep their distance under the voice), found by measuring
  // the loudness first; a limiter then holds the few highest peaks of the voice at -2 dB
  const measured = spawnSync('ffmpeg', ['-hide_banner', '-i', wav, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' }).stderr
  const loudness = Number(measured.match(/I:\s+(-?[\d.]+) LUFS(?![\s\S]*I:\s)/)[1])
  const gain = (LOUDNESS - loudness).toFixed(1)
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', pictures, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
    '-af', `volume=${gain}dB,alimiter=limit=${(10 ** (-2.5 / 20)).toFixed(3)}:attack=2:release=80:level=disabled`, '-ar', '48000', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', tmp], { stdio: 'inherit' })
  console.log(`sound: ${loudness} LUFS measured, ${gain} dB added`)
  if (r.status !== 0) throw new Error('ffmpeg could not add the sound')
  if (pictures !== target) rmSync(pictures)
  renameSync(tmp, target)
}
const serveOnly = args.includes('--serve')
await new Promise((r) => server.listen(serveOnly ? 4173 : 0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}/docs/marketing/video/src/index.html`
if (serveOnly) {
  console.log(base, '(add ?format=square or ?t=12.5)')
} else if (args.includes('--sound-only')) {
  for (const name of Object.values(names)) {
    addSound(join(out, `${name}.mp4`), join(out, `${name}.mp4`))
    console.log('sound added to', `${name}.mp4`)
  }
  server.close()
} else {
  const require = createRequire(import.meta.url)
  let chromium
  try { ({ chromium } = require('playwright')) } catch { ({ chromium } = require('playwright-core')) }
  const stills = args.includes('--stills') ? args[args.indexOf('--stills') + 1].split(',').map(Number) : null
  const formats = args.filter((a) => a in SIZES)
  const browser = await chromium.launch()
  for (const format of formats.length ? formats : Object.keys(SIZES)) {
    const [width, height] = SIZES[format]
    const page = await browser.newPage({ viewport: { width, height } })
    await page.goto(`${base}?format=${format}`)
    await page.waitForFunction(() => window.ready)
    const seek = (t) => page.evaluate((s) => window.seek(s), t)
    if (stills) {
      mkdirSync(join(here, 'stills'), { recursive: true })
      for (const t of stills) {
        await seek(t)
        writeFileSync(join(here, 'stills', `${format}-${String(t).padStart(5, '0')}.png`), await page.screenshot())
      }
    } else {
      const duration = await page.evaluate(() => window.DURATION)
      const name = names[format]
      const tmp = join(out, `${name}.tmp.mp4`)
      const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', tmp], { stdio: ['pipe', 'inherit', 'inherit'] })
      const done = new Promise((res, rej) => ff.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))))
      for (let f = 0; f < duration * FPS; f++) {
        await seek(f / FPS)
        const shot = await page.screenshot({ type: 'jpeg', quality: 92 })
        if (!ff.stdin.write(shot)) await new Promise((r) => ff.stdin.once('drain', r))
      }
      ff.stdin.end()
      await done
      addSound(tmp, join(out, `${name}.mp4`))
      console.log('rendered', `${name}.mp4`)
      if (format === 'wide') {
        await seek(POSTER_AT)
        writeFileSync(join(out, 'reqochet-45s-poster.png'), await page.screenshot())
      }
    }
    await page.close()
  }
  await browser.close()
  server.close()
}
