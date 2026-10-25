// M4: the prototype journey steps 4, 5 and 7 between two "PCs" (two clones of one bare repository).
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

async function pc(base: string, name: string, user: string | null): Promise<{ ws: WorkspaceService; root: string }> {
  const root = join(base, name)
  sh(base, 'clone', '-q', join(base, 'remote.git'), root)
  if (user) {
    sh(root, 'config', 'user.name', user)
    sh(root, 'config', 'user.email', `${user.toLowerCase()}@example.com`)
  }
  const userDir = await mkdtemp(join(tmpdir(), `reqman-user-${name}-`))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: () => createSqliteIndexCache(join(userDir, 'index.sqlite')),
    userDir,
    log: quietLog
  })
  return { ws, root }
}

async function setup() {
  const base = await mkdtemp(join(tmpdir(), 'reqman-2pc-'))
  sh(base, 'init', '-q', '--bare', '-b', 'main', join(base, 'remote.git'))
  const a = await pc(base, 'a', 'Alice')
  await a.ws.initialize(a.root)
  const create = async (ws: WorkspaceService, type: string, title: string, text = ''): Promise<string> => {
    const it = ws.newItem(type)
    it.title = title
    it.text = text
    const r = await ws.saveItem(it, null)
    if (!r.ok) throw new Error(r.message)
    return it.id
  }
  return { base, a, create }
}

const edit = async (ws: WorkspaceService, id: string, change: (i: import('../src/shared/domain').Item) => void): Promise<void> => {
  const d = await ws.getItem(id)
  if (!d) throw new Error(`no ${id}`)
  const item = structuredClone(d.item)
  change(item)
  const r = await ws.saveItem(item, d.revision)
  if (!r.ok) throw new Error(r.message)
}

describe('Git in the workspace (two PCs)', () => {
  it('A commits and pushes, B pulls, edits and pushes, A pulls and sees the history', async () => {
    const { base, a, create } = await setup()
    const sys = await create(a.ws, 'system-requirement', 'Temperature accuracy', 'Within 0.5 °C.')
    const tc = await create(a.ws, 'test-case', 'Check accuracy')
    expect(await a.ws.addLink(tc, 'verifies', sys)).toEqual({ ok: true })

    const st = await a.ws.gitState()
    expect(st).toMatchObject({ available: true, branch: 'main', upstream: null, hasRemote: true, identity: { name: 'Alice' } })
    // schema, .gitattributes and the two items
    expect(st.changes.map((c) => c.label)).toEqual(expect.arrayContaining([`${sys} Temperature accuracy`, `${tc} Check accuracy`, 'Schema (fields, types, link types)']))
    await writeFile(join(a.root, 'notes.txt'), 'not a requirement')
    expect((await a.ws.commit('  ')).ok).toBe(false)
    const c = await a.ws.commit('Add accuracy requirement and its test')
    expect(c).toMatchObject({ ok: true, message: expect.stringMatching(/^Committed \d+ changes\.$/) })
    expect(sh(a.root, 'status', '--porcelain')).toBe('?? notes.txt\n') // only requirements/ was committed

    expect(c.state.ahead).toBe(0)
    const p = await a.ws.push()
    expect(p).toMatchObject({ ok: true, message: 'Pushed.' })
    expect(p.state.upstream).toBe('origin/main')
    expect((await a.ws.push()).message).toMatch(/Nothing to push/)

    // PC B: clone (as a user would), open, edit two things, add a link, commit, push
    const b = await pc(base, 'b', 'Bob')
    await b.ws.open(b.root)
    expect((await b.ws.pull()).message).toBe('Already up to date.')
    await edit(b.ws, sys, (i) => {
      i.text = 'Within 0.3 °C.'
      i.fields.status = 'Review'
    })
    const tc2 = await create(b.ws, 'test-case', 'Check accuracy at 30 °C')
    await b.ws.addLink(tc2, 'verifies', sys)
    expect((await b.ws.commit('Tighten accuracy; second test')).ok).toBe(true)
    expect((await b.ws.push()).ok).toBe(true)

    // A pulls: the index sees B's changes right away
    const pulled = await a.ws.pull()
    expect(pulled).toMatchObject({ ok: true, message: 'Pulled: 2 items changed.' })
    expect((await a.ws.getItem(sys))?.item.text).toBe('Within 0.3 °C.')
    expect((await a.ws.getItem(sys))?.incoming.map((l) => l.id).sort()).toEqual([tc, tc2].sort())
    expect(a.ws.query({ links: 'suspect' }).items.map((i) => i.id)).toEqual([tc]) // A's test case now needs review

    // history of the requirement: Bob's change, then Alice's creation
    const h = await a.ws.itemHistory(sys)
    expect(h.map((e) => [e.author, e.message])).toEqual([
      ['Bob', 'Tighten accuracy; second test'],
      ['Alice', 'Add accuracy requirement and its test']
    ])
    const bobs = await a.ws.compareItemVersion(sys, h[0]!.hash)
    expect(bobs.diff.kind).toBe('modified')
    expect(bobs.diff.rows).toEqual([{ key: 'field:status', label: 'Status', before: 'Draft', after: 'Review' }])
    expect(bobs.diff.text).toEqual({ before: 'Within 0.5 °C.', after: 'Within 0.3 °C.' })
    const created = await a.ws.compareItemVersion(sys, h[1]!.hash)
    expect(created.diff.kind).toBe('added')
    expect(created.before).toBeNull()

    // an uncommitted edit shows as the first history entry
    await edit(a.ws, sys, (i) => (i.title = 'Temperature accuracy (room)'))
    const h2 = await a.ws.itemHistory(sys)
    expect(h2[0]).toMatchObject({ hash: 'working', message: 'Not committed yet' })
    expect((await a.ws.compareItemVersion(sys, 'working')).diff.rows).toEqual([
      { key: 'title', label: 'Title', before: 'Temperature accuracy', after: 'Temperature accuracy (room)' }
    ])

    // discard it
    const path = (await a.ws.gitState()).changes.find((x) => x.id === sys)!.path
    const d = await a.ws.discardChanges([path])
    expect(d.ok).toBe(true)
    expect(d.state.changes).toEqual([])
    expect((await a.ws.getItem(sys))?.item.title).toBe('Temperature accuracy')
  })

  it('stops a pull without changing anything when both sides changed the same item', async () => {
    const { base, a, create } = await setup()
    const sys = await create(a.ws, 'system-requirement', 'Shared requirement')
    const other = await create(a.ws, 'system-requirement', 'Other requirement')
    await a.ws.commit('Start')
    await a.ws.push()
    const b = await pc(base, 'b', 'Bob')
    await b.ws.open(b.root)

    await edit(a.ws, sys, (i) => (i.text = 'Alice wording'))
    await a.ws.commit('Alice')
    await a.ws.push()
    await edit(b.ws, sys, (i) => (i.text = 'Bob wording'))
    await b.ws.commit('Bob')

    const rejected = await b.ws.push()
    expect(rejected).toMatchObject({ ok: false, message: 'The remote has changes you do not have yet. Pull first, then push again.' })

    const headBefore = sh(b.root, 'rev-parse', 'HEAD')
    const r = await b.ws.pull()
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/^Pull stopped — nothing was changed/)
    expect(r.ok ? [] : r.items?.map((i) => i.label)).toEqual([`${sys} Shared requirement`])
    expect(sh(b.root, 'rev-parse', 'HEAD')).toBe(headBefore)
    expect(sh(b.root, 'status', '--porcelain')).toBe('')
    expect((await b.ws.getItem(sys))?.item.text).toBe('Bob wording')

    // take their version, all inside ReqMan: undo the (unpushed) commit, discard the item, pull
    let st = await b.ws.gitState()
    expect(st).toMatchObject({ canUndoCommit: true, lastCommitMessage: 'Bob' })
    const undone = await b.ws.undoLastCommit()
    expect(undone.ok).toBe(true)
    expect(undone.state.changes.map((c) => c.id)).toEqual([sys])
    expect((await b.ws.discardChanges([undone.state.changes[0]!.path])).ok).toBe(true)
    expect((await b.ws.pull()).ok).toBe(true)
    expect((await b.ws.getItem(sys))?.item.text).toBe('Alice wording')
    st = await b.ws.gitState()
    expect(st.canUndoCommit).toBe(false) // nothing of Bob's that is not on the remote
    expect((await b.ws.undoLastCommit()).ok).toBe(false)

    // different items on both sides: merged automatically
    await edit(b.ws, other, (i) => (i.text = 'Bob edits the other one'))
    await b.ws.commit('Bob, other item')
    await edit(a.ws, sys, (i) => (i.text = 'Alice again'))
    await a.ws.commit('Alice again')
    await a.ws.push()
    const merged = await b.ws.pull()
    expect(merged).toMatchObject({ ok: true, message: 'Pulled: 1 item changed.' })
    expect((await b.ws.getItem(sys))?.item.text).toBe('Alice again')
    expect((await b.ws.getItem(other))?.item.text).toBe('Bob edits the other one')
    expect((await b.ws.push()).ok).toBe(true)
  })

  it('refuses to pull over uncommitted changes of the same item, and asks for name/e-mail before committing', async () => {
    const { base, a, create } = await setup()
    const sys = await create(a.ws, 'system-requirement', 'Requirement')
    await a.ws.commit('Start')
    await a.ws.push()
    const b = await pc(base, 'b', null)
    // no identity on B — make sure no global one leaks in from the machine running the tests
    const home = await mkdtemp(join(tmpdir(), 'reqman-home-'))
    const oldHome = process.env['HOME']
    const oldGlobal = process.env['GIT_CONFIG_GLOBAL']
    process.env['HOME'] = home
    process.env['GIT_CONFIG_GLOBAL'] = join(home, '.gitconfig')
    try {
      await b.ws.open(b.root)
      await edit(b.ws, sys, (i) => (i.text = 'Bob, not committed'))
      const st = await b.ws.gitState()
      expect(st.identity).toEqual({ name: null, email: null })
      const c = await b.ws.commit('Bob')
      expect(c).toMatchObject({ ok: false, message: expect.stringMatching(/name and e-mail/) })
      expect((await b.ws.setGitIdentity('Bob', 'not-an-email')).ok).toBe(false)
      expect((await b.ws.setGitIdentity('Bob', 'bob@example.com')).ok).toBe(true)
      expect(await readFile(join(home, '.gitconfig'), 'utf8')).toMatch(/name = Bob/)

      await edit(a.ws, sys, (i) => (i.text = 'Alice, committed'))
      await a.ws.commit('Alice')
      await a.ws.push()
      const r = await b.ws.pull()
      expect(r.ok).toBe(false)
      expect(r.message).toMatch(/not committed/)
      expect(r.ok ? [] : r.items?.map((i) => i.id)).toEqual([sys])
      expect((await b.ws.getItem(sys))?.item.text).toBe('Bob, not committed')
    } finally {
      if (oldHome === undefined) delete process.env['HOME']
      else process.env['HOME'] = oldHome
      if (oldGlobal === undefined) delete process.env['GIT_CONFIG_GLOBAL']
      else process.env['GIT_CONFIG_GLOBAL'] = oldGlobal
    }
  })

  it('explains when Git is not usable: plain folder, no remote', async () => {
    const plainRoot = await mkdtemp(join(tmpdir(), 'reqman-plain-'))
    const userDir = await mkdtemp(join(tmpdir(), 'reqman-user-'))
    const ws = createWorkspace({
      store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
      git: createSystemGitAdapter(),
      openIndex: () => createSqliteIndexCache(join(userDir, 'i.sqlite')),
      userDir,
      log: quietLog
    })
    await ws.initialize(plainRoot)
    expect(await ws.gitState()).toMatchObject({ available: false, reason: expect.stringMatching(/not a Git repository/) })
    expect((await ws.commit('x')).ok).toBe(false)

    const local = await mkdtemp(join(tmpdir(), 'reqman-local-'))
    sh(local, 'init', '-q', '-b', 'main')
    sh(local, 'config', 'user.name', 'Solo')
    sh(local, 'config', 'user.email', 'solo@example.com')
    await ws.initialize(local)
    expect((await ws.commit('First')).ok).toBe(true)
    expect(await ws.push()).toMatchObject({ ok: false, message: expect.stringMatching(/no remote/) })
    expect(await ws.pull()).toMatchObject({ ok: false, message: expect.stringMatching(/no remote/) })
  })
})
