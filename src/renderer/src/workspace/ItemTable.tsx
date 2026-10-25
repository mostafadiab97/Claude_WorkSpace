import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { IndexedItem, ItemQuery, Schema, SortKey } from '../../../shared/domain'
import { formatValue, typeName } from '../lib/schema'

const PAGE = 100
const ROW_HEIGHT = 34
const HEADER_HEIGHT = 37

export interface Column {
  key: SortKey
  label: string
  /** Narrowest the column may get; wider windows share the extra space by `grow`. */
  minPx: number
  grow: number
  value: (i: IndexedItem) => string
}

export function columnsFor(schema: Schema): Column[] {
  return [
    { key: 'id', label: 'ID', minPx: 120, grow: 0, value: (i) => i.id },
    { key: 'title', label: 'Title', minPx: 220, grow: 3, value: (i) => i.title || '(no title)' },
    { key: 'type', label: 'Type', minPx: 130, grow: 1.2, value: (i) => typeName(schema, i.type) },
    ...schema.fields.map<Column>((f) => ({
      key: `field:${f.id}`,
      label: f.name,
      minPx: f.type === 'list' ? 120 : 100,
      grow: f.type === 'list' ? 1.2 : 1,
      value: (i) => formatValue(i.fields[f.id])
    }))
  ]
}

/**
 * The item table. Only visible rows are rendered and rows are fetched from the index 100 at a time,
 * so it behaves the same with 50 or 50,000 items.
 */
export function ItemTable(props: {
  schema: Schema
  query: Omit<ItemQuery, 'limit' | 'offset'>
  dataVersion: number
  selectedId: string | null
  onSelect: (id: string) => void
  onSort: (key: SortKey) => void
  onTotal?: (total: number) => void
  emptyText: string
}) {
  const { schema, query, dataVersion, selectedId, onSelect, onSort, onTotal, emptyText } = props
  const columns = useMemo(() => columnsFor(schema), [schema])
  const template = columns.map((c) => (c.grow ? `minmax(${c.minPx}px, ${c.grow}fr)` : `${c.minPx}px`)).join(' ')
  // When the pane is narrower than all columns together, header and rows scroll sideways together.
  const minWidth = columns.reduce((sum, c) => sum + c.minPx, 0)
  const queryKey = JSON.stringify(query)

  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState<Map<number, IndexedItem[]>>(new Map())
  const loading = useRef(new Set<number>())
  const generation = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // New query or changed data: start over from the first page. A new query also scrolls back to the top;
  // a data refresh (save, outside change) keeps the scroll position.
  const lastQuery = useRef(queryKey)
  useEffect(() => {
    if (lastQuery.current !== queryKey && scrollRef.current) scrollRef.current.scrollTop = 0
    lastQuery.current = queryKey
    const gen = ++generation.current
    loading.current = new Set([0])
    void window.reqman.queryItems({ ...query, limit: PAGE, offset: 0 }).then((r) => {
      if (gen !== generation.current) return
      setTotal(r.total)
      onTotal?.(r.total)
      setPages(new Map([[0, r.items]]))
      loading.current.delete(0)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKey stands for query
  }, [queryKey, dataVersion])

  // eslint-disable-next-line react-hooks/incompatible-library -- the virtualizer manages its own state; this component is not memoized
  const virtualizer = useVirtualizer({
    count: total,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    // the sticky header sits above the first row inside the same scroll area
    scrollMargin: HEADER_HEIGHT,
    overscan: 12
  })
  const visible = virtualizer.getVirtualItems()

  // Fetch the pages the visible rows fall into.
  const first = visible[0]?.index ?? 0
  const last = visible.at(-1)?.index ?? 0
  useEffect(() => {
    const gen = generation.current
    for (let p = Math.floor(first / PAGE); p <= Math.floor(last / PAGE); p++) {
      if (pages.has(p) || loading.current.has(p)) continue
      loading.current.add(p)
      void window.reqman.queryItems({ ...query, limit: PAGE, offset: p * PAGE }).then((r) => {
        if (gen !== generation.current) return
        loading.current.delete(p)
        setPages((prev) => new Map(prev).set(p, r.items))
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- query is fixed for a generation
  }, [first, last, pages])

  const rowAt = (index: number): IndexedItem | undefined => pages.get(Math.floor(index / PAGE))?.[index % PAGE]

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    let index = -1
    for (const [p, rows] of pages) {
      const k = rows.findIndex((r) => r.id === selectedId)
      if (k >= 0) index = p * PAGE + k
    }
    const next = Math.min(Math.max(index + (e.key === 'ArrowDown' ? 1 : -1), 0), total - 1)
    const row = rowAt(next)
    if (row) {
      onSelect(row.id)
      virtualizer.scrollToIndex(next, { align: 'auto' })
    }
  }

  const sortBy = query.sort?.by ?? 'id'
  const desc = query.sort?.descending ?? false

  return (
    <div className="table table__scroll scroll" role="grid" aria-rowcount={total} aria-label="Items" ref={scrollRef} tabIndex={0} onKeyDown={onKeyDown}>
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
              title={`Sort by ${c.label}`}
            >
              {c.label}
              {sortBy === c.key && <span aria-hidden="true">{desc ? ' ▾' : ' ▴'}</span>}
            </button>
          ))}
        </div>
        {total === 0 ? (
          <p className="table__empty">{emptyText}</p>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {visible.map((v) => {
              const row = rowAt(v.index)
              return (
                <div
                  key={v.key}
                  role="row"
                  aria-rowindex={v.index + 1}
                  aria-selected={row?.id === selectedId}
                  className={row?.id === selectedId ? 'table__row table__row--selected' : 'table__row'}
                  style={{ gridTemplateColumns: template, height: ROW_HEIGHT, transform: `translateY(${v.start - HEADER_HEIGHT}px)` }}
                  onClick={() => row && onSelect(row.id)}
                >
                  {row
                    ? columns.map((c) => (
                        <span key={c.key} role="gridcell" className={c.key === 'id' ? 'table__td table__td--id' : 'table__td'} title={c.value(row)}>
                          {c.value(row)}
                        </span>
                      ))
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
