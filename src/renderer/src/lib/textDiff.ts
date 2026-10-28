// Side-by-side differences for the Changes view (owner's decision O-05): old version on the left, new on the
// right, changed words marked, long runs of unchanged lines folded. Pure functions, unit-tested (tests/ui).
// Line and word comparison come from the `diff` library (jsdiff, BSD-3-Clause).
import { diffLines, diffWordsWithSpace } from 'diff'

/** A piece of one side: `mark` = this text was removed (left side) or added (right side). */
export interface Segment {
  text: string
  mark: boolean
}

/** Both sides of one changed value, cut into pieces so the changed words can be highlighted. */
export function wordDiff(before: string, after: string): { left: Segment[]; right: Segment[] } {
  const left: Segment[] = []
  const right: Segment[] = []
  for (const p of diffWordsWithSpace(before, after)) {
    if (!p.added) left.push({ text: p.value, mark: p.removed })
    if (!p.removed) right.push({ text: p.value, mark: p.added })
  }
  return { left: merge(left), right: merge(right) }
}

/** Joins neighbours with the same mark (fewer elements to draw). */
function merge(segs: Segment[]): Segment[] {
  const out: Segment[] = []
  for (const s of segs) {
    const last = out[out.length - 1]
    if (last && last.mark === s.mark) last.text += s.text
    else if (s.text) out.push({ ...s })
  }
  return out
}

/** One row of the side-by-side text view. Line numbers start at 1; a missing side has no number. */
export type TextRow =
  | { kind: 'same'; leftNo: number; rightNo: number; text: string }
  | { kind: 'change'; leftNo: number; rightNo: number; left: Segment[]; right: Segment[] }
  | { kind: 'removed'; leftNo: number; text: string }
  | { kind: 'added'; rightNo: number; text: string }
  | { kind: 'fold'; count: number; rows: TextRow[] }

const linesOf = (value: string): string[] => {
  const lines = value.split('\n')
  if (lines[lines.length - 1] === '') lines.pop() // the line break at the end of a part
  return lines
}

/**
 * The text of an item before and after, as aligned rows. Removed lines followed by added lines are shown as
 * changed pairs (with the changed words marked); runs of more than 2 × `context` + 1 unchanged lines are folded.
 */
export function textRows(before: string, after: string, context = 2): TextRow[] {
  // same line endings, and a line break after the last line, so 'x' and 'x\n' count as the same line
  const norm = (t: string): string => (t ? `${t.replace(/\r\n/g, '\n').replace(/\n$/, '')}\n` : '')
  const parts = diffLines(norm(before), norm(after))
  const rows: TextRow[] = []
  let l = 1
  let r = 1
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i] as (typeof parts)[number]
    if (!p.added && !p.removed) {
      for (const text of linesOf(p.value)) rows.push({ kind: 'same', leftNo: l++, rightNo: r++, text })
      continue
    }
    if (p.removed) {
      const removed = linesOf(p.value)
      const next = parts[i + 1]
      const added = next?.added ? linesOf(next.value) : []
      if (next?.added) i++
      const pairs = Math.min(removed.length, added.length)
      for (let k = 0; k < pairs; k++) {
        const w = wordDiff(removed[k] as string, added[k] as string)
        rows.push({ kind: 'change', leftNo: l++, rightNo: r++, left: w.left, right: w.right })
      }
      for (let k = pairs; k < removed.length; k++) rows.push({ kind: 'removed', leftNo: l++, text: removed[k] as string })
      for (let k = pairs; k < added.length; k++) rows.push({ kind: 'added', rightNo: r++, text: added[k] as string })
      continue
    }
    for (const text of linesOf(p.value)) rows.push({ kind: 'added', rightNo: r++, text })
  }
  return fold(rows, context)
}

/** Folds long runs of unchanged lines, keeping `context` lines next to each change. */
function fold(rows: TextRow[], context: number): TextRow[] {
  const out: TextRow[] = []
  let i = 0
  while (i < rows.length) {
    if (rows[i]?.kind !== 'same') {
      out.push(rows[i] as TextRow)
      i++
      continue
    }
    let j = i
    while (j < rows.length && rows[j]?.kind === 'same') j++
    const run = rows.slice(i, j)
    const keepBefore = i === 0 ? 0 : context // nothing to show above the first change
    const keepAfter = j === rows.length ? 0 : context
    if (run.length > keepBefore + keepAfter + 1) {
      out.push(...run.slice(0, keepBefore))
      out.push({ kind: 'fold', count: run.length - keepBefore - keepAfter, rows: run.slice(keepBefore, run.length - keepAfter) })
      out.push(...run.slice(run.length - keepAfter))
    } else out.push(...run)
    i = j
  }
  return out
}
