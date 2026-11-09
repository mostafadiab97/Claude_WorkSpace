// Performance QA for 0.20.0 traceability (in-process, no window). Run on a throw-away generated repo:
//   node --import tsx tools/perf-qa-trace.mjs <repo>
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSystemGitAdapter } from '../src/modules/git-adapter/index.ts'
import { createSqliteIndexCache } from '../src/modules/index-cache/index.ts'
import { createFileRepositoryStore } from '../src/modules/repository-store/index.ts'
import { cacheFileName, createWorkspace } from '../src/modules/workspace/index.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const repo = process.argv[2]
const userDir = mkdtempSync(join(tmpdir(), 'rq-pqa-'))
const quiet = { info() {}, warn() {}, error() {} }
const ws = createWorkspace({ store: createFileRepositoryStore(join(root, 'config', 'default-schema.yaml')), git: createSystemGitAdapter(), openIndex: (r) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(r))), userDir, log: quiet, watchFiles: false })
const t = async (label, fn, n = 5, extra) => {
  const ms = []; let r
  for (let i = 0; i < n; i++) { const s = performance.now(); r = await fn(); ms.push(performance.now() - s) }
  ms.sort((a, b) => a - b)
  console.log(`${label}: median ${ms[ms.length >> 1].toFixed(1)} ms, max ${ms[ms.length - 1].toFixed(1)} ms${extra ? ' — ' + extra(r) : ''}`)
  return r
}
let s = performance.now()
await ws.open(repo)
console.log(`open (first index): ${(performance.now() - s).toFixed(0)} ms, items ${ws.repoInfo().itemCount}, rules ${ws.repoInfo().schema.rules?.length}`)
const docs = ws.repoInfo().documents.map((d) => d.name ?? d.id ?? d)
const gapsTotal = (r) => r.rules.map((x) => `${x.rule.id}:${x.gaps.length}/${x.total}`).join(' ')
await t('getCoverage all documents', () => ws.getCoverage(), 5, (r) => gapsTotal(r) + ` payload ${JSON.stringify(r).length >> 10} KB`)
await t(`getCoverage one document (${docs[0]})`, () => ws.getCoverage(typeof docs[0] === 'string' ? docs[0] : 'items'), 5, (r) => gapsTotal(r))
await t('query gaps paged 10000', () => ws.query({ gaps: true, limit: 10000, offset: 0, sort: { by: 'order' }, brief: true }), 5, (r) => `${r.total} matches, ${r.items.length} rows`)
await t('query gaps limit 0 (count)', () => ws.query({ gaps: true, limit: 0 }), 5, (r) => `${r.total}`)
await t('query gaps limit 100', () => ws.query({ gaps: true, limit: 100 }), 5, (r) => `${r.total}`)
const all = ws.query({ limit: 100000, brief: true, sort: { by: 'order' } }).items
const top = all.find((i) => !i.parent) ; const tops = all.filter((i) => !i.parent)
const childCount = new Map(); for (const i of all) if (i.parent) childCount.set(i.parent, (childCount.get(i.parent) || 0) + 1)
const size = (id) => ws.getImpact(id).nodes.length
const biggest = tops.map((i) => ({ ...i, n: size(i.id) })).sort((a, b) => b.n - a.n)[0]
const leaf = all.find((i) => !childCount.has(i.id) && i.type === 'system-requirement')
await t(`getImpact top heading (${biggest.id})`, () => ws.getImpact(biggest.id), 5, (r) => `${r.nodes.length} nodes truncated=${r.truncated} payload ${JSON.stringify(r).length >> 10} KB`)
await t('getImpact leaf system-requirement', () => ws.getImpact(leaf.id), 5, (r) => `${r.nodes.length} nodes`)
const mreq = { rowType: 'system-requirement', colType: 'test-case' }
await t('getMatrix sysreq x test-case', () => ws.getMatrix(mreq), 5, (r) => `rows ${r.rows.length}/${r.totalRows} cols ${r.cols.length} cells ${r.cells.length} payload ${JSON.stringify(r).length >> 10} KB`)
await t('getMatrix sysreq x test-case link=verifies', () => ws.getMatrix({ ...mreq, link: 'verifies' }), 3, (r) => `cells ${r.cells.length}`)
await t('getMatrix sw-req x test-case', () => ws.getMatrix({ rowType: 'software-requirement', colType: 'test-case' }), 3, (r) => `rows ${r.rows.length}/${r.totalRows} cols ${r.cols.length} cells ${r.cells.length}`)
await t('getMatrix sysreq x test-case gaps only', () => ws.getMatrix({ ...mreq, query: { gaps: true } }), 3, (r) => `rows ${r.totalRows}`)
await t('exportMatrix need x sysreq (small)', () => ws.exportMatrix({ rowType: 'stakeholder-need', colType: 'system-requirement' }), 3, (r) => `${r.count} rows, ${(r.content.length / 1024).toFixed(0)} KB`)
if (!process.env.SKIP_EXPORT) {
await t('exportMatrix (xlsx)', () => ws.exportMatrix(mreq), 3, (r) => `${r.count} rows, ${(r.content.length / 1024).toFixed(0)} KB`)
await t('exportMatrix sw-req x test-case (xlsx)', () => ws.exportMatrix({ rowType: 'software-requirement', colType: 'test-case' }), 2, (r) => `${r.count} rows, ${(r.content.length / 1024).toFixed(0)} KB`)
}
// saveSchemaRules: re-sync time (alternate none / starter)
const starter = ws.starterRules()
for (let i = 0; i < 4; i++) {
  const rules = i % 2 === 0 ? [] : starter
  s = performance.now()
  const r = await ws.saveSchemaRules(rules, ws.repoInfo().schemaRevision)
  console.log(`saveSchemaRules (${rules.length} rules): ${(performance.now() - s).toFixed(0)} ms ok=${r.ok} ${r.ok ? '' : r.message}`)
}
s = performance.now(); await ws.refresh(true); console.log(`refresh(focus) nothing changed: ${(performance.now() - s).toFixed(0)} ms`)
ws.close?.()
rmSync(userDir, { recursive: true, force: true })
process.exit(0)
