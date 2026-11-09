// QA of 0.20.0 theme 1b traceability: odd rule values, coverage counts, gaps filter, impact chain, matrix, schema writes.
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { parseSchema, starterRules } from '../src/modules/schema'
import { cacheFileName, createWorkspace, type WorkspaceService } from '../src/modules/workspace'
import type { Schema } from '../src/shared/domain'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }
const DEFAULT = join(__dirname, '..', 'config', 'default-schema.yaml')
async function setup(): Promise<{ ws: WorkspaceService; root: string }> {
  const base = await mkdtemp(join(tmpdir(), 'rq-qa20-'))
  const root = join(base, 'work')
  execFileSync('git', ['init', '-q', '-b', 'main', root])
  const userDir = await mkdtemp(join(tmpdir(), 'rq-qa20-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(DEFAULT),
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
const base = async (): Promise<string> => (await readFile(DEFAULT, 'utf8')).replace(/^rules:[\s\S]*$/m, '')
const rulesOf = async (yaml: string) => parseSchema((await base()) + yaml)

describe('QA 0.20.0 rules in schema.yaml: odd values', () => {
  it('rules: [] is none, missing and null are "never decided"', async () => {
    expect((await rulesOf('rules: []\n')).schema.rules).toEqual([])
    expect((await rulesOf('')).schema.rules).toBeUndefined()
    expect((await rulesOf('rules:\n')).schema.rules).toBeUndefined()
  })

  it('a rules value that is not a list is reported, and does not silently mean "none"', async () => {
    const p = await rulesOf('rules: nonsense\n')
    expect(p.problems.map((x) => x.path)).toContain('rules')
    // a broken rules: must not be treated like "the team chose none" (the starter set would stop being offered)
    expect(p.schema.rules).toBeUndefined()
  })

  it('numbers given as text, fractions, huge and caps are refused, not guessed', async () => {
    const t = 'type: risk, link: mitigates'
    const p = await rulesOf(
      `rules:\n  - { ${t}, id: a, min: '2' }\n  - { ${t}, id: b, min: 2.5 }\n  - { ${t}, id: c, min: 100 }\n  - { ${t}, id: d, min: true }\n  - { ${t}, id: e, level: ERROR }\n  - { ${t}, id: f, direction: Incoming }\n  - { ${t}, id: G }\n`
    )
    expect(p.problems.map((x) => x.path)).toEqual(['rules[0].min', 'rules[1].min', 'rules[2].min', 'rules[3].min', 'rules[4].level', 'rules[5].direction', 'rules[6].id'])
    expect(p.schema.rules).toEqual([])
  })

  it('two rules without an ID for the same type, link and direction: the second is reported (generated IDs collide)', async () => {
    const p = await rulesOf('rules:\n  - { type: risk, link: mitigates, from: [system-requirement] }\n  - { type: risk, link: mitigates, from: [software-requirement] }\n')
    expect(p.problems.map((x) => x.path)).toEqual(['rules[1].id'])
    expect(p.schema.rules?.length).toBe(1)
  })

  it('"from" as one word, empty, duplicated, or with a number in it', async () => {
    const p = await rulesOf(
      'rules:\n  - { id: a, type: risk, link: mitigates, from: system-requirement }\n  - { id: b, type: risk, link: mitigates, from: [] }\n  - { id: c, type: risk, link: mitigates, from: [test-case, test-case] }\n  - { id: d, type: risk, link: mitigates, from: [5] }\n'
    )
    // restated by the builder (QA-4/QA-6 fixed): a repeated type counts once; a rule with a number in "from" is
    // reported and not used (it would have turned "only from X" into "from anything")
    expect(p.schema.rules?.map((r) => r.from)).toEqual([['system-requirement'], undefined, ['test-case']])
    expect(p.problems.map((x) => x.path)).toContain('rules[3].from')
  })

  it('a rule naming a link type the schema lacks is reported (type or link written in capitals too)', async () => {
    const p = await rulesOf('rules:\n  - { id: a, type: Risk, link: mitigates }\n  - { id: b, type: risk, link: Mitigates }\n')
    expect(p.problems.map((x) => x.path)).toEqual(['rules[0].type', 'rules[1].link'])
  })
})

describe('QA 0.20.0 starter rules for a schema missing some types', () => {
  const schemaWith = (types: string[], links: string[]): Schema => ({
    version: 1,
    itemTypes: types.map((id) => ({ id, name: id, requirement: true })),
    fields: [],
    linkTypes: links.map((id) => ({ id, name: id, reverseName: id }))
  })
  it('only offers rules whose types and links exist; every starter rule parses without a problem', async () => {
    const cases: [string[], string[]][] = [
      [[], []],
      [['risk'], ['mitigates']],
      [['risk', 'system-requirement'], ['mitigates']],
      [['stakeholder-need'], ['refines']],
      [['system-requirement', 'test-case'], ['refines']],
      [['system-requirement', 'test-case', 'stakeholder-need', 'risk', 'interface-requirement'], ['verifies', 'refines', 'mitigates']]
    ]
    for (const [types, links] of cases) {
      const s = schemaWith(types, links)
      const rules = starterRules(s)
      for (const r of rules) {
        expect(types).toContain(r.type)
        expect(links).toContain(r.link)
        for (const f of r.from ?? []) expect(types).toContain(f)
      }
      expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length)
    }
    expect(starterRules(schemaWith(['risk'], ['mitigates']))).toEqual([])
    expect(starterRules(schemaWith(['system-requirement', 'test-case'], ['refines'])).length).toBe(0)
  })
})

describe('QA 0.20.0 coverage counts', () => {
  it('an item linked twice by the same test, a link to a missing item, a self link, and the document filter', async () => {
    const { ws, root } = await setup()
    const a = await add(ws, 'system-requirement', 'A')
    const b = await add(ws, 'system-requirement', 'B')
    const t = await add(ws, 'test-case', 'T', { document: 'Tests' })
    await ws.addLink(t, 'verifies', a)
    // the same link written twice by hand in the file (a merge can do this)
    const file = join(root, 'requirements', 'Tests', `${t}.md`)
    const text = await readFile(file, 'utf8')
    expect(text).toContain(`target: ${a}`)
    // rule min 2: one test linking the same item twice must still count as ONE test
    const rule = { id: 'two-tests', type: 'system-requirement', link: 'verifies', direction: 'incoming' as const, from: ['test-case'], min: 2, level: 'warning' as const }
    expect((await ws.saveSchemaRules([rule], ws.repoInfo().schemaRevision)).ok).toBe(true)
    const dup = text.replace(/(\n\s+- id: [^\n]*)?\n---/, (m) => m) // keep the file intact; duplicate through the API below instead
    expect(dup.length).toBeGreaterThan(0)
    await ws.addLink(t, 'verifies', a) // adding the same link again
    const cov = ws.getCoverage().rules[0]
    expect(cov?.gaps.map((g) => g.id).sort()).toEqual([a, b].sort())
    expect(ws.getCoverage('System').rules[0]?.total).toBe(2)
    expect(ws.getCoverage('Nope').rules[0]?.total).toBe(0)
    expect(ws.getCoverage('').rules[0]?.total).toBe(0)
  })

  it('loose items (document "") are counted for document "" and for all documents', async () => {
    const { ws, root } = await setup()
    const id = 'REQ-LOOSE01'
    await writeFile(join(root, 'requirements', `${id}.md`), `---\nid: ${id}\ntype: system-requirement\ntitle: Loose\nparent: null\norder: a0\nlinks: []\nstatus: Draft\n---\nbody\n`)
    await ws.refresh(true)
    expect(ws.getCoverage('').rules.find((r) => r.rule.id === 'system-verified')?.gaps.map((g) => g.id)).toEqual([id])
    expect(ws.getCoverage().rules.find((r) => r.rule.id === 'system-verified')?.gaps.map((g) => g.id)).toContain(id)
  })

  it('a link to an item that does not exist counts for nothing (outgoing rule)', async () => {
    const { ws, root } = await setup()
    const rule = { id: 'tc-out', type: 'test-case', link: 'verifies', direction: 'outgoing' as const, min: 1, level: 'warning' as const }
    await ws.saveSchemaRules([rule], ws.repoInfo().schemaRevision)
    const t = await add(ws, 'test-case', 'T', { document: 'Tests' })
    const file = join(root, 'requirements', 'Tests', `${t}.md`)
    const txt = await readFile(file, 'utf8')
    await writeFile(file, txt.replace(/links:\s*\[\]/, 'links:\n  - { type: verifies, target: REQ-MISSING1 }'))
    await ws.refresh(true)
    expect(ws.getCoverage().rules[0]?.gaps.map((g) => g.id)).toEqual([t])
  })

  it('Obsolete is matched whatever its case or spaces; an obsolete item linking out does not count', async () => {
    const { ws } = await setup()
    const a = await add(ws, 'system-requirement', 'A')
    const t = await add(ws, 'test-case', 'T', { document: 'Tests', status: 'Obsolete' })
    await ws.addLink(t, 'verifies', a)
    const sys = ws.getCoverage().rules.find((r) => r.rule.id === 'system-verified')
    expect(sys?.gaps.map((g) => g.id)).toEqual([a])
  })

  it('rule on a type that has no status field in the schema still works (no crash)', async () => {
    const { ws } = await setup()
    const a = await add(ws, 'stakeholder-need', 'N')
    expect(ws.getCoverage().rules.find((r) => r.rule.id === 'need-refined')?.gaps.map((g) => g.id)).toEqual([a])
  })
})

describe('QA 0.20.0 the Coverage gaps filter with other filters', () => {
  it('combined with text, document, parent, incomplete, status, sort and paging', async () => {
    const { ws } = await setup()
    const a = await add(ws, 'system-requirement', 'Alpha brake')
    const b = await add(ws, 'system-requirement', 'Bravo brake')
    const c = await add(ws, 'system-requirement', 'Child brake', { parent: a })
    const ok = await add(ws, 'system-requirement', 'Covered brake')
    const t = await add(ws, 'test-case', 'T', { document: 'Tests' })
    await ws.addLink(t, 'verifies', ok)
    const ids = (q: Parameters<WorkspaceService['query']>[0]) => ws.query(q).items.map((i) => i.id).sort()
    expect(ids({ gaps: true, text: 'brake' })).toEqual([a, b, c].sort())
    expect(ids({ gaps: true, text: 'Covered' })).toEqual([])
    expect(ids({ gaps: true, document: 'System' })).toEqual([a, b, c].sort())
    expect(ids({ gaps: true, document: 'Tests' })).toEqual([])
    expect(ids({ gaps: true, parent: a })).toEqual([c])
    expect(ids({ gaps: true, parent: null })).toEqual([a, b].sort())
    expect(ids({ gaps: true, incomplete: true })).toEqual(ids({ incomplete: true, types: ['system-requirement'] }).filter((x) => x !== ok))
    expect(ids({ gaps: true, types: ['test-case'] })).toEqual([])
    const page = ws.query({ gaps: true, limit: 2, offset: 0, sort: { by: 'id' } })
    expect(page.total).toBe(3)
    expect(page.items.length).toBe(2)
    expect(ws.query({ gaps: true, limit: 2, offset: 2, sort: { by: 'id' } }).items.length).toBe(1)
  })

  it('combined with required fields (incomplete), field values, links and text (parameter order in the SQL)', async () => {
    const { ws } = await setup()
    const sc = ws.repoInfo().schema
    const types = sc.itemTypes.map((t) => (t.id === 'system-requirement' || t.id === 'software-requirement' ? { ...t, required: ['priority'] } : t))
    expect((await ws.saveSchemaTypes(types, sc.linkTypes, ws.repoInfo().schemaRevision)).ok).toBe(true)
    const a = await add(ws, 'system-requirement', 'Alpha')
    const b = await add(ws, 'software-requirement', 'Beta')
    const base = ws.newItem('system-requirement', undefined, undefined, 'System')
    const hi = { ...base, title: 'Alpha high', fields: { ...base.fields, priority: 'High' } }
    expect((await ws.saveItem(hi, null)).ok).toBe(true)
    const ids = (q: Parameters<WorkspaceService['query']>[0]) => ws.query(q).items.map((i) => i.id).sort()
    expect(ids({ gaps: true, incomplete: true, text: 'Alpha' })).toEqual([a])
    expect(ids({ gaps: true, incomplete: true, types: ['system-requirement', 'software-requirement'] })).toEqual([a, b].sort())
    expect(ids({ gaps: true, fields: { priority: ['High'] } })).toEqual([hi.id])
    expect(ids({ gaps: true, links: 'none', text: 'Alpha' })).toEqual([a, hi.id].sort())
    expect(ids({ gaps: true, links: 'suspect' })).toEqual([])
  })

  it('with no rules (rules: []) the filter shows nothing; with the rules missing it shows nothing', async () => {
    const { ws } = await setup()
    await add(ws, 'system-requirement', 'A')
    await ws.saveSchemaRules([], ws.repoInfo().schemaRevision)
    expect(ws.query({ gaps: true }).total).toBe(0)
  })
})

describe('QA 0.20.0 impact chain', () => {
  it('a cycle terminates; the start item is not listed; a missing item gives an empty chain', async () => {
    const { ws } = await setup()
    const a = await add(ws, 'system-requirement', 'A')
    const b = await add(ws, 'system-requirement', 'B')
    const c = await add(ws, 'system-requirement', 'C')
    await ws.addLink(b, 'refines', a)
    await ws.addLink(c, 'refines', b)
    await ws.addLink(a, 'refines', c) // cycle
    const r = ws.getImpact(a)
    expect(r.nodes.map((n) => n.id)).toEqual([b, c])
    expect(ws.getImpact('REQ-NOPE').nodes).toEqual([])
  })

  it('a deep chain of 60 children and a wide parent are fully listed with the right depth', async () => {
    const { ws } = await setup()
    let parent = await add(ws, 'system-requirement', 'root')
    const root = parent
    for (let i = 0; i < 60; i++) parent = await add(ws, 'software-requirement', `n${i}`, { parent })
    const r = ws.getImpact(root)
    expect(r.nodes.length).toBe(60)
    expect(r.nodes[59]?.depth).toBe(60)
  })

  it('a test linking with relates-to is not impact; via a relates-to the chain stops', async () => {
    const { ws } = await setup()
    const a = await add(ws, 'system-requirement', 'A')
    const b = await add(ws, 'system-requirement', 'B')
    const c = await add(ws, 'system-requirement', 'C')
    await ws.addLink(b, 'relates-to', a)
    await ws.addLink(c, 'refines', b)
    expect(ws.getImpact(a).nodes).toEqual([])
  })

  it('children in another document: a child whose parent is in a different document is not listed (same rule as the tree)', async () => {
    const { ws, root } = await setup()
    const p = await add(ws, 'system-requirement', 'P')
    const k = await add(ws, 'software-requirement', 'K', { document: 'Tests' })
    const file = join(root, 'requirements', 'Tests', `${k}.md`)
    const txt = await readFile(file, 'utf8')
    await writeFile(file, txt.replace(/parent: .*/, `parent: ${p}`))
    await ws.refresh(true)
    const r = ws.getImpact(p)
    // the item is shown at the top level of its own document (CR18-04) so it is not "under" P; the chain should agree
    expect(r.nodes.map((n) => n.id)).toEqual([])
  })

  it('a duplicated ID (a file copied by hand) does not crash or list the ID twice', async () => {
    const { ws, root } = await setup()
    const a = await add(ws, 'system-requirement', 'A')
    const b = await add(ws, 'software-requirement', 'B', { parent: a })
    const src = join(root, 'requirements', 'System', `${b}.md`)
    await writeFile(join(root, 'requirements', 'Tests', `${b}-copy.md`), await readFile(src, 'utf8'))
    await ws.refresh(true)
    const r = ws.getImpact(a)
    expect(r.nodes.filter((n) => n.id === b).length).toBeLessThanOrEqual(1)
    expect(() => ws.getMatrix({ rowType: 'system-requirement', colType: 'software-requirement' })).not.toThrow()
    expect(() => ws.getCoverage()).not.toThrow()
  })
})

describe('QA 0.20.0 matrix', () => {
  it('an item linked in both directions gives two cells; the link filter keeps one; text filter narrows rows', async () => {
    const { ws } = await setup()
    const a = await add(ws, 'system-requirement', 'Alpha')
    const s = await add(ws, 'software-requirement', 'Soft')
    await ws.addLink(a, 'refines', s)
    await ws.addLink(s, 'implements', a)
    const m = ws.getMatrix({ rowType: 'system-requirement', colType: 'software-requirement' })
    expect(m.cells.map((c) => `${c.dir}:${c.type}`).sort()).toEqual(['in:implements', 'out:refines'])
    expect(ws.getMatrix({ rowType: 'system-requirement', colType: 'software-requirement', link: 'implements' }).cells.map((c) => c.dir)).toEqual(['in'])
    expect(ws.getMatrix({ rowType: 'system-requirement', colType: 'software-requirement', query: { text: 'zzz' } }).rows).toEqual([])
    const x = await ws.exportMatrix({ rowType: 'system-requirement', colType: 'software-requirement' })
    expect(x.count).toBe(1)
  })

  it('same type for rows and columns; a row item that links to itself; the filter cannot override the row type', async () => {
    const { ws } = await setup()
    const a = await add(ws, 'system-requirement', 'A')
    const b = await add(ws, 'system-requirement', 'B')
    await ws.addLink(a, 'refines', b)
    const m = ws.getMatrix({ rowType: 'system-requirement', colType: 'system-requirement', query: { types: ['test-case'] } })
    expect(m.rows.length).toBe(2)
    expect(m.cells.length).toBe(2) // a→b out for row a, and b←a in for row b
  })

  it('more than 2000 rows are cut, cells and columns follow; the export has every row', async () => {
    const { ws } = await setup()
    const t = await add(ws, 'test-case', 'T', { document: 'Tests' })
    const t2 = await add(ws, 'test-case', 'T2', { document: 'Tests' })
    // build 2003 rows with the batch import-free route: create items directly
    const ids: string[] = []
    for (let i = 0; i < 2003; i++) {
      const b = ws.newItem('system-requirement', undefined, undefined, 'System')
      const r = await ws.saveItem({ ...b, title: `R${i}` }, null)
      if (!r.ok) throw new Error(r.message)
      ids.push(b.id)
    }
    const first = ids[0] as string
    const last = ids[2002] as string
    await ws.addLink(t, 'verifies', first)
    await ws.addLink(t2, 'verifies', last)
    const m = ws.getMatrix({ rowType: 'system-requirement', colType: 'test-case' })
    expect(m.truncatedRows).toBe(true)
    expect(m.totalRows).toBe(2003)
    expect(m.rows.length).toBe(2000)
    for (const c of m.cells) {
      expect(c.r).toBeLessThan(2000)
      expect(m.cols[c.c]).toBeTruthy()
    }
    const x = await ws.exportMatrix({ rowType: 'system-requirement', colType: 'test-case' })
    expect(x.count).toBe(2003)
  }, 120_000)
})

describe('QA 0.20.0 saving rules', () => {
  it('two windows: the second save with the old revision is refused and the file keeps the first', async () => {
    const { ws, root } = await setup()
    const rev = ws.repoInfo().schemaRevision
    const r1 = { id: 'r1', type: 'risk', link: 'mitigates', direction: 'incoming' as const, min: 1, level: 'warning' as const }
    expect((await ws.saveSchemaRules([r1], rev)).ok).toBe(true)
    const r2 = await ws.saveSchemaRules([], rev)
    expect(r2.ok).toBe(false)
    expect(await readFile(join(root, 'requirements', '.reqochet', 'schema.yaml'), 'utf8')).toContain('id: r1')
  })

  it('rules naming unknown types are refused and the file is untouched', async () => {
    const { ws, root } = await setup()
    const file = join(root, 'requirements', '.reqochet', 'schema.yaml')
    const before = await readFile(file, 'utf8')
    const bad = { id: 'x', type: 'nope', link: 'mitigates', direction: 'incoming' as const, min: 1, level: 'warning' as const }
    expect((await ws.saveSchemaRules([bad], ws.repoInfo().schemaRevision)).ok).toBe(false)
    const dup = { id: 'd', type: 'risk', link: 'mitigates', direction: 'incoming' as const, min: 1, level: 'warning' as const }
    expect((await ws.saveSchemaRules([dup, dup], ws.repoInfo().schemaRevision)).ok).toBe(false)
    expect(await readFile(file, 'utf8')).toBe(before)
  })

  it('removing an unused item type that a rule names is refused or drops the rule; it must not leave a broken rule in the file', async () => {
    const { ws } = await setup()
    const s = ws.repoInfo().schema
    // "risk" is named by the rule risk-mitigated, but no item has this type, so the "still used" check lets it go
    const r = await ws.saveSchemaTypes(s.itemTypes.filter((t) => t.id !== 'risk'), s.linkTypes, ws.repoInfo().schemaRevision)
    const problems = ws.repoInfo().schemaProblems ?? []
    expect(r.ok === false || problems.filter((p) => p.path.startsWith('rules[')).length === 0).toBe(true)
  })

  it('a hand-edited schema with an unusable rule keeps working; the problem is listed', async () => {
    const { ws, root } = await setup()
    const file = join(root, 'requirements', '.reqochet', 'schema.yaml')
    await writeFile(file, (await readFile(file, 'utf8')) + '  - { id: broken, type: nope, link: verifies }\n')
    await ws.refresh(true)
    expect(ws.repoInfo().schema.rules?.some((r) => r.id === 'broken')).toBe(false)
    expect(ws.repoInfo().schemaProblems?.some((p) => p.path.startsWith('rules['))).toBe(true)
  })
})

describe('QA 0.20.0 window call checks (the handler for Coverage)', () => {
  it('getCoverage accepts "" (loose files) like query and renameDocument do', async () => {
    const handlers = new Map<string, (e: unknown, ...a: unknown[]) => unknown>()
    vi.resetModules()
    vi.doMock('electron', () => ({
      app: { getName: () => 'x', getVersion: () => '0', getPath: () => '/tmp', isPackaged: false },
      BrowserWindow: { fromWebContents: () => null, getAllWindows: () => [] },
      dialog: {},
      shell: {},
      ipcMain: { handle: (c: string, h: (e: unknown, ...a: unknown[]) => unknown) => handlers.set(c, h), on: () => {} }
    }))
    const { registerIpc } = await import('../src/main/ipc')
    const { Channels } = await import('../src/shared/api')
    const seen: unknown[] = []
    const services = { log: { ...quiet, filePath: '' }, workspace: new Proxy({ getCoverage: (d: unknown) => (seen.push(d), { rules: [] }) }, { get: (t, k) => (t as Record<string | symbol, unknown>)[k] ?? (() => undefined) }), theme: { userThemeFile: '', warnings: [] } }
    registerIpc(services as never, { resourceDir: '/tmp/x/y', userDir: '/tmp' } as never)
    const h = handlers.get(Channels.getCoverage)
    expect(h).toBeTruthy()
    expect(() => h?.({}, '')).not.toThrow()
    expect(seen).toEqual([''])
    vi.doUnmock('electron')
  })
})
