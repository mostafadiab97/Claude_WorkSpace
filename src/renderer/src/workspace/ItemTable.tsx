import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import type { IndexedItem, ItemQuery, Schema, SortKey } from '../../../shared/domain'
import { formatValue, typeName } from '../lib/schema'

const PAGE = 100
const ROW_HEIGHT = 34
const HEADER_HEIGHT = 37
/** Children shown per parent before a "Show more" row. */
const CHILD_LIMIT = 500
/** With more expanded parents than this, a refresh reloads everything in one go instead of parent by parent. */
const BULK_REFRESH = 60
const INDENT = 14
const ROOT = ''

export interface Column {
  key: SortKey
  label: string
  /** Narrowest the column may get; wider windows share the extra space by `grow`. */
  minPx: number
  grow: number
  value: (i: IndexedItem) => string
  /** Shown in the warning colour (e.g. suspect links). */
  warn?: (i: IndexedItem) => boolean
}

/** Built-in columns that can be hidden (ID and Title are always shown). */
export const BUILT_IN_OPTIONAL = [
  { key: 'type', label: 'Type' },
  { key: 'text', label: 'Text' },
  { key: 'links', label: 'Links' }
] as const

/** Columns that can be hidden: Type, Text, Links and every schema field. */
export function optionalColumns(schema: Schema): { key: string; label: string; builtIn: boolean }[] {
  return [
    { ...BUILT_IN_OPTIONAL[0], builtIn: true },
    { ...BUILT_IN_OPTIONAL[2], builtIn: true },
    ...schema.fields.map((f) => ({ key: `field:${f.id}`, label: f.name, builtIn: false })),
    { ...BUILT_IN_OPTIONAL[1], builtIn: true }
  ]
}

/** "→2 ←3 ⚠1": links out, links in, suspect links. */
export function linkSummary(i: IndexedItem): string {
  const parts: string[] = []
  if (i.links.length) parts.push(`→${i.links.length}`)
  if (i.incomingCount) parts.push(`←${i.incomingCount}`)
  if (i.suspectCount) parts.push(`⚠${i.suspectCount}`)
  return parts.join(' ')
}

/** Personal table layout: hidden column keys, and the order of the optional columns (keys). */
export interface ColumnPrefs {
  hidden: ReadonlySet<string>
  order: string[]
}

/** Sorts columns by a saved key order; columns not in it (e.g. new fields) keep their place at the end. */
export function orderColumns<T extends { key: string }>(cols: T[], order: string[]): T[] {
  const pos = new Map(order.map((k, i) => [k, i]))
  return cols
    .map((c, i) => ({ c, rank: pos.get(c.key) ?? order.length + i }))
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.c)
}

export function columnsFor(schema: Schema, prefs: ColumnPrefs = { hidden: new Set(), order: [] }): Column[] {
  const all: Column[] = [
    { key: 'id', label: 'ID', minPx: 120, grow: 0, value: (i) => i.id },
    { key: 'title', label: 'Title', minPx: 260, grow: 3, value: (i) => i.title || '(no title)' },
    { key: 'type', label: 'Type', minPx: 130, grow: 1.2, value: (i) => typeName(schema, i.type) },
    {
      key: 'links',
      label: 'Links',
      minPx: 90,
      grow: 0.6,
      value: linkSummary,
      warn: (i) => i.suspectCount > 0
    },
    ...schema.fields.map<Column>((f) => ({
      key: `field:${f.id}`,
      label: f.name,
      minPx: f.type === 'list' ? 120 : 100,
      grow: f.type === 'list' ? 1.2 : 1,
      value: (i) => formatValue(i.fields[f.id])
    })),
    { key: 'text', label: 'Text', minPx: 220, grow: 2.5, value: (i) => i.text }
  ]
  const [id, title, ...rest] = all
  return [id as Column, title as Column, ...orderColumns(rest, prefs.order)].filter((c) => !prefs.hidden.has(c.key))
}

export type Row =
  /** `path` = IDs of the item's ancestors, top-level first (tree mode only). */
  | { kind: 'item'; item: IndexedItem; depth: number; path: string[] }
  | { kind: 'more'; parent: string; depth: number; hidden: number }

export interface TreeControls {
  expandAll: () => Promise<void>
  collapseAll: () => void
}

type Sort = NonNullable<ItemQuery['sort']>
type Zone = 'before' | 'into' | 'after'

function linkTitle(i: IndexedItem): string {
  const lines = [`${i.links.length} link(s) from this item, ${i.incomingCount} from other items`]
  if (i.suspectCount) lines.push(`${i.suspectCount} suspect: the linked item changed since the link was confirmed`)
  return lines.join('\n')
}

// ---------------------------------------------------------------- flat list (search / filters)

function useFlatRows(active: boolean, query: Omit<ItemQuery, 'limit' | 'offset'>, dataVersion: number, onTotal?: (n: number) => void) {
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

interface Level {
  items: IndexedItem[]
  total: number
  limit: number
}

function useTreeRows(active: boolean, sort: Sort, dataVersion: number) {
  const [levels, setLevels] = useState<Map<string, Level>>(new Map())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const levelsRef = useRef(levels)
  const expandedRef = useRef(expanded)
  useEffect(() => {
    levelsRef.current = levels
    expandedRef.current = expanded
  }, [levels, expanded])
  const generation = useRef(0)
  const sortKey = JSON.stringify(sort)

  const fetchLevel = useCallback(
    async (key: string, limit: number): Promise<Level> => {
      const r = await window.reqman.queryItems({ parent: key || null, sort, limit, brief: true })
      return { items: r.items, total: r.total, limit }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sortKey stands for sort
    [sortKey]
  )

  /** Every item in one go, grouped by parent (Expand all, or refreshing a widely expanded tree). */
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

  // Load (or reload after a change) the top level and every expanded parent.
  useEffect(() => {
    if (!active) return
    const gen = ++generation.current
    const keys = [ROOT, ...expandedRef.current]
    void (async () => {
      const next =
        keys.length > BULK_REFRESH
          ? await fetchAll()
          : new Map(await Promise.all(keys.map(async (k) => [k, await fetchLevel(k, levelsRef.current.get(k)?.limit ?? CHILD_LIMIT)] as const)))
      if (gen === generation.current) merge(next)
    })()
  }, [active, dataVersion, fetchLevel, fetchAll])

  const rows = useMemo(() => {
    const out: Row[] = []
    const walk = (key: string, depth: number, path: string[]): void => {
      const level = levels.get(key)
      if (!level) return
      for (const item of level.items) {
        out.push({ kind: 'item', item, depth, path })
        if (item.childCount > 0 && expanded.has(item.id) && !path.includes(item.id)) walk(item.id, depth + 1, [...path, item.id])
      }
      if (level.total > level.items.length) out.push({ kind: 'more', parent: key, depth, hidden: level.total - level.items.length })
    }
    walk(ROOT, 0, [])
    return out
  }, [levels, expanded])

  const setOpen = useCallback(
    (id: string, open: boolean) => {
      setExpanded((prev) => {
        const s = new Set(prev)
        if (open) s.add(id)
        else s.delete(id)
        return s
      })
      // Always fetch on expand: a collapsed parent's children may have changed meanwhile.
      if (open) void fetchLevel(id, levelsRef.current.get(id)?.limit ?? CHILD_LIMIT).then((l) => merge(new Map([[id, l]])))
    },
    [fetchLevel]
  )

  const showMore = (key: string): void => {
    void fetchLevel(key, (levelsRef.current.get(key)?.limit ?? CHILD_LIMIT) + CHILD_LIMIT).then((l) => merge(new Map([[key, l]])))
  }

  const expandAll = async (): Promise<void> => {
    const gen = ++generation.current
    const all = await fetchAll()
    if (gen !== generation.current) return
    setLevels(all)
    setExpanded(new Set([...all.keys()].filter((k) => k !== ROOT)))
  }
  const collapseAll = (): void => setExpanded(new Set())

  /** Expand the ancestors of `id` and load the levels on the way, so the item has a row. */
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
    setExpanded((prev) => new Set([...prev, ...ancestors]))
  }

  return { rows, levels, expanded, setOpen, showMore, expandAll, collapseAll, reveal }
}

// ---------------------------------------------------------------- the table

/**
 * The item table. Without search or filters it shows the document hierarchy (expand/collapse, drag rows to
 * move them); with search or filters it is a flat list of the matches. Only visible rows are rendered and rows
 * are fetched from the index in pages, so it behaves the same with 50 or 50,000 items.
 */
export function ItemTable(props: {
  schema: Schema
  prefs: ColumnPrefs
  mode: 'tree' | 'flat'
  query: Omit<ItemQuery, 'limit' | 'offset'>
  dataVersion: number
  selectedId: string | null
  onSelect: (id: string) => void
  onSort: (key: SortKey) => void
  onTotal?: (total: number) => void
  /** Drag and drop: make `id` a child of `parent` (null = top level), placed before `before` (null = last). */
  onMove: (id: string, parent: string | null, before: string | null) => void
  controlsRef?: { current: TreeControls | null }
  /** Bumped after a save or move: show the selected item again (its parent may have changed). */
  revealNonce?: number
  emptyText: string
}) {
  const { schema, prefs, mode, query, dataVersion, selectedId, onSelect, onSort, onTotal, onMove, controlsRef, revealNonce, emptyText } = props
  const columns = useMemo(() => columnsFor(schema, prefs), [schema, prefs])
  const template = columns.map((c) => (c.grow ? `minmax(${c.minPx}px, ${c.grow}fr)` : `${c.minPx}px`)).join(' ')
  // When the pane is narrower than all columns together, header and rows scroll sideways together.
  const minWidth = columns.reduce((sum, c) => sum + c.minPx, 0)
  const isTree = mode === 'tree'
  const sort: Sort = query.sort ?? { by: 'order' }

  const flat = useFlatRows(!isTree, query, dataVersion, onTotal)
  const tree = useTreeRows(isTree, sort, dataVersion)
  const count = isTree ? tree.rows.length : flat.count
  const rowAt = (i: number): Row | undefined => (isTree ? tree.rows[i] : flat.rowAt(i))
  const indexOf = (id: string): number => (isTree ? tree.rows.findIndex((r) => r.kind === 'item' && r.item.id === id) : flat.indexOf(id))

  const scrollRef = useRef<HTMLDivElement>(null)
  // A new search or filter scrolls back to the top; a data refresh keeps the scroll position.
  const viewKey = `${mode}|${JSON.stringify(query)}`
  const lastView = useRef(viewKey)
  useEffect(() => {
    if (lastView.current !== viewKey && scrollRef.current) scrollRef.current.scrollTop = 0
    lastView.current = viewKey
  }, [viewKey])

  // eslint-disable-next-line react-hooks/incompatible-library -- the virtualizer manages its own state; this component is not memoized
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    // the sticky header sits above the first row inside the same scroll area
    scrollMargin: HEADER_HEIGHT,
    overscan: 12
  })
  const visible = virtualizer.getVirtualItems()
  const first = visible[0]?.index ?? 0
  const last = visible.at(-1)?.index ?? 0
  const { ensure } = flat
  useEffect(() => ensure(first, last), [first, last, ensure])

  useEffect(() => {
    if (controlsRef) controlsRef.current = { expandAll: tree.expandAll, collapseAll: tree.collapseAll }
  })

  // Tree: when an item is selected from elsewhere (problem list, a link, a new item, leaving search),
  // open its parents and scroll to it.
  const rowsRef = useRef(tree.rows)
  useEffect(() => {
    rowsRef.current = tree.rows
  }, [tree.rows])
  const pendingScroll = useRef<string | null>(null)
  const lastNonce = useRef(revealNonce)
  const { reveal } = tree
  useEffect(() => {
    if (!isTree || !selectedId) return
    const index = rowsRef.current.findIndex((r) => r.kind === 'item' && r.item.id === selectedId)
    if (index >= 0 && revealNonce === lastNonce.current) virtualizer.scrollToIndex(index, { align: 'auto' })
    else {
      lastNonce.current = revealNonce
      pendingScroll.current = selectedId
      void reveal(selectedId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the selection or mode changes, not on every load
  }, [selectedId, isTree, revealNonce])
  useEffect(() => {
    const id = pendingScroll.current
    if (!id) return
    const index = tree.rows.findIndex((r) => r.kind === 'item' && r.item.id === id)
    if (index >= 0) {
      pendingScroll.current = null
      virtualizer.scrollToIndex(index, { align: 'center' })
    }
  }, [tree.rows, virtualizer])

  // ---- keyboard: ↑/↓ move the selection; in the tree → opens, ← closes or goes to the parent
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const index = selectedId ? indexOf(selectedId) : -1
    const row = index >= 0 ? rowAt(index) : undefined
    if (isTree && row?.kind === 'item' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault()
      const open = tree.expanded.has(row.item.id)
      if (e.key === 'ArrowRight' && row.item.childCount > 0 && !open) tree.setOpen(row.item.id, true)
      else if (e.key === 'ArrowLeft' && open) tree.setOpen(row.item.id, false)
      else if (e.key === 'ArrowLeft' && row.path.length > 0) onSelect(row.path.at(-1) as string)
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const step = e.key === 'ArrowDown' ? 1 : -1
    for (let next = index + step; next >= 0 && next < count; next += step) {
      const r = rowAt(next)
      if (r?.kind === 'item') {
        onSelect(r.item.id)
        virtualizer.scrollToIndex(next, { align: 'auto' })
        return
      }
      if (!r) return // not loaded yet
    }
  }

  // ---- drag and drop
  const dragging = useRef<string | null>(null)
  const [drop, setDrop] = useState<{ index: number; zone: Zone } | null>(null)
  const expandTimer = useRef<{ id: string; timer: number } | null>(null)
  const clearDrag = (): void => {
    dragging.current = null
    setDrop(null)
    if (expandTimer.current) window.clearTimeout(expandTimer.current.timer)
    expandTimer.current = null
  }

  const zoneFor = (e: DragEvent<HTMLElement>, row: Row & { kind: 'item' }): Zone | null => {
    const id = dragging.current
    if (!id || row.item.id === id || row.path.includes(id)) return null
    if (!isTree) return 'into' // in a search result only "make it a child of this row" makes sense
    const rect = e.currentTarget.getBoundingClientRect()
    const y = (e.clientY - rect.top) / rect.height
    return y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'into'
  }

  const onRowDragOver = (e: DragEvent<HTMLElement>, index: number, row: Row & { kind: 'item' }): void => {
    const zone = zoneFor(e, row)
    e.stopPropagation()
    if (!zone) {
      e.dataTransfer.dropEffect = 'none'
      setDrop(null)
      return
    }
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (drop?.index !== index || drop.zone !== zone) setDrop({ index, zone })
    // hovering over a closed parent opens it after a moment
    if (isTree && zone === 'into' && row.item.childCount > 0 && !tree.expanded.has(row.item.id) && expandTimer.current?.id !== row.item.id) {
      if (expandTimer.current) window.clearTimeout(expandTimer.current.timer)
      expandTimer.current = { id: row.item.id, timer: window.setTimeout(() => tree.setOpen(row.item.id, true), 700) }
    }
  }

  const onRowDrop = (e: DragEvent<HTMLElement>, row: Row & { kind: 'item' }): void => {
    e.preventDefault()
    e.stopPropagation()
    const id = dragging.current
    const zone = zoneFor(e, row)
    clearDrag()
    if (!id || !zone) return
    const parentOf = (r: Row & { kind: 'item' }): string | null => (isTree ? (r.path.at(-1) ?? null) : (r.item.parent ?? null))
    if (zone === 'into') return onMove(id, row.item.id, null)
    if (zone === 'before') return onMove(id, parentOf(row), row.item.id)
    // after: below an open parent means "first child"; otherwise "before the next sibling"
    const children = tree.levels.get(row.item.id)?.items
    if (tree.expanded.has(row.item.id) && children?.length) return onMove(id, row.item.id, children[0]?.id ?? null)
    const parent = parentOf(row)
    const sibs = tree.levels.get(parent ?? ROOT)?.items ?? []
    const k = sibs.findIndex((s) => s.id === row.item.id)
    const next = sibs.slice(k + 1).find((s) => s.id !== id)
    onMove(id, parent, next?.id ?? null)
  }

  // Dropping on the empty space below the rows makes the item a top-level item.
  const onAreaDragOver = (e: DragEvent<HTMLElement>): void => {
    if (!dragging.current || !isTree) return
    e.preventDefault()
    setDrop(null)
  }
  const onAreaDrop = (e: DragEvent<HTMLElement>): void => {
    const id = dragging.current
    clearDrag()
    if (!id || !isTree) return
    e.preventDefault()
    onMove(id, null, null)
  }

  const sortBy = query.sort?.by ?? 'order'
  const desc = query.sort?.descending ?? false

  return (
    <div
      className="table table__scroll scroll"
      role={isTree ? 'treegrid' : 'grid'}
      aria-rowcount={count}
      aria-label="Items"
      ref={scrollRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onDragOver={onAreaDragOver}
      onDrop={onAreaDrop}
    >
      <div className="table__inner" style={{ minWidth }}>
        <div className="table__head" role="row" style={{ gridTemplateColumns: template }}>
          {columns.map((c) => (
            <button
              key={c.key}
              type="button"
              role="columnheader"
              aria-sort={sortBy === c.key ? (desc ? 'descending' : 'ascending') : 'none'}
              className={`${sortBy === c.key ? 'table__th table__th--sorted' : 'table__th'}${c.key === 'id' ? ' table__th--id' : ''}`}
              onClick={() => onSort(c.key)}
              title={isTree ? `Sort by ${c.label} (within each parent); click again for descending, a third time for document order` : `Sort by ${c.label}`}
            >
              {c.label}
              {sortBy === c.key && <span aria-hidden="true">{desc ? ' ▾' : ' ▴'}</span>}
            </button>
          ))}
        </div>
        {count === 0 ? (
          <p className="table__empty">{emptyText}</p>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {visible.map((v) => {
              const row = rowAt(v.index)
              const style = { gridTemplateColumns: template, height: ROW_HEIGHT, transform: `translateY(${v.start - HEADER_HEIGHT}px)` }
              if (row?.kind === 'more') {
                return (
                  <div key={v.key} role="row" className="table__row table__row--more" style={style}>
                    <span className="table__td table__td--id" />
                    <span className="table__td" style={{ paddingLeft: `${8 + row.depth * INDENT + INDENT}px` }}>
                      <button type="button" className="link-btn" onClick={() => tree.showMore(row.parent)}>
                        Show more ({row.hidden.toLocaleString('en')} hidden)
                      </button>
                    </span>
                  </div>
                )
              }
              const item = row?.item
              const selected = item?.id === selectedId
              const dropClass = drop?.index === v.index ? ` table__row--drop-${drop.zone}` : ''
              const open = item ? tree.expanded.has(item.id) : false
              return (
                <div
                  key={v.key}
                  role="row"
                  aria-rowindex={v.index + 1}
                  aria-selected={selected}
                  aria-level={isTree && row ? row.depth + 1 : undefined}
                  aria-expanded={isTree && item && item.childCount > 0 ? open : undefined}
                  data-id={item?.id}
                  className={`table__row${selected ? ' table__row--selected' : ''}${dropClass}`}
                  style={style}
                  draggable={Boolean(item)}
                  onDragStart={(e) => {
                    if (!item) return
                    dragging.current = item.id
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', item.id)
                  }}
                  onDragEnd={clearDrag}
                  onDragOver={(e) => row?.kind === 'item' && onRowDragOver(e, v.index, row)}
                  onDragLeave={() => drop?.index === v.index && setDrop(null)}
                  onDrop={(e) => row?.kind === 'item' && onRowDrop(e, row)}
                  onClick={() => item && onSelect(item.id)}
                >
                  {row && item
                    ? columns.map((c) =>
                        c.key === 'title' && isTree ? (
                          <span key={c.key} role="gridcell" className="table__td table__td--tree" style={{ paddingLeft: `${4 + row.depth * INDENT}px` }} title={c.value(item)}>
                            {item.childCount > 0 ? (
                              <button
                                type="button"
                                className="tree__toggle"
                                aria-label={open ? `Collapse ${item.id}` : `Expand ${item.id}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  tree.setOpen(item.id, !open)
                                }}
                              >
                                {open ? '▾' : '▸'}
                              </button>
                            ) : (
                              <span className="tree__toggle tree__toggle--leaf" aria-hidden="true" />
                            )}
                            <span className="table__text">{c.value(item)}</span>
                            {item.childCount > 0 && !open && <span className="table__count">{item.childCount.toLocaleString('en')}</span>}
                          </span>
                        ) : (
                          <span
                            key={c.key}
                            role="gridcell"
                            className={`table__td${c.key === 'id' ? ' table__td--id' : ''}${c.warn?.(item) ? ' table__td--warn' : ''}`}
                            title={c.key === 'links' ? linkTitle(item) : c.value(item)}
                          >
                            {c.value(item)}
                          </span>
                        )
                      )
                    : <span className="table__td table__td--loading">…</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
