import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSchema } from '../src/modules/schema'

const defaultSchema = readFileSync(join(__dirname, '..', 'config', 'default-schema.yaml'), 'utf8')

describe('schema', () => {
  it('parses the shipped default schema without problems', () => {
    const { schema, problems } = parseSchema(defaultSchema)
    expect(problems).toEqual([])
    expect(schema.itemTypes.map((t) => t.id)).toContain('system-requirement')
    expect(schema.itemTypes).toHaveLength(12)
    expect(schema.itemTypes.find((t) => t.id === 'information')?.requirement).toBe(false)
    expect(schema.fields.map((f) => f.id)).toEqual(['status', 'priority', 'owner', 'tags'])
    expect(schema.fields[0]?.default).toBe('Draft')
    expect(schema.linkTypes.find((l) => l.id === 'verifies')?.reverseName).toBe('verified by')
  })

  it('skips invalid entries with a clear message and keeps the rest', () => {
    const { schema, problems } = parseSchema(`
itemTypes:
  - { id: system-requirement, name: System, prefix: SYS }
  - { id: Bad Id, prefix: X }
  - { id: other, prefix: SYS }
fields:
  - { id: title, type: text }
  - { id: level, type: enum }
  - { id: asil, type: enum, options: [A, B], default: Z }
  - { id: weight, type: colour }
linkTypes:
  - { id: verifies }
  - { id: verifies }
`)
    // a prefix is no longer needed or checked (IDs are REQ-… for every type since 0.9.0)
    expect(schema.itemTypes.map((t) => t.id)).toEqual(['system-requirement', 'other'])
    expect(schema.fields.map((f) => f.id)).toEqual(['asil'])
    expect(schema.fields[0]?.default).toBeUndefined()
    expect(schema.linkTypes).toHaveLength(1)
    expect(problems.map((p) => p.path)).toEqual([
      'itemTypes[1].id',
      'fields[0].id',
      'fields[1].options',
      'fields[2].default',
      'fields[3].type',
      'linkTypes[1].id'
    ])
  })

  it('reports broken YAML instead of throwing', () => {
    const { schema, problems } = parseSchema('itemTypes: [ {')
    expect(schema.itemTypes).toEqual([])
    expect(problems[0]?.message).toMatch(/Not valid YAML/)
  })
})
