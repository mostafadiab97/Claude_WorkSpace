// Rebuilds the documentation diagrams from their sources in docs/diagrams/archify/*.json with Archify
// (https://github.com/tt-a1i/archify, Apache-2.0): checks each one (schema, layout, source-line evidence,
// real-browser check), writes docs/diagrams/<name>.html and a picture docs/images/<name>.png for the Markdown docs.
//
//   git clone https://github.com/tt-a1i/archify ../archify        (once, next to this repository)
//   node tools/diagrams.mjs [name ...]
//
// Environment: ARCHIFY = path to archify/bin/archify.mjs (default ../archify/archify/bin/archify.mjs);
// ARCHIFY_CHROME = a Chrome/Chromium/Edge executable if Archify cannot find one by itself.
// The diagrams cite source lines at a pinned commit (meta.repository.revision): after code changes, update that
// revision to a pushed commit and check that the cited lines still say what the diagram claims.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const archify = resolve(process.env.ARCHIFY ?? join(root, '..', 'archify', 'archify', 'bin', 'archify.mjs'))
if (!existsSync(archify)) {
  console.error(`Archify not found at ${archify}. Clone https://github.com/tt-a1i/archify next to this repository or set ARCHIFY.`)
  process.exit(1)
}
const srcDir = join(root, 'docs', 'diagrams', 'archify')
const wanted = process.argv.slice(2)
const names = readdirSync(srcDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .filter((n) => wanted.length === 0 || wanted.includes(n))

let failed = 0
for (const name of names) {
  const spec = JSON.parse(readFileSync(join(srcDir, `${name}.json`), 'utf8'))
  const out = `docs/diagrams/${name}.html`
  try {
    execFileSync(process.execPath, [archify, 'finalize', spec.diagram_type, `docs/diagrams/archify/${name}.json`, out, '--repo-root', '.', '--quality', spec.meta.quality_profile ?? 'showcase', '--json'], { cwd: root, stdio: 'pipe' })
    console.log(`✓ ${out}`)
  } catch (e) {
    failed++
    console.error(`✗ ${name}: ${String(e.stdout ?? e.message).slice(0, 2000)}`)
  }
  // receipts are regenerated on every run; keep only the diagram
  for (const f of readdirSync(join(root, 'docs', 'diagrams'))) if (f.startsWith(`${name}.`) && f.endsWith('.json')) rmSync(join(root, 'docs', 'diagrams', f))
}

// pictures for the Markdown documents: the diagram canvas only, light theme, 2× for sharp text
const require = createRequire(join(root, 'package.json'))
const { chromium } = require('playwright-core')
const browser = await chromium.launch(process.env.ARCHIFY_CHROME ? { executablePath: process.env.ARCHIFY_CHROME } : { channel: 'msedge' }).catch(() => chromium.launch())
for (const name of names) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', deviceScaleFactor: 2 })
  await page.goto(`file://${join(root, 'docs', 'diagrams', `${name}.html`)}`)
  await page.waitForTimeout(1500)
  const svg = await page.evaluateHandle(() => {
    let best = null
    let area = 0
    for (const s of document.querySelectorAll('svg')) {
      const r = s.getBoundingClientRect()
      if (r.width * r.height > area) {
        area = r.width * r.height
        best = s
      }
    }
    return best
  })
  await svg.asElement().screenshot({ path: join(root, 'docs', 'images', `${name}.png`) })
  console.log(`✓ docs/images/${name}.png`)
  await page.close()
}
await browser.close()
process.exit(failed ? 1 : 0)
