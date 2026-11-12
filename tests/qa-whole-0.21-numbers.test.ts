// QA whole project 0.21 (helper agent, docs/AGENT-WORKFLOW.md): outline numbers — the fast header reader used by
// Compare against the full parser and the live index on hand-edited files; kept numbers after saves; sort by
// number with orphans. Assertions state the EXPECTED behaviour; `it.fails` marks a defect found.
// Details: docs/reviews/agents/whole-project-0.21-qa-tester.md
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { parseItemFile, readStructure } from '../src/modules/items'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { cacheFileName, createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }
async function makeWs(): Promise<WorkspaceService> {
  const userDir = await mkdtemp(join(tmpdir(), 'rq-qaw21-user-'))
  return createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: (r: string) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(r))),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
}
async function setup(): Promise<{ ws: WorkspaceService; root: string; sh: (...a: string[]) => string }> {
  const root = join(await mkdtemp(join(tmpdir(), 'rq-qaw21-')), 'proj')
  await mkdir(root)
  const sh = (...a: string[]): string => execFileSync('git', a, { cwd: root, encoding: 'utf8' })
  sh('init', '-q', '-b', 'main')
  sh('config', 'user.name', 'T')
  sh('config', 'user.email', 't@example.invalid')
  const ws = await makeWs()
  await ws.initialize(root, 'Spec')
  return { ws, root, sh }
}
const add = async (ws: WorkspaceService, title: string, o: { parent?: string; document?: string } = {}): Promise<string> => {
  const it = { ...ws.newItem('system-requirement', o.parent, undefined, o.parent ? undefined : (o.document ?? 'Spec')), title }
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}
const numbers = (ws: WorkspaceService): Map<string, string | undefined> => new Map(ws.query({ limit: 100000 }).items.map((i) => [i.id, i.number]))

describe('QA-W21 fast header reader against the full parser', { timeout: 120_000 }, () => {
  const file = (header: string): string => `---\n${header}\n---\nx\n`
  // DEFECT QW21-01: the fast reader ignores YAML continuation lines (a value wrapped onto an indented line), so it reads
  // a value or accepts a file that the full parser reads differently or refuses. Only hand-edited files.
  it.fails('QW21-01: never accepts a file the parser refuses, for hand-edited layouts (continued lines, tabs, flow style, keys in quotes, merge keys)', () => {
    const t = 'type: x\ntitle: T'
    const headers = [
      'id: REQ-AAAAAAA\nparent: REQ-BBBBBBB\n  CCC', // plain value continued on the next line
      'id: REQ-AAAAAAA\nparent:\n  REQ-BBBBBBB', // value on the next line
      'id: REQ-AAAAAAA\norder: a1\n  b', 'id:\n  REQ-AAAAAAA', '"id": REQ-AAAAAAA', 'id : REQ-AAAAAAA',
      'id: REQ-AAAAAAA\nparent: REQ-BBBBBBB, REQ-CCCCCCC', 'id: REQ-AAAAAAA\nparent: REQ-BBBBBBB:', 'id: REQ-AAAAAAA\nparent: REQ-B BBBBBB',
      'id: REQ-AAAAAAA\n<<: {parent: REQ-BBBBBBB}', 'id: REQ-AAAAAAA\nparent: REQ-BBBBBBB\r\norder: a1', 'id: REQ-AAAAAAA\n\nparent: REQ-BBBBBBB',
      'id: REQ-AAAAAAA\n# parent: REQ-BBBBBBB', 'id: REQ-AAAAAAA\n  parent: REQ-BBBBBBB', 'id: REQ-AAAAAAA\nParent: REQ-BBBBBBB', 'id: REQ-AAAAAAA\nparent: REQ-BBBBBBB\nparent: REQ-CCCCCCC',
      'id: req-aaaaaaa', 'id: REQ-AAAAAAA\nparent: REQ-AAAAAAA', 'id: REQ-AAAAAAA\norder: 9007199254740993', 'id: REQ-AAAAAAA\norder: 123456789012345'
    ]
    const bad: string[] = []
    for (const h of headers) {
      const text = file(`${h}\n${t}`)
      const fast = readStructure(text)
      if (fast === null) continue
      const full = parseItemFile(text, new Set())
      if (!full.ok) {
        bad.push(`fast accepts, parser refuses: ${JSON.stringify(h)}`)
        continue
      }
      const want = { id: full.item.id, ...(full.item.parent ? { parent: full.item.parent } : {}), ...(full.item.order !== undefined ? { order: full.item.order } : {}) }
      if (JSON.stringify(fast) !== JSON.stringify(want)) bad.push(`differs ${JSON.stringify(h)}: ${JSON.stringify(fast)} vs ${JSON.stringify(want)}`)
    }
    expect(bad).toEqual([])
  })
  it('QW21-02: Compare numbers equal the live numbers at both commits for hand-edited files (CRLF, BOM, quoted, legacy order, orphans, loop, tie, two documents)', async () => {
    const { ws, root, sh } = await setup()
    await mkdir(join(root, 'requirements', 'Other'), { recursive: true })
    const A = 'REQ-AAAAAAA', B = 'REQ-BBBBBBB', C = 'REQ-CCCCCCC', D = 'REQ-DDDDDDD', E = 'REQ-EEEEEEE', F = 'REQ-FFFFFFF', G = 'REQ-GGGGGGG', H = 'REQ-HHHHHHH', I = 'REQ-JJJJJJJ', J = 'REQ-KKKKKKK'
    const f = (id: string, extra: string, title = 'T', type = 'system-requirement'): string => `---\nid: ${id}\ntype: ${type}\ntitle: ${title}\n${extra}---\nbody\n`
    const files: Record<string, string> = {
      [`Spec/${A}.md`]: f(A, 'order: a0\n'),
      [`Spec/${B}.md`]: f(B, `parent: ${A}\norder: a1\n`).replace(/\n/g, '\r\n'),
      [`Spec/${C}.md`]: String.fromCharCode(0xfeff) + f(C, `parent: ${A}\norder: a0\n`),
      [`Spec/${D}.md`]: f(D, `parent: "${A}"\norder: a2\n`),
      [`Spec/${E}.md`]: f(E, 'order: 30\n'), // legacy numeric order
      [`Spec/${F}.md`]: f(F, `parent: REQ-ZZZZZZZ\norder: a0\n`), // orphan
      [`Spec/${G}.md`]: f(G, `parent: ${H}\norder: a0\n`), // loop with H
      [`Spec/${H}.md`]: f(H, `parent: ${G}\norder: a0\n`),
      [`Spec/${I}.md`]: f(I, 'order: a0\n'), // tie with A on order
      [`Other/${J}.md`]: f(J, `parent: ${A}\norder: a0\n`), // parent in the other document
      'Spec/NOTES.md': 'just notes\n'
    }
    for (const [p, c] of Object.entries(files)) await writeFile(join(root, 'requirements', p), c)
    sh('add', '-A')
    sh('commit', '-q', '-m', 'hand edited')
    const c1 = sh('rev-parse', 'HEAD').trim()
    // second commit: every item gets a new title by plain text replacement (keeps each file's own style)
    for (const [p, c] of Object.entries(files)) if (p.endsWith('.md') && !p.includes('NOTES')) await writeFile(join(root, 'requirements', p), c.replace('title: T', 'title: T2'))
    sh('add', '-A')
    sh('commit', '-q', '-m', 'titles')
    const c2 = sh('rev-parse', 'HEAD').trim()
    expect((await ws.open(root)) !== undefined).toBe(true)
    const liveAfter = numbers(ws)
    const r = await ws.compareVersions(c1, c2)
    const fromCompare = new Map(r.entries.map((e) => [e.id, e]))
    const ve = await ws.openVersion(c1)
    expect(ve.ok).toBe(true)
    const liveBefore = numbers(ws)
    await ws.closeVersion()
    const diffs: string[] = []
    for (const [id, e] of fromCompare) {
      if (e.numberAfter !== liveAfter.get(id)) diffs.push(`${id} after ${e.numberAfter} vs live ${liveAfter.get(id)}`)
      if (e.numberBefore !== liveBefore.get(id)) diffs.push(`${id} before ${e.numberBefore} vs live ${liveBefore.get(id)}`)
    }
    expect(fromCompare.size).toBeGreaterThanOrEqual(8)
    expect(diffs).toEqual([])
  })
})

describe('QA-W21 kept outline numbers after saves (W-21)', { timeout: 120_000 }, () => {
  async function freshNumbers(root: string): Promise<Map<string, string | undefined>> {
    const other = await makeWs()
    await other.open(root)
    return numbers(other)
  }
  it('QW21-03: after saves that change position, parent, type, title, or links, the numbers are those of a freshly opened project', async () => {
    const { ws, root } = await setup()
    const a = await add(ws, 'a'), b = await add(ws, 'b'), c = await add(ws, 'c', { parent: a }), d = await add(ws, 'd', { parent: a })
    const e = await add(ws, 'e')
    const check = async (label: string): Promise<void> => {
      const live = numbers(ws)
      const fresh = await freshNumbers(root)
      expect([...live].sort(), label).toEqual([...fresh].sort())
    }
    await check('start')
    const edit = async (id: string, f: (i: NonNullable<Awaited<ReturnType<WorkspaceService['getItem']>>>['item']) => void): Promise<void> => {
      const g = await ws.getItem(id)
      f(g!.item)
      const r = await ws.saveItem(g!.item, g!.revision)
      expect(r.ok, JSON.stringify(r)).toBe(true)
    }
    await edit(c, (i) => { i.title = 'retitled' })
    await check('title')
    await edit(d, (i) => { i.order = 'a0' }) // moves d before c
    await check('order')
    await edit(e, (i) => { i.parent = b })
    await check('parent')
    await edit(e, (i) => { i.parent = undefined })
    await check('parent removed')
    await edit(b, (i) => { i.type = 'information' })
    await check('type')
    await edit(a, (i) => { i.links = [{ type: 'refines', target: b }] })
    await check('links')
    await edit(a, (i) => { i.text = 'x'; i.order = undefined })
    await check('order removed')
    expect(await ws.renameDocument('Spec', 'Renamed')).toMatchObject({ ok: true })
    await check('document renamed')
  })
  it('QW21-04: parallel saves of different items (one moves, one retitles) leave numbers equal to a fresh open', async () => {
    const { ws, root } = await setup()
    const ids: string[] = []
    for (let k = 0; k < 6; k++) ids.push(await add(ws, `i${k}`))
    const gs = await Promise.all(ids.map((id) => ws.getItem(id)))
    await Promise.all(
      gs.map((g, k) => {
        const item = g!.item
        if (k % 2 === 0) item.title = `t${k}`
        else item.order = `a${9 - k}`
        return ws.saveItem(item, g!.revision)
      })
    )
    const live = numbers(ws)
    const fresh = await makeWs()
    await fresh.open(root)
    expect([...live].sort()).toEqual([...numbers(fresh)].sort())
  })
  it('QW21-05: an outside change to another file that the index picks up during a save does not keep an old number (hand-moved file)', async () => {
    const { ws, root } = await setup()
    const a = await add(ws, 'a'), b = await add(ws, 'b')
    numbers(ws) // fill the cache
    // someone edits b's order by hand; the app is told only about a's save
    const { readFile } = await import('node:fs/promises')
    const pb = join(root, 'requirements', 'Spec', `${b}.md`)
    const text = await readFile(pb, 'utf8')
    await writeFile(pb, text.replace(/order: .*/, 'order: Zz'), 'utf8')
    await writeFile(pb, (await readFile(pb, 'utf8')).replace(/order: .*/, 'order: 0'), 'utf8')
    const g = await ws.getItem(a)
    g!.item.title = 'a2'
    expect((await ws.saveItem(g!.item, g!.revision)).ok).toBe(true)
    await ws.refresh(true)
    const live = numbers(ws)
    const fresh = await makeWs()
    await fresh.open(root)
    expect([...live].sort()).toEqual([...numbers(fresh)].sort())
  })
})

describe('QA-W21 sort by number with orphans', { timeout: 120_000 }, () => {
  it('QW21-06: sort by number puts numbered items in outline order (1.10 after 1.9), orphans and loops last, both directions, paging stable', async () => {
    const { ws, root } = await setup()
    const a = await add(ws, 'a')
    const kids: string[] = []
    for (let k = 0; k < 12; k++) kids.push(await add(ws, `k${k}`, { parent: a }))
    const f = (id: string, extra: string): string => `---\nid: ${id}\ntype: system-requirement\ntitle: x\n${extra}---\n`
    await writeFile(join(root, 'requirements', 'Spec', 'REQ-ORPHAN1.md'), f('REQ-ORPHAN1', 'parent: REQ-NOWHERE\n'))
    await writeFile(join(root, 'requirements', 'Spec', 'REQ-LOOP001.md'), f('REQ-LOOP001', 'parent: REQ-LOOP002\n'))
    await writeFile(join(root, 'requirements', 'Spec', 'REQ-LOOP002.md'), f('REQ-LOOP002', 'parent: REQ-LOOP001\n'))
    await ws.refresh(true)
    const asc = ws.query({ sort: { by: 'number' }, limit: 100000 }).items
    const nums = asc.map((i) => i.number)
    const numbered = nums.filter((n) => n !== undefined) as string[]
    expect(numbered.length).toBe(13)
    expect(numbered.slice(0, 3)).toEqual(['1', '1.1', '1.2'])
    expect(numbered[numbered.length - 1]).toBe('1.12')
    expect(nums.slice(13).every((n) => n === undefined)).toBe(true)
    expect(nums.length).toBe(16)
    const desc = ws.query({ sort: { by: 'number', descending: true }, limit: 100000 }).items.map((i) => i.id)
    // descending: the reverse of ascending among numbered items; every item exactly once
    expect(new Set(desc).size).toBe(16)
    const descNumbered = ws.query({ sort: { by: 'number', descending: true }, limit: 100000 }).items.filter((i) => i.number !== undefined).map((i) => i.number)
    expect(descNumbered).toEqual([...numbered].reverse())
    const pages: string[] = []
    for (let off = 0; off < 16; off += 5) pages.push(...ws.query({ sort: { by: 'number' }, limit: 5, offset: off }).items.map((i) => i.id))
    expect(pages).toEqual(asc.map((i) => i.id))
    void kids
  })
  it('QW21-07: sort by number with a search filter and with two documents does not mix documents', async () => {
    const { ws } = await setup()
    await ws.createDocument('Zeta')
    const a = await add(ws, 'alpha one', { document: 'Zeta' })
    await add(ws, 'alpha two', { parent: a })
    await add(ws, 'alpha three')
    const rows = ws.query({ text: 'alpha', sort: { by: 'number' }, limit: 100000 }).items
    expect(rows.length).toBe(3)
    expect(rows.map((r) => r.number)).toEqual(['1', '1', '1.1']) // each document counts from 1
  })
})
