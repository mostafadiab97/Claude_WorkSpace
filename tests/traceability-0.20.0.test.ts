// 0.20.0 — theme 1b traceability (the owner's decisions T-01…T-08, 8 Nov 2026): coverage rules, gaps, impact, matrix.
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { parseSchema, starterRules } from '../src/modules/schema'
import { cacheFileName, createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }
async function setup(): Promise<{ ws: WorkspaceService; root: string }> {
  const base = await mkdtemp(join(tmpdir(), 'rq-tr-'))
  const root = join(base, 'work')
  execFileSync('git', ['init', '-q', '-b', 'main', root])
  const userDir = await mkdtemp(join(tmpdir(), 'rq-tr-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: (r: string) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(r))),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
  await ws.initialize(root, 'System')
  await ws.createDocument('Tests')
  return { ws, root }
}
const add = async (ws: WorkspaceService, type: string, title: string, o: { parent?: string; document?: string; status?: string } = {}): Promise<string> => {
  const base = ws.newItem(type, o.parent, undefined, o.parent ? undefined : (o.document ?? 'System'))
  const it = { ...base, title, fields: { ...base.fields, ...(o.status ? { status: o.status } : {}) } }
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}

describe('0.20.0 coverage rules in the schema', () => {
  it('new projects start with the starter set; unknown types and bad values are reported, not used', async () => {
    const { ws } = await setup()
    const rules = ws.repoInfo().schema.rules ?? []
    expect(rules.map((r) => r.id)).toEqual(['need-refined', 'system-verified', 'software-verified', 'hardware-verified', 'interface-verified', 'risk-mitigated'])
    const text = (await readFile(join(__dirname, '..', 'config', 'default-schema.yaml'), 'utf8')).replace(/^rules:[\s\S]*$/m, '') +
      'rules:\n  - { type: nope, link: verifies }\n  - { type: risk, link: mitigates, min: 0 }\n  - { type: risk, link: mitigates, direction: sideways }\n  - { type: test-case, link: verifies, direction: outgoing }\n'
    const p = parseSchema(text)
    expect(p.problems.map((x) => x.path)).toEqual(['rules[0].type', 'rules[1].min', 'rules[2].direction'])
    expect(p.schema.rules).toEqual([{ id: 'test-case-verifies-outgoing', type: 'test-case', link: 'verifies', direction: 'outgoing', min: 1, level: 'warning' }])
  })

  it('a schema without rules: is "never decided"; saving [] records "none"; saving rules round-trips and keeps comments', async () => {
    const { ws, root } = await setup()
    const file = join(root, 'requirements', '.reqochet', 'schema.yaml')
    const without = (await readFile(file, 'utf8')).replace(/\n# Coverage rules[\s\S]*$/, '\n')
    await writeFile(file, `# my comment\n${without}`)
    await ws.refresh(true)
    expect(ws.repoInfo().schema.rules).toBeUndefined()
    const none = await ws.saveSchemaRules([], ws.repoInfo().schemaRevision)
    expect(none.ok).toBe(true)
    expect(ws.repoInfo().schema.rules).toEqual([])
    const set = starterRules(ws.repoInfo().schema).slice(0, 2)
    expect((await ws.saveSchemaRules(set, ws.repoInfo().schemaRevision)).ok).toBe(true)
    expect(ws.repoInfo().schema.rules).toEqual(set)
    expect(await readFile(file, 'utf8')).toContain('# my comment')
    // a stale revision is refused (conflict-checked like the types)
    expect((await ws.saveSchemaRules([], 'stale')).ok).toBe(false)
  })
})

describe('0.20.0 coverage, gaps and the filter', () => {
  it('counts incoming links from the right types, across documents; Obsolete items count on neither end', async () => {
    const { ws } = await setup()
    const covered = await add(ws, 'system-requirement', 'covered')
    const gap = await add(ws, 'system-requirement', 'gap')
    const old = await add(ws, 'system-requirement', 'obsolete gap', { status: 'Obsolete' })
    const byObsoleteTest = await add(ws, 'system-requirement', 'only an obsolete test')
    const t1 = await add(ws, 'test-case', 'test 1', { document: 'Tests' })
    const t2 = await add(ws, 'test-case', 'test 2', { document: 'Tests', status: 'Obsolete' })
    const notATest = await add(ws, 'design-element', 'design')
    expect((await ws.addLink(t1, 'verifies', covered)).ok).toBe(true)
    expect((await ws.addLink(t2, 'verifies', byObsoleteTest)).ok).toBe(true)
    expect((await ws.addLink(notATest, 'verifies', gap)).ok).toBe(true)
    const sys = ws.getCoverage().rules.find((r) => r.rule.id === 'system-verified')
    expect(sys?.total).toBe(3)
    expect(sys?.gaps.map((g) => g.id).sort()).toEqual([gap, byObsoleteTest].sort())
    expect(sys?.gaps.every((g) => g.document === 'System')).toBe(true)
    expect(ws.getCoverage('Tests').rules.find((r) => r.rule.id === 'system-verified')?.total).toBe(0)
    // the Coverage gaps filter (T-08) finds the same items
    expect(ws.query({ gaps: true, types: ['system-requirement'] }).items.map((i) => i.id).sort()).toEqual([gap, byObsoleteTest].sort())
    expect(ws.query({ gaps: true }).items.some((i) => i.id === old)).toBe(false)
  })

  it('an outgoing rule and "at least 2"', async () => {
    const { ws } = await setup()
    const rules = [{ id: 'tc-verifies-two', type: 'test-case', link: 'verifies', direction: 'outgoing' as const, min: 2, level: 'error' as const }]
    expect((await ws.saveSchemaRules(rules, ws.repoInfo().schemaRevision)).ok).toBe(true)
    const r1 = await add(ws, 'system-requirement', 'r1')
    const r2 = await add(ws, 'system-requirement', 'r2')
    const one = await add(ws, 'test-case', 'one link', { document: 'Tests' })
    const two = await add(ws, 'test-case', 'two links', { document: 'Tests' })
    await ws.addLink(one, 'verifies', r1)
    await ws.addLink(two, 'verifies', r1)
    await ws.addLink(two, 'verifies', r2)
    expect(ws.getCoverage().rules[0]?.gaps.map((g) => g.id)).toEqual([one])
  })
})

describe('0.20.0 impact chain and matrix', () => {
  it('impact: children and items linking to it, all levels, each once, without "relates to"', async () => {
    const { ws } = await setup()
    const need = await add(ws, 'stakeholder-need', 'need')
    const sys = await add(ws, 'system-requirement', 'sys')
    const sw = await add(ws, 'software-requirement', 'sw', { parent: sys })
    const test = await add(ws, 'test-case', 'test', { document: 'Tests' })
    const loose = await add(ws, 'design-element', 'only related')
    await ws.addLink(sys, 'refines', need)
    await ws.addLink(test, 'verifies', sw)
    await ws.addLink(test, 'verifies', sys) // reached twice: listed once
    await ws.addLink(loose, 'relates-to', need)
    const r = ws.getImpact(need)
    expect(r.truncated).toBe(false)
    expect(r.nodes.map((n) => [n.id, n.depth, n.parent, n.via])).toEqual([
      [sys, 1, need, 'refines'],
      [test, 2, sys, 'verifies'],
      [sw, 2, sys, 'child']
    ])
  })

  it('matrix: rows of one type (filtered), columns only the linked items of the other; the Excel export has every row', async () => {
    const { ws } = await setup()
    const a = await add(ws, 'system-requirement', 'A')
    const b = await add(ws, 'system-requirement', 'B')
    const t1 = await add(ws, 'test-case', 'T1', { document: 'Tests' })
    await add(ws, 'test-case', 'T2 unlinked', { document: 'Tests' })
    await ws.addLink(t1, 'verifies', a)
    const m = ws.getMatrix({ rowType: 'system-requirement', colType: 'test-case' })
    expect(m.rows.map((r) => r.id)).toEqual([a, b])
    expect(m.cols.map((c) => c.id)).toEqual([t1])
    expect(m.cells).toEqual([{ r: 0, c: 0, type: 'verifies', dir: 'in', suspect: false }])
    expect(ws.getMatrix({ rowType: 'system-requirement', colType: 'test-case', query: { text: 'B' } }).rows.map((r) => r.id)).toEqual([b])
    expect(ws.getMatrix({ rowType: 'system-requirement', colType: 'test-case', link: 'refines' }).cells).toEqual([])
    const x = await ws.exportMatrix({ rowType: 'system-requirement', colType: 'test-case' })
    expect(x.count).toBe(2)
    expect(x.content.byteLength).toBeGreaterThan(1000)
  })
})
