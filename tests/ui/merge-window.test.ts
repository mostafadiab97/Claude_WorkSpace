// 0.12.0 (M8): the merge window's progress, the branch panel's lists, and the "branch" preset of Changes.
import { describe, expect, it } from 'vitest'
import type { CompareOptions, MergePlan } from '../../src/shared/api'
import { branchGroups, decidedCount } from '../../src/renderer/src/workspace/mergeAnswers'
import { rangeOf } from '../../src/renderer/src/workspace/compareRange'

const part = (key: string) => ({ key, label: key, base: '', mine: 'm', theirs: 't', editable: true })
const plan: MergePlan = {
  source: 'origin/main',
  head: 'a',
  theirs: 'b',
  incoming: 3,
  combined: [],
  duplicates: [],
  questions: [
    { path: 'requirements/items/REQ-1.md', id: 'REQ-1', label: 'REQ-1 One', parts: [part('title'), part('text')] },
    { path: 'requirements/items/REQ-2.md', id: 'REQ-2', label: 'REQ-2 Two', parts: [part('item')] }
  ]
}

describe('merge window', () => {
  it('counts decided parts (an edit counts, even when empty)', () => {
    expect(decidedCount(plan, {})).toBe(0)
    expect(decidedCount(plan, { 'requirements/items/REQ-1.md': { title: 'mine', text: { edit: '' } } })).toBe(2)
    expect(decidedCount(plan, { 'requirements/items/REQ-1.md': { title: 'mine', text: 'theirs' }, 'requirements/items/REQ-2.md': { item: 'theirs' } })).toBe(3)
  })
  it('groups branches: local first, remote after, filtered by name', () => {
    const list = [
      { name: 'main', kind: 'branch' as const, current: true },
      { name: 'feature/x', kind: 'branch' as const, current: false },
      { name: 'origin/main', kind: 'remote' as const, current: false }
    ]
    expect(branchGroups(list, '')).toEqual({ local: [list[0], list[1]], remote: [list[2]] })
    expect(branchGroups(list, 'FEAT').local.map((b) => b.name)).toEqual(['feature/x'])
  })
  it('the branch preset shows the range it was given', () => {
    const o: CompareOptions = { lastPull: null, hasUncommitted: false, commits: [], refs: [], head: 'h' }
    expect(rangeOf('branch', o, { from: '', to: '' })).toBeNull()
    expect(rangeOf('branch', o, { from: '', to: '' }, { from: 'base', to: 'tip' })).toEqual({ from: 'base', to: 'tip' })
  })
})
