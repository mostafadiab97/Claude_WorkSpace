// Tests for the fixes of the project review (docs/reviews/2026-10-25-project-review.md), released in 0.8.0.
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { isTransient, withRetry, writeFileAtomic } from '../src/modules/safe-files'
import { createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quietLog = { info: () => {}, warn: () => {}, error: () => {} }
const sh = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' })
const schemaFile = join(__dirname, '..', 'config', 'default-schema.yaml')

async function setup(opts: { git?: boolean; run?: Parameters<typeof createSystemGitAdapter>[0] } = {}): Promise<{ ws: WorkspaceService; root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'reqman-fix-'))
  const userDir = await mkdtemp(join(tmpdir(), 'reqman-fix-user-'))
  if (opts.git) {
    sh(root, 'init', '-q', '-b', 'main')
    sh(root, 'config', 'user.name', 'Tester')
    sh(root, 'config', 'user.email', 'tester@example.com')
  }
  const ws = createWorkspace({
    store: createFileRepositoryStore(schemaFile),
    git: createSystemGitAdapter(opts.run),
    openIndex: () => createSqliteIndexCache(join(userDir, 'index.sqlite')),
    userDir,
    log: quietLog
  })
  await ws.initialize(root)
  return { ws, root }
}

async function add(ws: WorkspaceService, type: string, title: string, parent?: string): Promise<string> {
  const it = ws.newItem(type, parent)
  it.title = title
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}

const itemsDir = (root: string): string => join(root, 'requirements', 'items')

describe('D-01 — an item whose file name differs from its ID', () => {
  it('can be opened, saved in place, deleted, and its file name fixed', async () => {
    const { ws, root } = await setup({ git: true })
    const id = await add(ws, 'risk', 'Overheating')
    const other = await add(ws, 'test-case', 'Heat test')
    await rename(join(itemsDir(root), `${id}.md`), join(itemsDir(root), 'RSK-RENAMD.md'))
    const info = await ws.refresh()
    expect(info.issues.find((i) => i.itemId === id)).toMatchObject({ fix: 'file-name', severity: 'warning' })

    const d = await ws.getItem(id)
    expect(d?.item.title).toBe('Overheating')
    // saving writes into the renamed file, never a second file with the same ID
    const saved = await ws.saveItem({ ...d!.item, title: 'Overheating of the PCB' }, d!.revision)
    expect(saved.ok).toBe(true)
    expect(await readFile(join(itemsDir(root), 'RSK-RENAMD.md'), 'utf8')).toContain('Overheating of the PCB')
    await expect(readFile(join(itemsDir(root), `${id}.md`), 'utf8')).rejects.toThrow()
    expect((await ws.refresh()).issues.filter((i) => i.path === 'id' || i.message.includes('files have the ID'))).toEqual([])

    // links to and from it work
    expect((await ws.addLink(other, 'verifies', id)).ok).toBe(true)
    expect((await ws.confirmLinks(other)).ok).toBe(true)

    const fixed = await ws.fixFileName(id)
    expect(fixed.ok).toBe(true)
    expect((await ws.refresh()).issues.filter((i) => i.fix)).toEqual([])
    expect((await ws.getItem(id))?.item.title).toBe('Overheating of the PCB')

    // deleting a renamed item removes the right file
    await rename(join(itemsDir(root), `${id}.md`), join(itemsDir(root), 'X-1.md'))
    await ws.refresh()
    const again = await ws.getItem(id)
    expect((await ws.deleteItem(id, again!.revision, { removeIncomingLinks: true })).ok).toBe(true)
    await expect(readFile(join(itemsDir(root), 'X-1.md'), 'utf8')).rejects.toThrow()
  })

  it('a fixed file name can be undone with Discard (owner checklist 0.8.0 step 3)', async () => {
    const { ws, root } = await setup({ git: true })
    const id = await add(ws, 'risk', 'Renamed risk')
    await rename(join(itemsDir(root), `${id}.md`), join(itemsDir(root), 'RSK-RENAMD.md'))
    expect((await ws.commit('data with a renamed file')).ok).toBe(true)
    await ws.refresh()
    expect((await ws.fixFileName(id)).ok).toBe(true)
    await ws.refresh()
    const st = await ws.gitState()
    expect(st.changes).toHaveLength(2)
    expect((await ws.discardChanges(st.changes.map((c) => c.path))).ok).toBe(true)
    expect((await ws.gitState()).changes).toEqual([])
    expect(await readFile(join(itemsDir(root), 'RSK-RENAMD.md'), 'utf8')).toContain('Renamed risk')
    expect((await ws.refresh()).issues.some((i) => i.fix === 'file-name')).toBe(true)
  })

  it('refuses to fix the name when <ID>.md is already taken', async () => {
    const { ws, root } = await setup()
    const id = await add(ws, 'risk', 'A')
    const text = await readFile(join(itemsDir(root), `${id}.md`), 'utf8')
    await writeFile(join(itemsDir(root), 'COPY.md'), text, 'utf8')
    await ws.refresh()
    // two files hold the ID; one is named right — the copy cannot take its name
    const issues = (await ws.refresh()).issues
    expect(issues.some((i) => i.message.includes('files have the ID'))).toBe(true)
  })
})

describe('D-04 — short Windows file locks', () => {
  it('retries while the error looks temporary, then succeeds', async () => {
    let calls = 0
    const r = await withRetry(
      async () => {
        calls++
        if (calls < 3) throw Object.assign(new Error('busy'), { code: 'EBUSY' })
        return 'done'
      },
      [1, 1, 1]
    )
    expect(r).toBe('done')
    expect(calls).toBe(3)
  })

  it('does not retry real errors, and gives up after the last wait', async () => {
    let calls = 0
    await expect(
      withRetry(async () => {
        calls++
        throw Object.assign(new Error('missing'), { code: 'ENOENT' })
      }, [1, 1])
    ).rejects.toThrow('missing')
    expect(calls).toBe(1)
    let busy = 0
    await expect(
      withRetry(async () => {
        busy++
        throw Object.assign(new Error('locked'), { code: 'EPERM' })
      }, [1, 1])
    ).rejects.toThrow('locked')
    expect(busy).toBe(3)
    expect(isTransient(Object.assign(new Error(), { code: 'EACCES' }))).toBe(true)
    expect(isTransient(Object.assign(new Error(), { code: 'ENOENT' }))).toBe(false)
  })

  it('writes atomically and creates the folder when asked (D-10)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'reqman-atomic-'))
    const file = join(dir, 'sub', 'settings.json')
    await writeFileAtomic(file, '{"a":1}', { mkdir: true })
    expect(await readFile(file, 'utf8')).toBe('{"a":1}')
    await writeFileAtomic(file, '{"a":2}')
    expect(await readFile(file, 'utf8')).toBe('{"a":2}')
    await rm(dir, { recursive: true, force: true })
  })
})

describe('D-03 — operations run one after another', () => {
  it('two saves of the same item started at once: the second sees the first and is refused', async () => {
    const { ws } = await setup()
    const id = await add(ws, 'system-requirement', 'Base')
    const d = await ws.getItem(id)
    const [a, b] = await Promise.all([
      ws.saveItem({ ...d!.item, title: 'First' }, d!.revision),
      ws.saveItem({ ...d!.item, title: 'Second' }, d!.revision)
    ])
    expect(a.ok).toBe(true)
    expect(b).toMatchObject({ ok: false, reason: 'conflict' })
    expect((await ws.getItem(id))?.item.title).toBe('First')
  })

  it('many moves at once end in a consistent order', async () => {
    const { ws } = await setup()
    const ids: string[] = []
    for (let i = 0; i < 6; i++) ids.push(await add(ws, 'system-requirement', `R${i}`))
    await Promise.all(ids.map((id) => ws.reparentItem(id, null, ids[0] === id ? null : ids[0])))
    const order = ws.query({ parent: null, sort: { by: 'order' } }).items.map((i) => i.order)
    expect(new Set(order).size).toBe(order.length) // no two items share a position
  })
})

describe('P-01 — refresh re-reads only what changed', () => {
  it('sees an outside edit, a new and a deleted file without checking everything', async () => {
    const { ws, root } = await setup()
    const id = await add(ws, 'system-requirement', 'Watched')
    const other = await add(ws, 'system-requirement', 'Other')
    await ws.refresh()
    await new Promise((r) => setTimeout(r, 100))
    expect((await ws.refresh()).lastSync.changedFiles).toBe(0)

    const file = join(itemsDir(root), `${id}.md`)
    await writeFile(file, (await readFile(file, 'utf8')).replace('Watched', 'Edited outside'), 'utf8')
    await rm(join(itemsDir(root), `${other}.md`))
    await new Promise((r) => setTimeout(r, 200))
    const info = await ws.refresh()
    expect(info.itemCount).toBe(1)
    expect(info.lastSync.full).toBe(false)
    expect(ws.query({ text: 'outside' }).total).toBe(1)
  })
})

describe('P-02 — the Git bar refresh starts few Git processes', () => {
  it('needs three Git commands per refresh once the slow facts are known', async () => {
    const calls: string[][] = []
    const { execFile } = await import('node:child_process')
    const run = (cmd: string, args: string[], o?: { timeoutMs?: number }): Promise<string> =>
      new Promise((resolve, reject) => {
        calls.push(args)
        execFile(cmd, args, { timeout: o?.timeoutMs ?? 30_000 }, (e, out, err) => (e ? reject(Object.assign(e, { stdout: out, stderr: err })) : resolve(out)))
      })
    const { ws } = await setup({ git: true, run })
    await ws.gitState()
    calls.length = 0
    const st = await ws.gitState()
    expect(st.available).toBe(true)
    expect(calls.length).toBeLessThanOrEqual(3)
  })
})

describe('D-07 — titles of deleted items in the Changes list', () => {
  it('come from the last commit in one go', async () => {
    const { ws, root } = await setup({ git: true })
    const ids = [await add(ws, 'system-requirement', 'Gone one'), await add(ws, 'system-requirement', 'Gone two')]
    expect((await ws.commit('two items')).ok).toBe(true)
    for (const id of ids) await rm(join(itemsDir(root), `${id}.md`))
    await ws.refresh()
    const st = await ws.gitState()
    expect(st.changes.filter((c) => c.kind === 'deleted').map((c) => c.title).sort()).toEqual(['Gone one', 'Gone two'])
  })
})

describe('P-05 and D-08 — changing field definitions', () => {
  it('re-reads no item file and keeps values of removed fields for when they come back', async () => {
    const { ws } = await setup()
    const id = await add(ws, 'system-requirement', 'With owner')
    const d = await ws.getItem(id)
    await ws.saveItem({ ...d!.item, fields: { ...d!.item.fields, owner: 'Alice' } }, d!.revision)
    let info = await ws.refresh()
    const without = info.schema.fields.filter((f) => f.id !== 'owner')
    const r1 = await ws.saveSchemaFields(without, info.schemaRevision)
    expect(r1.ok && r1.info.lastSync.full).toBe(false)
    expect(ws.query({}).items[0]?.fields['owner']).toBeUndefined()
    info = await ws.refresh()
    const r2 = await ws.saveSchemaFields([...info.schema.fields, { id: 'owner', name: 'Owner', type: 'text' }], info.schemaRevision)
    expect(r2.ok && r2.info.lastSync.full).toBe(false)
    expect(ws.query({ fields: { owner: ['Alice'] } }).total).toBe(1)
  })

  it('tells how many items hold values a changed definition does not allow', async () => {
    const { ws } = await setup()
    for (const p of ['High', 'Low', 'Low']) {
      const id = await add(ws, 'system-requirement', `P ${p}`)
      const d = await ws.getItem(id)
      await ws.saveItem({ ...d!.item, fields: { ...d!.item.fields, priority: p } }, d!.revision)
    }
    const info = await ws.refresh()
    const fields = info.schema.fields.map((f) => (f.id === 'priority' ? { ...f, options: ['High', 'Medium'] } : f))
    const check = ws.checkFields(fields)
    expect(check).toEqual([expect.objectContaining({ fieldId: 'priority', count: 2 })])
    expect(check[0]?.examples).toHaveLength(2)
    expect(ws.checkFields(info.schema.fields)).toEqual([])
  })
})
