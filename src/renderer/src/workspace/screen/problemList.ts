// The problem list's content (pure, unit-tested).
import type { RepoInfo } from '../../../../shared/api'
import { T } from '../../../../shared/text'

export interface Problem {
  key: string
  text: string
  /** Clickable: the item it is about. */
  id?: string
  /** ReqMan can fix it with one click. */
  fix?: 'file-name'
}

/** Schema problems and whole-repository problems, as one list (pure). File problems carry a path, not an ID. */
export function problemsOf(info: Pick<RepoInfo, 'schemaProblems' | 'issues'>): Problem[] {
  return [
    ...info.schemaProblems.map((p) => ({ key: `s-${p.path}`, text: T.workspace.schemaProblem(p.path, p.message) })),
    ...info.issues.map((i) => ({
      key: `i-${i.itemId}-${i.path}-${i.message}`,
      text: `${i.itemId}: ${i.message}`,
      ...(i.path === 'file' ? {} : { id: i.itemId }),
      ...(i.fix ? { fix: i.fix } : {})
    }))
  ]
}

