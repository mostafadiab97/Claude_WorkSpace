// Rebuilds the documentation diagrams from their sources in docs/diagrams/archify/*.json with Archify
// (https://github.com/tt-a1i/archify, Apache-2.0): checks each one (schema, layout, source-line evidence,
// real-browser check), writes docs/diagrams/<name>.html and a picture docs/images/<name>.png for the Markdown docs.
//
//   git clone https://github.com/tt-a1i/archify ../archify        (once, next to this repository)
//   node tools/diagrams.mjs [name ...]
//   node tools/diagrams.mjs --index        only rewrite docs/diagrams/index.html (the navigator; no Archify needed)
//
// Environment: ARCHIFY = path to archify/bin/archify.mjs (default ../archify/archify/bin/archify.mjs);
// ARCHIFY_CHROME = a Chrome/Chromium/Edge executable if Archify cannot find one by itself.
// The diagrams cite source lines at a pinned commit (meta.repository.revision): after code changes, update that
// revision to a pushed commit and check that the cited lines still say what the diagram claims.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'docs', 'diagrams', 'archify')

// One line per diagram for the navigator (what a reader learns from it).
const ABOUT = {
  architecture: 'Every part of ReqMan, what it may talk to, and where data lives.',
  'save-flow': 'What happens between clicking Save and the file on disk — and how a newer version is never overwritten.',
  'pull-flow': 'How Pull checks for clashes in memory first and stops before anything changes.'
}
const KIND = { architecture: 'Architecture', sequence: 'Sequence', workflow: 'Workflow' }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/** docs/diagrams/index.html: a list of every diagram on the left; clicking one shows it on the right. */
function writeIndex() {
  const all = readdirSync(srcDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const spec = JSON.parse(readFileSync(join(srcDir, f), 'utf8'))
      const name = f.replace(/\.json$/, '')
      const parts = (spec.components ?? spec.nodes ?? spec.participants ?? []).map((p) => p.label ?? p.name ?? p.id)
      return { name, title: spec.meta.title, kind: KIND[spec.diagram_type] ?? spec.diagram_type, about: ABOUT[name] ?? '', parts }
    })
    .sort((a, b) => Object.keys(ABOUT).indexOf(a.name) - Object.keys(ABOUT).indexOf(b.name))
  const items = all
    .map(
      (d) => `      <li><a href="#${esc(d.name)}" data-name="${esc(d.name)}">
        <span class="kind">${esc(d.kind)}</span>
        <span class="title">${esc(d.title)}</span>
        <span class="about">${esc(d.about)}</span>
        <span class="parts">${esc(d.parts.join(' · '))}</span>
      </a></li>`
    )
    .join('\n')
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ReqMan diagrams</title>
<!-- Written by tools/diagrams.mjs — do not edit by hand. -->
<style>
  :root { --bg: #f7f7f5; --panel: #ffffff; --text: #1d1d1f; --muted: #6b6b70; --line: #e3e3e0; --accent: #2457d6; --chip: #eef2fc; }
  @media (prefers-color-scheme: dark) { :root { --bg: #141416; --panel: #1c1c1f; --text: #ececee; --muted: #9a9aa2; --line: #2e2e33; --accent: #7fa2ff; --chip: #24283a; } }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { display: grid; grid-template-columns: 320px 1fr; background: var(--bg); color: var(--text); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
  nav { border-right: 1px solid var(--line); background: var(--panel); overflow-y: auto; padding: 20px 14px; }
  h1 { font-size: 16px; margin: 0 6px 4px; }
  .lead { color: var(--muted); font-size: 12.5px; margin: 0 6px 16px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  a { display: grid; gap: 3px; padding: 10px 12px; border-radius: 8px; color: inherit; text-decoration: none; border: 1px solid transparent; }
  a:hover { background: var(--bg); }
  a[aria-current="page"] { background: var(--chip); border-color: var(--accent); }
  a:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .kind { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--accent); font-weight: 600; }
  .title { font-weight: 600; }
  .about { color: var(--muted); font-size: 12.5px; }
  .parts { color: var(--muted); font-size: 11.5px; opacity: .85; }
  .foot { margin: 18px 6px 0; font-size: 12px; color: var(--muted); }
  .foot a { display: inline; padding: 0; color: var(--accent); }
  main { display: grid; grid-template-rows: auto 1fr; min-width: 0; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--line); background: var(--panel); }
  header a { display: inline; padding: 0; color: var(--accent); font-size: 13px; }
  iframe { width: 100%; height: 100%; border: 0; background: var(--bg); }
  @media (max-width: 760px) {
    body { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
    nav { border-right: 0; border-bottom: 1px solid var(--line); max-height: 45vh; padding: 14px 16px; }
    .parts { display: none; }
  }
</style>
</head>
<body>
<nav aria-label="Diagrams">
  <h1>ReqMan diagrams</h1>
  <p class="lead">${all.length} diagrams. Click one to show it; every box in a diagram links to the source lines it was drawn from.</p>
  <ul>
${items}
  </ul>
  <p class="foot">Made with <a href="https://github.com/tt-a1i/archify">Archify</a>. To change one, see README.md in this folder.</p>
</nav>
<main>
  <header><strong id="current"></strong><a id="open" href="#" target="_blank" rel="noopener">Open on its own ↗</a></header>
  <iframe id="view" title="Diagram"></iframe>
</main>
<script>
  const links = [...document.querySelectorAll('nav a[data-name]')]
  const view = document.getElementById('view')
  function show() {
    const wanted = location.hash.slice(1)
    const link = links.find((a) => a.dataset.name === wanted) || links[0]
    if (!link) return
    for (const a of links) a.toggleAttribute('aria-current', a === link)
    link.setAttribute('aria-current', 'page')
    const file = link.dataset.name + '.html'
    if (view.getAttribute('src') !== file) view.setAttribute('src', file)
    document.getElementById('current').textContent = link.querySelector('.title').textContent
    document.getElementById('open').href = file
    document.title = link.querySelector('.title').textContent + ' — ReqMan diagrams'
  }
  addEventListener('hashchange', show)
  show()
</script>
</body>
</html>
`
  writeFileSync(join(root, 'docs', 'diagrams', 'index.html'), html)
  console.log('✓ docs/diagrams/index.html')
}

if (process.argv.includes('--index')) {
  writeIndex()
  process.exit(0)
}

const archify = resolve(process.env.ARCHIFY ?? join(root, '..', 'archify', 'archify', 'bin', 'archify.mjs'))
if (!existsSync(archify)) {
  console.error(`Archify not found at ${archify}. Clone https://github.com/tt-a1i/archify next to this repository or set ARCHIFY.`)
  process.exit(1)
}
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
writeIndex()
process.exit(failed ? 1 : 0)
