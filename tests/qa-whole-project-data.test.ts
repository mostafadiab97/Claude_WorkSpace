// QA whole-project review, part 2: odd data (Arabic, very long text, search characters, CSV/Excel/item-file round
// trips). Tests that pass are regression guards found while trying to break the app; `it.fails` marks a defect
// that exists today. Details: docs/reviews/agents/whole-project-qa-tester.md
import { readFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { parseCsv, readXlsx, toCsv, writeXlsx } from '../src/modules/import-export'
import { parseItemFile, serializeItem } from '../src/modules/items'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { parseSchema } from '../src/modules/schema'
import { createWorkspace } from '../src/modules/workspace'

const { schema } = parseSchema(readFileSync(join(__dirname, '..', 'config', 'default-schema.yaml'), 'utf8'))
const odd = ['say "hi", ok', 'line1\nline2', 'مرحبا بالعالم "اختبار"', ' lead and trail ', 'a;b\tc', '', '😀 ‏متطلب']

describe('QA-WP: round trips of odd data (regression guards, pass today)', () => {
  it('QA-WP-10: CSV with quotes, line breaks, Arabic, emoji and a 100,000-character cell survives toCsv → parseCsv for every separator', () => {
    for (const sep of [',', ';', '\t']) {
      const rows = [odd.slice(), ['x'.repeat(100_000), 'ب', 'c']]
      expect(parseCsv(toCsv(rows, sep), sep)).toEqual(rows)
    }
  })
  it('QA-WP-11: Excel keeps Arabic, quotes, leading/trailing spaces, numbers-as-text and a 40,000-character cell', async () => {
    const rows = [[...odd.filter((c) => !c.includes('\n')), '00123', '1e3', 'x'.repeat(40_000)]]
    const data = await writeXlsx([{ name: 'S', header: rows[0]!.map((_, i) => `c${i}`), rows }])
    const back = (await readXlsx(data))[0]!.rows
    expect(back[1]).toEqual(rows[0])
  })
  it('QA-WP-12: an item file keeps awkward titles, Arabic and a 200,000-character title; a body that contains "---" lines', () => {
    const titles = ['a: b # c', '"quoted"', '- dash', 'مرحبا: عالم', '  spaced  ', 'null', 'true', '123', '|', '---', 'x'.repeat(200_000)]
    for (const title of titles) {
      const src = serializeItem({ id: 'REQ-AAAAAAA', type: 'system-requirement', title, order: 'a0', fields: {}, links: [], text: '---\nbody\n---', extra: {} }, schema)
      const r = parseItemFile(src, new Set())
      expect(r.ok && r.item.title).toBe(title)
      expect(r.ok && r.item.text).toBe('---\nbody\n---')
    }
  })
})

describe('QA-WP: search with odd characters (real workspace and index)', { timeout: 60_000 }, () => {
  async function workspaceWith(items: [string, string][]) {
    const root = await mkdtemp(join(tmpdir(), 'qa-wp-search-'))
    const userDir = await mkdtemp(join(tmpdir(), 'qa-wp-searchu-'))
    const ws = createWorkspace({
      store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
      git: createSystemGitAdapter(),
      openIndex: () => createSqliteIndexCache(join(userDir, 'i.sqlite')),
      userDir,
      log: { info() {}, warn() {}, error() {} },
      watchFiles: false
    })
    await ws.initialize(root)
    for (const [title, text] of items) {
      const i = ws.newItem('system-requirement')
      i.title = title
      i.text = text
      const r = await ws.saveItem(i, null)
      if (!r.ok) throw new Error(r.message)
    }
    return ws
  }
  const data: [string, string][] = [['مستشعر الحرارة', 'يجب أن يقيس النظام درجة الحرارة'], ['Battery 100% safe', 'under_score and "quoted" text'], ['Plain', 'x'.repeat(1_000_000)], ['Plain two', 'no marks']]

  it('QA-WP-13: Arabic words, quotes, FTS operators and punctuation never throw; a 1 MB text is stored whole and shortened in brief mode', async () => {
    const ws = await workspaceWith(data)
    for (const q of ['الحرارة', '"', '"quoted', 'AND', 'NOT x', '*', '(', ':', "'", '\\', '^', 'title:Plain']) expect(() => ws.query({ text: q })).not.toThrow()
    expect(ws.query({ text: 'الحرارة' }).total).toBe(1)
    expect(ws.query({ text: 'Plain', sort: { by: 'id' } }).items.find((i) => i.title === 'Plain')?.text).toHaveLength(1_000_000)
    expect(ws.query({ text: 'Plain', brief: true }).items.every((i) => i.text.length <= 200)).toBe(true)
  })
  it.fails('QA-WP-02: searching for "_" or "%" finds only items that contain that character (LIKE wildcards are escaped)', async () => {
    const ws = await workspaceWith(data)
    // only "under_score" contains "_" and only "100%" contains "%": the defect returns every item (SQL LIKE wildcard)
    expect(ws.query({ text: '_' }).total).toBe(1)
    expect(ws.query({ text: '%' }).total).toBe(1)
  })
})
