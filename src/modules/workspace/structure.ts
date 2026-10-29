// The hierarchy: parents, the order of siblings, moving items, and the document order used by exports.
import type { Item } from '../../shared/api'
import type { IndexedItem } from '../index-cache'
import type { ExportItem } from '../import-export'
import { keyBetween, keysBetween, MAX_ORDER_KEY_LENGTH } from '../items'
import { queryAll, type OpResult, type Session, type WorkspaceContext } from './context'
import { T } from '../../shared/text'


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

type Placed = { id: string; order?: string }

/**
 * Outline numbers ("1", "1.2", "2.3.1") from parent + position (owner's decision O-03): calculated whenever they are
 * shown, never stored, so a move changes one file and every number follows at once. `rows` must list siblings
 * in document order (as `IndexCache.structure()` does). Items whose parent is missing, or that sit in a parent
 * loop, are not in the hierarchy and get no number. Pure.
 */
export function outlineNumbers(rows: { id: string; parent?: string }[]): Map<string, string> {
  const ids = new Set(rows.map((r) => r.id))
  const children = new Map<string, string[]>()
  for (const r of rows) {
    if (r.parent !== undefined && !ids.has(r.parent)) continue // orphan: not in the tree
    const key = r.parent ?? ''
    const list = children.get(key)
    if (list) list.push(r.id)
    else children.set(key, [r.id])
  }
  const out = new Map<string, string>()
  const walk = (key: string, prefix: string): void => {
    ;(children.get(key) ?? []).forEach((id, k) => {
      if (out.has(id)) return
      const number = prefix ? `${prefix}.${k + 1}` : String(k + 1)
      out.set(id, number)
      walk(id, number)
    })
  }
  walk('', '')
  return out
}

/** Compares outline numbers part by part ("1.10" after "1.9"); items without a number come last. Pure. */
export function compareOutline(a: string | undefined, b: string | undefined): number {
  if (a === b) return 0
  if (a === undefined) return 1
  if (b === undefined) return -1
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1)
    if (d !== 0) return d
  }
  return 0
}

/** True when the siblings' keys are usable as they are: present, strictly increasing. */
const keysUsable = (sibs: Placed[]): boolean => sibs.every((x, k) => x.order !== undefined && (k === 0 || (sibs[k - 1]?.order as string) < x.order))

/** The whole group with fresh, short, evenly spaced keys — only for hand-edited groups with missing or equal keys. */
function respace(list: Placed[]): { id: string; order: string }[] {
  const keys = keysBetween(null, null, list.length)
  return list.map((x, k) => ({ id: x.id, order: keys[k] as string })).filter((p, k) => list[k]?.order !== p.order)
}

/**
 * Where to put `id` among `sibs` (already without it, in order) so that it lands before `before` (or last).
 * Returns the keys to write: normally exactly one — the moved item's (S-04). Only when the group's keys are
 * missing or out of order (files edited by hand) is the group re-spaced. Pure.
 */
export function planInsert(sibs: Placed[], id: string, before: string | null | undefined): { id: string; order: string }[] {
  const at = before ? sibs.findIndex((x) => x.id === before) : -1
  const index = at < 0 ? sibs.length : at
  if (!keysUsable(sibs)) return respace([...sibs.slice(0, index), { id }, ...sibs.slice(index)])
  return [{ id, order: keyBetween(sibs[index - 1]?.order ?? null, sibs[index]?.order ?? null) }]
}

/**
 * Where to put several items (in this order) among `sibs` (already without them) so that they land before `before`
 * (or last): one key per moved item, between the two neighbours — or the whole group re-spaced when its keys are
 * not usable. Pure.
 */
export function planInsertMany(sibs: Placed[], ids: string[], before: string | null | undefined): { id: string; order: string }[] {
  const at = before ? sibs.findIndex((x) => x.id === before) : -1
  const index = at < 0 ? sibs.length : at
  if (!keysUsable(sibs)) return respace([...sibs.slice(0, index), ...ids.map((id) => ({ id })), ...sibs.slice(index)])
  const keys = keysBetween(sibs[index - 1]?.order ?? null, sibs[index]?.order ?? null, ids.length)
  return ids.map((id, k) => ({ id, order: keys[k] as string }))
}

/** Moving item `i` one place up or down (`j` = its neighbour): one new key for the moved item. Pure. */
export function planSwap(sibs: Placed[], i: number, j: number): { id: string; order: string }[] {
  const a = sibs[i]
  if (!a || !sibs[j]) return []
  // Without the moved item, the item that should follow it sits at index j in both directions:
  // up = before the old neighbour (still at j); down = after it (it moved to j-1), so before rest[j] (or last).
  const rest = sibs.filter((_, k) => k !== i)
  return planInsert(rest, a.id, rest[j]?.id ?? null)
}

/**
 * Sibling groups whose keys got long (owner's rule, 28 Oct 2026: more than 4 characters) get short, evenly
 * spaced keys again. Returns the new keys of the items that change. Pure.
 */
export function planTidy(sibs: Placed[]): { id: string; order: string }[] {
  if (!sibs.some((x) => (x.order?.length ?? MAX_ORDER_KEY_LENGTH + 1) > MAX_ORDER_KEY_LENGTH)) return []
  return respace(sibs)
}

export function createStructureOps(ctx: WorkspaceContext) {
  const { log } = ctx

  const siblings = (s: Session, parent: string | undefined): IndexedItem[] =>
    s.index.query({ parent: parent ?? null, sort: { by: 'order' }, limit: 10_000 }).items

  /** Writes the planned order values (and the new parent of `moved`), conflict-safe, then updates the index. */
  async function apply(s: Session, plan: { id: string; order: string }[], moved?: { ids: ReadonlySet<string>; parent: string | null }): Promise<OpResult> {
    const paths = plan.map((p) => s.repo.itemPath(p.id))
    for (const step of plan) {
      const cur = await s.repo.readItem(step.id)
      if (!cur?.ok) return { ok: false, message: T.wsMsg.movingStopped(step.id) }
      const next: Item = { ...cur.item, order: step.order }
      if (moved && moved.ids.has(step.id)) {
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
    /** Writes planned order keys (conflict-safe) and updates the index. */
    applyPlan: (s: Session, plan: { id: string; order: string }[]) => apply(s, plan),
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
    nextOrder(s: Session, parent: string | undefined): string {
      const last = s.index.query({ parent: parent ?? null, sort: { by: 'order', descending: true }, limit: 1 }).items[0]
      return keyBetween(last?.order ?? null, null)
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
        const r = await apply(s, plan, { ids: new Set([id]), parent })
        if (r.ok) log.info(`Moved ${id} under ${parent ?? 'top level'}${before ? ` before ${before}` : ''}`)
        return r
      } catch (e) {
        log.error(`Moving ${id} failed`, e)
        return { ok: false, message: (e as Error).message }
      }
    },

    /**
     * Moves several items at once (owner, 0.11.0): they keep their document order, land together before `before`
     * (or last) under `parent`, and each keeps its children. An item whose parent is moved too stays under it.
     */
    async reparentItems(ids: string[], parent: string | null, before?: string | null): Promise<OpResult> {
      const s = ctx.need()
      const wanted = new Set(ids)
      for (const id of wanted) if (!s.index.get(id)) return { ok: false, message: T.wsMsg.unreadable(id) }
      if (parent !== null) {
        if (!s.index.get(parent)) return { ok: false, message: T.wsMsg.missing(parent) }
        for (const id of wanted) if (createsLoop(s, id, parent)) return { ok: false, message: T.wsMsg.moveLoop(parent, id) }
      }
      // items below another moved item go along with it
      const hasMovedAncestor = (id: string): boolean => {
        const seen = new Set<string>()
        let cur = s.index.get(id)?.parent
        while (cur && !seen.has(cur)) {
          if (wanted.has(cur)) return true
          seen.add(cur)
          cur = s.index.get(cur)?.parent
        }
        return false
      }
      const numbers = ctx.numbers(s)
      const moving = [...wanted].filter((id) => !hasMovedAncestor(id)).sort((a, b) => compareOutline(numbers.get(a), numbers.get(b)) || (a < b ? -1 : 1))
      const set = new Set(moving)
      const sibs = siblings(s, parent ?? undefined).filter((x) => !set.has(x.id))
      // dropping before one of the moved items means before the next one that stays
      let target = before ?? null
      if (target && set.has(target)) {
        const all = siblings(s, parent ?? undefined)
        const k = all.findIndex((x) => x.id === target)
        target = all.slice(k + 1).find((x) => !set.has(x.id))?.id ?? null
      }
      try {
        const r = await apply(s, planInsertMany(sibs, moving, target), { ids: set, parent })
        if (r.ok) log.info(`Moved ${moving.length} items under ${parent ?? 'top level'}${target ? ` before ${target}` : ''}`)
        return r
      } catch (e) {
        log.error(`Moving ${moving.length} items failed`, e)
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
