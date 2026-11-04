// The problem list's content (pure, unit-tested).
import type { RepoInfo } from '../../../../shared/api'
import { T } from '../../../../shared/text'

/** Kinds of problems, in the order the panel shows their groups (UI review UX-11). */
export const PROBLEM_GROUPS = ['schema', 'id', 'links', 'parent', 'file', 'file-name', 'other'] as const
export type ProblemGroup = (typeof PROBLEM_GROUPS)[number]

export interface Problem {
  key: string
  text: string
  /** The message without the ID in front (the panel shows the ID in its own column). */
  message: string
  group: ProblemGroup
  severity: 'error' | 'warning'
  /** Clickable: the item it is about. */
  id?: string
  /** What the row is about when it is not an item (a file path, a schema key). */
  subject?: string
  /** ReqMan can fix it with one click. */
  fix?: 'file-name'
}

const groupOf = (path: string): ProblemGroup => ((PROBLEM_GROUPS as readonly string[]).includes(path) ? (path as ProblemGroup) : 'other')

/** Schema problems and whole-repository problems, as one list (pure). File problems carry a path, not an ID. */
export function problemsOf(info: Pick<RepoInfo, 'schemaProblems' | 'issues'>): Problem[] {
  return [
    ...info.schemaProblems.map((p): Problem => ({ key: `s-${p.path}`, text: T.workspace.schemaProblem(p.path, p.message), message: p.message, subject: p.path, group: 'schema', severity: 'error' })),
    ...info.issues.map(
      (i, n): Problem => ({
        key: `i-${n}-${i.itemId}-${i.path}-${i.message}`, // the index keeps keys unique (two files with one ID)
        text: `${i.itemId}: ${i.message}`,
        message: i.message,
        group: groupOf(i.path),
        severity: i.severity === 'warning' ? 'warning' : 'error',
        ...(i.path === 'file' ? { subject: i.itemId } : { id: i.itemId }),
        ...(i.fix ? { fix: i.fix } : {})
      })
    )
  ]
}

/** The problems by kind, groups in a fixed order, empty groups left out (pure). */
export function groupProblems(problems: Problem[]): { group: ProblemGroup; problems: Problem[] }[] {
  return PROBLEM_GROUPS.map((group) => ({ group, problems: problems.filter((p) => p.group === group) })).filter((g) => g.problems.length > 0)
}
