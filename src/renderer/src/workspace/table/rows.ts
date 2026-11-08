// Where the table's rows come from: a flat, paged list (search/filters) or the document hierarchy (tree).
// Both fetch from the index only what is needed, so the table behaves the same with 50 or 50,000 items.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  /** All documents: one collapsible row per document, its tree inside (the owner, 8 Nov 2026). */
  | { kind: 'group'; name: string; count: number; open: boolean; depth: 0 }

/** The tree key of a document group's top level (an item ID never starts with this character). */
export const GROUP_KEY = (document: string): string => `\u0001${document}`
export const isGroupKey = (key: string): boolean => key.startsWith('\u0001')
export interface DocumentGroup {
  name: string
  count: number
}

type Sort = NonNullable<ItemQuery['sort']>

// ---------------------------------------------------------------- flat list (search / filters)

/** `fullText`: the rows carry each item's whole text (the main column, D-19a), not the short preview. */
export function useFlatRows(active: boolean, query: Omit<ItemQuery, 'limit' | 'offset'>, dataVersion: number, onTotal?: (n: number) => void, fullText = false) {
  const queryKey = JSON.stringify([query, fullText])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState<Map<number, IndexedItem[]>>(new Map())
  const loading = useRef(new Set<number>())
  const generation = useRef(0)

  useEffect(() => {
    if (!active) return
    const gen = ++generation.current
    loading.current = new Set([0])
    void window.reqochet.queryItems({ ...query, limit: PAGE, offset: 0, brief: !fullText }).then((r) => {
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
        void window.reqochet.queryItems({ ...query, limit: PAGE, offset: p * PAGE, brief: !fullText }).then((r) => {
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
export function treeRows(levels: ReadonlyMap<string, Level>, open: OpenState, groups?: readonly DocumentGroup[], closedGroups?: ReadonlySet<string>): Row[] {
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
  if (groups && groups.length > 0) {
    for (const g of groups) {
      const isOpenGroup = !closedGroups?.has(g.name)
      out.push({ kind: 'group', name: g.name, count: g.count, open: isOpenGroup, depth: 0 })
      if (isOpenGroup && g.count > 0) {
        if (!levels.has(GROUP_KEY(g.name))) out.push({ kind: 'loading', parent: GROUP_KEY(g.name), depth: 1 })
        else walk(GROUP_KEY(g.name), 1, [])
      }
    }
    return out
  }
  walk(ROOT, 0, [])
  return out
}

/**
 * `document`: only that document's tree (S-10); undefined = all documents — then `groups` (two or more documents)
 * shows one collapsible row per document with its tree inside.
 */
export function useTreeRows(active: boolean, sort: Sort, dataVersion: number, document?: string, groups?: readonly DocumentGroup[], fullText = false) {
  const grouped = document === undefined && groups !== undefined && groups.length > 1
  const groupNames = grouped ? (groups as DocumentGroup[]).map((g) => g.name).join('\u0000') : ''
  const [closedGroups, setClosedGroups] = useState<ReadonlySet<string>>(new Set())
  const closedRef = useRef(closedGroups)
  useEffect(() => {
    closedRef.current = closedGroups
  }, [closedGroups])
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
  // the document is part of the key: another document is another tree (S-10)
  const sortKey = JSON.stringify([sort, document ?? null, groupNames, fullText])
  // an answer for another sort or document that arrives late must not overwrite the current tree (the e2e run showed
  // "All documents" with only the previous document's row after a save + switch)
  const sortKeyRef = useRef(sortKey)
  useLayoutEffect(() => {
    sortKeyRef.current = sortKey // runs before the load effect below captures it
  }, [sortKey])

  const fetchLevel = useCallback(
    async (key: string, limit: number): Promise<Level> => {
      // a document group's top level, an item's children, or the top level of one document / all documents
      const where = isGroupKey(key) ? { parent: null, document: key.slice(1) } : { parent: key || null, ...(document !== undefined && !key ? { document } : {}) }
      const r = await window.reqochet.queryItems({ ...where, sort, limit, brief: !fullText })
      return { items: r.items, total: r.total, limit }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sortKey stands for sort
    [sortKey]
  )

  /** Every item in one go, grouped by parent (refreshing a widely opened tree). */
  const fetchAll = useCallback(async (): Promise<Map<string, Level>> => {
    const all: IndexedItem[] = []
    for (let offset = 0; ; offset += 10_000) {
      const r = await window.reqochet.queryItems({ sort, limit: 10_000, offset, brief: !fullText, ...(document !== undefined ? { document } : {}) })
      all.push(...r.items)
      if (r.items.length === 0 || all.length >= r.total) break
    }
    const groups = new Map<string, IndexedItem[]>(groupNames ? groupNames.split('\u0000').map((g) => [GROUP_KEY(g), []]) : [[ROOT, []]])
    // an item whose parent is not in this result (another document, or missing) sits at the top level, as in
    // fetchLevel (CR18-05)
    const here = new Set(all.map((x) => `${x.document ?? ''}\u0000${x.id}`))
    for (const it of all) {
      const parentHere = it.parent !== undefined && here.has(`${it.document ?? ''}\u0000${it.parent}`)
      const k = parentHere ? (it.parent as string) : groupNames ? GROUP_KEY(it.document ?? '') : ROOT
      const g = groups.get(k)
      if (g) g.push(it)
      else groups.set(k, [it])
    }
    return new Map([...groups].map(([k, items]) => [k, { items, total: items.length, limit: Math.max(CHILD_LIMIT, items.length) }]))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sortKey stands for sort
  }, [sortKey])

  const merge = (next: Map<string, Level>, asked: string = sortKeyRef.current): void => {
    if (asked !== sortKeyRef.current) return
    setLevels((prev) => {
      const m = new Map(prev)
      for (const [k, v] of next) m.set(k, v)
      return m
    })
  }

  // Load (or reload after a change) the top level and every loaded open parent.
  useEffect(() => {
    if (!active) return
    const gen = ++generation.current
    const asked = sortKeyRef.current
    const o = openRef.current
    // grouped: the open documents' top levels instead of the one top level
    const tops = groupNames ? groupNames.split('\u0000').filter((g) => !closedRef.current.has(g)).map(GROUP_KEY) : [ROOT]
    const keys = [...tops, ...[...levelsRef.current.keys()].filter((k) => k !== ROOT && !isGroupKey(k) && isOpen(o, k))]
    if (!o.all) for (const k of o.ids) if (!keys.includes(k)) keys.push(k)
    void (async () => {
      const next =
        keys.length > BULK_REFRESH
          ? await fetchAll()
          : new Map(await Promise.all(keys.map(async (k) => [k, await fetchLevel(k, levelsRef.current.get(k)?.limit ?? CHILD_LIMIT)] as const)))
      if (gen === generation.current) merge(next, asked)
    })()
  }, [active, dataVersion, fetchLevel, fetchAll, groupNames])

  // compared by value: the screen passes a new list on every render
  const groupsKey = grouped ? JSON.stringify(groups) : ''
  const groupList = useMemo(() => (groupsKey ? (JSON.parse(groupsKey) as DocumentGroup[]) : undefined), [groupsKey])
  const rows = useMemo(() => treeRows(levels, open, groupList, closedGroups), [levels, open, groupList, closedGroups])
  /** Opens or closes a document group (All documents). */
  const setGroupOpen = (name: string, value: boolean): void =>
    setClosedGroups((prev) => {
      const next = new Set(prev)
      if (value) next.delete(name)
      else next.add(name)
      return next
    })

  const load = useCallback(
    (key: string) => {
      if (inflight.current.has(key)) return
      inflight.current.add(key)
      const asked = sortKeyRef.current
      void fetchLevel(key, levelsRef.current.get(key)?.limit ?? CHILD_LIMIT)
        .then((l) => merge(new Map([[key, l]]), asked))
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
    [load, setOpenState] // setOpenState is stable; listed because the React compiler asks for it
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
    const asked = sortKeyRef.current
    void fetchLevel(key, (levelsRef.current.get(key)?.limit ?? CHILD_LIMIT) + CHILD_LIMIT).then((l) => merge(new Map([[key, l]]), asked))
  }

  /** Opens every level at once. Levels are then loaded as they scroll into view (review P-04). */
  const expandAll = async (): Promise<void> => {
    setOpenState({ all: true, ids: new Set() })
  }
  const collapseAll = (): void => setOpenState({ all: false, ids: new Set() })

  /** Open the ancestors of `id` and load the levels on the way, so the item has a row. */
  const reveal = async (id: string): Promise<void> => {
    const asked = sortKeyRef.current
    const ancestors = await window.reqochet.getAncestors(id)
    let top = ROOT
    if (groupNames) {
      // which document holds the item's top-level ancestor: open that group
      const topId = ancestors[0] ?? id
      for (const g of groupNames.split('\u0000')) {
        const level = await fetchLevel(GROUP_KEY(g), 10_000)
        if (level.items.some((x) => x.id === topId)) {
          top = GROUP_KEY(g)
          setGroupOpen(g, true)
          break
        }
      }
    }
    const keys = [top, ...ancestors]
    const loaded = await Promise.all(
      keys.map(async (k, i) => {
        const wanted = keys[i + 1] ?? id
        let level = await fetchLevel(k, levelsRef.current.get(k)?.limit ?? CHILD_LIMIT)
        // the item may sit beyond "Show more" in a very wide section
        if (!level.items.some((x) => x.id === wanted) && level.total > level.items.length) level = await fetchLevel(k, 10_000)
        return [k, level] as const
      })
    )
    merge(new Map(loaded), asked)
    setOpenState((prev) => {
      const ids = new Set(prev.ids)
      for (const a of ancestors) {
        if (prev.all) ids.delete(a)
        else ids.add(a)
      }
      return { all: prev.all, ids }
    })
  }

  return { rows, levels, isOpen: (id: string) => isOpen(open, id), setOpen, setGroupOpen, ensure, showMore, expandAll, collapseAll, reveal }
}
