import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react'
import type { ItemQuery, Schema, SortKey } from '../../../shared/domain'
import { T } from '../../../shared/text'
import { columnsFor, linkTitle, type ColumnPrefs } from './table/columns'
import { useRowDrag } from './table/drag'
import { useFlatRows, useTreeRows, type Row } from './table/rows'

export { optionalColumns, orderColumns, shownColumnKeys, columnsFor, linkSummary, type Column, type ColumnPrefs } from './table/columns'
export type { Row } from './table/rows'

const ROW_HEIGHT = 34
const HEADER_HEIGHT = 37
const INDENT = 14

export interface TreeControls {
  expandAll: () => Promise<void>
  collapseAll: () => void
}

/**
 * The item table. Without search or filters it shows the document hierarchy (expand/collapse, drag rows to
 * move them); with search or filters it is a flat list of the matches. Only visible rows are rendered and rows
 * are fetched from the index in pages (table/rows.ts), so it behaves the same with 50 or 50,000 items.
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
  const sort = query.sort ?? { by: 'order' as const }

  const flat = useFlatRows(!isTree, query, dataVersion, onTotal)
  const tree = useTreeRows(isTree, sort, dataVersion)
  const count = isTree ? tree.rows.length : flat.count
  const rowAt = (i: number): Row | undefined => (isTree ? tree.rows[i] : flat.rowAt(i))
  const indexOf = (id: string): number => (isTree ? tree.rows.findIndex((r) => r.kind === 'item' && r.item.id === id) : flat.indexOf(id))
  const drag = useRowDrag({ tree: isTree, levels: tree.levels, isOpen: tree.isOpen, open: (id) => tree.setOpen(id, true), onMove })

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
  const ensureFlat = flat.ensure
  const ensureTree = tree.ensure
  useEffect(() => ensureFlat(first, last), [first, last, ensureFlat])
  useEffect(() => ensureTree(first, last), [first, last, ensureTree])

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
      const open = tree.isOpen(row.item.id)
      if (e.key === 'ArrowRight' && row.item.childCount > 0 && !open) tree.setOpen(row.item.id, true)
      else if (e.key === 'ArrowLeft' && open && row.item.childCount > 0) tree.setOpen(row.item.id, false)
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
      if (!r || r.kind === 'loading') return // not loaded yet
    }
  }

  const sortBy = query.sort?.by ?? 'order'
  const desc = query.sort?.descending ?? false

  return (
    <div
      className="table table__scroll scroll"
      role={isTree ? 'treegrid' : 'grid'}
      aria-rowcount={count}
      aria-label={T.table.label}
      ref={scrollRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onDragOver={drag.areaOver}
      onDrop={drag.areaDrop}
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
              title={isTree ? T.table.sortTreeTooltip(c.label) : T.table.sortTooltip(c.label)}
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
              if (row?.kind === 'more' || row?.kind === 'loading') {
                return (
                  <div key={v.key} role="row" className={`table__row table__row--more${row.kind === 'loading' ? ' table__row--loading' : ''}`} style={style}>
                    <span className="table__td table__td--id" />
                    <span className="table__td" style={{ paddingLeft: `${8 + row.depth * INDENT + INDENT}px` }}>
                      {row.kind === 'more' ? (
                        <button type="button" className="link-btn" onClick={() => tree.showMore(row.parent)}>
                          {T.table.showMore(row.hidden)}
                        </button>
                      ) : (
                        T.common.loading
                      )}
                    </span>
                  </div>
                )
              }
              const item = row?.item
              const selected = item?.id === selectedId
              const dropClass = drag.drop?.index === v.index ? ` table__row--drop-${drag.drop.zone}` : ''
              const open = item ? tree.isOpen(item.id) : false
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
                  onDragStart={(e) => item && drag.start(e, item.id)}
                  onDragEnd={drag.end}
                  onDragOver={(e) => row?.kind === 'item' && drag.over(e, v.index, row)}
                  onDragLeave={() => drag.leave(v.index)}
                  onDrop={(e) => row?.kind === 'item' && drag.dropOn(e, row)}
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
                                aria-label={open ? T.table.collapse(item.id) : T.table.expand(item.id)}
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
