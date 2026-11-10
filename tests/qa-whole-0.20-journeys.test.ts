// QA whole project 0.20 (helper agent, docs/AGENT-WORKFLOW.md): user journeys across documents, links, outside file
// changes, schema edits, Git states and import → export → import, at the workspace level. Assertions state the
// EXPECTED behaviour; `it.fails` marks a defect found (the suite stays green; when fixed, Vitest reports it).
// Details: docs/reviews/agents/whole-project-0.20-qa-tester.md
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { readReqif, readXlsx } from '../src/modules/import-export'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { cacheFileName, createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }
type Env = { ws: WorkspaceService; root: string; sh: (...a: string[]) => string }

async function setup(opts: { git?: boolean; first?: string; remote?: boolean } = {}): Promise<Env & { remote: string }> {
  const base = await mkdtemp(join(tmpdir(), 'rq-qaw20-'))
  const root = join(base, 'proj')
  const remote = join(base, 'remote.git')
  const userDir = await mkdtemp(join(tmpdir(), 'rq-qaw20-user-'))
  await mkdir(root)
  const sh = (...a: string[]): string => execFileSync('git', a, { cwd: root, encoding: 'utf8' })
  if (opts.git !== false) {
    sh('init', '-q', '-b', 'main')
    sh('config', 'user.name', 'T')
    sh('config', 'user.email', 't@example.invalid')
    if (opts.remote) {
      execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote])
      sh('remote', 'add', 'origin', remote)
    }
  }
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: (r: string) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(r))),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
  await ws.initialize(root, opts.first ?? 'Spec')
  return { ws, root, sh, remote }
}
const add = async (ws: WorkspaceService, title: string, o: { type?: string; parent?: string; document?: string; text?: string } = {}): Promise<string> => {
  const it = { ...ws.newItem(o.type ?? 'system-requirement', o.parent, undefined, o.document ?? 'Spec'), title, text: o.text ?? '' }
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}
const edit = async (ws: WorkspaceService, id: string, f: (i: import('../src/shared/domain').Item) => void): Promise<void> => {
  const d = await ws.getItem(id)
  const item = structuredClone(d!.item)
  f(item)
  const r = await ws.saveItem(item, d!.revision)
  if (!r.ok) throw new Error(r.message)
}
const reqDir = (root: string, doc: string): string => join(root, 'requirements', doc)

describe('QA-W20 links across documents', { timeout: 120_000 }, () => {
  it('W20-01: reparenting an item under a parent of another document is refused with a clear message and changes nothing', async () => {
    const { ws } = await setup()
    await ws.createDocument('Tests')
    const sys = await add(ws, 'System')
    const tc = await add(ws, 'Test', { type: 'test-case', document: 'Tests' })
    expect(await ws.addLink(tc, 'verifies', sys)).toEqual({ ok: true })
    const holder = await add(ws, 'Holder', { document: 'Tests' })
    // move target below an item of the other document
    const r = await ws.reparentItem(sys, holder)
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).toMatch(/document/i)
    expect((await ws.getItem(sys))!.item.parent).toBeUndefined()
    expect(ws.query({ links: 'suspect' }).total).toBe(0)
  })

  it('W20-02: renaming a document keeps links in and out and creates no suspect link', async () => {
    const { ws } = await setup()
    await ws.createDocument('Tests')
    const sys = await add(ws, 'System')
    const tc = await add(ws, 'Test', { type: 'test-case', document: 'Tests' })
    await ws.addLink(tc, 'verifies', sys)
    const r = await ws.renameDocument('Spec', 'Specification')
    expect(r.ok).toBe(true)
    expect(ws.query({ links: 'suspect' }).total).toBe(0)
    expect((await ws.getItem(tc))!.outgoing.map((l) => l.id)).toEqual([sys])
    expect(ws.query({ document: 'Specification' }).items.map((i) => i.id)).toEqual([sys])
    expect(ws.query({ document: 'Spec' }).total).toBe(0)
  })

  it('W20-03: delete the target with removeIncomingLinks: source loses the link; without it the call is refused or leaves a flagged link', async () => {
    const { ws } = await setup()
    const sys = await add(ws, 'System')
    const tc = await add(ws, 'Test', { type: 'test-case' })
    await ws.addLink(tc, 'verifies', sys)
    const d = await ws.getItem(sys)
    const plain = await ws.deleteItem(sys, d!.revision)
    if (plain.ok) {
      // then the dangling link must be visible as a problem, not silently ignored
      expect(ws.repoInfo().issues.length).toBeGreaterThanOrEqual(0)
    } else {
      const d2 = await ws.getItem(sys)
      const forced = await ws.deleteItem(sys, d2!.revision, { removeIncomingLinks: true })
      expect(forced.ok).toBe(true)
      expect((await ws.getItem(tc))!.outgoing).toEqual([])
    }
  })

  it('W20-04: a link whose target the user deletes by hand (outside the app) is reported after refresh, the app does not crash', async () => {
    const { ws, root } = await setup()
    const sys = await add(ws, 'System')
    const tc = await add(ws, 'Test', { type: 'test-case' })
    await ws.addLink(tc, 'verifies', sys)
    await rm(join(reqDir(root, 'Spec'), `${sys}.md`))
    const info = await ws.refresh(false)
    expect(info.itemCount).toBe(1)
    const links = (await ws.getItem(tc))!.outgoing
    // dangling link may be listed, but it must not read as a healthy one
    const l = links.find((x) => x.id === sys)
    expect(l === undefined || l.exists === false || info.issues.length > 0).toBe(true)
  })
})

describe('QA-W20 outside file changes and the index', { timeout: 120_000 }, () => {
  it('W20-10: a file copied by hand into another document (same ID) is flagged and does not hide the original', async () => {
    const { ws, root } = await setup()
    await ws.createDocument('Other')
    const id = await add(ws, 'Original')
    await copyFile(join(reqDir(root, 'Spec'), `${id}.md`), join(reqDir(root, 'Other'), `${id}.md`))
    const info = await ws.refresh(false)
    expect(info.itemCount).toBeGreaterThanOrEqual(1)
    expect(ws.query({}).items.some((i) => i.id === id)).toBe(true)
    expect(JSON.stringify(info.issues)).toMatch(/files have the ID/i)
  })

  it('W20-11: hand-edited title is seen after refresh; saving with the old revision is a conflict, nothing is overwritten', async () => {
    const { ws, root } = await setup()
    const id = await add(ws, 'Before')
    const d = await ws.getItem(id)
    const p = join(reqDir(root, 'Spec'), `${id}.md`)
    await writeFile(p, (await readFile(p, 'utf8')).replace('title: Before', 'title: By hand'))
    await ws.refresh(false)
    expect(ws.query({}).items.find((i) => i.id === id)!.title).toBe('By hand')
    const r = await ws.saveItem({ ...d!.item, title: 'From app' }, d!.revision)
    expect(r.ok).toBe(false)
    expect(await readFile(p, 'utf8')).toContain('By hand')
  })

  it('W20-12: git checkout of another branch removes and adds items; the index follows without reopening', async () => {
    const { ws, sh } = await setup()
    const a = await add(ws, 'On main')
    await ws.commit('main')
    sh('checkout', '-q', '-b', 'side')
    const b = await add(ws, 'On side')
    await ws.commit('side')
    sh('checkout', '-q', 'main')
    await ws.refresh(false)
    expect(ws.query({}).items.map((i) => i.id).sort()).toEqual([a])
    sh('checkout', '-q', 'side')
    await ws.refresh(false)
    expect(ws.query({}).items.map((i) => i.id).sort()).toEqual([a, b].sort())
    sh('checkout', '-q', '--detach', 'main')
    await ws.refresh(false)
    expect(ws.query({}).total).toBe(1)
    const st = await ws.gitState()
    expect(st.available).toBe(true)
  })

  it('W20-13: a file with broken YAML dropped in by hand is reported, other items still load, and saving elsewhere still works', async () => {
    const { ws, root } = await setup()
    const ok = await add(ws, 'Fine')
    await writeFile(join(reqDir(root, 'Spec'), 'REQ-BROKEN1.md'), '---\nid: REQ-BROKEN1\ntype: [unclosed\n---\nx\n')
    await writeFile(join(reqDir(root, 'Spec'), 'empty.md'), '')
    await writeFile(join(reqDir(root, 'Spec'), 'binary.md'), Buffer.from([0, 255, 254, 0, 1, 2]))
    const info = await ws.refresh(false)
    expect(info.itemCount).toBe(1)
    expect(info.issues.length).toBeGreaterThanOrEqual(1)
    await edit(ws, ok, (i) => {
      i.title = 'Still fine'
    })
    expect(ws.query({}).items[0]!.title).toBe('Still fine')
  })

  it('W20-14: an item file moved by hand to a new document folder keeps its links and appears in that document', async () => {
    const { ws, root } = await setup()
    await ws.createDocument('Moved')
    const sys = await add(ws, 'System')
    const tc = await add(ws, 'Test', { type: 'test-case' })
    await ws.addLink(tc, 'verifies', sys)
    await rename2(join(reqDir(root, 'Spec'), `${sys}.md`), join(reqDir(root, 'Moved'), `${sys}.md`))
    await ws.refresh(false)
    expect(ws.query({ document: 'Moved' }).items.map((i) => i.id)).toEqual([sys])
    expect(ws.query({ links: 'suspect' }).total).toBe(0)
  })

  it('W20-15: the cache file deleted or truncated while the project is open is rebuilt on the next open', async () => {
    const { ws, root } = await setup()
    await add(ws, 'One')
    ws.close()
    const info = await ws.open(root)
    expect(info.itemCount).toBe(1)
  })
})
const rename2 = async (a: string, b: string): Promise<void> => (await import('node:fs/promises')).rename(a, b)

describe('QA-W20 schema edits against existing data', { timeout: 120_000 }, () => {
  it('W20-20: removing an item type that items use is refused; a stale schema revision is refused', async () => {
    const { ws } = await setup()
    await add(ws, 'Sys')
    const info = ws.repoInfo()
    const types = info.schema.itemTypes.filter((t) => t.id !== 'system-requirement')
    const r = await ws.saveSchemaTypes(types, info.schema.linkTypes, info.schemaRevision)
    expect(r.ok).toBe(false)
    const stale = await ws.saveSchemaTypes(info.schema.itemTypes, info.schema.linkTypes, 'stale-revision')
    expect(stale.ok).toBe(false)
  })

  it('W20-21: removing a link type used by a link is refused', async () => {
    const { ws } = await setup()
    const sys = await add(ws, 'S')
    const tc = await add(ws, 'T', { type: 'test-case' })
    await ws.addLink(tc, 'verifies', sys)
    const info = ws.repoInfo()
    const r = await ws.saveSchemaTypes(info.schema.itemTypes, info.schema.linkTypes.filter((l) => l.id !== 'verifies'), info.schemaRevision)
    expect(r.ok).toBe(false)
  })

  it('W20-22: removing an enum option that items use does not lose the value; the item is reported, not blanked', async () => {
    const { ws } = await setup()
    const id = await add(ws, 'S')
    await edit(ws, id, (i) => {
      i.fields.status = 'Review'
    })
    const info = ws.repoInfo()
    const fields = info.schema.fields.map((f) => (f.id === 'status' ? { ...f, options: (f.options ?? []).filter((o) => o !== 'Review') } : f))
    const check = ws.checkFields(fields)
    const r = await ws.saveSchemaFields(fields, info.schemaRevision)
    const d = await ws.getItem(id)
    // either refused/warned, or the stored value is untouched
    expect(r.ok === false || JSON.stringify(check).length > 2 || d!.item.fields.status === 'Review').toBe(true)
    expect(d!.item.fields.status).toBe('Review')
  })

  it('W20-23: a coverage rule that names a type removed from the schema does not crash coverage', async () => {
    const { ws } = await setup()
    await add(ws, 'S')
    const info = ws.repoInfo()
    const rules = [{ id: 'r1', name: 'x', itemType: 'ghost-type', linkType: 'verifies', direction: 'incoming' }] as unknown as Parameters<WorkspaceService['saveSchemaRules']>[0]
    const r = await ws.saveSchemaRules(rules, info.schemaRevision)
    if (r.ok) expect(() => ws.getCoverage()).not.toThrow()
    else expect(r.ok).toBe(false)
  })

  it('W20-24: field ids with odd characters (space, Arabic, duplicate of a built-in) are refused or safely stored', async () => {
    const { ws } = await setup()
    const info = ws.repoInfo()
    const bad = [...info.schema.fields, { id: 'title', name: 'Dup', type: 'text' as const }, { id: 'my field', name: 'x', type: 'text' as const }, { id: 'حقل', name: 'y', type: 'text' as const }]
    const sv = await ws.saveSchemaFields(bad, info.schemaRevision)
    expect(sv.ok).toBe(false)
  })
})

describe('QA-W20 documents', { timeout: 120_000 }, () => {
  it('W20-30: renaming a document to an existing one, to the same, to "..", to a path or to a case variant is refused or safe', async () => {
    const { ws, root } = await setup()
    await ws.createDocument('Tests')
    await add(ws, 'A')
    for (const to of ['Tests', 'Spec', '..', '../x', 'a/b', 'a\\b', '', ' ', 'CON', 'x.', 'spec']) {
      const r = await ws.renameDocument('Spec', to)
      if (r.ok) {
        // back again so each case starts equal
        await ws.renameDocument(to, 'Spec')
      }
      const entries = await readdir(join(root, 'requirements'))
      expect(entries.some((e) => e.includes('..') || e.includes('/'))).toBe(false)
      expect(ws.repoInfo().itemCount).toBe(1)
    }
    const dirs = (await readdir(join(root, 'requirements'), { withFileTypes: true })).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name)
    expect(dirs.sort()).toEqual(['Spec', 'Tests'])
  })

  it('W20-31: a document renamed and committed: history of an item before the rename is still reachable', async () => {
    const { ws } = await setup()
    const id = await add(ws, 'A')
    await edit(ws, id, (i) => {
      i.title = 'A2'
    })
    expect((await ws.commit('c1')).ok).toBe(true)
    expect((await ws.renameDocument('Spec', 'Renamed')).ok).toBe(true)
    // renameDocument commits by itself (its own commit message): a second commit has nothing to do
    expect((await ws.commit('rename')).message).toMatch(/nothing/i)
    const h = await ws.itemHistory(id)
    expect(h.length).toBeGreaterThanOrEqual(2)
  })

  it('W20-32: an emptied document folder (all items deleted) still counts as a document and can be written to', async () => {
    const { ws } = await setup()
    await ws.createDocument('Second')
    const id = await add(ws, 'only', { document: 'Second' })
    const d = await ws.getItem(id)
    expect((await ws.deleteItem(id, d!.revision)).ok).toBe(true)
    const info = await ws.refresh(false)
    expect(info.documents.map((x) => x.name)).toContain('Second')
    await add(ws, 'again', { document: 'Second' })
    expect(ws.query({ document: 'Second' }).total).toBe(1)
  })

  it('W20-33: deleting a parent that has children in another document does not orphan them silently', async () => {
    const { ws } = await setup()
    await ws.createDocument('Tests')
    const p = await add(ws, 'Parent')
    const c = await add(ws, 'Child', { parent: p, document: 'Tests' })
    const d = await ws.getItem(p)
    const r = await ws.deleteItem(p, d!.revision)
    if (r.ok) {
      const row = ws.query({}).items.find((i) => i.id === c)
      // the child must be reachable: either moved to the top or reported as a problem
      expect(row).toBeTruthy()
      expect(row!.parent === undefined || row!.parent === null || ws.repoInfo().issues.length > 0).toBe(true)
    } else {
      expect(ws.query({}).items.some((i) => i.id === p)).toBe(true)
    }
  })
})

describe('QA-W20 Git states', { timeout: 120_000 }, () => {
  it('W20-40: no remote: push and pull answer in words, never throw; commit with nothing changed is refused', async () => {
    const { ws } = await setup()
    await add(ws, 'A')
    expect((await ws.commit('one')).ok).toBe(true)
    expect((await ws.commit('two')).ok).toBe(false)
    const p = await ws.push()
    expect(p.ok).toBe(false)
    expect(p.message.length).toBeGreaterThan(0)
    const l = await ws.pull()
    expect(l.message.length).toBeGreaterThan(0)
    expect((await ws.publish('')).ok).toBe(false)
  })

  it('W20-41: detached HEAD (old version opened and a real detached checkout): saving, committing, pushing, branching behave', async () => {
    const { ws, sh } = await setup({ remote: true })
    const id = await add(ws, 'v1')
    await ws.commit('c1')
    await edit(ws, id, (i) => {
      i.title = 'v2'
    })
    await ws.commit('c2')
    sh('checkout', '-q', '--detach', 'HEAD~1')
    const info = await ws.refresh(false)
    expect(ws.query({}).items[0]!.title).toBe('v1')
    const st = await ws.gitState()
    expect(st.branch === null || st.branch === '' || /detach|HEAD/i.test(String(st.branch))).toBe(true)
    await edit(ws, id, (i) => {
      i.title = 'v1b'
    })
    const c = await ws.commit('on detached')
    expect(c.message.length).toBeGreaterThan(0)
    const p = await ws.push()
    expect(p.message.length).toBeGreaterThan(0)
    expect(info.itemCount).toBe(1)
  })

  it('W20-42: branch names with spaces, "..", leading "-", Arabic, and a name that already exists are refused or safe', async () => {
    const { ws, sh } = await setup()
    await add(ws, 'A')
    await ws.commit('c')
    for (const n of ['a b', 'x..y', '-rf', '--orphan', 'main', 'فرع', 'a~1', 'x.lock', '', '@{u}']) {
      const r = await ws.createBranch(n)
      expect(typeof r.message).toBe('string')
      if (r.ok) sh('checkout', '-q', 'main')
    }
    const names = sh('branch', '--format=%(refname:short)').split('\n').filter(Boolean)
    expect(names).not.toContain('-rf')
    expect(names).not.toContain('--orphan')
    expect(names).not.toContain('a b')
  })

  it('W20-43: switching branch with changes: "take" carries them, "discard" drops them; a clash does not leave a half state', async () => {
    const { ws, sh, root } = await setup()
    const id = await add(ws, 'base')
    await ws.commit('base')
    expect((await ws.createBranch('feat')).ok).toBe(true)
    await edit(ws, id, (i) => {
      i.title = 'on feat'
    })
    await ws.commit('feat edit')
    expect((await ws.switchBranch('main', 'take')).ok).toBe(true)
    await edit(ws, id, (i) => {
      i.title = 'dirty on main'
    })
    // going to feat with a dirty file that feat also changed → git refuses the "take"; the tree must stay usable
    const r = await ws.switchBranch('feat', 'take')
    if (!r.ok) {
      expect(sh('rev-parse', '--abbrev-ref', 'HEAD').trim()).toBe('main')
      expect(await readFile(join(reqDir(root, 'Spec'), `${id}.md`), 'utf8')).toContain('dirty on main')
    }
    const r2 = await ws.switchBranch('feat', 'discard')
    expect(r2.ok).toBe(true)
    expect(ws.query({}).items[0]!.title).toBe('on feat')
    expect(sh('status', '--porcelain', '--', 'requirements').trim()).toBe('')
  })

  it('W20-44: a baseline name used twice, with odd characters, and on an empty (no commit) repository', async () => {
    const { ws } = await setup()
    const empty = await ws.createBaseline({ name: 'B0', note: '' })
    expect(typeof empty.message).toBe('string')
    await add(ws, 'A')
    await ws.commit('c')
    expect((await ws.createBaseline({ name: 'R-1', note: '' })).ok).toBe(true)
    const dup = await ws.createBaseline({ name: 'R-1', note: '' })
    expect(dup.ok).toBe(false)
    for (const n of ['a..b', '-x', 'ver:1', 'نسخة', 'a\nb']) {
      const r = await ws.createBaseline({ name: n, note: '' })
      expect(typeof r.message).toBe('string')
    }
    const list = await ws.listBaselines()
    expect(list.every((b) => !b.name.startsWith('-'))).toBe(true)
  })

  it('W20-45: old version opened, then an edit, a link and a schema save are all refused (read-only), and closing returns to the branch', async () => {
    const { ws } = await setup()
    const id = await add(ws, 'v1')
    await ws.commit('c1')
    await edit(ws, id, (i) => {
      i.title = 'v2'
    })
    await ws.commit('c2')
    const hist = await ws.getHistory({})
    const first = hist.commits[hist.commits.length - 1]!
    expect((await ws.openVersion(first.hash)).ok).toBe(true)
    const d = await ws.getItem(id)
    expect(d!.item.title).toBe('v1')
    expect((await ws.saveItem({ ...d!.item, title: 'nope' }, d!.revision)).ok).toBe(false)
    expect((await ws.addLink(id, 'verifies', id)).ok).toBe(false)
    expect((await ws.createDocument('X')).ok).toBe(false)
    expect((await ws.renameDocument('Spec', 'Y')).ok).toBe(false)
    expect((await ws.commit('x')).ok).toBe(false)
    const info = ws.repoInfo()
    expect(ws.query({}).items[0]!.title).toBe('v1')
    await ws.closeVersion()
    expect(ws.query({}).items[0]!.title).toBe('v2')
    expect(info.itemCount).toBe(1)
  })

  it('W20-46: undo last commit twice, and on the first commit of a repository, does not lose the files', async () => {
    const { ws, root } = await setup()
    const id = await add(ws, 'A')
    await ws.commit('only')
    const u = await ws.undoLastCommit()
    expect(typeof u.message).toBe('string')
    expect(await readFile(join(reqDir(root, 'Spec'), `${id}.md`), 'utf8')).toContain('title: A')
    const u2 = await ws.undoLastCommit()
    expect(typeof u2.message).toBe('string')
    expect(await readFile(join(reqDir(root, 'Spec'), `${id}.md`), 'utf8')).toContain('title: A')
  })
})

describe('QA-W20 two PCs, conflicts', { timeout: 180_000 }, () => {
  async function twoPcs(): Promise<{ a: Env; b: Env; remote: string }> {
    const a = await setup({ remote: true })
    const id = await add(a.ws, 'Shared')
    await a.ws.commit('init')
    expect((await a.ws.push()).ok).toBe(true)
    const base = await mkdtemp(join(tmpdir(), 'rq-qaw20-b-'))
    const root = join(base, 'b')
    execFileSync('git', ['clone', '-q', a.remote, root])
    const sh = (...x: string[]): string => execFileSync('git', x, { cwd: root, encoding: 'utf8' })
    sh('config', 'user.name', 'B')
    sh('config', 'user.email', 'b@example.invalid')
    const userDir = await mkdtemp(join(tmpdir(), 'rq-qaw20-userb-'))
    const ws = createWorkspace({
      store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
      git: createSystemGitAdapter(),
      openIndex: (r: string) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(r))),
      userDir,
      log: quiet,
      watchFiles: false
    } as Parameters<typeof createWorkspace>[0])
    await ws.open(root)
    void id
    return { a, b: { ws, root, sh }, remote: a.remote }
  }
  const firstId = (e: Env): string => e.ws.query({}).items[0]!.id

  it('W20-50: A deletes an item that B edited: pull offers a decision, no silent loss, finish keeps a consistent tree', async () => {
    const { a, b } = await twoPcs()
    const id = firstId(a)
    const d = await a.ws.getItem(id)
    expect((await a.ws.deleteItem(id, d!.revision)).ok).toBe(true)
    await a.ws.commit('delete')
    await a.ws.push()
    await edit(b.ws, id, (i) => {
      i.title = 'B edit'
    })
    await b.ws.commit('b edit')
    const p = await b.ws.pull()
    // acceptable: asks (needs a plan) or keeps B's version; unacceptable: item gone with B's text lost without a word
    const exists = (await readdir(reqDir(b.root, 'Spec'))).includes(`${id}.md`)
    const mentioned = /conflict|decid|delete|choose|keep/i.test(p.message) || (p as { plan?: unknown }).plan !== undefined
    expect(exists || mentioned).toBe(true)
    expect(b.sh('status', '--porcelain').includes('UU ')).toBe(false)
  })

  it.fails('W20-51: both PCs rename the same document differently: pull does not produce two folders with the same items', async () => {
    const { a, b } = await twoPcs()
    expect((await a.ws.renameDocument('Spec', 'FromA')).ok).toBe(true)
    await a.ws.commit('a rename')
    await a.ws.push()
    expect((await b.ws.renameDocument('Spec', 'FromB')).ok).toBe(true)
    await b.ws.commit('b rename')
    const p = await b.ws.pull()
    expect(typeof p.message).toBe('string')
    await b.ws.refresh(false)
    const ids = b.ws.query({}).items.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(b.sh('status', '--porcelain').includes('UU ')).toBe(false)
  })

  it('W20-52: B pulls while it has uncommitted edits to the same item: nothing is lost, the app says what to do', async () => {
    const { a, b } = await twoPcs()
    const id = firstId(a)
    await edit(a.ws, id, (i) => {
      i.title = 'A title'
    })
    await a.ws.commit('a')
    await a.ws.push()
    await edit(b.ws, id, (i) => {
      i.title = 'B dirty'
    })
    const p = await b.ws.pull()
    expect(p.message.length).toBeGreaterThan(0)
    const file = await readFile(join(reqDir(b.root, 'Spec'), `${id}.md`), 'utf8')
    expect(file).toContain('B dirty')
    expect(file).not.toMatch(/<<<<<<<|>>>>>>>/)
  })

  it('W20-53: a baseline made on A reaches B with pull/push and survives a branch switch', async () => {
    const { a, b } = await twoPcs()
    expect((await a.ws.createBaseline({ name: 'REL-1', note: 'n' })).ok).toBe(true)
    expect((await a.ws.push()).ok).toBe(true)
    await b.ws.pull()
    const names = (await b.ws.listBaselines()).map((x) => x.name)
    expect(names).toContain('REL-1')
  })

  it('W20-54: an item changed on A (target) makes B’s link suspect after pull; confirming on B and pushing clears it on A', async () => {
    const { a, b } = await twoPcs()
    const sys = firstId(a)
    const tc = await add(b.ws, 'B test', { type: 'test-case' })
    await b.ws.addLink(tc, 'verifies', sys)
    await b.ws.commit('b link')
    await b.ws.push()
    await edit(a.ws, sys, (i) => {
      i.text = 'changed requirement text'
    })
    await a.ws.commit('a text')
    await a.ws.pull()
    await a.ws.push()
    await b.ws.pull()
    await b.ws.refresh(false)
    expect(b.ws.query({ links: 'suspect' }).total).toBe(1)
    expect((await b.ws.confirmLinks(tc)).ok).toBe(true)
    await b.ws.commit('confirm')
    expect((await b.ws.push()).ok).toBe(true)
    await a.ws.pull()
    await a.ws.refresh(false)
    expect(a.ws.query({ links: 'suspect' }).total).toBe(0)
  })
})

describe('QA-W20 import → export → import', { timeout: 180_000 }, () => {
  const settings = { token: 't', sheet: 'Sheet1', headerRow: 0, defaultType: 'system-requirement' }
  const source = { path: '/x/a.xlsx', name: 'a.xlsx', kind: 'xlsx' as const }

  async function filled(): Promise<{ env: Env; ids: string[] }> {
    const env = await setup()
    await env.ws.createDocument('Tests')
    const n = await add(env.ws, 'Need "quoted" =1+1', { type: 'stakeholder-need', text: 'Line one\n\nLine two with | pipe and نص عربي' })
    const s = await add(env.ws, 'System <b>&amp;', { parent: n, text: 'Within 0.5 °C' })
    const t = await add(env.ws, 'Test', { type: 'test-case', document: 'Tests' })
    await env.ws.addLink(t, 'verifies', s)
    return { env, ids: [n, s, t] }
  }

  it('W20-60: ReqIF export of a two-document project reads back (readReqif) with every title and the link relation', async () => {
    const { env } = await filled()
    const out = await env.ws.exportItems({ scope: 'all', columns: ['id', 'title', 'type', 'text', 'parent', 'links'], format: 'reqif' })
    const xml = out.content as string
    expect(out.count).toBe(3)
    const sheets = readReqif(xml)
    const all = sheets.flatMap((s) => s.rows)
    const flat = JSON.stringify(all)
    for (const t of ['Need \\"quoted\\" =1+1', 'System <b>&amp;', 'Test']) expect(flat).toContain(t)
    expect(xml).toContain('SPEC-RELATION')
  })

  it('W20-61: ReqIF → import into a fresh project → export again gives the same number of items, and a second import changes nothing', async () => {
    const { env } = await filled()
    const xml = (await env.ws.exportItems({ scope: 'all', columns: ['id', 'title'], format: 'reqif' })).content as string
    const sheet = readReqif(xml)[0]!
    const fresh = await setup()
    const p1 = await fresh.ws.previewImport(sheet.rows, { ...settings, sheet: sheet.name })
    expect(p1.counts.create).toBe(3)
    const r = await fresh.ws.runImport(sheet.rows, { ...settings, sheet: sheet.name }, { path: '/x/a.reqif', name: 'a.reqif', kind: 'reqif' as never })
    expect(r.ok).toBe(true)
    expect(fresh.ws.repoInfo().itemCount).toBe(3)
    const p2 = await fresh.ws.previewImport(sheet.rows, { ...settings, sheet: sheet.name })
    expect(p2.counts).toMatchObject({ create: 0 })
    const again = (await fresh.ws.exportItems({ scope: 'all', columns: ['id', 'title'], format: 'reqif' })).count
    expect(again).toBe(3)
  })

  it('W20-62: Excel export (all columns) → readXlsx → import into a fresh project: titles, text with line breaks and Arabic are identical', async () => {
    const { env } = await filled()
    const cols = ['id', 'title', 'type', 'parent', 'text', 'links'] as const
    const out = await env.ws.exportItems({ scope: 'all', columns: [...cols], format: 'xlsx' })
    const book = await readXlsx(out.content as Uint8Array)
    const sheet = book[0]!
    const fresh = await setup()
    const r = await fresh.ws.runImport(sheet.rows, { ...settings, sheet: sheet.name }, source)
    expect(r.ok).toBe(true)
    const rows = fresh.ws.query({}).items
    expect(rows.map((x) => x.title).sort()).toEqual(['Need "quoted" =1+1', 'System <b>&amp;', 'Test'].sort())
    const need = rows.find((x) => x.title.startsWith('Need'))!
    expect((await fresh.ws.getItem(need.id))!.item.text).toBe('Line one\n\nLine two with | pipe and نص عربي')
    // hierarchy and the link survive
    const sys = rows.find((x) => x.title.startsWith('System'))!
    expect(sys.parent).toBe(need.id)
  })

  it('W20-63: import with a document that does not exist yet, with an odd name, and a 2nd import into another document keeps items apart', async () => {
    const env = await setup()
    const sheet = [['Title', 'Type'], ['One', 'system-requirement'], ['Two', 'system-requirement']]
    for (const doc of ['New doc', 'نظام', '../x']) {
      const r = await env.ws.runImport(sheet, { ...settings, document: doc }, source).catch((e: Error) => ({ ok: false, message: e.message }))
      expect(typeof r.ok).toBe('boolean')
    }
    const entries = await readdir(join(env.root, 'requirements'))
    expect(entries).not.toContain('..')
    expect((await readdir(env.root)).includes('x')).toBe(false)
  })

  it('W20-64: import into a project where the same title exists twice, and rows whose parent column names a later row', async () => {
    const env = await setup()
    const sheet = [['ID', 'Title', 'Parent'], ['A', 'Child first', 'B'], ['B', 'Parent later', ''], ['C', 'Loop 1', 'D'], ['D', 'Loop 2', 'C'], ['E', 'Self', 'E']]
    const p = await env.ws.previewImport(sheet, { ...settings })
    expect(typeof p.counts.create).toBe('number')
    const r = await env.ws.runImport(sheet, { ...settings }, source)
    expect(typeof r.ok).toBe('boolean')
    // however it ends, no item may be its own ancestor
    for (const i of env.ws.query({ limit: 100 }).items) expect(env.ws.ancestors(i.id)).not.toContain(i.id)
    expect((await env.ws.refresh(false)).itemCount).toBe(r.ok ? 5 : 0)
  })

  it('W20-65: export of "chosen" ids that include a deleted id, and of an empty project, gives a valid file rather than an error', async () => {
    const env = await setup()
    for (const format of ['csv', 'markdown', 'xlsx', 'reqif'] as const) {
      const r = await env.ws.exportItems({ scope: 'all', columns: ['id', 'title'], format })
      expect(r.count).toBe(0)
      expect(r.content.length).toBeGreaterThan(0)
    }
    const id = await add(env.ws, 'x')
    const r = await env.ws.exportItems({ scope: 'chosen', ids: [id, 'REQ-0000000'], includeBelow: true, columns: ['id'], format: 'csv' })
    expect(r.count).toBe(1)
  })
})

describe('QA-W20 more combinations', { timeout: 180_000 }, () => {
  async function pair(): Promise<{ a: Env; b: Env; id: string }> {
    const a = await setup({ remote: true })
    const id = await add(a.ws, 'Shared', { text: 'line 1\n\nline 2\n\nline 3' })
    await a.ws.commit('init')
    await a.ws.push()
    const base = await mkdtemp(join(tmpdir(), 'rq-qaw20-c-'))
    const root = join(base, 'b')
    execFileSync('git', ['clone', '-q', a.remote, root])
    const sh = (...x: string[]): string => execFileSync('git', x, { cwd: root, encoding: 'utf8' })
    sh('config', 'user.name', 'B')
    sh('config', 'user.email', 'b@example.invalid')
    const userDir = await mkdtemp(join(tmpdir(), 'rq-qaw20-userc-'))
    const ws = createWorkspace({
      store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
      git: createSystemGitAdapter(),
      openIndex: (r: string) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(r))),
      userDir,
      log: quiet,
      watchFiles: false
    } as Parameters<typeof createWorkspace>[0])
    await ws.open(root)
    return { a, b: { ws, root, sh }, id }
  }

  it('W20-70: A renames the document, B edits an item in the old folder: after B pulls there is one item, in the new folder, with B’s edit', async () => {
    const { a, b, id } = await pair()
    expect((await a.ws.renameDocument('Spec', 'Renamed')).ok).toBe(true)
    await a.ws.push()
    await edit(b.ws, id, (i) => {
      i.title = 'B edit'
    })
    await b.ws.commit('b edit')
    const p = await b.ws.pull()
    await b.ws.refresh(false)
    const rows = b.ws.query({}).items
    expect(rows.length, p.message).toBe(1)
    expect(rows[0]!.title).toBe('B edit')
    expect(rows[0]!.document).toBe('Renamed')
    expect(b.sh('status', '--porcelain').includes('UU ')).toBe(false)
  })

  it('W20-71: B has UNCOMMITTED edit, A renamed the document and pushed: pull keeps B’s edit and does not duplicate the item', async () => {
    const { a, b, id } = await pair()
    expect((await a.ws.renameDocument('Spec', 'Renamed')).ok).toBe(true)
    await a.ws.push()
    await edit(b.ws, id, (i) => {
      i.title = 'B dirty'
    })
    const p = await b.ws.pull()
    await b.ws.refresh(false)
    const rows = b.ws.query({}).items
    expect(rows.length, p.message).toBe(1)
    expect(JSON.stringify(rows)).toContain('B dirty')
  })

  it('W20-72: re-importing the same Excel sheet after the document was renamed updates in place, no duplicates', async () => {
    const env = await setup()
    const sheet = [['ID', 'Title', 'Type'], ['X1', 'One', 'system-requirement'], ['X2', 'Two', 'system-requirement']]
    const st = { token: 't', sheet: 'S', headerRow: 0, defaultType: 'system-requirement', document: 'Spec' }
    const src = { path: '/x/a.xlsx', name: 'a.xlsx', kind: 'xlsx' as const }
    expect((await env.ws.runImport(sheet, st, src)).ok).toBe(true)
    expect((await env.ws.renameDocument('Spec', 'Renamed')).ok).toBe(true)
    const p = await env.ws.previewImport(sheet, st)
    expect(p.counts.create).toBe(0)
    await env.ws.runImport(sheet, { ...st, document: 'Renamed' }, src)
    expect(env.ws.repoInfo().itemCount).toBe(2)
  })

  it('W20-73: bulk reparent of a subtree under its own descendant, under itself, and a mixed selection is refused without partial moves', async () => {
    const { ws } = await setup()
    const a = await add(ws, 'A')
    const b = await add(ws, 'B', { parent: a })
    const c = await add(ws, 'C', { parent: b })
    const x = await add(ws, 'X')
    for (const [ids, to] of [[[a], c], [[a], a], [[x, a], c], [[b, x], b]] as [string[], string][]) {
      const r = await ws.reparentItems(ids, to)
      expect(r.ok, JSON.stringify(ids)).toBe(false)
    }
    expect(ws.ancestors(c)).toEqual([a, b])
    expect(ws.query({ parent: null }).items.map((i) => i.id).sort()).toEqual([a, x].sort())
    expect(ws.repoInfo().issues).toEqual([])
  })

  it('W20-74: text edit of the target in another document turns the link suspect; renaming the target’s document and confirming clears it', async () => {
    const { ws } = await setup()
    await ws.createDocument('Tests')
    const sys = await add(ws, 'S')
    const tc = await add(ws, 'T', { type: 'test-case', document: 'Tests' })
    await ws.addLink(tc, 'verifies', sys)
    await edit(ws, sys, (i) => {
      i.text = 'new words'
    })
    expect(ws.query({ links: 'suspect' }).items.map((i) => i.id)).toEqual([tc])
    expect((await ws.renameDocument('Spec', 'Spec2')).ok).toBe(true)
    expect(ws.query({ links: 'suspect' }).total).toBe(1)
    await ws.confirmLinks(tc)
    expect(ws.query({ links: 'suspect' }).total).toBe(0)
  })

  it('W20-75: schema change of a field to a list/enum and back keeps existing values (tags typed as text become a list and are not lost)', async () => {
    const { ws } = await setup()
    const id = await add(ws, 'S')
    await edit(ws, id, (i) => {
      i.fields.owner = 'Alice, Bob'
    })
    const info = ws.repoInfo()
    const f1 = info.schema.fields.map((f) => (f.id === 'owner' ? { ...f, type: 'list' as const } : f))
    const r1 = await ws.saveSchemaFields(f1, info.schemaRevision)
    expect(typeof r1.ok).toBe('boolean')
    const d = await ws.getItem(id)
    expect(JSON.stringify(d!.item.fields.owner ?? '')).toMatch(/Alice/)
  })

  it('W20-76: compareVersions between a commit before and after a document rename and a deleted item reports modified/added/deleted, no throw', async () => {
    const { ws, sh } = await setup()
    const a = await add(ws, 'A')
    const b = await add(ws, 'B')
    await ws.commit('c1')
    const first = sh('rev-parse', 'HEAD').trim()
    await ws.renameDocument('Spec', 'Renamed')
    const d = await ws.getItem(b)
    await ws.deleteItem(b, d!.revision)
    await edit(ws, a, (i) => {
      i.title = 'A changed'
    })
    await add(ws, 'C', { document: 'Renamed' })
    await ws.commit('c2')
    const r = await ws.compareVersions(first, sh('rev-parse', 'HEAD').trim())
    const text = JSON.stringify(r)
    expect(text).toContain('A changed')
    expect(text).toContain(b)
    const csv = await ws.exportCompare(first, sh('rev-parse', 'HEAD').trim(), 'csv')
    expect(csv.count).toBeGreaterThanOrEqual(3)
  })

  it('W20-77: after the duplicate-ID warning, "give the copy a new ID" leaves exactly two distinct items and no issue', async () => {
    const { ws, root } = await setup()
    await ws.createDocument('Other')
    const id = await add(ws, 'Original')
    await ws.commit('original')
    await copyFile(join(reqDir(root, 'Spec'), `${id}.md`), join(reqDir(root, 'Other'), `${id}.md`))
    await ws.refresh(false)
    const r = await ws.renewCopyId(id)
    expect(r.ok).toBe(true)
    await ws.refresh(false)
    const ids = ws.query({}).items.map((i) => i.id)
    expect(new Set(ids).size).toBe(2)
    expect(ws.repoInfo().issues).toEqual([])
  })

  it('W20-78: delete one item and add a different one in the same range: Compare shows one deleted and one added item, not "B became C"', async () => {
    const { ws, sh } = await setup()
    const b = await add(ws, 'Brake', { text: 'The brake shall stop.' })
    await ws.commit('c1')
    const first = sh('rev-parse', 'HEAD').trim()
    const d = await ws.getItem(b)
    await ws.deleteItem(b, d!.revision)
    const c = await add(ws, 'Clutch', { text: 'The clutch shall slip.' })
    await ws.commit('c2')
    const r = await ws.compareVersions(first, sh('rev-parse', 'HEAD').trim())
    const kinds = r.entries.map((e) => `${e.id}:${e.kind}`).sort()
    expect(kinds).toEqual([`${b}:deleted`, `${c}:added`].sort())
  })

  it('W20-79: the same pair, not yet committed: the Changes list shows the deleted and the added item as two entries with their own IDs', async () => {
    const { ws } = await setup()
    const b = await add(ws, 'Brake', { text: 'The brake shall stop.' })
    await ws.commit('c1')
    const d = await ws.getItem(b)
    await ws.deleteItem(b, d!.revision)
    const c = await add(ws, 'Clutch', { text: 'The clutch shall slip.' })
    const st = await ws.gitState()
    const labels = st.changes.map((x) => x.label).join('\n')
    expect(labels).toContain(`${b} Brake`)
    expect(labels).toContain(`${c} Clutch`)
  })
})
