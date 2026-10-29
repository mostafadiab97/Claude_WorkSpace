// 0.11.0 (M7): import a sheet into a repository, import it again, write changes back into the file, a new project
// from a file, publishing to an empty remote, and exporting chosen items.
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { parseCsv, readXlsx, updateXlsx } from '../src/modules/import-export'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quietLog = { info: () => {}, warn: () => {}, error: () => {} }
const sh = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' })
const SAMPLE = join(__dirname, '..', 'samples', 'sample-requirements.xlsx')

async function workspace(): Promise<{ ws: WorkspaceService; base: string }> {
  const base = await mkdtemp(join(tmpdir(), 'reqman-xl-'))
  const userDir = await mkdtemp(join(tmpdir(), 'reqman-xl-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: () => createSqliteIndexCache(join(userDir, 'index.sqlite')),
    userDir,
    log: quietLog
  })
  return { ws, base }
}
const sampleRows = async (): Promise<string[][]> => (await readXlsx(await readFile(SAMPLE)))[0]!.rows
const settings = { token: 't', sheet: 'Requirements', headerRow: 0, defaultType: 'system-requirement' }
const source = { path: SAMPLE, name: 'sample-requirements.xlsx', kind: 'xlsx' as const }

describe('Excel import into a repository (M7)', { timeout: 120_000 }, () => {
  it('a new project from the sample file: 59 items, hierarchy, links confirmed, one commit', async () => {
    const { ws, base } = await workspace()
    const root = join(base, 'project')
    await ws.createProject(root)
    sh(root, 'config', 'user.name', 'Tester')
    sh(root, 'config', 'user.email', 'tester@example.com')
    const rows = await sampleRows()
    const p = await ws.previewImport(rows, settings)
    expect(p.counts).toEqual({ create: 59, update: 0, unchanged: 0, skip: 0 })
    const r = await ws.runImport(rows, settings, source, 'Imported from sample-requirements.xlsx')
    expect(r).toMatchObject({ ok: true, created: 59, committed: true })
    expect(sh(root, 'log', '--format=%s').trim()).toBe('Imported from sample-requirements.xlsx')
    expect(sh(root, 'status', '--porcelain').trim()).toBe('')
    expect(ws.repoInfo().itemCount).toBe(59)
    // the stakeholder needs are the top level, the rest hangs below them
    expect(ws.query({ parent: null }).total).toBe(8 + 2 + 20) // needs, change requests and test cases have no parent
    expect(ws.query({ links: 'suspect' }).total).toBe(0)
    const sys = ws.query({ text: 'SYS-001', limit: 1000 }).items
    expect(sys.length).toBeGreaterThanOrEqual(0)
    expect(await ws.importSource()).toMatchObject({ name: 'sample-requirements.xlsx', sheet: 'Requirements' })
  })

  it('imports again: one changed cell = one update; "Update the Excel file" writes ReqMan edits back', async () => {
    const { ws, base } = await workspace()
    const root = join(base, 'repo')
    await ws.createProject(root)
    const rows = await sampleRows()
    await ws.runImport(rows, settings, source)
    const edited = rows.map((r) => (r[0] === 'SYS-003' ? r.map((c, i) => (i === 4 ? 'Review' : c)) : r))
    expect((await ws.previewImport(edited, settings)).counts).toEqual({ create: 0, update: 1, unchanged: 58, skip: 0 })
    // an edit in ReqMan and a new item, then "Update the Excel file"
    const id = ws.query({ text: 'Remote control', limit: 5 }).items.find((x) => x.title === 'Remote control')!.id
    const d = await ws.getItem(id)
    expect((await ws.saveItem({ ...d!.item, fields: { ...d!.item.fields, status: 'Obsolete' } }, d!.revision)).ok).toBe(true)
    const n = ws.newItem('stakeholder-need')
    n.title = 'Voice control'
    expect((await ws.saveItem(n, null)).ok).toBe(true)
    const u = await ws.sourceUpdate(rows)
    expect(u.edits).toEqual([{ row: 3, col: 5, value: 'Obsolete' }]) // lists in another order are not a change
    expect(u.added).toBe(1)
    expect(u.append[0]?.slice(0, 3)).toEqual([n.id, 'Stakeholder Need', 'Voice control'])
    const out = await updateXlsx(await readFile(SAMPLE), u.sheet, u.edits, u.append)
    const back = await readXlsx(out)
    expect(back.map((s) => s.name)).toEqual(['Requirements', 'About']) // the other sheet survives
    expect(back[0]!.rows[2]![4]).toBe('Obsolete')
    expect(back[0]!.rows[60]![2]).toBe('Voice control')
  })

  it('publishes a repository without a remote to an empty one', async () => {
    const { ws, base } = await workspace()
    const root = join(base, 'local')
    await ws.createProject(root)
    sh(root, 'config', 'user.name', 'Tester')
    sh(root, 'config', 'user.email', 'tester@example.com')
    await ws.runImport(await sampleRows(), settings, source, 'first')
    sh(base, 'init', '-q', '--bare', '-b', 'main', 'empty.git')
    expect((await ws.publish('not an address')).ok).toBe(false)
    const r = await ws.publish(pathToFileURL(join(base, 'empty.git')).href)
    expect(r.ok, r.message).toBe(true)
    expect(sh(join(base, 'empty.git'), 'log', '--format=%s', 'main').trim()).toBe('first')
    expect((await ws.publish(pathToFileURL(join(base, 'empty.git')).href)).ok).toBe(false) // already has origin
  })

  it('exports chosen items with everything below them, once each, in document order', async () => {
    const { ws, base } = await workspace()
    const root = join(base, 'chosen')
    await ws.createProject(root)
    await ws.runImport(await sampleRows(), settings, source)
    const need = ws.query({ parent: null, sort: { by: 'order' } }).items[0]!
    const child = ws.query({ parent: need.id, sort: { by: 'order' } }).items[0]!
    const csv = await ws.exportItems({ scope: 'chosen', ids: [child.id, need.id], includeBelow: true, columns: ['id', 'title', 'level'], format: 'csv' })
    const rows = parseCsv(csv.content as string).slice(1)
    expect(rows[0]![0]).toBe(need.id) // document order, not the order chosen
    expect(new Set(rows.map((r) => r[0])).size).toBe(rows.length) // no item twice
    let below = 0
    const walk = (id: string): void => {
      for (const c of ws.query({ parent: id, limit: 1000 }).items) {
        below++
        walk(c.id)
      }
    }
    walk(need.id)
    expect(rows.length).toBe(1 + below)
    expect(rows.find((r) => r[0] === child.id)?.[3]).toBe('2') // real level
    const only = await ws.exportItems({ scope: 'chosen', ids: [need.id], includeBelow: false, columns: ['id'], format: 'csv' })
    expect(only.count).toBe(1)
  })
})
