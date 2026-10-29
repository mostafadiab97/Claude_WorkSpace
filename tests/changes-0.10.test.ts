// 0.10.0 Changes view, core side: take back one part of an uncommitted change (O-05), keep / unlink suspect
// links (O-04), uncommitted changes before the first commit, and a renamed file listed as a change.
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rename } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quietLog = { info: () => {}, warn: () => {}, error: () => {} }
const sh = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' })

async function setup(): Promise<{ ws: WorkspaceService; root: string }> {
  const base = await mkdtemp(join(tmpdir(), 'reqman-chg-'))
  const root = join(base, 'repo')
  sh(base, 'init', '-q', '-b', 'main', root)
  sh(root, 'config', 'user.name', 'Tester')
  sh(root, 'config', 'user.email', 'tester@example.com')
  const userDir = await mkdtemp(join(tmpdir(), 'reqman-chg-user-'))
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

async function add(ws: WorkspaceService, title: string, extra: Record<string, unknown> = {}, type = 'system-requirement'): Promise<string> {
  const it = { ...ws.newItem(type), title, ...extra }
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}
async function edit(ws: WorkspaceService, id: string, change: (i: Awaited<ReturnType<WorkspaceService['getItem']>> & object) => void): Promise<void> {
  const d = await ws.getItem(id)
  if (!d) throw new Error(`no ${id}`)
  change(d)
  const r = await ws.saveItem(d.item, d.revision)
  if (!r.ok) throw new Error(r.message)
}

describe('take back one part of an uncommitted change (O-05)', () => {
  it('field, text, position and links go back one at a time; the other changes stay', async () => {
    const { ws } = await setup()
    const chapter = await add(ws, 'Chapter', {}, 'information')
    const other = await add(ws, 'Other')
    const id = await add(ws, 'Accuracy', { text: 'Line one\nLine two\n', fields: { status: 'Draft', priority: 'High' } })
    expect((await ws.addLink(id, 'refines', other)).ok).toBe(true)
    expect((await ws.commit('start')).ok).toBe(true)

    await edit(ws, id, (d) => {
      d.item.title = 'Accuracy of the sensor'
      d.item.fields = { ...d.item.fields, status: 'Approved' }
      d.item.text = 'Line one\nLine 2 changed\n'
      d.item.parent = chapter
      d.item.links = [{ type: 'verifies', target: chapter }]
    })
    const head = (await ws.compareOptions()).head as string
    const entry = async () => (await ws.compareVersions(head, 'WORKING')).entries.find((e) => e.id === id)
    expect((await entry())?.diff.rows.map((r) => r.key).sort()).toEqual(['field:status', 'parent', 'title'].sort())

    expect(await ws.revertChange(id, { kind: 'row', key: 'field:status' })).toEqual({ ok: true })
    let now = (await ws.getItem(id))!.item
    expect(now.fields.status).toBe('Draft')
    expect(now.title).toBe('Accuracy of the sensor') // untouched

    expect((await ws.revertChange(id, { kind: 'row', key: 'parent' })).ok).toBe(true)
    expect((await ws.revertChange(id, { kind: 'text' })).ok).toBe(true)
    expect((await ws.revertChange(id, { kind: 'link', type: 'verifies', target: chapter })).ok).toBe(true) // added → removed
    expect((await ws.revertChange(id, { kind: 'link', type: 'refines', target: other })).ok).toBe(true) // removed → back
    now = (await ws.getItem(id))!.item
    expect(now.parent).toBeUndefined()
    expect(now.text).toBe('Line one\nLine two')
    expect(now.links.map((l) => `${l.type} ${l.target}`)).toEqual([`refines ${other}`])
    expect(now.links[0]?.confirmed).toBeTruthy() // as it was committed

    // taking back the last difference leaves nothing to show
    expect((await ws.revertChange(id, { kind: 'row', key: 'title' })).ok).toBe(true)
    expect(await entry()).toBeUndefined()
    const again = await ws.revertChange(id, { kind: 'row', key: 'title' })
    expect(again.ok).toBe(false)
  })

  it('a new item cannot be taken back in parts (Discard deletes it)', async () => {
    const { ws } = await setup()
    await add(ws, 'First')
    expect((await ws.commit('start')).ok).toBe(true)
    const id = await add(ws, 'New one')
    const r = await ws.revertChange(id, { kind: 'row', key: 'title' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/Discard/)
  })
})

describe('keep or unlink suspect links (O-04)', () => {
  it('keeps some links (confirmed against the new text) and removes others, one write per source', async () => {
    const { ws } = await setup()
    const target = await add(ws, 'Target', { text: 'old' })
    const a = await add(ws, 'Test A', {}, 'test-case')
    const b = await add(ws, 'Test B', {}, 'test-case')
    for (const src of [a, b]) expect((await ws.addLink(src, 'verifies', target)).ok).toBe(true)
    await edit(ws, target, (d) => {
      d.item.text = 'new'
    })
    expect((await ws.getItem(target))!.incoming.map((l) => l.suspect)).toEqual([true, true])
    const r = await ws.decideLinks([
      { source: a, type: 'verifies', target, keep: true },
      { source: b, type: 'verifies', target, keep: false }
    ])
    expect(r).toEqual({ ok: true, kept: 1, unlinked: 1 })
    const incoming = (await ws.getItem(target))!.incoming
    expect(incoming.map((l) => [l.id, l.suspect])).toEqual([[a, false]])
    expect((await ws.getItem(b))!.item.links).toEqual([])
  })
})

describe('Changes view data', () => {
  it('lists uncommitted items before the first commit', async () => {
    const { ws } = await setup()
    const id = await add(ws, 'Very first')
    expect((await ws.compareOptions()).head).toBeNull()
    const c = await ws.compareVersions('EMPTY', 'WORKING')
    expect(c.from.ref).toBe('EMPTY')
    expect(c.entries.map((e) => [e.id, e.kind, e.numberAfter])).toEqual([[id, 'added', '1']])
    expect(c.entries[0]?.paths).toEqual([`requirements/items/${id}.md`])
  })

  it('lists a file renamed by hand, with both file names (to discard it)', async () => {
    const { ws, root } = await setup()
    const id = await add(ws, 'Renamed')
    expect((await ws.commit('start')).ok).toBe(true)
    const dir = join(root, 'requirements', 'items')
    await rename(join(dir, `${id}.md`), join(dir, 'BY-HAND.md'))
    await ws.refresh()
    const head = (await ws.compareOptions()).head as string
    const e = (await ws.compareVersions(head, 'WORKING')).entries
    expect(e.map((x) => [x.id, x.summary])).toEqual([[id, 'File name changed']])
    expect(e[0]?.paths.sort()).toEqual([`requirements/items/${id}.md`, 'requirements/items/BY-HAND.md'].sort())
    expect((await ws.discardChanges(e[0]!.paths)).ok).toBe(true)
    expect(await readFile(join(dir, `${id}.md`), 'utf8')).toContain('title: Renamed')
  })
})

describe('owner report on 0.10.0: "Changes (1)" while the list was empty', () => {
  it('lists an item whose only uncommitted change is a link confirmation (Keep), so it can be committed or discarded', async () => {
    const { ws } = await setup()
    const target = await add(ws, 'Target', { text: 'old' })
    const test = await add(ws, 'Test', {}, 'test-case')
    expect((await ws.addLink(test, 'verifies', target)).ok).toBe(true)
    expect((await ws.commit('start')).ok).toBe(true)
    await edit(ws, target, (d) => {
      d.item.text = 'new'
    })
    expect((await ws.decideLinks([{ source: test, type: 'verifies', target, keep: true }])).ok).toBe(true)
    expect((await ws.discardChanges([`requirements/items/${target}.md`])).ok).toBe(true)
    const st = await ws.gitState()
    expect(st.changes.map((c) => c.id)).toEqual([test])
    const head = (await ws.compareOptions()).head as string
    const e = (await ws.compareVersions(head, 'WORKING')).entries
    expect(e.map((x) => [x.id, x.summary])).toEqual([[test, 'Link review only (a link was kept or confirmed)']])
    // between two commits such a change stays hidden (nothing a reader would call a change)
  })
})
