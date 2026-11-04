// Pure helpers of the merge window (unit-tested in tests/ui/).
import type { MergeAnswers, MergeChoice, MergePlan } from '../../../shared/api'

export const isDecided = (c: MergeChoice | undefined): boolean => c !== undefined

/** How many highlighted parts already have an answer. */
export function decidedCount(plan: MergePlan, answers: MergeAnswers): number {
  let n = 0
  for (const q of plan.questions) for (const p of q.parts) if (isDecided(answers[q.path]?.[p.key])) n++
  return n
}

/** Branch list of the Git bar: local branches first, then the remote ones; the current branch is not a target. */
export function branchGroups<B extends { name: string; kind: 'branch' | 'remote'; current: boolean }>(list: B[], filter: string, localNames: string[] = []): { local: B[]; remote: B[] } {
  const words = filter.trim().toLowerCase()
  const hit = (b: B): boolean => !words || b.name.toLowerCase().includes(words)
  // "Only on GitHub": a remote branch whose local branch exists (also the current one, given in `localNames`) is left
  // out — Pull brings it in (UI re-check UXN-05)
  const locals = new Set([...localNames, ...list.filter((b) => b.kind === 'branch').map((b) => b.name)])
  const shortName = (n: string): string => n.slice(n.indexOf('/') + 1)
  return { local: list.filter((b) => b.kind === 'branch' && hit(b)), remote: list.filter((b) => b.kind === 'remote' && hit(b) && !locals.has(shortName(b.name))) }
}
