// Prepares the "review pack" a helper agent starts from (docs/AGENT-WORKFLOW.md), so it does not read the whole project:
// the changed files since a base (default: the latest release tag), the diff summary, which helpers the changed areas
// need, the project rules that apply to them, and the e2e screenshots. Writes docs/reviews/agents/<label>-pack.md.
//
//   node tools/review-pack.mjs [base] [label]      e.g. node tools/review-pack.mjs v0.16.2 0.17.0
//   node tools/review-pack.mjs --all [label]       whole project (whole-project review): every tracked file, by area
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
const all = process.argv[2] === '--all'
// release tags are made on GitHub by release.yml; fetch them when the clone does not have them yet
const hasRef = (r) => { try { git('rev-parse', '--verify', '--quiet', `${r}^{commit}`); return true } catch { return false } }
const wanted = all ? null : process.argv[2]
if (!all && (!wanted || !hasRef(wanted))) { try { git('fetch', '--quiet', '--tags', 'origin') } catch { /* offline: use what is here */ } }
const base = all ? null : wanted || git('describe', '--tags', '--abbrev=0')
const label = process.argv[3] || (all ? 'whole-project' : `since-${base}`)
const head = git('rev-parse', '--short', 'HEAD')
const files = all ? git('ls-files').split('\n') : git('diff', '--name-only', `${base}..HEAD`).split('\n').filter(Boolean)

// changed area → helpers that must look (the owner, 5 Nov 2026: only the helpers a version needs)
const AREAS = [
  { name: 'data and Git core', test: /^src\/modules\/(repository-store|items|schema|safe-files|workspace|git-adapter|index-cache)\//, helpers: ['code-reviewer', 'qa-tester', 'security-reviewer'], rules: ['NFR-05 never lose data (validate, atomic writes, ConflictError, keep unknown keys, never force-push)', 'writes and Git actions only through the workspace queue q(); never one queued call inside another', 'order keys compared byte-wise, never localeCompare', 'SQLite index changed → bump FORMAT_VERSION'] },
  { name: 'import / export', test: /^src\/modules\/import-export\//, helpers: ['code-reviewer', 'qa-tester', 'security-reviewer'], rules: ['ReqIF valid against the official schema (tests/reqif.test.ts)', 'old reqman.* names still import'] },
  { name: 'main process and window calls', test: /^src\/(main|preload)\//, helpers: ['code-reviewer', 'security-reviewer'], rules: ['every window call: ReqochetApi method + Channels entry + ipc.ts handler validating with validate.ts', 'composition.ts is the only wiring place'] },
  { name: 'screens', test: /^src\/renderer\//, helpers: ['code-reviewer', 'ui-ux-reviewer', 'qa-tester'], rules: ['no hex/rgb in renderer code — theme tokens --rm-* only', 'every word from src/shared/text.ts (and text-ar.ts); no text in module-level constants', 'CSS logical properties only (right-to-left)', 'renderer uses only window.reqochet and shared/domain types'] },
  { name: 'texts', test: /^src\/shared\/text(-ar)?\.ts$/, helpers: ['arabic-reviewer'], rules: ['every key in both languages; right-to-left mark on Arabic texts', 'glossary: docs/guides/arabic-glossary.md'] },
  { name: 'brand', test: /^resources\/brand\//, helpers: ['brand-reviewer'], rules: ['resources/brand/README.md rules; never mirrored in Arabic; small cut below 32 px'] },
  { name: 'lists, index, performance-sensitive code', test: /^src\/(modules\/index-cache|renderer\/src\/workspace\/(ItemTable|Tree)[^/]*)/, helpers: ['performance-tester'], rules: ['10k / 50k targets in docs/TESTING.md → "Automated checks in detail"'] },
  { name: 'build, CI, installer, updater', test: /^(\.github\/|build\/|electron-builder\.yml|package\.json|src\/modules\/updater\/|e2e\/acceptance)/, helpers: ['code-reviewer', 'security-reviewer'], rules: ['no secrets in files; no push on pull requests', 'privacy check: no personal data in files'] },
  { name: 'docs', test: /^(docs\/|README\.md|CLAUDE\.md|CHANGELOG\.md)/, helpers: ['code-reviewer'], rules: ['docs match the code (the code reviewer checks the changed areas\' docs)'] },
  { name: 'tests', test: /^(tests|e2e)\//, helpers: [], rules: [] }
]
const byArea = new Map()
for (const f of files) {
  const area = AREAS.find((a) => a.test.test(f)) ?? { name: 'other', helpers: [], rules: [] }
  if (!byArea.has(area.name)) byArea.set(area.name, { area, files: [] })
  byArea.get(area.name).files.push(f)
}
// a file can concern more than one area (the index is data core and performance): every matching area adds its helpers
const helpers = [...new Set(files.flatMap((f) => AREAS.filter((a) => a.test.test(f)).flatMap((a) => a.helpers)))].sort()
const stat = all ? '' : git('diff', '--stat=120', `${base}..HEAD`).split('\n').slice(-1)[0]
const shots = existsSync('e2e/out') ? readdirSync('e2e/out').filter((f) => f.endsWith('.png')).sort() : []

let md = `# Review pack — ${label}\n\nCommit \`${head}\`${all ? ' (whole project)' : `, changes since \`${base}\` — ${stat}`}. Made by \`tools/review-pack.mjs\`.\n\n`
md += `## Helpers this pack needs\n\n${helpers.map((h) => `- ${h}`).join('\n') || '- none (tests/docs only)'}\n\n## Changed areas\n\n`
for (const { area, files: fs } of byArea.values()) {
  md += `### ${area.name} (${fs.length} files${area.helpers.length ? ` → ${area.helpers.join(', ')}` : ''})\n\n`
  if (area.rules.length) md += `Rules: ${area.rules.join('; ')}.\n\n`
  md += fs.slice(0, 400).map((f) => `- \`${f}\``).join('\n') + (fs.length > 400 ? `\n- … ${fs.length - 400} more` : '') + '\n\n'
}
md += `## Screenshots (e2e/out, from \`npm run build && xvfb-run -a npm run test:e2e\` on this commit)\n\n${shots.length ? shots.map((s) => `- \`e2e/out/${s}\``).join('\n') : '- none yet — run the e2e scenarios first'}\n\n`
md += `## How to look at the changes\n\n${all ? '- read the files of your area; `git log --oneline -30` for recent history' : `- \`git diff ${base}..HEAD -- <file>\` for one file; \`git log --oneline ${base}..HEAD\` for the commits`}\n- project rules in full: CLAUDE.md "Non-negotiable rules"; pitfalls per area: docs/PITFALLS.md\n`
mkdirSync('docs/reviews/agents', { recursive: true })
const out = `docs/reviews/agents/${label}-pack.md`
writeFileSync(out, md)
console.log(`${out}: ${files.length} files, helpers: ${helpers.join(', ') || 'none'}`)
