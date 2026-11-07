// The owner's points on 0.16.3 (5 Nov 2026) and the 0.16.4 fixes that can be checked without a window.
import { describe, expect, it } from 'vitest'
import { guessMapping, parseCsv, planImport } from '../src/modules/import-export'
import { parseSchema } from '../src/modules/schema'
import { readFileSync } from 'node:fs'

describe('CSV: a " inside a multi-line cell (owner, 0.16.3 step 5)', () => {
  it('a bare " typed inside a quoted cell (table, bullet list) does not cut the rest of the cell', () => {
    const csv = 'ID,Text\nA,"- screen 12" display\n- second line"\nB,next\n'
    const rows = parseCsv(csv)
    expect(rows).toEqual([['ID', 'Text'], ['A', '- screen 12" display\n- second line'], ['B', 'next']])
  })
  it('a list line that ends in 12" inside a cell that is not the last column keeps the cell going', () => {
    const csv = 'ID,Text,Links\nA,"- screen 12"\n- second line",REQ-1\n'
    expect(parseCsv(csv)).toEqual([['ID', 'Text', 'Links'], ['A', '- screen 12"\n- second line', 'REQ-1']])
  })
  it('Excel\'s doubled quotes still read as one quote, and a quote before the separator still ends the cell', () => {
    expect(parseCsv('"a ""b"" c","x"\n')).toEqual([['a "b" c', 'x']])
    expect(parseCsv('"| a | 12"" |\n| b |",y\n')).toEqual([['| a | 12" |\n| b |', 'y']])
  })
})

describe('import warns about a row whose cell count does not match the header (owner, 0.16.3 step 5)', () => {
  it('a short row is named, the rest imports', () => {
    const schema = parseSchema(readFileSync('config/default-schema.yaml', 'utf8')).schema
    const headers = ['Title', 'Text', 'Status']
    const rows = [['One', 'x', 'Draft'], ['Two', 'cut']]
    const plan = planImport({ rows, headers, firstRow: 2, mapping: guessMapping(headers, schema), schema, defaultType: 'system-requirement', existing: { byId: new Map(), bySource: new Map() }, newId: (() => { let n = 0; return () => `REQ-T00000${n++}` })(), isValidId: () => true, checkCells: true })
    expect(plan.problems.some((p) => p.row === 3 && /2 cells but the header has 3/.test(p.message))).toBe(true)
  })
})

describe('a new item can go right below the selected one (the owner, 5 Nov 2026)', () => {
  it('newItem(type, undefined, after) places it between the item and its next sibling', async () => {
    const { mkdtemp } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { createSqliteIndexCache } = await import('../src/modules/index-cache')
    const { createFileRepositoryStore } = await import('../src/modules/repository-store')
    const { createWorkspace } = await import('../src/modules/workspace')
    const root = await mkdtemp(join(tmpdir(), 'rq-after-'))
    const userDir = await mkdtemp(join(tmpdir(), 'rq-after-user-'))
    const quiet = { info: () => {}, warn: () => {}, error: () => {} }
    const ws = createWorkspace({
      store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
      git: (await import('../src/modules/git-adapter')).createSystemGitAdapter(),
      openIndex: () => createSqliteIndexCache(join(userDir, 'index.sqlite')),
      userDir,
      log: quiet,
      watchFiles: false
    } as Parameters<typeof createWorkspace>[0])
    await ws.initialize(root)
    const save = async (title: string, after?: string): Promise<string> => {
      const it = ws.newItem('system-requirement', undefined, after)
      const r = await ws.saveItem({ ...it, title }, null)
      if (!r.ok) throw new Error(r.message)
      return it.id
    }
    const a = await save('A')
    await save('C')
    await save('B', a)
    const titles = ws.query({ parent: null, sort: { by: 'order', descending: false } }).items.map((x) => x.title)
    expect(titles).toEqual(['A', 'B', 'C'])
  })
})
