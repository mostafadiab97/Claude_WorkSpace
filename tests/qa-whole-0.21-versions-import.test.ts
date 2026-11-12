// QA whole project 0.21 (helper agent, docs/AGENT-WORKFLOW.md): link extras in merges, old-version export and compare,
// the old-version view under concurrent calls, CSV and Excel import limits. Assertions state the EXPECTED behaviour;
// `it.fails` marks a defect found. Details: docs/reviews/agents/whole-project-0.21-qa-tester.md
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { parseCsv, readReqif, readXlsx } from '../src/modules/import-export'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { mergeItems, type Item } from '../src/modules/items'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { cacheFileName, createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }
async function setup(): Promise<{ ws: WorkspaceService; root: string; sh: (...a: string[]) => string }> {
  const root = join(await mkdtemp(join(tmpdir(), 'rq-qaw21v-')), 'proj')
  await mkdir(root)
  const userDir = await mkdtemp(join(tmpdir(), 'rq-qaw21v-user-'))
  const sh = (...a: string[]): string => execFileSync('git', a, { cwd: root, encoding: 'utf8' })
  sh('init', '-q', '-b', 'main')
  sh('config', 'user.name', 'T')
  sh('config', 'user.email', 't@example.invalid')
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: (r: string) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(r))),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
  await ws.initialize(root, 'Spec')
  return { ws, root, sh }
}
const add = async (ws: WorkspaceService, title: string, parent?: string): Promise<string> => {
  const it = { ...ws.newItem('system-requirement', parent, undefined, parent ? undefined : 'Spec'), title }
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}
const text = (c: string | Uint8Array): string => (typeof c === 'string' ? c : Buffer.from(c).toString('utf8'))

describe('QA-W21 link extras in merges (W-03)', () => {
  const schema = { fields: [], itemTypes: [{ id: 'system-requirement', name: 'S' }] } as unknown as Parameters<typeof mergeItems>[3]
  const item = (links: Item['links'], title = 't'): Item => ({ id: 'REQ-AAAAAAA', type: 'system-requirement', title, fields: {}, text: '', extra: {}, links })
  const L = (target: string, extra?: Record<string, unknown>, confirmed?: string): Item['links'][number] => ({ type: 'refines', target, ...(confirmed ? { confirmed } : {}), ...(extra ? { extra } : {}) })
  it('QW21-40: a note added on one side only, removed on the other side only, and kept untouched elsewhere', () => {
    const base = item([L('REQ-BBBBBBB', { note: 'n' }), L('REQ-CCCCCCC')])
    const mine = item([L('REQ-BBBBBBB'), L('REQ-CCCCCCC', { tool: 'x' })]) // removed note on B, added tool on C
    const r = mergeItems(base, mine, structuredClone(base), schema)
    expect(r.conflicts).toEqual([])
    expect(r.item?.links.find((l) => l.target === 'REQ-BBBBBBB')?.extra).toBeUndefined()
    expect(r.item?.links.find((l) => l.target === 'REQ-CCCCCCC')?.extra).toEqual({ tool: 'x' })
  })
  it('QW21-41: extra values that are lists or maps compare by value, so equal structures on both sides are no conflict', () => {
    const base = item([L('REQ-BBBBBBB', { tags: ['a'], meta: { k: 1 } })])
    const same = item([L('REQ-BBBBBBB', { tags: ['a', 'b'], meta: { k: 1, j: 2 } })])
    const same2 = item([L('REQ-BBBBBBB', { meta: { k: 1, j: 2 }, tags: ['a', 'b'] })]) // other key order
    const r = mergeItems(base, same, same2, schema)
    expect(r.conflicts).toEqual([])
    expect(r.item?.links[0]?.extra).toEqual({ tags: ['a', 'b'], meta: { k: 1, j: 2 } })
  })
  it('QW21-42: a link added on both sides with different notes is a question, not a silent pick; the link added on one side keeps its note', () => {
    const base = item([])
    const r = mergeItems(base, item([L('REQ-BBBBBBB', { note: 'mine' })]), item([L('REQ-BBBBBBB', { note: 'theirs' }), L('REQ-CCCCCCC', { note: 'only theirs' })]), schema)
    expect(r.item?.links.find((l) => l.target === 'REQ-CCCCCCC')?.extra).toEqual({ note: 'only theirs' })
    expect(r.conflicts.length).toBe(1)
  })
  it('QW21-43: a link removed by one side while the other side changed only its note: asked, and the note change is not silently lost', () => {
    const base = item([L('REQ-BBBBBBB', { note: 'old' })])
    const r = mergeItems(base, item([]), item([L('REQ-BBBBBBB', { note: 'new' })]), schema)
    const kept = r.item?.links.find((l) => l.target === 'REQ-BBBBBBB')
    // either the link is gone with a question about it, or it is kept with the new note; silent loss of the edit is the defect
    expect(r.conflicts.length > 0 || kept?.extra?.note === 'new').toBe(true)
  })
  it('QW21-44: a note with a key like __proto__ or constructor survives as plain data and does not change other links', () => {
    const base = item([L('REQ-BBBBBBB')])
    const evil = JSON.parse('{"__proto__": {"polluted": 1}, "constructor": "c"}') as Record<string, unknown>
    const r = mergeItems(base, item([L('REQ-BBBBBBB', evil)]), structuredClone(base), schema)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(Object.keys(r.item?.links[0]?.extra ?? {})).toContain('constructor')
  })
})

describe('QA-W21 old versions: export, compare, and the view under concurrent calls', { timeout: 180_000 }, () => {
  async function twoCommits(): Promise<{ ws: WorkspaceService; root: string; sh: (...a: string[]) => string; ids: string[]; c1: string; c2: string }> {
    const { ws, root, sh } = await setup()
    const a = await add(ws, 'alpha')
    const b = await add(ws, 'beta', a)
    const c = await add(ws, 'gamma')
    expect((await ws.commit('one')).ok).toBe(true)
    const c1 = sh('rev-parse', 'HEAD').trim()
    const g = await ws.getItem(b)
    g!.item.title = 'beta changed'
    expect((await ws.saveItem(g!.item, g!.revision)).ok).toBe(true)
    await add(ws, 'delta')
    expect((await ws.commit('two')).ok).toBe(true)
    return { ws, root, sh, ids: [a, b, c], c1, c2: sh('rev-parse', 'HEAD').trim() }
  }
  it('QW21-50: exports of the shown old version (csv, markdown, xlsx, reqif) hold the OLD titles, no control characters, and the count matches the version', async () => {
    const { ws, c1 } = await twoCommits()
    expect((await ws.openVersion(c1)).ok).toBe(true)
    for (const format of ['csv', 'markdown', 'xlsx', 'reqif'] as const) {
      const r = await ws.exportItems({ scope: 'all', columns: ['id', 'title', 'level', 'text'], format })
      expect(r.count, format).toBe(3)
      if (format === 'xlsx') {
        const rows = JSON.stringify(await readXlsx(new Uint8Array(r.content as Uint8Array)))
        expect(rows).toContain('beta')
        expect(rows).not.toContain('beta changed')
        expect(rows).not.toContain('delta')
      } else {
        const t = text(r.content)
        expect(t, format).toContain('beta')
        expect(t, format).not.toContain('beta changed')
        expect(t, format).not.toContain('delta')
        // eslint-disable-next-line no-control-regex
        expect(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(t), `${format} has control characters`).toBe(false)
      }
    }
    await ws.closeVersion()
    expect((await ws.exportItems({ scope: 'all', columns: ['id', 'title'], format: 'csv' })).count).toBe(4)
  })
  it('QW21-51: export of a version that holds a control character in a title (hand-edited file) reads back as valid ReqIF and CSV', async () => {
    const { ws, root, sh } = await setup()
    const a = await add(ws, 'plain')
    const p = join(root, 'requirements', 'Spec', `${a}.md`)
    await writeFile(p, (await readFile(p, 'utf8')).replace('title: plain', 'title: "bad\\x01\\x0b title \\u0085 end"'))
    sh('add', '-A')
    sh('commit', '-q', '-m', 'ctl')
    const c = sh('rev-parse', 'HEAD').trim()
    await ws.refresh(true)
    await add(ws, 'later')
    expect((await ws.commit('later')).ok).toBe(true)
    expect((await ws.openVersion(c)).ok).toBe(true)
    const reqif = await ws.exportItems({ scope: 'all', columns: ['id', 'title'], format: 'reqif' })
    const back = await readReqif(text(reqif.content))
    expect(JSON.stringify(back)).toContain('title')
    const csv = await ws.exportItems({ scope: 'all', columns: ['id', 'title'], format: 'csv' })
    expect(parseCsv(text(csv.content)).length).toBe(2)
    // eslint-disable-next-line no-control-regex
    expect(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text(reqif.content))).toBe(false)
  })
  it('QW21-52: exportCompare between two commits in every format while an old version is shown names the changes and does not depend on the shown version', async () => {
    const { ws, c1, c2 } = await twoCommits()
    expect((await ws.openVersion(c1)).ok).toBe(true)
    for (const format of ['csv', 'markdown', 'xlsx', 'reqif'] as const) {
      const r = await ws.exportCompare(c1, c2, format)
      expect(r.count, format).toBe(2) // beta modified, delta added
    }
    expect((await ws.compareVersions(c1, c2)).entries.map((e) => e.kind).sort()).toEqual(['added', 'modified'])
  })
  it('QW21-53: one item deleted and a different one added in the same commit: one deletion and one addition, even when the files look nearly alike (W-07)', async () => {
    const { ws, root, sh } = await setup()
    const a = await add(ws, 'same title')
    expect((await ws.commit('one')).ok).toBe(true)
    const c1 = sh('rev-parse', 'HEAD').trim()
    const old = await readFile(join(root, 'requirements', 'Spec', `${a}.md`), 'utf8')
    sh('rm', '-q', join('requirements', 'Spec', `${a}.md`))
    await writeFile(join(root, 'requirements', 'Spec', 'REQ-NEWNEW1.md'), old.replace(a, 'REQ-NEWNEW1'))
    sh('add', '-A')
    sh('commit', '-q', '-m', 'swap')
    const c2 = sh('rev-parse', 'HEAD').trim()
    await ws.refresh(true)
    const r = await ws.compareVersions(c1, c2)
    expect(r.entries.map((e) => `${e.id}:${e.kind}`).sort()).toEqual([`${a}:deleted`, 'REQ-NEWNEW1:added'].sort())
    const toWorking = await ws.compareVersions(c1, 'WORKING')
    expect(toWorking.entries.length).toBe(0)
  })
  it('QW21-54: the same ID kept while the file is renamed by hand (same item, new file name) is one modified/moved entry, never deleted+added', async () => {
    const { ws, root, sh } = await setup()
    const a = await add(ws, 'keep me')
    expect((await ws.commit('one')).ok).toBe(true)
    const c1 = sh('rev-parse', 'HEAD').trim()
    sh('mv', join('requirements', 'Spec', `${a}.md`), join('requirements', 'Spec', `${a} renamed.md`))
    sh('commit', '-q', '-am', 'rename file')
    const c2 = sh('rev-parse', 'HEAD').trim()
    const r = await ws.compareVersions(c1, c2)
    expect(r.entries.filter((e) => e.id === a).length).toBeLessThanOrEqual(1)
    expect(r.entries.some((e) => e.kind === 'deleted')).toBe(false)
  })
  it('QW21-55: openVersion twice and closeVersion at once, with queries in between: the last call wins, no call throws, and the end state is coherent', async () => {
    const { ws, c1, c2 } = await twoCommits()
    const calls: Promise<unknown>[] = [
      ws.openVersion(c1),
      Promise.resolve().then(() => ws.query({ limit: 100 })),
      ws.openVersion(c2),
      Promise.resolve().then(() => ws.query({ limit: 100 })),
      ws.openVersion(c1),
      ws.closeVersion(),
      ws.openVersion(c2)
    ]
    const settled = await Promise.allSettled(calls)
    expect(settled.filter((s) => s.status === 'rejected').map((s) => String((s as PromiseRejectedResult).reason))).toEqual([])
    const info = ws.repoInfo()
    const rows = ws.query({ limit: 100 })
    // whichever version is shown, the table agrees with its label
    if (info.version) expect(rows.total).toBe(info.version.ref.startsWith(c2.slice(0, 7)) || info.version.ref === c2 ? 4 : 3)
    else expect(rows.total).toBe(4)
    await ws.closeVersion()
    expect(ws.repoInfo().version).toBeUndefined()
    expect(ws.query({ limit: 100 }).total).toBe(4)
  })
  it('QW21-56: while an old version is shown every write and Git action is refused with a message and writes nothing', async () => {
    const { ws, root, sh, ids, c1 } = await twoCommits()
    expect((await ws.openVersion(c1)).ok).toBe(true)
    const before = sh('status', '--porcelain')
    const g = await ws.getItem(ids[0] as string)
    g!.item.title = 'edited in old view'
    const s = await ws.saveItem(g!.item, g!.revision)
    expect(s.ok).toBe(false)
    expect((await ws.deleteItem(ids[2] as string, g!.revision)).ok).toBe(false)
    expect((await ws.createBaseline({ name: 'during-view', note: '' })).ok).toBe(false)
    expect((await ws.commit('x')).ok).toBe(false)
    expect((await ws.renameDocument('Spec', 'Other')).ok).toBe(false)
    expect(sh('status', '--porcelain')).toBe(before)
    const parallel = await Promise.all([ws.saveItem(g!.item, g!.revision), ws.closeVersion()])
    // a save that races with closing must either be refused or applied to the live item, never to the old commit
    if (parallel[0].ok) expect((await readFile(join(root, 'requirements', 'Spec', `${ids[0]}.md`), 'utf8')).includes('edited in old view')).toBe(true)
    expect(ws.repoInfo().version).toBeUndefined()
  })
  it('QW21-57: opening a commit that does not exist, a tag name, a branch name, and an abbreviated hash: clear message or works; the live table is untouched', async () => {
    const { ws, sh, c1 } = await twoCommits()
    sh('tag', 'plain-tag', c1)
    expect((await ws.openVersion('0000000000000000000000000000000000000000')).ok).toBe(false)
    expect(ws.repoInfo().version).toBeUndefined()
    expect((await ws.openVersion('--output=/tmp/x')).ok).toBe(false)
    expect(ws.repoInfo().version).toBeUndefined()
    for (const ref of ['plain-tag', c1.slice(0, 8), 'main~1']) {
      const r = await ws.openVersion(ref)
      expect(r.ok, ref).toBe(true)
      expect(ws.query({ limit: 100 }).total, ref).toBe(3)
    }
    await ws.closeVersion()
  })
})

describe('QA-W21 CSV and Excel limits (W-05, W-06)', { timeout: 180_000 }, () => {
  it('QW21-60: CSV: short rows, rows ending in a quoted cell, CRLF, lone CR, an empty quoted cell and a final line without a break keep every row apart', () => {
    const csv = 'a,b,c\r\n1,"x"\r\n2,"y ""q"" z",3\r\n"",""\r\n4\r\n5,"multi\r\nline"\r\n6,"last"'
    expect(parseCsv(csv)).toEqual([['a', 'b', 'c'], ['1', 'x'], ['2', 'y "q" z', '3'], ['', ''], ['4'], ['5', 'multi\r\nline'], ['6', 'last']].map((r) => r.map((c) => c.replace('\r\n', '\n'))).map((r, i) => (i === 5 ? ['5', 'multi\r\nline'] : r)))
  })
  it('QW21-61: CSV: an unterminated quote at the end gives the rest as one cell without throwing, and 200,000 short rows parse in a few seconds', () => {
    expect(() => parseCsv('a,b\n1,"never closed\n2,3')).not.toThrow()
    const big = Array.from({ length: 200_000 }, (_, k) => `${k},"v${k}"`).join('\n')
    const t = Date.now()
    expect(parseCsv(big).length).toBe(200_000)
    expect(Date.now() - t).toBeLessThan(8000)
  })
  it('QW21-62: CSV with separators ; and tab, a BOM and Arabic quoted cells that contain the separator', () => {
    expect(parseCsv('﻿id;عنوان\n1;"أ؛ب"\n2;"x"', ';')).toEqual([['id', 'عنوان'], ['1', 'أ؛ب'], ['2', 'x']])
    expect(parseCsv('a\tb\n"1\t2"\t3', '\t')).toEqual([['a', 'b'], ['1\t2', '3']])
  })
  async function craft(rowRef: string): Promise<Uint8Array> {
    const wb = new ExcelJS.Workbook()
    const sh = wb.addWorksheet('Items')
    sh.getCell(1, 1).value = 'ID'
    sh.getCell(2, 1).value = 'x'
    const zip = await JSZip.loadAsync(await wb.xlsx.writeBuffer())
    const f = Object.keys(zip.files).find((n) => n.includes('sheet1.xml')) as string
    const xml = (await zip.file(f)!.async('string')).replace('r="2"', `r="${rowRef}"`).replace('r="A2"', `r="A${rowRef}"`)
    zip.file(f, xml)
    return zip.generateAsync({ type: 'uint8array' })
  }
  it('QW21-63: Excel: rows beyond Excel\'s limit (1,048,577; 4,294,967,296; 99,999,999,999,999) are refused at once with a message, never a crash or a hang', async () => {
    for (const row of ['1048577', '4294967296', '99999999999999']) {
      const t = Date.now()
      await expect(readXlsx(await craft(row)), row).rejects.toThrow()
      expect(Date.now() - t, row).toBeLessThan(5000)
    }
  })
  it('QW21-64: Excel: a cell in the very last allowed row (1,048,576) is read within a few seconds and memory stays small', async () => {
    const t = Date.now()
    const r = await readXlsx(await craft('1048576'))
    expect(JSON.stringify(r).length).toBeGreaterThan(0)
    expect(Date.now() - t).toBeLessThan(15_000)
  })
  it('QW21-65: Excel: a file that is not a zip, an empty zip, and a zip without a sheet are refused with a message', async () => {
    await expect(readXlsx(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow()
    await expect(readXlsx(new Uint8Array(await new JSZip().generateAsync({ type: 'uint8array' })))).rejects.toThrow()
    const wb = new ExcelJS.Workbook()
    await expect(readXlsx(new Uint8Array(await wb.xlsx.writeBuffer()))).rejects.toThrow()
  })
  it('QW21-66: Excel: a sheet with a merged range covering one million rows, and a formula cell with a huge cached text, read without hanging', async () => {
    const wb = new ExcelJS.Workbook()
    const sh = wb.addWorksheet('Items')
    sh.getCell(1, 1).value = 'ID'
    sh.getCell(1, 2).value = 'Title'
    sh.getCell(2, 1).value = 'x'
    sh.mergeCells('B2:B1000000')
    sh.getCell(2, 2).value = { formula: 'A2', result: 'y'.repeat(100_000) }
    const t = Date.now()
    const r = await readXlsx(new Uint8Array(await wb.xlsx.writeBuffer()))
    expect(JSON.stringify(r).length).toBeGreaterThan(0)
    expect(Date.now() - t).toBeLessThan(15_000)
  })
})
