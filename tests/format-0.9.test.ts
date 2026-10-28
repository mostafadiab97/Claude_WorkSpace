// The 0.9.0 data format: REQ- IDs, editable type, order keys (a move writes one file), outline numbers, and
// re-spacing of long keys at push time.
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quietLog = { info: () => {}, warn: () => {}, error: () => {} }
const sh = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' })

async function setup(remote = false): Promise<{ ws: WorkspaceService; root: string }> {
  const base = await mkdtemp(join(tmpdir(), 'reqman-fmt-'))
  const root = join(base, 'repo')
  if (remote) {
    sh(base, 'init', '-q', '--bare', '-b', 'main', 'remote.git')
    sh(base, 'clone', '-q', join(base, 'remote.git'), root)
  } else sh(base, 'init', '-q', '-b', 'main', root)
  sh(root, 'config', 'user.name', 'Tester')
  sh(root, 'config', 'user.email', 'tester@example.com')
  const userDir = await mkdtemp(join(tmpdir(), 'reqman-fmt-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: () => createSqliteIndexCache(join(userDir, 'index.sqlite')),
    userDir,
    log: quietLog
  })
  await ws.initialize(root)
  return { ws, root }
}

async function add(ws: WorkspaceService, title: string, parent?: string, type = 'system-requirement'): Promise<string> {
  const it = ws.newItem(type, parent)
  it.title = title
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}
const file = (root: string, id: string): Promise<string> => readFile(join(root, 'requirements', 'items', `${id}.md`), 'utf8')

describe('0.9.0 data format', () => {
  it('gives every item a REQ- ID and lets the type change without changing the ID', async () => {
    const { ws, root } = await setup()
    const id = await add(ws, 'Accuracy')
    expect(id).toMatch(/^REQ-[0-9A-HJKMNP-TV-Z]{7}$/)
    const d = await ws.getItem(id)
    const r = await ws.saveItem({ ...d!.item, type: 'test-case' }, d!.revision)
    expect(r.ok).toBe(true)
    expect(await file(root, id)).toContain('type: test-case')
    expect((await ws.getItem(id))?.issues).toEqual([])
  })

  it('a move writes only the moved file', async () => {
    const { ws, root } = await setup()
    const ids = [await add(ws, 'A'), await add(ws, 'B'), await add(ws, 'C'), await add(ws, 'D')]
    sh(root, 'add', '-A')
    sh(root, 'commit', '-q', '-m', 'four items')
    // move D between A and B, then C to the top
    expect((await ws.reparentItem(ids[3]!, null, ids[1]!)).ok).toBe(true)
    expect((await ws.moveItem(ids[2]!, 'up')).ok).toBe(true)
    const changed = sh(root, 'status', '--porcelain').trim().split('\n')
    expect(changed).toHaveLength(2) // only D and C
    expect(ws.query({ parent: null, sort: { by: 'order' } }).items.map((i) => i.title)).toEqual(['A', 'D', 'C', 'B'])
  })

  it('reads positions written as numbers by older versions', async () => {
    const { ws, root } = await setup()
    const a = await add(ws, 'First')
    const b = await add(ws, 'Second')
    for (const [id, n] of [[a, 20], [b, 10]] as const) {
      const p = join(root, 'requirements', 'items', `${id}.md`)
      await writeFile(p, (await readFile(p, 'utf8')).replace(/order: \S+/, `order: ${n}`))
    }
    await ws.refresh()
    expect(ws.query({ parent: null, sort: { by: 'order' } }).items.map((i) => i.title)).toEqual(['Second', 'First'])
    // a move next to old numbers still writes one file
    const c = await add(ws, 'Third')
    expect((await ws.reparentItem(c, null, a)).ok).toBe(true)
    expect(ws.query({ parent: null, sort: { by: 'order' } }).items.map((i) => i.title)).toEqual(['Second', 'Third', 'First'])
    expect(await file(root, a)).toContain('order: 20')
  })

  it('calculates outline numbers everywhere and keeps them current after a move', async () => {
    const { ws } = await setup()
    const ch1 = await add(ws, 'Chapter 1', undefined, 'information')
    const ch2 = await add(ws, 'Chapter 2', undefined, 'information')
    const r1 = await add(ws, 'Req 1', ch1)
    const r2 = await add(ws, 'Req 2', ch1)
    const num = (id: string) => ws.query({ text: id }).items.find((i) => i.id === id)?.number
    expect([num(ch1), num(r1), num(r2), num(ch2)]).toEqual(['1', '1.1', '1.2', '2'])
    expect((await ws.getItem(r2))?.number).toBe('1.2')
    expect((await ws.reparentItem(r1, ch2, null)).ok).toBe(true)
    expect([num(r2), num(r1)]).toEqual(['1.1', '2.1'])
    // sorting a flat list by number = document order
    expect(ws.query({ sort: { by: 'number' } }).items.map((i) => i.number)).toEqual(['1', '1.1', '2', '2.1'])
  })

  it('Compare shows a moved item as "old number → new number"', async () => {
    const { ws } = await setup()
    const ch1 = await add(ws, 'Chapter 1', undefined, 'information')
    const ch2 = await add(ws, 'Chapter 2', undefined, 'information')
    const r = await add(ws, 'Req', ch1)
    expect((await ws.commit('start')).ok).toBe(true)
    expect((await ws.reparentItem(r, ch2, null)).ok).toBe(true)
    const head = (await ws.compareOptions()).head as string
    const c = await ws.compareVersions(head, 'WORKING')
    const e = c.entries.find((x) => x.id === r)
    expect(e).toMatchObject({ kind: 'moved', numberBefore: '1.1', numberAfter: '2.1', summary: '1.1 → 2.1' })
    expect(e?.diff.rows.find((x) => x.key === 'order')).toMatchObject({ before: '1.1', after: '2.1' })
  })

  it('at push, re-spaces long keys — only in groups this user changed, as its own commit', async () => {
    const { ws, root } = await setup(true)
    const chapter = await add(ws, 'Chapter', undefined, 'information')
    const other = await add(ws, 'Other chapter', undefined, 'information')
    const a = await add(ws, 'A', chapter)
    const b = await add(ws, 'B', chapter)
    expect((await ws.commit('start')).ok).toBe(true)
    expect((await ws.push()).ok).toBe(true)
    // many inserts into the same gap make keys long
    for (let i = 0; i < 12; i++) {
      const x = await add(ws, `X${i}`, chapter)
      const last = ws.query({ parent: chapter, sort: { by: 'order' } }).items.find((it) => it.title === 'B')
      expect((await ws.reparentItem(x, chapter, last!.id)).ok).toBe(true)
    }
    const long = ws.query({ parent: chapter, sort: { by: 'order' }, limit: 100 }).items
    expect(long.some((i) => (i.order?.length ?? 0) > 4)).toBe(true)
    const before = long.map((i) => i.title)
    expect((await ws.commit('many inserts')).ok).toBe(true)
    const p = await ws.push()
    expect(p.ok).toBe(true)
    const after = ws.query({ parent: chapter, sort: { by: 'order' }, limit: 100 }).items
    expect(after.map((i) => i.title)).toEqual(before) // same order
    expect(after.every((i) => (i.order?.length ?? 0) <= 4)).toBe(true)
    expect(sh(root, 'log', '-1', '--format=%s')).toMatch(/^Tidy positions of \d+ items/)
    expect(sh(root, 'status', '--porcelain').trim()).toBe('') // everything committed and pushed
    expect(sh(root, 'rev-list', '--count', 'origin/main..HEAD').trim()).toBe('0')
    // the other chapter was not touched
    expect((await ws.getItem(other))?.item.order).toBe('a1')
    expect([a, b].length).toBe(2)
  })
})

describe('Compare across an ID conversion', () => {
  it('pairs an item with its former ID instead of showing a deletion and an addition', async () => {
    const { ws, root } = await setup()
    const id = await add(ws, 'Old style')
    expect((await ws.commit('start')).ok).toBe(true)
    const head = (await ws.compareOptions()).head as string
    // what the conversion did: new file name and ID, old ID kept
    const { rename } = await import('node:fs/promises')
    const dir = join(root, 'requirements', 'items')
    const text = await readFile(join(dir, `${id}.md`), 'utf8')
    await rename(join(dir, `${id}.md`), join(dir, 'REQ-NEW0001.md'))
    await writeFile(join(dir, 'REQ-NEW0001.md'), text.replace(`id: ${id}`, `id: REQ-NEW0001`).replace('type: system', `former-id: ${id}\ntype: system`))
    await ws.refresh()
    const c = await ws.compareVersions(head, 'WORKING')
    expect(c.entries.map((e) => [e.id, e.kind])).toEqual([['REQ-NEW0001', 'modified']])
  })
})
