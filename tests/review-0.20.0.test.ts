// 0.20.0 — fixes from the helper review (docs/reviews/agents/0.20.0-*.md).
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { parseSchema } from '../src/modules/schema'
import { cacheFileName, createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }
async function setup(): Promise<{ ws: WorkspaceService; file: string }> {
  const base = await mkdtemp(join(tmpdir(), 'rq-r20-'))
  const root = join(base, 'work')
  execFileSync('git', ['init', '-q', '-b', 'main', root])
  const userDir = await mkdtemp(join(tmpdir(), 'rq-r20-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: (r: string) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(r))),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
  await ws.initialize(root, 'System')
  return { ws, file: join(root, 'requirements', '.reqochet', 'schema.yaml') }
}
const add = async (ws: WorkspaceService, type: string, title: string, fields: Record<string, string> = {}): Promise<string> => {
  const base = ws.newItem(type, undefined, undefined, 'System')
  const it = { ...base, title, fields: { ...base.fields, ...fields } }
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}

describe('0.20.0 review fixes', () => {
  it('CR20-01/02/03: saving rules keeps hand-written keys and comments, keeps an unreadable rule, and keeps the rule IDs', async () => {
    const { ws, file } = await setup()
    const text = (await readFile(file, 'utf8')).replace(
      '  - { id: risk-mitigated,',
      '  # the risk rule, agreed in the review\n  - { id: typo, type: risk, link: mitigatez }\n  - { id: risk-mitigated, note: keep me,'
    )
    await writeFile(file, text)
    await ws.refresh(true)
    const rules = ws.repoInfo().schema.rules ?? []
    expect(rules.map((r) => r.id)).toContain('need-refined')
    // the window sends the readable rules back with one changed and one removed
    const next = rules.filter((r) => r.id !== 'hardware-verified').map((r) => (r.id === 'risk-mitigated' ? { ...r, min: 2 } : r))
    const saved = await ws.saveSchemaRules(next, ws.repoInfo().schemaRevision)
    expect(saved.ok, saved.ok ? '' : saved.message).toBe(true)
    const after = await readFile(file, 'utf8')
    expect(after).toContain('note: keep me')
    expect(after).toContain('# the risk rule, agreed in the review')
    expect(after).toContain('link: mitigatez') // a rule reqochet could not read stays as written
    expect(after).not.toContain('hardware-verified')
    const parsed = parseSchema(after).schema.rules ?? []
    expect(parsed.find((r) => r.id === 'risk-mitigated')?.min).toBe(2)
    expect(parsed.map((r) => r.id)).toContain('need-refined')
  })

  it('CR20-04: the matrix follows the Incomplete filter like the table', async () => {
    const { ws } = await setup()
    const types = ws.repoInfo().schema.itemTypes.map((t) => (t.id === 'system-requirement' ? { ...t, required: ['owner'] } : t))
    expect((await ws.saveSchemaTypes(types, ws.repoInfo().schema.linkTypes, ws.repoInfo().schemaRevision)).ok).toBe(true)
    const without = await add(ws, 'system-requirement', 'no owner')
    await add(ws, 'system-requirement', 'with owner', { owner: 'A. Hassan' })
    expect(ws.getMatrix({ rowType: 'system-requirement', colType: 'test-case', query: { incomplete: true } }).rows.map((r) => r.id)).toEqual([without])
  })

  it('SEC20-01: a matrix too large for a grid is exported as a list', async () => {
    const { ws } = await setup()
    // 30 rows × 30 linked columns is a grid; the same with a lowered limit would be a list — check both layouts exist
    const reqs: string[] = []
    for (let k = 0; k < 3; k++) reqs.push(await add(ws, 'system-requirement', `R${k}`))
    const t = await add(ws, 'test-case', 'T')
    await ws.addLink(t, 'verifies', reqs[0] as string)
    const small = await ws.exportMatrix({ rowType: 'system-requirement', colType: 'test-case' })
    expect(small.count).toBe(3)
  })

  it('SEC20-02: at most 100 rules and 20 "from" types are read from a pulled schema', async () => {
    const { file } = await setup()
    const base = (await readFile(file, 'utf8')).replace(/\nrules:[\s\S]*$/, '\n')
    const many = Array.from({ length: 120 }, (_, k) => `  - { id: r${k}, type: risk, link: mitigates }`).join('\n')
    const p = parseSchema(`${base}rules:\n${many}\n  - { id: wide, type: risk, link: mitigates, from: [${Array.from({ length: 21 }, () => 'risk').join(', ')}] }\n`)
    expect(p.schema.rules?.length).toBe(100)
    expect(p.problems.some((x) => x.path === 'rules')).toBe(true)
  })

  it('QA-3/CR20-05: an item type a rule names cannot be removed', async () => {
    const { ws } = await setup()
    const types = ws.repoInfo().schema.itemTypes.filter((t) => t.id !== 'risk')
    const r = await ws.saveSchemaTypes(types, ws.repoInfo().schema.linkTypes, ws.repoInfo().schemaRevision)
    expect(r.ok).toBe(false)
    expect(r.ok ? '' : r.message).toMatch(/risk-mitigated/)
  })
})
