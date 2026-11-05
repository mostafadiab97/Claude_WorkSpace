// QA whole-project review (helper agent, docs/AGENT-WORKFLOW.md): the High/Medium findings of the earlier reports for
// the core (items file format, repository store), written to FAIL today. `it.fails` keeps the suite green; when the
// defect is fixed the test starts passing and Vitest reports it — then change `it.fails` to `it`.
// Details: docs/reviews/agents/whole-project-qa-tester.md
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseItemFile, serializeItem } from '../src/modules/items'
import { createFileRepositoryStore } from '../src/modules/repository-store'

const store = createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml'))
const newRoot = (): Promise<string> => mkdtemp(join(tmpdir(), 'qa-wp-core-'))

const FILE = (header: string, body = 'Body text.'): string => `---\n${header}\n---\n\n${body}\n`
const fieldDefs = [
  { id: 'tags', name: 'Tags', type: 'list' as const },
  { id: 'flag', name: 'Flag', type: 'text' as const }
]
const roundTrip = (src: string): string => {
  const r = parseItemFile(src, new Set(fieldDefs.map((f) => f.id)))
  if (!r.ok) throw new Error(r.error)
  return serializeItem(r.item, { fields: fieldDefs })
}

describe('CR1-02: unknown header content survives a save (NFR-05)', () => {
  const base = 'id: REQ-AAAAAAA\ntype: system-requirement\ntitle: T\norder: a0\n'
  it.fails('CR1-02a: extra keys inside a link are kept', () => {
    // defect: only type/target/confirmed are copied (itemFile.ts:247-252)
    const out = roundTrip(FILE(`${base}links:\n  - type: verifies\n    target: REQ-BBBBBBB\n    note: keep me`))
    expect(out).toContain('keep me')
  })
  it.fails('CR1-02b: a list holding mappings is not turned into "[object Object]"', () => {
    const out = roundTrip(FILE(`${base}tags:\n  - a: 1`))
    expect(out).not.toContain('[object Object]')
  })
  it.fails('CR1-02c: a parent that is not text is kept somewhere, not dropped', () => {
    const out = roundTrip(FILE(`${base}parent: 123`))
    expect(out).toMatch(/123/)
  })
  it.fails('CR1-02d: a boolean field value stays a boolean', () => {
    const out = roundTrip(FILE(`${base}flag: true`))
    expect(out).not.toContain('"true"')
  })
})

describe('CR1-03: "Edit fields" keeps unknown keys on a field and the comments', () => {
  it.fails('CR1-03: required/description and a comment survive writeSchemaFields', async () => {
    const root = await newRoot()
    const repo = await store.initialize(root)
    const path = join(root, 'requirements', repo.metaDir, 'schema.yaml')
    const yaml = await readFile(path, 'utf8')
    const marked = yaml.replace(/(\n {2}- id: status\n)/, '\n  # QA-COMMENT keep me$1').replace(/(\n {2}- id: status\n)/, '$1    qa-extra: kept\n')
    expect(marked).toContain('qa-extra: kept')
    await writeFile(path, marked)
    const open = await store.open(root)
    await open.writeSchemaFields(open.schema.fields, open.schemaRevision)
    const after = await readFile(path, 'utf8')
    expect(after).toContain('qa-extra: kept')
    expect(after).toContain('QA-COMMENT keep me')
  })
})

describe('SEC-01: a hostile ID in a header cannot move a file out of the repository', () => {
  it.fails('SEC-01: fixFileName refuses "../" in the ID', async () => {
    const root = await newRoot()
    const repo = await store.initialize(root)
    const dir = join(root, 'requirements', 'items')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'REQ-AAAAAAA.md'), FILE('id: ../../../qa-escaped\ntype: system-requirement\ntitle: Evil\norder: a0'))
    const open = await store.open(root)
    let result: string | Error
    try {
      result = await open.fixFileName('../../../qa-escaped')
    } catch (e) {
      result = e as Error
    }
    // expected: it throws (or returns a path inside items/); defect: the file lands above the repository
    expect(result instanceof Error).toBe(true)
    expect(existsSync(join(root, '..', 'qa-escaped.md'))).toBe(false)
    expect(repo.root).toBe(root)
  })
})
