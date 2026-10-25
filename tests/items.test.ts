import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSchema } from '../src/modules/schema'
import {
  contentFingerprint,
  generateId,
  isValidId,
  parseItemFile,
  serializeItem,
  validateItem,
  type Item
} from '../src/modules/items'

const { schema } = parseSchema(readFileSync(join(__dirname, '..', 'config', 'default-schema.yaml'), 'utf8'))
const fieldIds = new Set(schema.fields.map((f) => f.id))

const sample: Item = {
  id: 'SYS-K7Q3XM',
  type: 'system-requirement',
  title: 'Brake pedal response: time',
  fields: { status: 'Draft', priority: 'High', owner: 'm.hassan', tags: ['braking', 'safety'] },
  parent: 'STK-2B8R1C',
  order: 30,
  links: [{ type: 'refines', target: 'STK-2B8R1C', confirmed: '4e1a9c0b2d11' }],
  text: 'The system shall begin braking within **150 ms** of pedal input.\n\n- second paragraph',
  extra: {}
}

describe('item file format', () => {
  it('writes the canonical layout', () => {
    expect(serializeItem(sample, schema)).toBe(`---
id: SYS-K7Q3XM
type: system-requirement
title: "Brake pedal response: time"
status: Draft
priority: High
owner: m.hassan
tags:
  - braking
  - safety
parent: STK-2B8R1C
order: 30
links:
  - type: refines
    target: STK-2B8R1C
    confirmed: 4e1a9c0b2d11
---
The system shall begin braking within **150 ms** of pedal input.

- second paragraph
`)
  })

  it('round-trips exactly: parse(serialize(item)) == item and serialize is stable', () => {
    const text = serializeItem(sample, schema)
    const parsed = parseItemFile(text, fieldIds)
    expect(parsed).toEqual({ ok: true, item: sample })
    if (parsed.ok) expect(serializeItem(parsed.item, schema)).toBe(text)
  })

  it('reads Windows line endings and a byte-order mark', () => {
    const text = '﻿' + serializeItem(sample, schema).replace(/\n/g, '\r\n')
    const parsed = parseItemFile(text, fieldIds)
    expect(parsed.ok && parsed.item).toEqual(sample)
  })

  it('preserves header keys it does not know, and values of fields removed from the schema', () => {
    const text = `---
id: SW-ABC123
type: software-requirement
title: T
asil: B
x-imported-from: DOORS
status: Approved
---
Body
`
    const parsed = parseItemFile(text, fieldIds)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.item.fields).toEqual({ status: 'Approved' })
    expect(parsed.item.extra).toEqual({ asil: 'B', 'x-imported-from': 'DOORS' })
    const again = serializeItem(parsed.item, schema)
    expect(again).toContain('asil: B\n')
    expect(again).toContain('x-imported-from: DOORS\n')
  })

  it('omits empty values and writes an item without text or links compactly', () => {
    const minimal: Item = { id: 'INFO-000001', type: 'information', title: 'Introduction', fields: { tags: [], owner: '' }, links: [], text: '', extra: {} }
    expect(serializeItem(minimal, schema)).toBe('---\nid: INFO-000001\ntype: information\ntitle: Introduction\n---\n')
  })

  it('keeps a body line that starts with dashes', () => {
    const item: Item = { ...sample, text: 'Intro\n---\nAfter a rule' }
    const parsed = parseItemFile(serializeItem(item, schema), fieldIds)
    expect(parsed.ok && parsed.item.text).toBe('Intro\n---\nAfter a rule')
  })

  it.each([
    ['no header', 'Just text', /start with a "---"/],
    ['unclosed header', '---\nid: A\n', /not closed/],
    ['broken YAML', '---\nid: [\n---\n', /not valid YAML/],
    ['missing id', '---\ntype: risk\n---\n', /no "id"/],
    ['missing type', '---\nid: RSK-000001\n---\n', /no "type"/],
    ['bad links', '---\nid: A\ntype: risk\nlinks: nope\n---\n', /must be a list/],
    ['link without target', '---\nid: A\ntype: risk\nlinks:\n  - type: verifies\n---\n', /links\[0\]/]
  ])('rejects a file with %s with a clear message', (_name, text, message) => {
    const r = parseItemFile(text, fieldIds)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(message)
  })
})

describe('ids', () => {
  it('generates prefixed IDs in the expected format', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => generateId('SYS')))
    expect(ids.size).toBe(2000)
    for (const id of ids) expect(isValidId(id)).toBe(true)
    expect([...ids].every((id) => !/[ILOU]/.test(id.slice(4)))).toBe(true)
  })

  it('never returns an ID that is already taken', () => {
    const taken = new Set<string>()
    for (let i = 0; i < 500; i++) taken.add(generateId('TC', (id) => taken.has(id)))
    expect(taken.size).toBe(500)
  })

  it('rejects malformed IDs', () => {
    expect(isValidId('SYS-1')).toBe(false)
    expect(isValidId('sys-K7Q3XM')).toBe(false)
    expect(isValidId('SYS-K7Q3XO')).toBe(false)
  })
})

describe('validation', () => {
  it('accepts a valid item', () => {
    expect(validateItem(sample, schema)).toEqual([])
  })

  it('reports schema violations', () => {
    const bad: Item = {
      ...sample,
      id: 'TC-K7Q3XM',
      type: 'system-requirement',
      parent: 'TC-K7Q3XM',
      fields: { status: 'Done', priority: 'High' },
      links: [
        { type: 'blocks', target: 'X' },
        { type: 'refines', target: 'TC-K7Q3XM' },
        { type: 'refines', target: 'TC-K7Q3XM' }
      ]
    }
    expect(validateItem(bad, schema).map((i) => `${i.severity}:${i.path}`)).toEqual([
      'warning:id',
      'error:fields.status',
      'error:parent',
      'error:links[0].type',
      'error:links[1].target',
      'error:links[2].target',
      'warning:links[2]'
    ])
  })
})

describe('content fingerprint', () => {
  it('changes with title or text, not with status or links', () => {
    const base = contentFingerprint(sample)
    expect(contentFingerprint({ ...sample, text: sample.text + '!' })).not.toBe(base)
    expect(contentFingerprint({ ...sample, title: 'Other' })).not.toBe(base)
    expect(contentFingerprint({ ...sample, fields: { status: 'Approved' } } as Item)).toBe(base)
    expect(contentFingerprint({ ...sample, text: sample.text.replace(/\n/g, '\r\n') })).toBe(base)
  })
})
