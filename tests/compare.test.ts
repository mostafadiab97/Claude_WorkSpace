// M5 Compare: requirement-level differences between two versions (journey step 6).
import { execFileSync } from 'node:child_process'
import { mkdtemp, rename, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter, readBlobs } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { createWorkspace, type WorkspaceService } from '../src/modules/workspace'
import type { Item } from '../src/shared/domain'

const quietLog = { info: () => {}, warn: () => {}, error: () => {} }
const sh = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' })

async function pc(base: string, name: string, user: string): Promise<{ ws: WorkspaceService; root: string }> {
  const root = join(base, name)
  sh(base, 'clone', '-q', join(base, 'remote.git'), root)
  sh(root, 'config', 'user.name', user)
  sh(root, 'config', 'user.email', `${user.toLowerCase()}@example.com`)
  const userDir = await mkdtemp(join(tmpdir(), `reqman-cmp-${name}-`))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: () => createSqliteIndexCache(join(userDir, 'index.sqlite')),
    userDir,
    log: quietLog
  })
  return { ws, root }
}

const create = async (ws: WorkspaceService, type: string, title: string, opts: { parent?: string; text?: string } = {}): Promise<string> => {
  const it = ws.newItem(type, opts.parent)
  it.title = title
  it.text = opts.text ?? ''
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}
const edit = async (ws: WorkspaceService, id: string, change: (i: Item) => void): Promise<void> => {
  const d = await ws.getItem(id)
  if (!d) throw new Error(`no ${id}`)
  const item = structuredClone(d.item)
  change(item)
  const r = await ws.saveItem(item, d.revision)
  if (!r.ok) throw new Error(r.message)
}

describe('compare two versions', { timeout: 120_000 }, () => {
  it('lists added, changed, moved and deleted items, link changes, schema changes and unreadable files', async () => {
    const base = await mkdtemp(join(tmpdir(), 'reqman-cmp-'))
    sh(base, 'init', '-q', '--bare', '-b', 'main', join(base, 'remote.git'))
    const { ws, root } = await pc(base, 'a', 'Alice')
    const info = await ws.initialize(root)
    const s1 = await create(ws, 'system-requirement', 'Accuracy', { text: 'Within 0.5 °C.' })
    const s2 = await create(ws, 'system-requirement', 'Display')
    const s3 = await create(ws, 'system-requirement', 'Old requirement')
    const t1 = await create(ws, 'test-case', 'Check accuracy')
    const r1 = await create(ws, 'risk', 'Overheating')
    await ws.addLink(t1, 'verifies', s1)
    await ws.commit('Version 1')
    const v1 = sh(root, 'rev-parse', 'HEAD').trim()

    await edit(ws, s1, (i) => {
      i.text = 'Within 0.3 °C.'
      i.fields.status = 'Review'
    })
    expect(await ws.reparentItem(s2, s1)).toEqual({ ok: true })
    await ws.removeLink(t1, 'verifies', s1)
    await ws.addLink(t1, 'verifies', s2)
    const n1 = await create(ws, 'stakeholder-need', 'New need')
    const d3 = await ws.getItem(s3)
    await ws.deleteItem(s3, d3!.revision)
    await ws.saveSchemaFields([...info.schema.fields, { id: 'safety', name: 'Safety', type: 'text' }], info.schemaRevision)
    // renamed by hand (ID unchanged), and a file broken by hand
    await rename(join(root, 'requirements', 'items', `${r1}.md`), join(root, 'requirements', 'items', 'RSK-RENAMD.md'))
    await writeFile(join(root, 'requirements', 'items', 'SYS-BROKEN.md'), 'no header here\n')
    await ws.refresh()
    await ws.commit('Version 2')

    const r = await ws.compareVersions(v1, 'HEAD')
    const by = Object.fromEntries(r.entries.map((e) => [e.id, e]))
    expect(Object.keys(by).sort()).toEqual([n1, r1, s1, s2, s3, t1, 'SYS-BROKEN'].sort())
    // a file renamed by hand is listed (0.10.0: the Changes view must be able to discard it), with both names
    expect(by[r1]).toMatchObject({ kind: 'modified', summary: 'File name changed' })
    expect(by[r1]!.paths).toHaveLength(2)
    expect(by[s1]).toMatchObject({ kind: 'modified', summary: 'Text, Status', contentChanged: true })
    expect(by[s1]!.diff.text).toEqual({ before: 'Within 0.5 °C.', after: 'Within 0.3 °C.' })
    expect(by[s2]).toMatchObject({ kind: 'moved', contentChanged: false })
    // a moved item is summarised by its outline numbers before and after (O-03)
    expect(by[s2]!.summary).toMatch(/^[\d.]+ → [\d.]+$/)
    expect(by[s2]!.numberBefore).not.toBe(by[s2]!.numberAfter)
    expect(by[t1]).toMatchObject({ kind: 'modified', summary: '1 link added, 1 link removed', contentChanged: false })
    expect(by[n1]).toMatchObject({ kind: 'added', summary: 'New item', title: 'New need' })
    expect(by[s3]).toMatchObject({ kind: 'deleted', title: 'Old requirement' })
    expect(by['SYS-BROKEN']!.unreadable).toMatch(/header/)
    expect(r.links).toEqual([
      { source: t1, type: 'verifies', target: s2, change: 'added' },
      { source: t1, type: 'verifies', target: s1, change: 'removed' }
    ].sort((x, y) => x.target.localeCompare(y.target)))
    expect(r.schema).toMatchObject({ fieldsAdded: ['safety'], fieldsRemoved: [] })
    expect(r.from.label).toMatch(/^[0-9a-f]{7} Version 1 \(Alice, /)
    expect(r.to.label).toMatch(/Version 2/)

    // the same version on both sides: nothing
    expect((await ws.compareVersions('HEAD', 'HEAD')).entries).toEqual([])

    // working folder: a saved but uncommitted edit and a brand-new (untracked) item
    await edit(ws, n1, (i) => (i.title = 'New need, renamed'))
    const n2 = await create(ws, 'use-case', 'Fresh use case')
    const w = await ws.compareVersions('HEAD', 'WORKING')
    expect(w.entries.map((e) => [e.id, e.kind, e.summary])).toEqual(
      [
        [n1, 'modified', 'Title'],
        [n2, 'added', 'New item']
      ].sort((x, y) => (x[0] as string).localeCompare(y[0] as string))
    )
    expect(w.to.label).toMatch(/working folder/)
    await expect(ws.compareVersions('nope', 'HEAD')).rejects.toThrow(/not a commit/)
  })

  it('knows what the last pull brought in', async () => {
    const base = await mkdtemp(join(tmpdir(), 'reqman-cmp2-'))
    sh(base, 'init', '-q', '--bare', '-b', 'main', join(base, 'remote.git'))
    const a = await pc(base, 'a', 'Alice')
    await a.ws.initialize(a.root)
    const s1 = await create(a.ws, 'system-requirement', 'Accuracy')
    await a.ws.commit('Start')
    await a.ws.push()
    const b = await pc(base, 'b', 'Bob')
    await b.ws.open(b.root)
    expect((await b.ws.compareOptions()).lastPull).toBeNull() // only cloned so far

    await edit(a.ws, s1, (i) => (i.text = 'Alice changed it'))
    const s2 = await create(a.ws, 'system-requirement', 'Another')
    await a.ws.commit('Alice: text + new item')
    await a.ws.push()
    expect((await b.ws.pull()).ok).toBe(true)
    // Bob then commits something of his own; "last pull" still means what the pull brought in
    await create(b.ws, 'test-case', 'Bob test')
    await b.ws.commit('Bob')

    const o = await b.ws.compareOptions()
    expect(o.lastPull).not.toBeNull()
    expect(o.commits.map((c) => c.message)).toEqual(['Bob', 'Alice: text + new item', 'Start'])
    expect(o.refs.map((r) => `${r.kind}:${r.name}`)).toEqual(expect.arrayContaining(['branch:main', 'remote:origin/main']))
    const r = await b.ws.compareVersions(o.lastPull!.from, o.lastPull!.to)
    expect(r.entries.map((e) => [e.id, e.kind])).toEqual([[s1, 'modified'], [s2, 'added']].sort((x, y) => (x[0] as string).localeCompare(y[0] as string)))
  })

  it('reads many files through one git process', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'reqman-blobs-'))
    sh(dir, 'init', '-q', '-b', 'main')
    const oids: string[] = []
    for (let i = 0; i < 300; i++) {
      const n = join(dir, `f${i}.md`)
      await writeFile(n, `file ${i} — ünïcode ✓\n`.repeat((i % 5) + 1))
      oids.push(sh(dir, 'hash-object', '-w', n).trim())
    }
    const got = await readBlobs(dir, [...oids, 'f'.repeat(40)])
    expect(got.get(oids[7]!)).toBe('file 7 — ünïcode ✓\n'.repeat(3))
    expect(got.get('f'.repeat(40))).toBeNull()
    expect([...got.values()].filter((v) => v !== null)).toHaveLength(300)
  })
})
