import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quietLog = { info: () => {}, warn: () => {}, error: () => {} }

async function setup(opts: { git?: boolean } = {}): Promise<{ ws: WorkspaceService; root: string; userDir: string }> {
  const root = await mkdtemp(join(tmpdir(), 'reqman-ws-'))
  const userDir = await mkdtemp(join(tmpdir(), 'reqman-user-'))
  if (opts.git) execFileSync('git', ['init', '-q', root])
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: (r) => createSqliteIndexCache(join(userDir, 'cache', `${r.length}-${Date.now()}.sqlite`)),
    userDir,
    log: quietLog
  })
  return { ws, root, userDir }
}

describe('workspace', () => {
  it('detects Git repositories and uses the repository top folder', async () => {
    const { ws, root } = await setup({ git: true })
    const { mkdir } = await import('node:fs/promises')
    await mkdir(join(root, 'docs', 'specs'), { recursive: true })
    const check = await ws.checkFolder(join(root, 'docs', 'specs'))
    expect(check.isGitRepository).toBe(true)
    // Windows may report the same folder as a short (RUNNER~1) or long name; compare the real paths.
    expect(realpathSync.native(check.root).toLowerCase()).toBe(realpathSync.native(root).toLowerCase())
    expect(check.state).toBe('not-initialized')

    const plain = await setup()
    expect(await plain.ws.checkFolder(plain.root)).toMatchObject({ isGitRepository: false, state: 'not-initialized' })
  })

  it('runs journey steps 1–3: create the folder, add a hierarchy, filter and read items', async () => {
    const { ws, root } = await setup({ git: true })
    const info = await ws.initialize(root)
    expect(info).toMatchObject({ itemCount: 0, isGitRepository: true, issues: [] })

    const stk = ws.newItem('stakeholder-need')
    stk.title = 'Comfortable temperature'
    const s1 = await ws.saveItem(stk, null)
    expect(s1.ok).toBe(true)

    const sys = ws.newItem('system-requirement', stk.id)
    sys.title = 'Temperature accuracy'
    sys.text = 'The thermostat shall measure within ±0.5 °C.'
    const sys2 = ws.newItem('system-requirement', stk.id)
    sys2.title = 'Display readability'
    expect(sys.order).toBe(10)
    expect((await ws.saveItem(sys, null)).ok).toBe(true)
    // the second new item is created after the first is saved, so it must be numbered after it
    const sys3 = ws.newItem('system-requirement', stk.id)
    expect(sys3.order).toBe(20)
    sys2.order = 20
    await ws.saveItem(sys2, null)

    expect(ws.query({ types: ['system-requirement'] }).total).toBe(2)
    expect(ws.query({ text: 'thermostat' }).items.map((i) => i.id)).toEqual([sys.id])
    expect(ws.query({ parent: null }).items.map((i) => [i.id, i.childCount])).toEqual([[stk.id, 2]])
    expect(ws.query({ parent: stk.id, sort: { by: 'order' } }).items.map((i) => i.id)).toEqual([sys.id, sys2.id])

    const d = await ws.getItem(sys.id)
    expect(d?.item.text).toBe(sys.text)
    expect(d?.issues).toEqual([])
  })

  it('refuses saving over a file that changed outside ReqMan', async () => {
    const { ws, root } = await setup()
    await ws.initialize(root)
    const item = ws.newItem('risk')
    item.title = 'First'
    const saved = await ws.saveItem(item, null)
    if (!saved.ok) throw new Error(saved.message)

    // someone edits the file by hand (or a git pull changes it)
    const file = join(root, 'requirements', 'items', `${item.id}.md`)
    await writeFile(file, (await readFile(file, 'utf8')).replace('First', 'Edited by hand'))

    const again = await ws.saveItem({ ...item, title: 'Mine' }, saved.details.revision)
    expect(again).toMatchObject({ ok: false, reason: 'conflict' })
    expect(await readFile(file, 'utf8')).toContain('Edited by hand')

    // saving a "new" item whose ID already exists is a conflict too
    expect(await ws.saveItem(item, null)).toMatchObject({ ok: false, reason: 'conflict' })
  })

  it('validates before saving: schema values, missing parents and parent loops', async () => {
    const { ws, root } = await setup()
    await ws.initialize(root)
    const a = ws.newItem('system-requirement')
    a.title = 'A'
    const sa = await ws.saveItem(a, null)
    const b = ws.newItem('software-requirement', a.id)
    b.title = 'B'
    await ws.saveItem(b, null)
    if (!sa.ok) throw new Error()

    expect(await ws.saveItem({ ...a, fields: { status: 'Done' } }, sa.details.revision)).toMatchObject({ ok: false, reason: 'invalid' })
    expect(await ws.saveItem({ ...a, parent: 'SYS-NOPE00' }, sa.details.revision)).toMatchObject({ ok: false, reason: 'invalid' })
    const loop = await ws.saveItem({ ...a, parent: b.id }, sa.details.revision)
    expect(loop.ok).toBe(false)
    if (!loop.ok) expect(loop.message).toMatch(/one of its children/)
  })

  it('moves items up and down by swapping only two files', async () => {
    const { ws, root } = await setup()
    await ws.initialize(root)
    const ids: string[] = []
    for (const t of ['One', 'Two', 'Three']) {
      const it = ws.newItem('information')
      it.title = t
      await ws.saveItem(it, null)
      ids.push(it.id)
    }
    const order = (): string[] => ws.query({ parent: null, sort: { by: 'order' } }).items.map((i) => i.title)
    expect(order()).toEqual(['One', 'Two', 'Three'])
    expect(await ws.moveItem(ids[2]!, 'up')).toEqual({ ok: true })
    expect(order()).toEqual(['One', 'Three', 'Two'])
    expect(await ws.moveItem(ids[0]!, 'up')).toEqual({ ok: true }) // already first: no change
    expect(await ws.moveItem(ids[0]!, 'down')).toEqual({ ok: true })
    expect(order()).toEqual(['Three', 'One', 'Two'])
  })

  it('deletes only items without children, and reports links left dangling', async () => {
    const { ws, root } = await setup()
    await ws.initialize(root)
    const parent = ws.newItem('system-requirement')
    parent.title = 'P'
    const sp = await ws.saveItem(parent, null)
    const child = ws.newItem('software-requirement', parent.id)
    child.title = 'C'
    const sc = await ws.saveItem(child, null)
    const test = ws.newItem('test-case')
    test.title = 'T'
    test.links = [{ type: 'verifies', target: child.id }]
    await ws.saveItem(test, null)
    if (!sp.ok || !sc.ok) throw new Error()

    expect((await ws.getItem(child.id))?.incoming).toEqual([{ id: test.id, type: 'verifies' }])
    expect(await ws.deleteItem(parent.id, sp.details.revision)).toMatchObject({ ok: false })
    expect(await ws.deleteItem(child.id, sc.details.revision)).toEqual({ ok: true })
    expect((await ws.refresh()).issues.map((i) => i.message)).toEqual([`"verifies" link to ${child.id}, which does not exist.`])
  })

  it('remembers recently opened repositories, newest first, and picks up outside changes on refresh', async () => {
    const { ws, root, userDir } = await setup()
    await ws.initialize(root)
    const other = await mkdtemp(join(tmpdir(), 'reqman-ws-other-'))
    await ws.initialize(other)
    await ws.open(root)
    expect((await ws.recent()).map((r) => r.root)).toEqual([root, other])
    await ws.forgetRecent(other)
    expect((await ws.recent()).map((r) => r.root)).toEqual([root])
    expect(JSON.parse(await readFile(join(userDir, 'recent-repositories.json'), 'utf8'))).toHaveLength(1)

    await writeFile(
      join(root, 'requirements', 'items', 'RSK-HAND01.md'),
      '---\nid: RSK-HAND01\ntype: risk\ntitle: Written by hand\n---\n'
    )
    const info = await ws.refresh()
    expect(info.itemCount).toBe(1)
    expect(info.lastSync.changedFiles).toBe(1)
  })
  it('moves a whole sub-group to a new parent or to the top level, refusing loops', async () => {
    const { ws, root } = await setup()
    await ws.initialize(root)
    const save = async (type: string, title: string, parent?: string): Promise<string> => {
      const it = ws.newItem(type, parent)
      it.title = title
      expect((await ws.saveItem(it, null)).ok).toBe(true)
      return it.id
    }
    const a = await save('stakeholder-need', 'A')
    const b = await save('stakeholder-need', 'B')
    const a1 = await save('system-requirement', 'A1', a)
    const a11 = await save('software-requirement', 'A1.1', a1)

    expect(ws.ancestors(a11)).toEqual([a, a1])
    expect(ws.ancestors(a)).toEqual([])

    // a1 with its child goes under b, placed last
    expect(await ws.reparentItem(a1, b)).toEqual({ ok: true })
    expect(ws.ancestors(a11)).toEqual([b, a1])
    expect(ws.query({ parent: a }).total).toBe(0)

    // loops are refused: b under its own grandchild
    expect((await ws.reparentItem(b, a11)).ok).toBe(false)
    expect((await ws.reparentItem(b, b)).ok).toBe(false)

    // to top level: placed after the existing top-level items
    expect(await ws.reparentItem(a1, null)).toEqual({ ok: true })
    const top = ws.query({ parent: null, sort: { by: 'order' } }).items.map((i) => i.id)
    expect(top).toEqual([a, b, a1])
    // placed before a sibling: between a and b
    expect(await ws.reparentItem(a1, null, b)).toEqual({ ok: true })
    expect(ws.query({ parent: null, sort: { by: 'order' } }).items.map((i) => i.id)).toEqual([a, a1, b])
    // before the first one, repeatedly, until the orders run out of room and get renumbered
    for (const x of [b, a, a1, b, a]) expect(await ws.reparentItem(x, null, ws.query({ parent: null, sort: { by: 'order' } }).items[0]?.id)).toEqual({ ok: true })
    expect(ws.query({ parent: null, sort: { by: 'order' } }).items.map((i) => i.id)).toEqual([a, b, a1])
    const file = await readFile(join(root, 'requirements', 'items', `${a1}.md`), 'utf8')
    expect(file).not.toMatch(/^parent:/m)
  })

  it('saves field definitions to schema.yaml, keeping comments, and refuses stale revisions', async () => {
    const { ws, root } = await setup()
    const info = await ws.initialize(root)
    const fields = [...info.schema.fields, { id: 'safety-level', name: 'Safety level', type: 'enum' as const, options: ['QM', 'A', 'B'] }]
    const r = await ws.saveSchemaFields(fields, info.schemaRevision)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.info.schema.fields.map((f) => f.id)).toContain('safety-level')
    expect(r.info.schemaRevision).not.toBe(info.schemaRevision)
    const text = await readFile(join(root, 'requirements', '.reqman', 'schema.yaml'), 'utf8')
    expect(text).toMatch(/safety-level/)
    expect(text).toMatch(/^#/m)
    // second save with the old revision: someone else changed it meanwhile
    expect((await ws.saveSchemaFields(info.schema.fields, info.schemaRevision)).ok).toBe(false)
    // invalid definitions are refused
    expect((await ws.saveSchemaFields([{ id: 'x', name: 'X', type: 'enum' }], r.info.schemaRevision)).ok).toBe(false)
  })
})
