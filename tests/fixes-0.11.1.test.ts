// Owner's requests on 0.11.0: move several chosen items at once (they keep their order and children), and
// discard the changes of several items.
import { execFileSync } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const sh = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' })

async function setup(): Promise<{ ws: WorkspaceService; root: string }> {
  const base = await mkdtemp(join(tmpdir(), 'reqman-111-'))
  const root = join(base, 'repo')
  sh(base, 'init', '-q', '-b', 'main', root)
  sh(root, 'config', 'user.name', 'Tester')
  sh(root, 'config', 'user.email', 'tester@example.com')
  const userDir = await mkdtemp(join(tmpdir(), 'reqman-111-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: () => createSqliteIndexCache(join(userDir, 'index.sqlite')),
    userDir,
    log: { info: () => {}, warn: () => {}, error: () => {} }
  })
  await ws.initialize(root)
  return { ws, root }
}
const add = async (ws: WorkspaceService, title: string, parent?: string): Promise<string> => {
  const it = ws.newItem(parent ? 'system-requirement' : 'information', parent)
  it.title = title
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}
const titles = (ws: WorkspaceService, parent: string | null): string[] => ws.query({ parent, sort: { by: 'order' } }).items.map((i) => i.title)

describe('moving several items at once', { timeout: 60_000 }, () => {
  it('keeps their document order, places them together, and an item moves with its chosen parent', async () => {
    const { ws } = await setup()
    const ch1 = await add(ws, 'Chapter 1')
    const ch2 = await add(ws, 'Chapter 2')
    const a = await add(ws, 'A', ch1)
    const b = await add(ws, 'B', ch1)
    const c = await add(ws, 'C', ch1)
    const x = await add(ws, 'X', ch2)
    const b1 = await add(ws, 'B.1', b)
    // chosen in another order than the document: C, A — and B.1, whose parent B is not chosen
    expect(await ws.reparentItems([c, a, b1], ch2, x)).toEqual({ ok: true })
    expect(titles(ws, ch2)).toEqual(['A', 'B.1', 'C', 'X'])
    expect(titles(ws, ch1)).toEqual(['B'])
    // a chosen item under another chosen item stays under it
    expect(await ws.reparentItems([b, ch2], null, ch1)).toEqual({ ok: true })
    expect(titles(ws, null)).toEqual(['B', 'Chapter 2', 'Chapter 1'])
    expect(titles(ws, ch2)).toEqual(['A', 'B.1', 'C', 'X'])
    // not into one of the moved items' own children
    const loop = await ws.reparentItems([ch2, b], x, null)
    expect(loop.ok).toBe(false)
  })
})

describe('discarding several items', { timeout: 60_000 }, () => {
  it('takes back the chosen items and leaves the others', async () => {
    const { ws, root } = await setup()
    const a = await add(ws, 'A')
    const b = await add(ws, 'B')
    expect((await ws.commit('start')).ok).toBe(true)
    for (const id of [a, b]) {
      const d = await ws.getItem(id)
      expect((await ws.saveItem({ ...d!.item, title: `${d!.item.title} changed` }, d!.revision)).ok).toBe(true)
    }
    const n = await add(ws, 'New')
    const head = (await ws.compareOptions()).head as string
    const entries = (await ws.compareVersions(head, 'WORKING')).entries
    const pick = entries.filter((e) => e.id === a || e.id === n).flatMap((e) => e.paths)
    expect((await ws.discardChanges(pick)).ok).toBe(true)
    expect(sh(root, 'status', '--porcelain', '--', 'requirements').trim().split('\n')).toEqual([`M requirements/items/${b}.md`])
    expect((await ws.getItem(a))?.item.title).toBe('A')
    expect(await ws.getItem(n)).toBeNull()
  })
})
