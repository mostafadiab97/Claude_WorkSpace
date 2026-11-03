// 0.15 UI polish (UI/UX review of 0.14.5, docs/reviews/agents/0.14.5-ui-ux.md): the small rules behind it.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { importPath } from '../src/main/validate'
import { QUICK_START_PAGE, SHORTCUTS_PAGE, splitGuide } from '../src/shared/guide'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseSchema } from '../src/modules/schema'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { fieldDefs } from '../src/main/validate'

const guide = readFileSync('docs/USER-GUIDE.md', 'utf8')

describe('user guide (UX-12, UX-24)', () => {
  it('the start screen link leads to the quick start page', () => {
    expect(splitGuide(guide).some((p) => p.id === QUICK_START_PAGE)).toBe(true)
    expect(splitGuide(guide).some((p) => p.id === SHORTCUTS_PAGE)).toBe(true) // Ctrl+/ (UX-25)
  })
  it('has no placeholder links such as <owner>', () => {
    expect(guide).not.toMatch(/github\.com\/<owner>|\(<owner>|%3Cowner%3E/i)
  })
})

describe('a file dropped on the import window (UX-23)', () => {
  const ext = ['xlsx', 'csv', 'reqif']
  it('accepts an absolute path with an import extension', () => {
    expect(importPath('C:\\Users\\x\\Reqs.XLSX', ext)).toBe('C:\\Users\\x\\Reqs.XLSX')
    expect(importPath('/home/x/r.csv', ext)).toBe('/home/x/r.csv')
    expect(importPath('\\\\server\\share\\r.reqif', ext)).toBe('\\\\server\\share\\r.reqif')
  })
  it('refuses relative paths, other file types and odd values', () => {
    expect(() => importPath('r.csv', ext)).toThrow()
    expect(() => importPath('C:\\x\\evil.exe', ext)).toThrow()
    expect(() => importPath('C:\\x\\a.csv\0.exe', ext)).toThrow()
    expect(() => importPath(42, ext)).toThrow()
  })
})

describe('names in other languages in schema.yaml (UX-22)', () => {
  const defaults = readFileSync('config/default-schema.yaml', 'utf8')
  it('the default schema has Arabic names for every type, field, choice and link type, without problems', () => {
    const { schema, problems } = parseSchema(defaults)
    expect(problems).toEqual([])
    expect(schema.itemTypes.every((t) => t.labels?.['ar'])).toBe(true)
    expect(schema.fields.every((f) => f.labels?.['ar'])).toBe(true)
    expect(schema.fields.filter((f) => f.type === 'enum').every((f) => f.options?.every((o) => f.optionLabels?.['ar']?.[o]))).toBe(true)
    expect(schema.linkTypes.every((l) => l.labels?.['ar'] && l.reverseLabels?.['ar'])).toBe(true)
  })
  it('reports labels that are not language → text', () => {
    const { problems } = parseSchema('itemTypes:\n  - { id: a, name: A, labels: [x] }\nfields:\n  - { id: f, name: F, labels: { Arabic!: x } }\n')
    expect(problems.map((p) => p.path)).toEqual(['itemTypes[0].labels', 'fields[0].labels.Arabic!'])
  })
  it('editing fields in the window keeps the translated names', async () => {
    const store = createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml'))
    const repo = await store.initialize(await mkdtemp(join(tmpdir(), 'reqman-labels-')))
    const fields = fieldDefs(JSON.parse(JSON.stringify(repo.schema.fields)))
    await repo.writeSchemaFields([...fields, { id: 'safety', name: 'Safety', type: 'text' }], repo.schemaRevision)
    const text = await readFile(join(repo.root, 'requirements', '.reqman', 'schema.yaml'), 'utf8')
    const { schema } = parseSchema(text)
    expect(schema.fields.find((f) => f.id === 'status')?.optionLabels?.['ar']?.['Draft']).toBe('مسودة')
    expect(schema.fields.find((f) => f.id === 'owner')?.labels).toEqual({ ar: 'المسؤول' })
    expect(schema.fields.find((f) => f.id === 'safety')?.labels).toBeUndefined()
  })
})
