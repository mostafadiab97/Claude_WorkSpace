// Where the table's rows come from: a flat, paged list (search/filters) or the document hierarchy (tree).
// Both fetch from the index only what is needed, so the table behaves the same with 50 or 50,000 items.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { IndexedItem, ItemQuery } from '../../../../shared/domain'

const PAGE = 100
/** Children shown per parent before a "Show more" row. */
export const CHILD_LIMIT = 500
/** With more loaded levels than this, a refresh reloads everything in one go instead of parent by parent. */
const BULK_REFRESH = 60
export const ROOT = ''

export type Row =
  /** `path` = IDs of the item's ancestors, top-level first (tree mode only). */
  | { kind: 'item'; item: IndexedItem; depth: number; path: string[] }
  | { kind: 'more'; parent: string; depth: number; hidden: number }
  /** An open parent whose children are not loaded yet ("Expand all" loads levels as they scroll into view). */
  | { kind: 'loading'; parent: string; depth: number }

type Sort = NonNullable<ItemQuery['sort']>

// ---------------------------------------------------------------- flat list (search / filters)

export function useFlatRows(active: boolean, query: Omit<ItemQuery, 'limit' | 'offset'>, dataVersion: number, onTotal?: (n: number) => void) {
  const queryKey = JSON.stringify(query)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState<Map<number, IndexedItem[]>>(new Map())
  const loading = useRef(new Set<number>())
  const generation = useRef(0)

  useEffect(() => {
    if (!active) return
    const gen = ++generation.current
    loading.current = new Set([0])
    void window.reqman.queryItems({ ...query, limit: PAGE, offset: 0, brief: true }).then((r) => {
      if (gen !== generation.current) return
      setTotal(r.total)
      onTotal?.(r.total)
      setPages(new Map([[0, r.items]]))
      loading.current.delete(0)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKey stands for query
  }, [active, queryKey, dataVersion])

  const ensure = useCallback(
    (first: number, last: number) => {
      if (!active) return
      const gen = generation.current
      for (let p = Math.floor(first / PAGE); p <= Math.floor(last / PAGE); p++) {
        if (pages.has(p) || loading.current.has(p)) continue
        loading.current.add(p)
        void window.reqman.queryItems({ ...query, limit: PAGE, offset: p * PAGE, brief: true }).then((r) => {
          if (gen !== generation.current) return
          loading.current.delete(p)
          setPages((prev) => new Map(prev).set(p, r.items))
        })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- query is fixed for a generation
    [active, pages]
  )

  const rowAt = (index: number): Row | undefined => {
    const item = pages.get(Math.floor(index / PAGE))?.[index % PAGE]
    return item ? { kind: 'item', item, depth: 0, path: [] } : undefined
  }
  const indexOf = (id: string): number => {
    for (const [p, rows] of pages) {
      const k = rows.findIndex((r) => r.id === id)
      if (k >= 0) return p * PAGE + k
    }
    return -1
  }
  return { count: active ? total : 0, rowAt, indexOf, ensure }
}

// ---------------------------------------------------------------- tree (document hierarchy)

export interface Level {
  items: IndexedItem[]
  total: number
  limit: number
}

/** Which parents are open: a set of opened IDs, or "everything" minus the ones closed again. */
export interface OpenState {
  all: boolean
  ids: ReadonlySet<string>
}
export const isOpen = (o: OpenState, id: string): boolean => (o.all ? !o.ids.has(id) : o.ids.has(id))

/**
 * The visible rows of the tree, depth-first. Pure (unit-tested): an open parent whose level is not loaded yet
 * yields one "loading" row; a level with more children than loaded ends with a "more" row.
 */
export function treeRows(levels: ReadonlyMap<string, Level>, open: OpenState): Row[] {
  const out: Row[] = []
  const walk = (key: string, depth: number, path: string[]): void => {
    const level = levels.get(key)
    if (!level) {
      if (key !== ROOT) out.push({ kind: 'loading', parent: key, depth })
      return
    }
    for (const item of level.items) {
      out.push({ kind: 'item', item, depth, path })
      if (item.childCount > 0 && isOpen(open, item.id) && !path.includes(item.id)) walk(item.id, depth + 1, [...path, item.id])
    }
    if (level.total > level.items.length) out.push({ kind: 'more', parent: key, depth, hidden: level.total - level.items.length })
  }
  walk(ROOT, 0, [])
  return out
}

export function useTreeRows(active: boolean, sort: Sort, dataVersion: number) {
  const [levels, setLevels] = useState<Map<string, Level>>(new Map())
  const [open, setOpenState] = useState<OpenState>({ all: false, ids: new Set() })
  const levelsRef = useRef(levels)
  const openRef = useRef(open)
  useEffect(() => {
    levelsRef.current = levels
    openRef.current = open
  }, [levels, open])
  const generation = useRef(0)
  const inflight = useRef(new Set<string>())
  const sortKey = JSON.stringify(sort)

  const fetchLevel = useCallback(
    async (key: string, limit: number): Promise<Level> => {
      const r = await window.reqman.queryItems({ parent: key || null, sort, limit, brief: true })
      return { items: r.items, total: r.total, limit }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sortKey stands for sort
    [sortKey]
  )

  /** Every item in one go, grouped by parent (refreshing a widely opened tree). */
  const fetchAll = useCallback(async (): Promise<Map<string, Level>> => {
    const all: IndexedItem[] = []
    for (let offset = 0; ; offset += 10_000) {
      const r = await window.reqman.queryItems({ sort, limit: 10_000, offset, brief: true })
      all.push(...r.items)
      if (r.items.length === 0 || all.length >= r.total) break
    }
    const groups = new Map<string, IndexedItem[]>([[ROOT, []]])
    for (const it of all) {
      const k = it.parent ?? ROOT
      const g = groups.get(k)
      if (g) g.push(it)
      else groups.set(k, [it])
    }
    return new Map([...groups].map(([k, items]) => [k, { items, total: items.length, limit: Math.max(CHILD_LIMIT, items.length) }]))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sortKey stands for sort
  }, [sortKey])

  const merge = (next: Map<string, Level>): void =>
    setLevels((prev) => {
      const m = new Map(prev)
      for (const [k, v] of next) m.set(k, v)
      return m
    })

  // Load (or reload after a change) the top level and every loaded open parent.
  useEffect(() => {
    if (!active) return
    const gen = ++generation.current
    const o = openRef.current
    const keys = [ROOT, ...[...levelsRef.current.keys()].filter((k) => k !== ROOT && isOpen(o, k))]
    if (!o.all) for (const k of o.ids) if (!keys.includes(k)) keys.push(k)
    void (async () => {
      const next =
        keys.length > BULK_REFRESH
          ? await fetchAll()
          : new Map(await Promise.all(keys.map(async (k) => [k, await fetchLevel(k, levelsRef.current.get(k)?.limit ?? CHILD_LIMIT)] as const)))
      if (gen === generation.current) merge(next)
    })()
  }, [active, dataVersion, fetchLevel, fetchAll])

  const rows = useMemo(() => treeRows(levels, open), [levels, open])

  const load = useCallback(
    (key: string) => {
      if (inflight.current.has(key)) return
      inflight.current.add(key)
      void fetchLevel(key, levelsRef.current.get(key)?.limit ?? CHILD_LIMIT)
        .then((l) => merge(new Map([[key, l]])))
        .finally(() => inflight.current.delete(key))
    },
    [fetchLevel]
  )

  const setOpen = useCallback(
    (id: string, value: boolean) => {
      setOpenState((prev) => {
        const ids = new Set(prev.ids)
        // in "everything open" mode the set lists the closed ones
        if (value !== prev.all) ids.add(id)
        else ids.delete(id)
        return { all: prev.all, ids }
      })
      // Always fetch on open: a closed parent's children may have changed meanwhile.
      if (value) load(id)
    },
    [load]
  )

  /** Loads the levels of "loading" rows between these row indexes (the visible part of the table). */
  const ensure = useCallback(
    (first: number, last: number) => {
      if (!active) return
      for (let i = first; i <= last && i < rows.length; i++) {
        const r = rows[i]
        if (r?.kind === 'loading') load(r.parent)
      }
    },
    [active, rows, load]
  )

  const showMore = (key: string): void => {
    void fetchLevel(key, (levelsRef.current.get(key)?.limit ?? CHILD_LIMIT) + CHILD_LIMIT).then((l) => merge(new Map([[key, l]])))
  }

  /** Opens every level at once. Levels are then loaded as they scroll into view (review P-04). */
  const expandAll = async (): Promise<void> => {
    setOpenState({ all: true, ids: new Set() })
  }
  const collapseAll = (): void => setOpenState({ all: false, ids: new Set() })

  /** Open the ancestors of `id` and load the levels on the way, so the item has a row. */
  const reveal = async (id: string): Promise<void> => {
    const ancestors = await window.reqman.getAncestors(id)
    const keys = [ROOT, ...ancestors]
    const loaded = await Promise.all(
      keys.map(async (k, i) => {
        const wanted = keys[i + 1] ?? id
        let level = await fetchLevel(k, levelsRef.current.get(k)?.limit ?? CHILD_LIMIT)
        // the item may sit beyond "Show more" in a very wide section
        if (!level.items.some((x) => x.id === wanted) && level.total > level.items.length) level = await fetchLevel(k, 10_000)
        return [k, level] as const
      })
    )
    merge(new Map(loaded))
    setOpenState((prev) => {
      const ids = new Set(prev.ids)
      for (const a of ancestors) {
        if (prev.all) ids.delete(a)
        else ids.add(a)
      }
      return { all: prev.all, ids }
    })
  }

  return { rows, levels, isOpen: (id: string) => isOpen(open, id), setOpen, ensure, showMore, expandAll, collapseAll, reveal }
}
