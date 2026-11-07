// QA 0.17.0 — Types window rules (S-04), required fields (S-05) and the incomplete filter with documents and other
// filters. `it.fails` marks a defect found (see the report).
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { createWorkspace, type WorkspaceService } from '../src/modules/workspace'
import type { ItemTypeDef } from '../src/shared/domain'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }

async function setup(first = 'Spec'): Promise<{ ws: WorkspaceService; root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'rq-qa17t-'))
  const userDir = await mkdtemp(join(tmpdir(), 'rq-qa17t-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: () => createSqliteIndexCache(join(userDir, 'index.sqlite')),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
  await ws.initialize(root, first)
  return { ws, root }
}
const schemaFile = (root: string): string => join(root, 'requirements', '.reqochet', 'schema.yaml')
const requireOn = async (ws: WorkspaceService, root: string, typeId: string, required: string[]): Promise<void> => {
  const info = await ws.refresh(false)
  const types = info.schema.itemTypes.map((t) => (t.id === typeId ? { ...t, required } : t))
  const r = await ws.saveSchemaTypes(types, info.schema.linkTypes, info.schemaRevision)
  if (!r.ok) throw new Error(r.message)
  void root
}
const add = async (ws: WorkspaceService, title: string, o: { type?: string; document?: string; text?: string; fields?: Record<string, unknown> } = {}): Promise<string> => {
  const it = { ...ws.newItem(o.type ?? 'system-requirement', undefined, undefined, o.document), title, text: o.text ?? '', fields: (o.fields ?? {}) as never }
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}

describe('QA: Types window, core rules', () => {
  it('duplicate item type ids are refused and the file stays valid', async () => {
    const { ws, root } = await setup()
    const info = await ws.refresh(false)
    const before = await readFile(schemaFile(root), 'utf8')
    const dup = [...info.schema.itemTypes, { id: 'risk', name: 'Risk again', requirement: true }]
    const r = await ws.saveSchemaTypes(dup, info.schema.linkTypes, info.schemaRevision)
    const after = await readFile(schemaFile(root), 'utf8')
    if (!r.ok) expect(after).toBe(before)
    else {
      // accepted: the file must still parse without problems and not contain YAML aliases
      expect(after).not.toMatch(/&a\d|\*a\d/)
      expect((await ws.refresh(false)).schemaProblems).toEqual([])
    }
  })

  it('duplicate link type ids are refused and the file stays valid', async () => {
    const { ws, root } = await setup()
    const info = await ws.refresh(false)
    const r = await ws.saveSchemaTypes(info.schema.itemTypes, [...info.schema.linkTypes, { id: 'refines', name: 'x', reverseName: 'y' }], info.schemaRevision)
    const after = await readFile(schemaFile(root), 'utf8')
    if (r.ok) expect(after).not.toMatch(/&a\d|\*a\d/)
    expect((await ws.refresh(false)).schemaProblems).toEqual([])
  })

  it('a link type used by a link cannot be removed', async () => {
    const { ws } = await setup()
    const a = await add(ws, 'a')
    const b = await add(ws, 'b')
    const link = await ws.addLink(a, 'satisfies', b)
    expect((link as { ok?: boolean }).ok).not.toBe(false)
    const info = await ws.refresh(false)
    const r = await ws.saveSchemaTypes(info.schema.itemTypes, info.schema.linkTypes.filter((l) => l.id !== 'satisfies'), info.schemaRevision)
    expect(r.ok).toBe(false)
  })

  it('removing all item types is refused; a stale revision is a conflict, not an overwrite', async () => {
    const { ws, root } = await setup()
    const info = await ws.refresh(false)
    expect((await ws.saveSchemaTypes([], info.schema.linkTypes, info.schemaRevision)).ok).toBe(false)
    await writeFile(schemaFile(root), (await readFile(schemaFile(root), 'utf8')) + '\n# changed outside\n')
    const r = await ws.saveSchemaTypes(info.schema.itemTypes, info.schema.linkTypes, info.schemaRevision)
    expect(r.ok).toBe(false)
    expect(await readFile(schemaFile(root), 'utf8')).toContain('# changed outside')
  })

  it('a required field that does not exist is refused', async () => {
    const { ws } = await setup()
    const info = await ws.refresh(false)
    const types = info.schema.itemTypes.map((t) => (t.id === 'risk' ? { ...t, required: ['nonexistent'] } : t))
    expect((await ws.saveSchemaTypes(types, info.schema.linkTypes, info.schemaRevision)).ok).toBe(false)
  })

  it('required title and text can be set and are written', async () => {
    const { ws, root } = await setup()
    await requireOn(ws, root, 'risk', ['title', 'text'])
    expect(await readFile(schemaFile(root), 'utf8')).toMatch(/required:[\s\S]{0,40}title[\s\S]{0,20}text/)
  })

  it('a type id with odd characters is refused by the core (not only by the window)', async () => {
    const { ws } = await setup()
    const info = await ws.refresh(false)
    for (const id of ['Bad Id', 'a: b', 'x\ny', '', '-x', 'ä']) {
      const r = await ws.saveSchemaTypes([...info.schema.itemTypes, { id, name: 'N', requirement: true }], info.schema.linkTypes, info.schemaRevision).catch(() => ({ ok: false }))
      expect(r.ok, JSON.stringify(id)).toBe(false)
    }
  })

  // The Fields window drops a field that a type still requires: the schema then has a problem in itemTypes and the
  // requirement is silently ignored (the check only looks at problems under "fields").
  it.fails('DEFECT QA-06: removing a field that an item type requires is refused (or the requirement is removed with it)', async () => {
    const { ws, root } = await setup()
    await requireOn(ws, root, 'risk', ['priority'])
    const info = await ws.refresh(false)
    const r = await ws.saveSchemaFields(info.schema.fields.filter((f) => f.id !== 'priority'), info.schemaRevision)
    const after = await ws.refresh(false)
    expect(r.ok === false || after.schemaProblems.length === 0).toBe(true)
  })

  it('renaming a type keeps its items valid (the name is a label, the id stays)', async () => {
    const { ws } = await setup()
    const id = await add(ws, 'r', { type: 'risk' })
    const info = await ws.refresh(false)
    const types = info.schema.itemTypes.map((t) => (t.id === 'risk' ? { ...t, name: 'نوع جديد' } : t))
    const r = await ws.saveSchemaTypes(types, info.schema.linkTypes, info.schemaRevision)
    expect(r.ok).toBe(true)
    expect((await ws.getItem(id))?.issues.filter((i) => i.severity === 'error')).toEqual([])
  })

  it('a type name with YAML-special text round-trips', async () => {
    const { ws } = await setup()
    const info = await ws.refresh(false)
    const names = ['a: b', '- x', '"quoted"', '#hash', 'null', 'yes', '12', 'multi\nline']
    for (const name of names) {
      const cur = await ws.refresh(false)
      const types = [...cur.schema.itemTypes.filter((t) => t.id !== 'qa-t'), { id: 'qa-t', name, requirement: true } as ItemTypeDef]
      const r = await ws.saveSchemaTypes(types, cur.schema.linkTypes, cur.schemaRevision)
      expect(r.ok, name).toBe(true)
      if (r.ok) expect(r.info.schema.itemTypes.find((t) => t.id === 'qa-t')?.name, name).toBe(name)
    }
    void info
  })
})

describe('QA: required fields and the incomplete filter', () => {
  it('title and text required: whitespace-only values count as missing', async () => {
    const { ws, root } = await setup()
    await requireOn(ws, root, 'risk', ['title', 'text'])
    const a = await add(ws, 'has title', { type: 'risk', text: '   ' })
    const b = await add(ws, 'complete', { type: 'risk', text: 'body' })
    const found = ws.query({ incomplete: true }).items.map((i) => i.id)
    expect(found).toContain(a)
    expect(found).not.toContain(b)
    expect((await ws.getItem(a))?.issues.filter((i) => i.path === 'required')).toHaveLength(1)
  })

  // item window and index must agree: the item check trims every kind of white space, SQLite trim() only spaces
  it.fails('DEFECT QA-07: a text of only a tab or line break is "missing" in the filter as it is in the item check', async () => {
    const { ws, root } = await setup()
    await requireOn(ws, root, 'risk', ['text'])
    const a = await add(ws, 'tabby', { type: 'risk' })
    const file = join(root, 'requirements', 'Spec', `${a}.md`)
    const raw = await readFile(file, 'utf8')
    await writeFile(file, raw.replace(/---\n$/, '---\n\n\t \n'))
    await ws.refresh(true)
    const d = await ws.getItem(a)
    const flagged = (d?.issues.filter((i) => i.path === 'required').length ?? 0) > 0
    const inFilter = ws.query({ incomplete: true }).items.some((i) => i.id === a)
    expect(inFilter).toBe(flagged)
  })

  it('several required fields on several types: each type only checks its own, every combination is found', async () => {
    const { ws, root } = await setup()
    await requireOn(ws, root, 'risk', ['priority', 'owner'])
    await requireOn(ws, root, 'system-requirement', ['text', 'priority', 'title'])
    const r1 = await add(ws, 'risk none', { type: 'risk' })
    const r2 = await add(ws, 'risk owner only', { type: 'risk', fields: { owner: 'me' } })
    const r3 = await add(ws, 'risk full', { type: 'risk', fields: { owner: 'me', priority: 'High' } })
    const s1 = await add(ws, 'sys no text', { fields: { priority: 'Low' } })
    const s2 = await add(ws, 'sys full', { text: 't', fields: { priority: 'Low' } })
    const s3 = await add(ws, 'sys no prio', { text: 't' })
    const t1 = await add(ws, 'test unaffected', { type: 'test-case' })
    const got = new Set(ws.query({ incomplete: true }).items.map((i) => i.id))
    expect([r1, r2, s1, s3].every((id) => got.has(id))).toBe(true)
    expect([r3, s2, t1].some((id) => got.has(id))).toBe(false)
  })

  it('incomplete combined with document, type, status field filter, search, links and parent', async () => {
    const { ws, root } = await setup('A')
    await ws.createDocument('B')
    await requireOn(ws, root, 'system-requirement', ['priority'])
    const a1 = await add(ws, 'alpha no prio', { document: 'A' })
    const b1 = await add(ws, 'alpha b no prio', { document: 'B', fields: { status: 'Draft' } })
    await add(ws, 'alpha prio', { document: 'A', fields: { priority: 'High' } })
    const q = (x: object): string[] => ws.query({ incomplete: true, ...x }).items.map((i) => i.id).sort()
    expect(q({})).toEqual([a1, b1].sort())
    expect(q({ document: 'A' })).toEqual([a1])
    expect(q({ document: 'B' })).toEqual([b1])
    expect(q({ document: 'A', types: ['risk'] })).toEqual([])
    expect(q({ types: ['system-requirement'], text: 'alpha b' })).toEqual([b1])
    expect(q({ fields: { status: ['Draft'] }, document: 'B' })).toEqual([b1])
    expect(q({ fields: { status: ['Approved'] } })).toEqual([])
    expect(q({ links: 'none', document: 'A' })).toEqual([a1])
    expect(q({ parent: null, document: 'A' })).toEqual([a1])
    expect(ws.query({ incomplete: true, document: 'A', sort: { by: 'number' }, limit: 1 }).total).toBe(1)
  })

  it('incomplete with no required fields anywhere finds nothing; a nonexistent document finds nothing', async () => {
    const { ws } = await setup()
    await add(ws, 'x')
    expect(ws.query({ incomplete: true }).total).toBe(0)
    expect(ws.query({ document: 'Nope' }).total).toBe(0)
    expect(ws.query({ incomplete: true, document: '' }).total).toBe(0)
  })

  it('incomplete: the total counts all matches although the page is limited; paging works', async () => {
    const { ws, root } = await setup()
    await requireOn(ws, root, 'system-requirement', ['priority'])
    for (let i = 0; i < 7; i++) await add(ws, `n${i}`)
    const p = ws.query({ incomplete: true, limit: 3, offset: 6, sort: { by: 'id' } })
    expect(p.total).toBe(7)
    expect(p.items).toHaveLength(1)
  })

  it('a required list field (tags) counts as missing when empty and present when filled', async () => {
    const { ws, root } = await setup()
    await requireOn(ws, root, 'risk', ['tags'])
    const a = await add(ws, 'no tags', { type: 'risk' })
    const b = await add(ws, 'tags', { type: 'risk', fields: { tags: ['x'] } })
    const got = ws.query({ incomplete: true }).items.map((i) => i.id)
    expect(got).toContain(a)
    expect(got).not.toContain(b)
    expect((await ws.getItem(b))?.issues.some((i) => i.path === 'required')).toBe(false)
  })

  it('an item of a removed required rule becomes complete again (schema change is picked up without a rebuild)', async () => {
    const { ws, root } = await setup()
    await requireOn(ws, root, 'risk', ['priority'])
    await add(ws, 'r', { type: 'risk' })
    expect(ws.query({ incomplete: true }).total).toBe(1)
    await requireOn(ws, root, 'risk', [])
    expect(ws.query({ incomplete: true }).total).toBe(0)
  })

  it('the window cannot make the filter see another rule: a required map sent with the query is ignored', async () => {
    const { ws } = await setup()
    await add(ws, 'x')
    const v = await import('../src/main/validate')
    const q = v.query({ incomplete: true, required: { 'system-requirement': ['title'] } }) as Parameters<WorkspaceService['query']>[0]
    expect(ws.query(q).total).toBe(0)
  })
})
