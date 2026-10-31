// 0.13.0: Arabic texts — every English key has an Arabic text (the compiler checks the keys; this checks the values),
// functions give Arabic results, and switching back restores English everywhere, also through kept references.
import { afterEach, describe, expect, it } from 'vitest'
import { getLanguage, isRtl, setLanguage, T } from '../src/shared/text'

type Node = string | ((...a: never[]) => unknown) | { [k: string]: Node }
const leaves = (o: Node, path = ''): [string, Node][] =>
  typeof o === 'object' && o !== null ? Object.entries(o).flatMap(([k, v]) => leaves(v as Node, path ? `${path}.${k}` : k)) : [[path, o]]

afterEach(() => setLanguage('en'))

describe('Arabic texts', () => {
  it('has a non-empty Arabic text for every key', () => {
    setLanguage('ar')
    const empty = leaves(T as unknown as Node).filter(([, v]) => typeof v === 'string' && v.trim() === '')
    expect(empty).toEqual([])
    expect(getLanguage()).toBe('ar')
    expect(isRtl('ar')).toBe(true)
  })
  it('texts with values are Arabic, with Western digits', () => {
    setLanguage('ar')
    expect(T.git.changes(3)).toMatch(/[؀-ۿ]/)
    expect(T.gitMsg.committed(12)).toContain('12')
  })
  it('switching swaps texts in place, so kept references follow', () => {
    const kept = T.workspace
    setLanguage('ar')
    expect(kept.newItem).toBe(T.workspace.newItem)
    expect(kept.newItem).toMatch(/[؀-ۿ]/)
    setLanguage('en')
    expect(kept.newItem).toBe('New item')
  })
  it('most texts are actually translated (not left in English)', () => {
    const en = new Map(leaves(T as unknown as Node).filter(([, v]) => typeof v === 'string') as [string, string][])
    setLanguage('ar')
    const ar = leaves(T as unknown as Node).filter(([, v]) => typeof v === 'string') as [string, string][]
    const same = ar.filter(([k, v]) => en.get(k) === v && /[a-z]{3}/.test(v) && !/^(ReqMan|Git|GitHub|Excel|ReqIF|CSV|Markdown|English|Ctrl)/.test(v))
    expect(same.length / ar.length).toBeLessThan(0.05)
  })
})
