// 0.15 UI polish — window-side rules (type-checked with the renderer's settings).
import { describe, expect, it } from 'vitest'
import type { Schema } from '../../src/shared/domain'
import { filterSummary } from '../../src/renderer/src/workspace/screen/useFilters'
import { middleEllipsis } from '../../src/renderer/src/lib/statusbar'
import { isHeading, typeShort } from '../../src/renderer/src/lib/schema'

const schema: Schema = {
  version: 1,
  itemTypes: [
    { id: 'system-requirement', name: 'System Requirement', short: 'SysReq', requirement: true },
    { id: 'heading', name: 'Heading', requirement: false },
    { id: 'note', name: 'Note', requirement: true }
  ],
  fields: [{ id: 'status', name: 'Status', type: 'enum', options: ['Draft', 'Approved'] }],
  linkTypes: []
}

describe('status bar (UX-36)', () => {
  it('says in words what the table is filtered by', () => {
    expect(filterSummary(schema, { search: ' door ', types: 'system-requirement', linkFilter: 'suspect', fieldFilters: { status: 'Draft', gone: 'x' } })).toBe(
      '“door”, Type = System Requirement, Status = Draft, With suspect links'
    )
    expect(filterSummary(schema, { search: '', types: '', linkFilter: '', fieldFilters: {} })).toBe('')
  })
  it('shortens a long path in the middle and keeps short ones', () => {
    expect(middleEllipsis('C:\\short', 60)).toBe('C:\\short')
    const p = 'C:\\Users\\someone\\Documents\\Projects\\Customer\\very\\deep\\folder\\Claude_SandBox'
    const s = middleEllipsis(p, 40)
    expect(s.length).toBe(40)
    expect(s.startsWith('C:\\Users')).toBe(true)
    expect(s.endsWith('Claude_SandBox')).toBe(true)
  })
})

describe('type column (UX-03)', () => {
  it('uses the short name, the full name when there is none, and nothing for headings', () => {
    expect(typeShort(schema, 'system-requirement')).toBe('SysReq')
    expect(typeShort(schema, 'note')).toBe('Note')
    expect(isHeading(schema, 'heading')).toBe(true)
    expect(isHeading(schema, 'note')).toBe(false)
  })
})
