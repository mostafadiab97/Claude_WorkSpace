// The hierarchy: parents, the order of siblings, moving items, and the document order used by exports.
import type { Item } from '../../shared/api'
import type { IndexedItem } from '../index-cache'
import type { ExportItem } from '../import-export'
import { queryAll, type OpResult, type Session, type WorkspaceContext } from './context'
import { T } from '../../shared/text'

export const ORDER_STEP = 10

/** Would making `newParent` the parent of `id` create a loop (newParent is id itself or below it)? */
export function createsLoop(s: Session, id: string, newParent: string): boolean {
  const seen = new Set<string>()
  let cur: string | undefined = newParent
  while (cur) {
    if (cur === id) return true
    if (seen.has(cur)) return false
    seen.add(cur)
    cur = s.index.get(cur)?.parent
  }
  return false
}

/** How many parents an item has above it (0 = top level); stops at a parent loop. */
export function depthOf(s: Session, id: string): number {
  let d = 0
  const seen = new Set<string>([id])
  for (let p = s.index.get(id)?.parent; p && !seen.has(p); p = s.index.get(p)?.parent) {
    seen.add(p)
    d++
  }
  return d
}

/**
 * Every item in document order: depth-first through the hierarchy, siblings by `order`; items in a parent
 * loop come last (they are listed as problems too). Pure: works on any list of indexed items.
 */
export function documentOrderOf(all: IndexedItem[]): ExportItem[] {
  const ids = new Set(all.map((i) => i.id))
  const children = new Map<string, IndexedItem[]>()
  for (const it of all) {
    const key = it.parent && ids.has(it.parent) && it.parent !== it.id ? it.parent : ''
    const list = children.get(key)
    if (list) list.push(it)
    else children.set(key, [it])
  }
  const out: ExportItem[] = []
  const seen = new Set<string>()
  const walk = (key: string, depth: number): void => {
    for (const it of children.get(key) ?? []) {
      if (seen.has(it.id)) continue
      seen.add(it.id)
      out.push({ item: it, depth, incoming: [] })
      walk(it.id, depth + 1)
    }
  }
  walk('', 0)
  for (const it of all) if (!seen.has(it.id)) out.push({ item: it, depth: 0, incoming: [] })
  return out
}

/**
 * Where to put `id` among `sibs` (already without it) so that it lands before `before` (or last).
 * Returns the order values to write: normally only the moved item; when there is no room between the
 * neighbours, the siblings are renumbered 10, 20, 30… (only those whose value changes). Pure.
 */
export function planInsert(sibs: { id: string; order?: number }[], id: string, before: string | null | undefined): { id: string; order: number }[] {
  const at = before ? sibs.findIndex((x) => x.id === before) : -1
  const index = at < 0 ? sibs.length : at
  const prev = sibs[index - 1]?.order
  const next = sibs[index]?.order
  if (index === sibs.length) return [{ id, order: Math.floor((prev ?? 0) / ORDER_STEP) * ORDER_STEP + ORDER_STEP }]
  if (next !== undefined && (index === 0 ? next > 1 : prev !== undefined && next - prev > 1)) {
    return [{ id, order: Math.floor(((index === 0 ? 0 : (prev as number)) + next) / 2) }]
  }
  const list: { id: string; order?: number }[] = [...sibs.slice(0, index), { id }, ...sibs.slice(index)]
  const plan: { id: string; order: number }[] = []
  list.forEach((x, k) => {
    const order = (k + 1) * ORDER_STEP
    if (x.id === id || x.order !== order) plan.push({ id: x.id, order })
  })
  return plan
}

/** Order values for swapping item `i` with its neighbour `j` (one place up or down). Pure. */
export function planSwap(sibs: { id: string; order?: number }[], i: number, j: number): { id: string; order: number }[] {
  const a = sibs[i]
  const b = sibs[j]
  if (!a || !b) return []
  // Normal case: swap the two values — two files change. Only if values are missing or equal (hand-edited
  // files) is the whole sibling list renumbered.
  if (a.order !== undefined && b.order !== undefined && a.order !== b.order) {
    return [
      { id: a.id, order: b.order },
      { id: b.id, order: a.order }
    ]
  }
  const reordered = [...sibs]
  reordered[i] = b
  reordered[j] = a
  return reordered.map((x, k) => ({ id: x.id, order: (k + 1) * ORDER_STEP })).filter((p) => sibs.find((x) => x.id === p.id)?.order !== p.order)
}

export function createStructureOps(ctx: WorkspaceContext) {
  const { log } = ctx

  const siblings = (s: Session, parent: string | undefined): IndexedItem[] =>
    s.index.query({ parent: parent ?? null, sort: { by: 'order' }, limit: 10_000 }).items

  /** Writes the planned order values (and the new parent of `moved`), conflict-safe, then updates the index. */
  async function apply(s: Session, plan: { id: string; order: number }[], moved?: { id: string; parent: string | null }): Promise<OpResult> {
    const paths = plan.map((p) => s.repo.itemPath(p.id))
    for (const step of plan) {
      const cur = await s.repo.readItem(step.id)
      if (!cur?.ok) return { ok: false, message: T.wsMsg.movingStopped(step.id) }
      const next: Item = { ...cur.item, order: step.order }
      if (moved && step.id === moved.id) {
        if (moved.parent === null) delete next.parent
        else next.parent = moved.parent
      }
      await s.repo.writeItem(next, { expectedRevision: cur.revision })
    }
    await s.index.syncPaths(s.repo, paths)
    return { ok: true }
  }

  return {
    siblings,
    documentOrder: (s: Session): ExportItem[] => documentOrderOf(queryAll(s.index, { sort: { by: 'order' } })),

    ancestors(id: string): string[] {
      const s = ctx.need()
      const chain: string[] = []
      const seen = new Set<string>([id])
      let cur = s.index.get(id)?.parent
      while (cur && !seen.has(cur)) {
        chain.unshift(cur)
        seen.add(cur)
        cur = s.index.get(cur)?.parent
      }
      return chain
    },

    /** Order value for a new item placed last under `parent`. */
    nextOrder(s: Session, parent: string | undefined): number {
      const last = s.index.query({ parent: parent ?? null, sort: { by: 'order', descending: true }, limit: 1 }).items[0]
      return Math.floor((last?.order ?? 0) / ORDER_STEP) * ORDER_STEP + ORDER_STEP
    },

    async reparentItem(id: string, parent: string | null, before?: string | null): Promise<OpResult> {
      const s = ctx.need()
      if (!s.index.get(id)) return { ok: false, message: T.wsMsg.unreadable(id) }
      if (parent !== null) {
        if (!s.index.get(parent)) return { ok: false, message: T.wsMsg.missing(parent) }
        if (createsLoop(s, id, parent)) return { ok: false, message: T.wsMsg.moveLoop(parent, id) }
      }
      // Its own children move with it: they keep pointing at it.
      const plan = planInsert(siblings(s, parent ?? undefined).filter((x) => x.id !== id), id, before)
      try {
        const r = await apply(s, plan, { id, parent })
        if (r.ok) log.info(`Moved ${id} under ${parent ?? 'top level'}${before ? ` before ${before}` : ''}`)
        return r
      } catch (e) {
        log.error(`Moving ${id} failed`, e)
        return { ok: false, message: (e as Error).message }
      }
    },

    async moveItem(id: string, direction: 'up' | 'down'): Promise<OpResult> {
      const s = ctx.need()
      const self = s.index.get(id)
      if (!self) return { ok: false, message: T.wsMsg.notFound(id) }
      const sibs = siblings(s, self.parent)
      const i = sibs.findIndex((x) => x.id === id)
      const j = direction === 'up' ? i - 1 : i + 1
      if (i < 0 || j < 0 || j >= sibs.length) return { ok: true } // already first/last
      try {
        return await apply(s, planSwap(sibs, i, j))
      } catch (e) {
        log.error(`Moving ${id} failed`, e)
        return { ok: false, message: (e as Error).message }
      }
    }
  }
}

export type StructureOps = ReturnType<typeof createStructureOps>
