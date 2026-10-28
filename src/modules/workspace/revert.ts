// Taking back one part of an uncommitted change (the ↶ arrows of the Changes view, owner's decision O-05):
// a field, the position, the text or one link becomes as it is in the last commit; everything else the user
// changed in that item stays. The result is saved like any edit (checked, conflict-safe).
import { relative } from 'node:path'
import type { RevertPart, SaveResult } from '../../shared/api'
import type { Item } from '../../shared/domain'
import type { GitAdapter } from '../git-adapter'
import { parseItemFile } from '../items'
import type { OpResult, WorkspaceContext } from './context'
import { T } from '../../shared/text'

/** `item` with `part` taken from `old`; null when that part does not differ. */
export function applyRevert(item: Item, old: Item, part: RevertPart): Item | null {
  const next: Item = { ...item, fields: { ...item.fields }, extra: { ...item.extra }, links: [...item.links] }
  if (part.kind === 'text') {
    if (item.text === old.text) return null
    next.text = old.text
    return next
  }
  if (part.kind === 'link') {
    const same = (l: { type: string; target: string }): boolean => l.type === part.type && l.target === part.target
    const now = item.links.some(same)
    const then = old.links.find(same)
    if (now && !then) next.links = item.links.filter((l) => !same(l)) // added since the commit → remove
    else if (!now && then) next.links = [...item.links, then] // removed since → add back as it was
    else return null
    return next
  }
  const key = part.key
  const setOrDelete = (rec: Record<string, unknown>, k: string, v: unknown): void => {
    if (v === undefined) delete rec[k]
    else rec[k] = v
  }
  if (key === 'title') next.title = old.title
  else if (key === 'type') next.type = old.type
  else if (key === 'parent' || key === 'order') {
    // the position is parent + order: both go back together
    setOrDelete(next as unknown as Record<string, unknown>, 'parent', old.parent)
    setOrDelete(next as unknown as Record<string, unknown>, 'order', old.order)
  } else if (key.startsWith('field:')) setOrDelete(next.fields, key.slice(6), old.fields[key.slice(6)])
  else if (key.startsWith('extra:')) setOrDelete(next.extra, key.slice(6), old.extra[key.slice(6)])
  else return null
  return JSON.stringify(next) === JSON.stringify(item) ? null : next
}

export function createRevertOps(ctx: WorkspaceContext, git: GitAdapter, save: (item: Item, revision: string | null) => Promise<SaveResult>) {
  return {
    async revertChange(id: string, part: RevertPart): Promise<OpResult> {
      const s = ctx.need()
      const current = await s.repo.readItem(id)
      if (!current?.ok) return { ok: false, message: T.wsMsg.unreadable(id) }
      const base = relative(s.repo.root, s.repo.folder).split('\\').join('/')
      const path = `${base ? `${base}/` : ''}${s.repo.itemPath(id)}`
      const committed = (await git.head(s.repo.root)) ? await git.show(s.repo.root, 'HEAD', path) : null
      if (committed === null) return { ok: false, message: T.wsMsg.revertNew(id) }
      const parsed = parseItemFile(committed, new Set(s.repo.schema.fields.map((f) => f.id)))
      if (!parsed.ok) return { ok: false, message: T.wsMsg.revertUnreadable(id, parsed.error) }
      const next = applyRevert(current.item, parsed.item, part)
      if (!next) return { ok: false, message: T.wsMsg.revertNothing(id) }
      const r = await save(next, current.revision)
      if (!r.ok) return { ok: false, message: r.message }
      ctx.log.info(`Took back ${part.kind === 'row' ? part.key : part.kind === 'link' ? `link ${part.type} ${part.target}` : 'text'} of ${id}`)
      return { ok: true }
    }
  }
}
