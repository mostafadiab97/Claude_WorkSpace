// 0.20.2 — data-safety fixes from the whole-project review (docs/reviews/2026-11-10-project-review.md, W-nn).
import { execFileSync } from 'node:child_process'
import { copyFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter, type CommandRunner } from '../src/modules/git-adapter'
import { mergeItems, type Item } from '../src/modules/items'
import { parseCsv, readXlsx } from '../src/modules/import-export'
import ExcelJS from 'exceljs'
import { buildProblemReport } from '../src/modules/logger'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { cacheFileName, createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }
async function setup(): Promise<{ ws: WorkspaceService; root: string; remote: string; base: string; sh: (...a: string[]) => string }> {
  const base = await mkdtemp(join(tmpdir(), 'rq-w20-'))
  const remote = join(base, 'remote.git')
  const root = join(base, 'work')
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote])
  execFileSync('git', ['init', '-q', '-b', 'main', root])
  const sh = (...a: string[]): string => execFileSync('git', a, { cwd: root, encoding: 'utf8' })
  sh('config', 'user.name', 'T')
  sh('config', 'user.email', 't@example.invalid')
  sh('remote', 'add', 'origin', remote)
  const userDir = await mkdtemp(join(tmpdir(), 'rq-w20-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: (r: string) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(r))),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
  await ws.initialize(root, 'System')
  return { ws, root, remote, base, sh }
}
const add = async (ws: WorkspaceService, title: string, parent?: string, document?: string): Promise<string> => {
  const it = { ...ws.newItem('system-requirement', parent, undefined, parent ? undefined : (document ?? 'System')), title }
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}

async function secondPc(remote: string): Promise<{ ws: WorkspaceService; root: string }> {
  const base = await mkdtemp(join(tmpdir(), 'rq-w20-b-'))
  const root = join(base, 'b')
  execFileSync('git', ['clone', '-q', remote, root])
  execFileSync('git', ['config', 'user.name', 'B'], { cwd: root })
  execFileSync('git', ['config', 'user.email', 'b@example.invalid'], { cwd: root })
  const userDir = await mkdtemp(join(tmpdir(), 'rq-w20-userb-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: (r: string) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(r))),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
  await ws.open(root)
  return { ws, root }
}
const edit = async (ws: WorkspaceService, id: string, change: (i: NonNullable<Awaited<ReturnType<WorkspaceService['getItem']>>>['item']) => void): Promise<void> => {
  const got = await ws.getItem(id)
  if (!got) throw new Error(`no ${id}`)
  change(got.item)
  const r = await ws.saveItem(got.item, got.revision)
  if (!r.ok) throw new Error(r.message)
}

describe('0.20.2 whole-project review fixes', () => {
  it('W-01: renewing a copied PARENT moves the copy\'s child, never the original child (copy document sorts after)', async () => {
    const { ws, root } = await setup()
    await ws.renameDocument('System', 'Alpha')
    await ws.refresh(true)
    const top = await add(ws, 'top', undefined, 'Alpha')
    const kid = await add(ws, 'kid', top)
    expect((await ws.commit('originals')).ok).toBe(true)
    await ws.createDocument('Zeta')
    for (const id of [top, kid]) await copyFile(join(root, 'requirements', 'Alpha', `${id}.md`), join(root, 'requirements', 'Zeta', `${id}.md`))
    await ws.refresh(true)
    const r = await ws.renewCopyId(top) // parent first
    expect(r.ok, r.ok ? '' : r.message).toBe(true)
    await ws.refresh(true)
    const newTop = ws.query({ document: 'Zeta' }).items.find((i) => i.title === 'top')
    expect(newTop?.id).not.toBe(top)
    // the original child still points to the original parent
    expect(ws.query({ document: 'Alpha' }).items.find((i) => i.id === kid)?.parent).toBe(top)
    // the copied child now points to the copy
    expect(ws.query({ document: 'Zeta' }).items.find((i) => i.title === 'kid')?.parent).toBe(newTop?.id)
  })
  it('W-02: a document with an Arabic name: a pull where both PCs edited the same item merges, and history finds it', async () => {
    const { ws, remote } = await setup()
    await ws.renameDocument('System', 'متطلبات')
    await ws.refresh(true)
    const id = await add(ws, 'shared', undefined, 'متطلبات')
    expect((await ws.commit('init')).ok).toBe(true)
    expect((await ws.push()).ok).toBe(true)
    const b = await secondPc(remote)
    await edit(b.ws, id, (i) => {
      i.title = 'title from B'
    })
    expect((await b.ws.commit('b')).ok).toBe(true)
    expect((await b.ws.push()).ok).toBe(true)
    await edit(ws, id, (i) => {
      i.fields.status = 'Review' // the line next to the title: Git sees one clash, the field merge solves it
    })
    expect((await ws.commit('a')).ok).toBe(true)
    const p = await ws.pull()
    expect(p.ok, p.message).toBe(true)
    const got = await ws.getItem(id)
    expect(got?.item.title).toBe('title from B')
    expect(got?.item.fields.status).toBe('Review')
    const h = await ws.itemHistory(id)
    expect(JSON.stringify(h)).toContain('"message":"b"')
    expect(Array.isArray(h) ? h.length : (h as { entries?: unknown[] }).entries?.length ?? 0).toBeGreaterThanOrEqual(3)
  })
  it('W-03: a merge keeps extra keys on links, and a change only to such a key is not lost', () => {
    const schema = { fields: [], itemTypes: [{ id: 'system-requirement', name: 'S' }] } as unknown as Parameters<typeof mergeItems>[3]
    const item = (title: string, note?: string, text = ''): Item => ({
      id: 'REQ-AAAAAAA', type: 'system-requirement', title, fields: {}, text, extra: {},
      links: [{ type: 'refines', target: 'REQ-BBBBBBB', ...(note ? { extra: { note } } : {}) }]
    })
    // mine changed the title, theirs changed only the link note
    const r = mergeItems(item('t', 'old'), item('t mine', 'old'), item('t', 'new'), schema)
    expect(r.conflicts).toEqual([])
    expect(r.item?.title).toBe('t mine')
    expect(r.item?.links[0]?.extra).toEqual({ note: 'new' })
    // only theirs changed the note: the merge must not treat the item as unchanged
    const r2 = mergeItems(item('t', 'old'), item('t', 'old'), item('t', 'new'), schema)
    expect(r2.item?.links[0]?.extra).toEqual({ note: 'new' })
    // both changed the note differently: asked, not silently decided (CR-04)
    const r3 = mergeItems(item('t', 'old'), item('t', 'mine'), item('t', 'theirs'), schema)
    expect(r3.conflicts).toHaveLength(1)
    expect(r3.conflicts[0]?.key).toMatch(/^link:.*:note$/)
    expect(mergeItems(item('t', 'old'), item('t', 'mine'), item('t', 'theirs'), schema, { [r3.conflicts[0]!.key]: 'theirs' }).item?.links[0]?.extra).toEqual({ note: 'theirs' })
  })
  it('W-04: exporting while an old version is shown gives valid ReqIF (no NUL characters in the title)', async () => {
    const { ws } = await setup()
    await add(ws, 'first')
    expect((await ws.commit('one')).ok).toBe(true)
    const first = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: (await ws.repoInfo())!.root, encoding: 'utf8' }).trim()
    await add(ws, 'second')
    expect((await ws.commit('two')).ok).toBe(true)
    expect((await ws.openVersion(first)).ok).toBe(true)
    const out = await ws.exportItems({ scope: 'all', columns: ['id', 'title'], format: 'reqif' } as Parameters<WorkspaceService['exportItems']>[0])
    const xml = String(out.content)
    expect(xml.includes(String.fromCharCode(0))).toBe(false)
    expect(xml).toMatch(/<TITLE>[^<]*work — requirements<\/TITLE>/)
    await ws.closeVersion()
  })
  it('W-11: Push sends only this branch to its upstream, whatever push.default or a "+" push rule says', async () => {
    const { ws, remote, sh } = await setup()
    await add(ws, 'a')
    expect((await ws.commit('a')).ok).toBe(true)
    expect((await ws.push()).ok).toBe(true)
    sh('branch', 'private-work')
    sh('config', 'push.default', 'matching')
    sh('config', 'remote.origin.push', '+refs/heads/*:refs/heads/*')
    await add(ws, 'b')
    expect((await ws.commit('b')).ok).toBe(true)
    expect((await ws.push()).ok).toBe(true)
    const heads = execFileSync('git', ['for-each-ref', '--format=%(refname)', 'refs/heads/'], { cwd: remote, encoding: 'utf8' })
    expect(heads.trim()).toBe('refs/heads/main')
  })
  it('W-05: CSV — a short row ending in a quoted cell does not swallow the rows after it', () => {
    const rows = parseCsv('ID,Title,Text,Status\r\nA-1,"Short row"\r\nA-2,Second,x,Draft\r\nA-3,"Third",y,Done')
    expect(rows.map((r) => r[0])).toEqual(['ID', 'A-1', 'A-2', 'A-3'])
    expect(rows[1]).toEqual(['A-1', 'Short row'])
    // the 0.16.3 case still works: a list line ending in 12" inside a quoted cell that is not the last column
    const kept = parseCsv('ID,Text,Status\nA-1,"- a 12"\n- b",Draft\n')
    expect(kept[1]).toEqual(['A-1', '- a 12"\n- b', 'Draft'])
    // CR-02: the continuation line has commas of its own
    const commas = parseCsv('ID,Text,Status\nA-1,"- a 12"\n- b, c, d",Draft\nA-2,y,Done\n')
    expect(commas[1]).toEqual(['A-1', '- a 12"\n- b, c, d', 'Draft'])
    expect(commas[2]).toEqual(['A-2', 'y', 'Done'])
  })
  it('W-06: an Excel file with a cell in row 50,000,000 is refused quickly instead of running out of memory', async () => {
    const wb = new ExcelJS.Workbook()
    const sheet = wb.addWorksheet('Items')
    sheet.getCell(1, 1).value = 'ID'
    sheet.getCell(50_000_000, 1).value = 'x'
    const data = new Uint8Array(await wb.xlsx.writeBuffer())
    const started = Date.now()
    await expect(readXlsx(data)).rejects.toThrow(/row 50,000,000/)
    expect(Date.now() - started).toBeLessThan(5000)
  })
  it('W-33: a problem report shows %USERPROFILE% instead of the Windows user folder', () => {
    const report = buildProblemReport({
      description: 'x',
      diagnostics: 'Log file: C:\\Users\\Sample.Person\\AppData\\Roaming\\reqochet-dev\\reqochet.log',
      log: 'opened c:/users/sample.person/Projects/demo\nopened D:\\Users\\other\\x',
      home: 'C:\\Users\\Sample.Person'
    })
    expect(report).not.toMatch(/Sample\.Person/i)
    expect(report).not.toMatch(/other/)
    expect(report).toContain('%USERPROFILE%\\AppData\\Roaming')
    expect(report).toContain('%USERPROFILE%/Projects/demo')
    // a profile name with a space, not the home folder (CR-10)
    const other = buildProblemReport({ description: '', diagnostics: 'C:\\Users\\Sam Ple\\docs', log: '', home: 'C:\\Users\\Other' })
    expect(other).not.toMatch(/Ple/)
  })
  it('W-02/W-08/W-12: every Git call gets plain paths, and heavy steps get the long time limit', async () => {
    const calls: { args: string[]; timeoutMs?: number }[] = []
    const run: CommandRunner = async (_f, args, o) => {
      calls.push({ args, timeoutMs: o?.timeoutMs })
      return args.includes('rev-parse') ? 'abc\n' : ''
    }
    const g = createSystemGitAdapter(run)
    await g.commit('/r', 'requirements', 'm')
    await g.switchBranch('/r', 'other')
    for (const c of calls) expect(c.args.slice(0, 2)).toEqual(['-c', 'core.quotePath=false'])
    const longOnes = calls.filter((c) => c.args.includes('add') || c.args.includes('commit') || c.args.includes('switch'))
    expect(longOnes.length).toBe(3)
    for (const c of longOnes) expect(c.timeoutMs).toBeGreaterThanOrEqual(15 * 60_000)
  })

  it('CR-01: Push refuses when the branch follows an upstream of another name (never onto the shared main)', async () => {
    const { ws, remote, sh } = await setup()
    await add(ws, 'a')
    expect((await ws.commit('a')).ok).toBe(true)
    expect((await ws.push()).ok).toBe(true)
    sh('fetch', '-q')
    sh('switch', '-q', '-c', 'fix', '--track', 'origin/main')
    await ws.refresh(true)
    await add(ws, 'on fix')
    expect((await ws.commit('fix work')).ok).toBe(true)
    const before = execFileSync('git', ['rev-parse', 'main'], { cwd: remote, encoding: 'utf8' })
    const r = await ws.push()
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/another name/)
    expect(execFileSync('git', ['rev-parse', 'main'], { cwd: remote, encoding: 'utf8' })).toBe(before)
  })
})
