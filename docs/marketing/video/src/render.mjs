// Renders the film page to MP4 with Playwright (one screenshot per frame) and ffmpeg.
//   node render.mjs                 both formats  -> ../reqochet-45s.mp4, ../reqochet-45s-square.mp4, ../reqochet-45s-poster.png
//   node render.mjs wide|square     one format
//   node render.mjs --stills 2,10.5,20 [wide|square]   PNG stills into ./stills/ (look before a full render)
//   node render.mjs --serve         only serve the page: http://localhost:4173/docs/marketing/video/src/index.html
// Needs: playwright (or playwright-core with a Chromium) and ffmpeg on the PATH.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { createReadStream, existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
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
const serveOnly = args.includes('--serve')
await new Promise((r) => server.listen(serveOnly ? 4173 : 0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}/docs/marketing/video/src/index.html`
if (serveOnly) {
  console.log(base, '(add ?format=square or ?t=12.5)')
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
      const name = format === 'wide' ? 'reqochet-45s' : 'reqochet-45s-square'
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
      renameSync(tmp, join(out, `${name}.mp4`))
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
