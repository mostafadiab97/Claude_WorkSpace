// 0.12.0 (M8): field-level 3-way merge, pull from any branch, duplicate-ID repair, branches, the last pull (D-05).
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { mergeItems, renameReferences, sameItem, type Item } from '../src/modules/items'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { createWorkspace, type WorkspaceService } from '../src/modules/workspace'
import type { Schema } from '../src/shared/domain'

const schema: Pick<Schema, 'fields' | 'itemTypes'> = {
  itemTypes: [
    { id: 'system-requirement', name: 'System requirement', requirement: true },
    { id: 'test-case', name: 'Test case', requirement: true }
  ],
  fields: [
    { id: 'status', name: 'Status', type: 'enum', options: ['Draft', 'Review', 'Approved'] },
    { id: 'tags', name: 'Tags', type: 'list' },
    { id: 'priority', name: 'Priority', type: 'number' }
  ]
}
const item = (over: Partial<Item> = {}): Item => ({
  id: 'REQ-AAAAAAA',
  type: 'system-requirement',
  title: 'Accuracy',
  order: 'a0',
  fields: { status: 'Draft', tags: ['a'] },
  links: [{ type: 'verifies', target: 'REQ-BBBBBBB', confirmed: 'f1' }],
  text: 'Within 0.5 °C.',
  extra: {},
  ...over
})

describe('mergeItems (field by field, base / mine / theirs)', () => {
  const base = item()
  it('takes the side that changed; both sides changing different parts is no question', () => {
    const r = mergeItems(base, item({ title: 'Accuracy (room)' }), item({ fields: { status: 'Review', tags: ['a'] }, text: 'Within 0.3 °C.' }), schema)
    expect(r.conflicts).toEqual([])
    expect(r.item).toMatchObject({ title: 'Accuracy (room)', text: 'Within 0.3 °C.', fields: { status: 'Review', tags: ['a'] } })
  })
  it('merges links and list values as sets', () => {
    const mine = item({ links: [...base.links, { type: 'refines', target: 'REQ-CCCCCCC' }], fields: { status: 'Draft', tags: ['a', 'mine'] } })
    const theirs = item({ links: [{ type: 'derives', target: 'REQ-DDDDDDD' }], fields: { status: 'Draft', tags: ['theirs'] } })
    const r = mergeItems(base, mine, theirs, schema)
    expect(r.conflicts).toEqual([])
    // they removed "verifies" and tag "a": removed; both additions kept
    expect(r.item?.links.map((l) => `${l.type} ${l.target}`)).toEqual(['refines REQ-CCCCCCC', 'derives REQ-DDDDDDD'])
    expect(r.item?.fields['tags']).toEqual(['mine', 'theirs'])
  })
  it('asks only for a part changed differently on both sides, and applies the answer', () => {
    const mine = item({ text: 'Mine', title: 'Same new title' })
    const theirs = item({ text: 'Theirs', title: 'Same new title', fields: { status: 'Approved', tags: ['a'] } })
    const r = mergeItems(base, mine, theirs, schema)
    expect(r.conflicts).toEqual([{ key: 'text', label: 'Text', base: 'Within 0.5 °C.', mine: 'Mine', theirs: 'Theirs', editable: true }])
    expect(mergeItems(base, mine, theirs, schema, { text: 'theirs' }).item).toMatchObject({ text: 'Theirs', title: 'Same new title', fields: { status: 'Approved' } })
    expect(mergeItems(base, mine, theirs, schema, { text: { edit: 'Both' } }).item?.text).toBe('Both')
  })
  it('treats parent + order as one place in the document', () => {
    const r = mergeItems(base, item({ parent: 'REQ-PPPPPPP', order: 'a1' }), item({ order: 'a5' }), schema)
    expect(r.conflicts.map((c) => [c.key, c.mine, c.theirs, c.editable])).toEqual([['position', 'Under REQ-PPPPPPP', 'At the top level', false]])
    expect(mergeItems(base, item({ parent: 'REQ-PPPPPPP', order: 'a1' }), item({ order: 'a5' }), schema, { position: 'theirs' }).item).toMatchObject({ order: 'a5' })
    expect(mergeItems(base, item({ parent: 'REQ-PPPPPPP', order: 'a1' }), item({ order: 'a5' }), schema, { position: 'theirs' }).item?.parent).toBeUndefined()
  })
  it('deleted on one side, changed on the other: a question about the whole item', () => {
    const r = mergeItems(base, null, item({ text: 'Changed' }), schema)
    expect(r.conflicts.map((c) => [c.key, c.mine, c.theirs])).toEqual([['item', 'Deleted', 'Changed']])
    expect(r.item).toBeNull()
    expect(mergeItems(base, null, item({ text: 'Changed' }), schema, { item: 'theirs' }).item?.text).toBe('Changed')
    // deleted on one side, untouched on the other: deleted
    expect(mergeItems(base, null, base, schema)).toEqual({ item: null, conflicts: [] })
  })
  it('a newer link confirmation on either side is no question; numbers typed in are numbers', () => {
    const r = mergeItems(base, item({ links: [{ ...base.links[0]!, confirmed: 'f2' }] }), item({ links: [{ ...base.links[0]!, confirmed: 'f3' }] }), schema)
    expect(r.conflicts).toEqual([])
    expect(['f2', 'f3']).toContain(r.item?.links[0]?.confirmed) // either confirmation; the Keep/Unlink window shows anything suspect
    const n = mergeItems(item({ fields: { priority: 1 } }), item({ fields: { priority: 2 } }), item({ fields: { priority: 3 } }), schema, { 'field:priority': { edit: '5' } })
    expect(n.item?.fields['priority']).toBe(5)
  })
  it('sameItem ignores key order and re-confirmations; renameReferences moves parent and link targets', () => {
    expect(sameItem(item({ fields: { tags: ['a'], status: 'Draft' } }), item())).toBe(true)
    expect(sameItem(item({ links: [{ type: 'verifies', target: 'REQ-BBBBBBB', confirmed: 'zz' }] }), item())).toBe(true)
    const moved = renameReferences(item({ parent: 'REQ-BBBBBBB' }), 'REQ-BBBBBBB', 'REQ-NNNNNNN')
    expect([moved.parent, moved.links[0]?.target]).toEqual(['REQ-NNNNNNN', 'REQ-NNNNNNN'])
  })
})

// ---------- with real Git: a bare "GitHub" repository and two clones

const quietLog = { info: () => {}, warn: () => {}, error: () => {} }
const sh = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' })

async function pc(base: string, name: string, user: string): Promise<{ ws: WorkspaceService; root: string }> {
  const root = join(base, name)
  sh(base, 'clone', '-q', join(base, 'remote.git'), root)
  sh(root, 'config', 'user.name', user)
  sh(root, 'config', 'user.email', `${user.toLowerCase()}@example.com`)
  const userDir = await mkdtemp(join(tmpdir(), `reqman-user-${name}-`))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: () => createSqliteIndexCache(join(userDir, 'index.sqlite')),
    userDir,
    log: quietLog,
    watchFiles: false
  })
  return { ws, root }
}

async function twoPcs() {
  const base = await mkdtemp(join(tmpdir(), 'reqman-m8-'))
  sh(base, 'init', '-q', '--bare', '-b', 'main', join(base, 'remote.git'))
  const a = await pc(base, 'a', 'Alice')
  await a.ws.initialize(a.root)
  const sys = await create(a.ws, 'system-requirement', 'Shared requirement', 'Start text')
  const tc = await create(a.ws, 'test-case', 'Check it')
  await a.ws.addLink(tc, 'verifies', sys)
  expect((await a.ws.commit('Start')).ok).toBe(true)
  expect((await a.ws.push()).ok).toBe(true)
  const b = await pc(base, 'b', 'Bob')
  await b.ws.open(b.root)
  return { base, a, b, sys, tc }
}
async function create(ws: WorkspaceService, type: string, title: string, text = '', id?: string): Promise<string> {
  const it = ws.newItem(type)
  if (id) it.id = id
  it.title = title
  it.text = text
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}
async function edit(ws: WorkspaceService, id: string, change: (i: Item) => void): Promise<void> {
  const d = await ws.getItem(id)
  if (!d) throw new Error(`no ${id}`)
  const it = structuredClone(d.item)
  change(it)
  const r = await ws.saveItem(it, d.revision)
  if (!r.ok) throw new Error(r.message)
}

describe('Pull with decisions per requirement (two PCs)', { timeout: 180_000 }, () => {
  it('combines different parts of one item automatically, records the pull for Changes (D-05)', async () => {
    const { a, b, sys } = await twoPcs()
    await edit(a.ws, sys, (i) => (i.fields['status'] = 'Review'))
    await edit(a.ws, sys, (i) => (i.title = 'Shared requirement (Alice)'))
    await a.ws.commit('Alice: status and title')
    await a.ws.push()
    // Bob changes the text: Git sees neighbouring lines and would stop; ReqMan combines the parts
    await edit(b.ws, sys, (i) => (i.text = 'Bob text'))
    await edit(b.ws, sys, (i) => (i.fields['priority'] = 'High'))
    await b.ws.commit('Bob: text')
    const r = await b.ws.pull()
    expect(r).toMatchObject({ ok: true })
    expect(r.message).toMatch(/^Pulled: 1 item changed(, 1 combined automatically)?\.$/)
    expect((await b.ws.getItem(sys))?.item).toMatchObject({ title: 'Shared requirement (Alice)', text: 'Bob text', fields: { status: 'Review' } })
    expect(sh(b.root, 'status', '--porcelain')).toBe('')
    // the Changes view finds what the pull brought in
    const o = await b.ws.compareOptions()
    expect(o.lastPull).not.toBeNull()
    const c = await b.ws.compareVersions(o.lastPull!.from, o.lastPull!.to)
    expect(c.entries.map((e) => e.id)).toEqual([sys])
    expect(c.entries[0]!.diff.rows.map((x) => x.key)).toEqual(expect.arrayContaining(['title', 'field:status']))
  })

  it('deleted here, changed there: asks; "theirs" brings the item back', async () => {
    const { a, b, sys, tc } = await twoPcs()
    await edit(a.ws, sys, (i) => (i.text = 'Alice keeps it alive'))
    await a.ws.commit('Alice')
    await a.ws.push()
    expect((await b.ws.deleteItem(sys, (await b.ws.getItem(sys))!.revision, { removeIncomingLinks: true })).ok).toBe(true)
    await b.ws.commit('Bob deletes')
    const r = await b.ws.pull()
    const plan = r.ok ? undefined : r.plan
    expect(plan?.questions.map((q) => q.parts.map((p) => [p.key, p.mine, p.theirs]))).toEqual([[['item', 'Deleted', 'Changed']]])
    // Bob's delete also removed the incoming link on the test case — that file merges on its own
    const done = await b.ws.finishPull(plan!, { [plan!.questions[0]!.path]: { item: 'theirs' } })
    expect(done.ok).toBe(true)
    expect((await b.ws.getItem(sys))?.item.text).toBe('Alice keeps it alive')
    expect((await b.ws.getItem(tc))?.item.links).toEqual([])
  })

  it('an edited answer is written; a commit in between makes the plan stale', async () => {
    const { a, b, sys } = await twoPcs()
    await edit(a.ws, sys, (i) => (i.text = 'Alice'))
    await a.ws.commit('Alice')
    await a.ws.push()
    await edit(b.ws, sys, (i) => (i.text = 'Bob'))
    await b.ws.commit('Bob')
    const r = await b.ws.pull()
    const plan = r.ok ? undefined : r.plan
    expect(plan).toBeDefined()
    const path = plan!.questions[0]!.path
    // something else is committed meanwhile
    await create(b.ws, 'system-requirement', 'Another')
    await b.ws.commit('Another')
    expect(await b.ws.finishPull(plan!, { [path]: { text: { edit: 'Alice and Bob' } } })).toMatchObject({ ok: false, message: expect.stringMatching(/Pull again/) })
    const again = await b.ws.pull()
    const plan2 = again.ok ? undefined : again.plan
    expect((await b.ws.finishPull(plan2!, { [path]: { text: { edit: 'Alice and Bob' } } })).ok).toBe(true)
    expect((await b.ws.getItem(sys))?.item.text).toBe('Alice and Bob')
  })

  it('repairs an ID created on both sides (D-09): mine gets a new ID, my links follow', async () => {
    const { a, b, sys } = await twoPcs()
    const dup = 'REQ-DUP0000'
    await create(a.ws, 'system-requirement', 'Alice item', 'from Alice', dup)
    await a.ws.commit('Alice adds')
    await a.ws.push()
    await create(b.ws, 'system-requirement', 'Bob item', 'from Bob', dup)
    const child = await create(b.ws, 'test-case', 'Bob test')
    await b.ws.addLink(child, 'verifies', dup)
    await b.ws.commit('Bob adds')
    const r = await b.ws.pull()
    expect(r.ok).toBe(true)
    const m = /REQ-DUP0000 was also created on the other side for a different item: yours is now (REQ-[0-9A-Z]{7})/.exec(r.message)
    expect(m).not.toBeNull()
    const newId = m![1]!
    expect((await b.ws.getItem(dup))?.item.title).toBe('Alice item')
    expect((await b.ws.getItem(newId))?.item.title).toBe('Bob item')
    expect((await b.ws.getItem(child))?.item.links.map((l) => l.target)).toEqual([newId])
    expect((await b.ws.getItem(sys))?.item.title).toBe('Shared requirement')
    expect(b.ws.repoInfo().issues).toEqual([])
  })

  it('finds "the last pull" after a git pull --rebase outside ReqMan (D-05)', async () => {
    const { a, b, sys, tc } = await twoPcs()
    await edit(a.ws, sys, (i) => (i.text = 'Alice'))
    await a.ws.commit('Alice')
    await a.ws.push()
    await edit(b.ws, tc, (i) => (i.title = 'Bob test'))
    await b.ws.commit('Bob')
    const before = sh(b.root, 'rev-parse', 'HEAD').trim()
    sh(b.root, 'pull', '-q', '--rebase')
    const o = await b.ws.compareOptions()
    expect(o.lastPull?.from).toBe(before)
    expect(o.lastPull?.to).toBe(sh(b.root, 'rev-parse', 'HEAD').trim())
  })

  it('refuses up front when the pull would overwrite uncommitted edits', async () => {
    const { a, b, sys } = await twoPcs()
    await edit(a.ws, sys, (i) => (i.text = 'Alice'))
    await a.ws.commit('Alice')
    await a.ws.push()
    await edit(b.ws, sys, (i) => (i.text = 'Bob, not committed'))
    const r = await b.ws.pull()
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/not committed/) })
    expect(r.ok ? [] : r.items?.map((i) => i.id)).toEqual([sys])
  })
})

describe('Branches (M8)', { timeout: 180_000 }, () => {
  it('create, switch (take along / blocked / discard), pull from branch, compare like a pull request', async () => {
    const { a, b, sys, tc } = await twoPcs()
    // new branch from the current one: uncommitted changes come along
    await edit(a.ws, sys, (i) => (i.text = 'Feature text'))
    expect(await a.ws.createBranch('bad name')).toMatchObject({ ok: false })
    expect(await a.ws.createBranch('main')).toMatchObject({ ok: false, message: 'A branch "main" exists already.' })
    const c = await a.ws.createBranch('feature/x')
    expect(c).toMatchObject({ ok: true })
    expect(c.state.branch).toBe('feature/x')
    expect(c.state.changes.map((x) => x.id)).toEqual([sys])
    await a.ws.commit('Feature work')
    expect((await a.ws.push()).ok).toBe(true) // publishes the new branch

    // back to main with an uncommitted change of the same item: blocked (main has another version)
    await edit(a.ws, sys, (i) => (i.text = 'More feature text'))
    const blocked = await a.ws.switchBranch('main', 'take')
    expect(blocked).toMatchObject({ ok: false })
    expect(blocked.ok ? [] : blocked.items?.map((i) => i.id)).toEqual([sys])
    expect(sh(a.root, 'branch', '--show-current').trim()).toBe('feature/x')
    // an uncommitted change of an item that is the same on both branches may come along
    await a.ws.discardChanges((await a.ws.gitState()).changes.map((x) => x.path))
    await edit(a.ws, tc, (i) => (i.title = 'Check it (draft)'))
    const take = await a.ws.switchBranch('main', 'take')
    expect(take).toMatchObject({ ok: true, message: 'Switched to "main".' })
    expect((await a.ws.getItem(tc))?.item.title).toBe('Check it (draft)')
    expect((await a.ws.getItem(sys))?.item.text).toBe('Start text') // the index follows the branch
    // discard: the change is gone, then the switch
    const d = await a.ws.switchBranch('feature/x', 'discard')
    expect(d.ok).toBe(true)
    expect(d.state.changes).toEqual([])
    expect((await a.ws.getItem(tc))?.item.title).toBe('Check it')
    await a.ws.switchBranch('main', 'take')

    // branches list: local ones first, the remote ones after
    const list = await a.ws.listBranches()
    expect(list.filter((x) => x.kind === 'branch').map((x) => [x.name, x.current])).toEqual([
      ['feature/x', false],
      ['main', true]
    ])
    expect(list.filter((x) => x.kind === 'remote').map((x) => x.name)).toEqual(['origin/feature/x', 'origin/main'])

    // PC B: compare what the feature branch would bring in (like a pull request), then pull it into main
    await b.ws.pull() // fetches; B now sees origin/feature/x
    const range = await b.ws.branchRange('origin/feature/x')
    expect(range).not.toBeNull()
    const cmp = await b.ws.compareVersions(range!.from, range!.to)
    expect(cmp.entries.map((e) => [e.id, e.kind])).toEqual([[sys, 'modified']])
    await edit(b.ws, tc, (i) => (i.fields['status'] = 'Review'))
    await b.ws.commit('Bob on main')
    const headBefore = sh(b.root, 'rev-parse', 'HEAD')
    const pulled = await b.ws.pullFrom('origin/feature/x')
    // 0.13.0 (owner, 31 Oct): another branch's changes arrive as uncommitted changes to review
    expect(pulled).toMatchObject({ ok: true, message: expect.stringMatching(/^Brought 1 changed item from origin\/feature\/x into your working folder — nothing is committed/) })
    expect(sh(b.root, 'rev-parse', 'HEAD')).toBe(headBefore)
    expect(pulled.state.changes.map((c) => c.id)).toEqual([sys])
    expect((await b.ws.getItem(sys))?.item.text).toBe('Feature text')
    expect(sh(b.root, 'branch', '--show-current').trim()).toBe('main')
    // pulling again would overwrite the uncommitted result: refused
    expect(await b.ws.pullFrom('origin/feature/x')).toMatchObject({ ok: false, message: expect.stringMatching(/not committed/) })
    expect((await b.ws.commit('Take the feature text')).ok).toBe(true)
    expect(await b.ws.pullFrom('origin/feature/x')).toMatchObject({ ok: true, message: expect.stringMatching(/Already up to date/) })
    expect(await b.ws.pullFrom('nope')).toMatchObject({ ok: false, message: 'There is no branch "nope".' })

    // a remote-only branch: switching creates the local branch that follows it
    const sw = await b.ws.switchBranch('origin/feature/x', 'take')
    expect(sw).toMatchObject({ ok: true, message: 'Switched to "feature/x".' })
    expect(sw.state.upstream).toBe('origin/feature/x')
    expect(existsSync(join(b.root, 'requirements'))).toBe(true)
    expect(await readFile(join(b.root, '.git', 'HEAD'), 'utf8')).toContain('feature/x')
    await writeFile(join(b.root, 'notes.txt'), 'outside requirements') // untracked files outside never matter
    expect((await b.ws.switchBranch('main', 'take')).ok).toBe(true)

    // delete a branch (0.13.0): never the current one; unmerged commits need a second "yes"
    expect(await b.ws.deleteBranch('main', false)).toMatchObject({ ok: false, message: expect.stringMatching(/current branch/) })
    expect((await b.ws.createBranch('scratch')).ok).toBe(true)
    await edit(b.ws, tc, (i) => (i.title = 'Scratch only'))
    await b.ws.commit('Scratch work')
    await b.ws.switchBranch('main', 'take')
    const refused = await b.ws.deleteBranch('scratch', false)
    expect(refused).toMatchObject({ ok: false, unmerged: true })
    expect(await b.ws.deleteBranch('scratch', true)).toMatchObject({ ok: true, message: 'Deleted the branch "scratch" on this PC.' })
    expect(sh(b.root, 'branch', '--list', 'scratch').trim()).toBe('')
    expect((await b.ws.deleteBranch('feature/x', false)).ok).toBe(true) // fully merged: no question
  })
})
