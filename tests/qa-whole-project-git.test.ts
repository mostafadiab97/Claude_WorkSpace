// QA whole-project review: Git / pull / texts findings (CR1-01, CR1-08) written to FAIL today, plus new probes.
// `it.fails` keeps the suite green; when a defect is fixed, Vitest reports it — then change `it.fails` to `it`.
// Details: docs/reviews/agents/whole-project-qa-tester.md
import { execFileSync } from 'node:child_process'
import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { diffItems, validateItem, type Item } from '../src/modules/items'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { createWorkspace, type WorkspaceService } from '../src/modules/workspace'
import { parseSchema } from '../src/modules/schema'
import { readFileSync } from 'node:fs'
import type { MergePlan } from '../src/shared/api'
import { setLanguage } from '../src/shared/text'

const quietLog = { info: () => {}, warn: () => {}, error: () => {} }
const sh = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' })
afterEach(() => setLanguage('en'))

async function pc(base: string, name: string, user: string): Promise<{ ws: WorkspaceService; root: string }> {
  const root = join(base, name)
  sh(base, 'clone', '-q', join(base, 'remote.git'), root)
  sh(root, 'config', 'user.name', user)
  sh(root, 'config', 'user.email', `${user.toLowerCase()}@example.com`)
  const userDir = await mkdtemp(join(tmpdir(), `qa-wp-user-${name}-`))
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
async function create(ws: WorkspaceService, type: string, title: string, text = ''): Promise<string> {
  const it = ws.newItem(type)
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

describe('CR1-01: a second "Pull from…" of the same branch must not copy an item under a new ID', { timeout: 180_000 }, () => {
  it.fails('CR1-01: item created on the branch, pulled, committed, edited on both sides, pulled again → still one item', async () => {
    const base = await mkdtemp(join(tmpdir(), 'qa-wp-cr101-'))
    sh(base, 'init', '-q', '--bare', '-b', 'main', join(base, 'remote.git'))
    const a = await pc(base, 'a', 'Alice')
    await a.ws.initialize(a.root)
    await create(a.ws, 'system-requirement', 'Seed', 'seed')
    expect((await a.ws.commit('Start')).ok).toBe(true)
    expect((await a.ws.push()).ok).toBe(true)
    const b = await pc(base, 'b', 'Bob')
    await b.ws.open(b.root)

    // A: branch with a NEW item X
    expect((await a.ws.createBranch('feature/x')).ok).toBe(true)
    const x = await create(a.ws, 'system-requirement', 'Made on the branch', 'v1')
    expect((await a.ws.commit('X on feature')).ok).toBe(true)
    expect((await a.ws.push()).ok).toBe(true)

    // B (main): pull from the branch, commit
    await b.ws.pull()
    expect((await b.ws.pullFrom('origin/feature/x')).ok).toBe(true)
    expect((await b.ws.commit('Take X')).ok).toBe(true)

    // both sides edit X
    await edit(a.ws, x, (i) => (i.text = 'v2 on feature'))
    expect((await a.ws.commit('X v2')).ok).toBe(true)
    expect((await a.ws.push()).ok).toBe(true)
    await edit(b.ws, x, (i) => (i.title = 'Renamed on main'))
    expect((await b.ws.commit('Rename X')).ok).toBe(true)
    await b.ws.pull()

    await b.ws.pullFrom('origin/feature/x')
    const files = (await readdir(join(b.root, 'requirements', 'items'))).filter((f) => f.endsWith('.md'))
    // Seed + X = 2 items; the defect makes a third file (X copied under a new ID)
    expect(files).toHaveLength(2)
  })
})

describe('CR1-08: core texts follow the language (Arabic)', () => {
  const { schema } = parseSchema(readFileSync(join(__dirname, '..', 'config', 'default-schema.yaml'), 'utf8'))
  const it1: Item = { id: 'REQ-AAAAAAA', type: 'system-requirement', title: 'Old', order: 'a0', fields: {}, links: [], text: '', extra: {} }
  const arabic = /[؀-ۿ]/
  it.fails('CR1-08a: diff row labels Title/Type/Parent are Arabic in the Arabic window', () => {
    setLanguage('ar')
    const d = diffItems(it1, { ...it1, title: 'New', parent: 'REQ-BBBBBBB' }, schema)
    expect(d.rows.map((r) => r.label).filter((l) => !arabic.test(l))).toEqual([])
  })
  it.fails('CR1-08b: validation messages are Arabic in the Arabic window', () => {
    setLanguage('ar')
    const issues = validateItem({ ...it1, title: '', type: 'no-such-type' }, schema)
    expect(issues.length).toBeGreaterThan(0)
    expect(issues.map((i) => i.message).filter((m) => !arabic.test(m))).toEqual([])
  })
})

// ---------- new defects found by this review (QA-WP-xx) ----------

async function conflictPair(): Promise<{ b: { ws: WorkspaceService; root: string }; id: string }> {
  const base = await mkdtemp(join(tmpdir(), 'qa-wp-conf-'))
  sh(base, 'init', '-q', '--bare', '-b', 'main', join(base, 'remote.git'))
  const a = await pc(base, 'a', 'Alice')
  await a.ws.initialize(a.root)
  const id = await create(a.ws, 'system-requirement', 'Shared', 'text')
  expect((await a.ws.commit('Start')).ok).toBe(true)
  expect((await a.ws.push()).ok).toBe(true)
  const b = await pc(base, 'b', 'Bob')
  await b.ws.open(b.root)
  await edit(a.ws, id, (i) => (i.fields['status'] = 'Review'))
  await a.ws.commit('A: Review')
  expect((await a.ws.push()).ok).toBe(true)
  await edit(b.ws, id, (i) => (i.fields['status'] = 'Approved'))
  await b.ws.commit('B: Approved')
  return { b, id }
}

describe('QA-WP-01: a typed answer in the pull decision window is checked against the schema (NFR-05: validate before writing)', { timeout: 120_000 }, () => {
  it.fails('QA-WP-01a: "Bogus" for the Status choice is refused or corrected', async () => {
    const { b, id } = await conflictPair()
    const pulled = (await b.ws.pull()) as Awaited<ReturnType<WorkspaceService['pull']>> & { plan?: MergePlan }
    expect(pulled.plan?.questions).toHaveLength(1)
    const q = pulled.plan!.questions[0]!
    const fin = await b.ws.finishPull(pulled.plan!, { [q.path]: { 'field:status': { edit: 'Bogus' } } })
    const now = (await b.ws.getItem(id))?.item.fields['status']
    // defect: the pull succeeds and the item now holds a value the schema does not allow
    expect(fin.ok === false || ['Draft', 'Review', 'Approved', 'Obsolete'].includes(String(now))).toBe(true)
  })
})
