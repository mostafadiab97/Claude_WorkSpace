import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { ItemQuery, Schema, SortKey } from '../../../shared/domain'
import { T } from '../../../shared/text'
import { renderItemText } from '../lib/markdown'
import { isHeading } from '../lib/schema'
import { clampWidth, columnTemplate, columnsFor, linkTitle, tableMinWidth, type ColumnPrefs } from './table/columns'
import { useRowDrag } from './table/drag'
import { useFlatRows, useTreeRows, type Row } from './table/rows'
import { isRtlDocument, useLanguage } from '../lib/language'
import { arrowDirection, closedMark } from '../lib/keys'

export { columnOrder, defaultOrder, moveColumn, optionalColumns, orderColumns, shownColumnKeys, columnsFor, withWidth, linkSummary, type Column, type ColumnPrefs } from './table/columns'
export type { Row } from './table/rows'

const ROW_HEIGHT = 34
/** First guess for a row with title and text (D-19a); each row is then measured. */
const FULL_ROW_GUESS = 72
/** The main column formats at most this much of a text; the editor shows all of it (SEC-19-02). */
const MAIN_TEXT_CHARS = 3000
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
/** Drag data of a column header (not a row). */
const COLUMN_MIME = 'application/x-reqochet-column'

export function ItemTable(props: {
  schema: Schema
  prefs: ColumnPrefs
  /** All documents (two or more): one collapsible group row per document (the owner, 8 Nov 2026). */
  documentGroups?: { name: string; count: number }[]
  /** A column header dragged onto another (the order is kept in the column preferences). */
  onMoveColumn?: (from: string, to: string) => void
  mode: 'tree' | 'flat'
  query: Omit<ItemQuery, 'limit' | 'offset'>
  dataVersion: number
  selectedId: string | null
  onSelect: (id: string) => void
  onSort: (key: SortKey) => void
  onTotal?: (total: number) => void
  /** Drag and drop: make `ids` children of `parent` (null = top level), placed before `before` (null = last). */
  onMove: (ids: string[], parent: string | null, before: string | null) => void
  controlsRef?: { current: TreeControls | null }
  /** Bumped after a save or move: show the selected item again (its parent may have changed). */
  revealNonce?: number
  /** What an empty table shows: a sentence, or the first-run card (UX-W01). */
  emptyText: string | ReactNode
  /** The user dragged a column edge: new width in px, or null = automatic again. */
  onResize?: (key: string, width: number | null) => void
  /** Items chosen with Ctrl/Shift+click (M7: export of chosen items). */
  chosen?: ReadonlySet<string>
  /** Ctrl+click toggles one item; Shift+click chooses the rows from the last clicked one; a plain click clears. */
  onChoose?: (ids: string[], how: 'toggle' | 'range' | 'clear') => void
  /** Right-click on a row (the context menu). */
  onRowMenu?: (id: string, x: number, y: number) => void
}) {
  const { schema, prefs, mode, query, dataVersion, selectedId, onSelect, onSort, onTotal, onMove, controlsRef, revealNonce, emptyText, onResize, chosen, onChoose, onRowMenu } = props
  const anchor = useRef<number | null>(null)
  const lang = useLanguage()
  // items with an empty required field get a small mark in their row (the owner, 8 Nov 2026 — S-05)
  const hasRequired = schema.itemTypes.some((t) => (t.required?.length ?? 0) > 0)
  const incompleteIds = useIdSet(hasRequired, 'incomplete', dataVersion)
  // items that break a coverage rule get a mark too (theme 1b, T-08)
  const hasRules = (schema.rules?.length ?? 0) > 0
  const gapIds = useIdSet(hasRules, 'gaps', dataVersion)
  const isIncomplete = (id: string): boolean => hasRequired && incompleteIds.has(id)
  const incompleteMark = (id: string): ReactNode =>
    isIncomplete(id) ? (
      <span className="table__incomplete" role="img" aria-label={T.table.incomplete} title={T.table.incompleteTip}>
        !
      </span>
    ) : null
  const gapMark = (id: string): ReactNode =>
    hasRules && gapIds.has(id) ? (
      <span className="table__gap" role="img" aria-label={T.trace.gapMark} title={T.trace.gapMark} />
    ) : null
  // a column header being dragged to a new place (rows have their own drag and drop)
  const [colDrag, setColDrag] = useState<string | null>(null)
  const [colOver, setColOver] = useState<string | null>(null)
  // while the main column shows the text (D-19a), a Text column would only repeat it
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the column labels follow the language
  const saved = useMemo(() => columnsFor(schema, prefs).filter((c) => !(prefs.oneLine !== true && c.key === 'text')), [schema, prefs, lang])
  // while a column edge is dragged, its width lives here and is saved when the mouse is released
  const [live, setLive] = useState<{ key: string; width: number } | null>(null)
  const columns = live ? saved.map((c) => (c.key === live.key ? { ...c, width: live.width } : c)) : saved
  const template = columnTemplate(columns)
  // When the pane is narrower than all columns together, header and rows scroll sideways together.
  const minWidth = tableMinWidth(columns)
  const startResize = (e: ReactPointerEvent<HTMLSpanElement>, key: string): void => {
    e.preventDefault()
    e.stopPropagation()
    const handle = e.currentTarget
    const start = (handle.parentElement as HTMLElement).getBoundingClientRect().width
    const startX = e.clientX
    let width = start
    handle.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent): void => {
      width = clampWidth(start + (ev.clientX - startX) * (isRtlDocument() ? -1 : 1))
      setLive({ key, width })
    }
    const up = (): void => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
      setLive(null)
      if (width !== start) onResize?.(key, width)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
  }
  const resizeByKey = (e: KeyboardEvent<HTMLSpanElement>, key: string): void => {
    const dir = arrowDirection(e.key) // wider/narrower follows the reading direction (W-51)
    if (!dir) return
    e.preventDefault()
    e.stopPropagation()
    const now = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect().width
    onResize?.(key, clampWidth(now + (dir === 'forward' ? 16 : -16)))
  }
  const isTree = mode === 'tree'
  const sort = query.sort ?? { by: 'order' as const }

  // D-19a (the owner, 8 Nov 2026): the main column shows each item's title and full text, rows grow; the toolbar switch
  // "One line" turns it back into one line per item
  const full = props.prefs.oneLine !== true
  const flat = useFlatRows(!isTree, query, dataVersion, onTotal, full)
  const tree = useTreeRows(isTree, sort, dataVersion, query.document, props.documentGroups, full)
  const count = isTree ? tree.rows.length : flat.count
  const rowAt = (i: number): Row | undefined => (isTree ? tree.rows[i] : flat.rowAt(i))
  const indexOf = (id: string): number => (isTree ? tree.rows.findIndex((r) => r.kind === 'item' && r.item.id === id) : flat.indexOf(id))
  const scrollRef = useRef<HTMLDivElement>(null)
  const drag = useRowDrag({ tree: isTree, levels: tree.levels, isOpen: tree.isOpen, open: (id) => tree.setOpen(id, true), onMove, ...(chosen ? { chosen } : {}), scroller: scrollRef, headerHeight: HEADER_HEIGHT })

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
    estimateSize: () => (full ? FULL_ROW_GUESS : ROW_HEIGHT),
    // heights measured with the text shown must not carry over to one line per item (owner, 0.19.0 test 2: empty
    // space between rows after Show text off and opening levels): each mode has its own keys, so its own sizes
    getItemKey: (i) => (full ? `t${i}` : i),
    // the sticky header sits above the first row inside the same scroll area
    scrollMargin: HEADER_HEIGHT,
    overscan: 12
  })
  const visible = virtualizer.getVirtualItems()
  // a switch of Show text forgets every measured height (both modes start from their first guess again)
  const lastFull = useRef(full)
  useEffect(() => {
    if (lastFull.current === full) return
    lastFull.current = full
    virtualizer.measure()
  }, [full, virtualizer])
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
    const dir = arrowDirection(e.key) // open/close follows the reading direction (W-51: in Arabic → closes)
    if (isTree && row?.kind === 'item' && dir) {
      e.preventDefault()
      const open = tree.isOpen(row.item.id)
      if (dir === 'forward' && row.item.childCount > 0 && !open) tree.setOpen(row.item.id, true)
      else if (dir === 'back' && open && row.item.childCount > 0) tree.setOpen(row.item.id, false)
      else if (dir === 'back' && row.path.length > 0) onSelect(row.path.at(-1) as string)
      return
    }
    // the row menu from the keyboard (Menu key, Shift+F10, Delete) and Enter into the editor (UX-W03)
    if (row?.kind === 'item' && (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey) || e.key === 'Delete')) {
      e.preventDefault()
      const el = e.currentTarget.querySelector<HTMLElement>(`[data-id="${CSS.escape(row.item.id)}"]`)
      const r = el?.getBoundingClientRect()
      onRowMenu?.(row.item.id, r ? r.left + 24 : 80, r ? r.bottom : 120)
      return
    }
    if (row?.kind === 'item' && e.key === 'Enter') {
      e.preventDefault()
      document.querySelector<HTMLElement>('.editor input, .editor textarea, .editor select')?.focus()
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
      className={full ? 'table table--full table__scroll scroll' : 'table table__scroll scroll'}
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
          {columns.map((c, ci) => {
            const movable = props.onMoveColumn !== undefined && c.key !== 'number' && c.key !== 'title'
            const dropSide = colDrag && colOver === c.key && colDrag !== c.key && movable ? (columns.findIndex((x) => x.key === colDrag) < ci ? ' is-drop-after' : ' is-drop-before') : ''
            return (
            <div
              key={c.key}
              role="columnheader"
              aria-sort={sortBy === c.key ? (desc ? 'descending' : 'ascending') : 'none'}
              className={`table__thcell${c.key === 'id' ? ' table__th--id' : ''}${colDrag === c.key ? ' is-dragging' : ''}${dropSide}`}
              data-column={c.key}
              draggable={movable}
              onDragStart={(e) => {
                if (!movable) return
                e.stopPropagation()
                setColDrag(c.key)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData(COLUMN_MIME, c.key)
              }}
              onDragOver={(e) => {
                if (!colDrag) return
                e.preventDefault()
                e.stopPropagation()
                if (colOver !== c.key) setColOver(c.key)
              }}
              onDrop={(e) => {
                if (!colDrag) return
                e.preventDefault()
                e.stopPropagation()
                if (movable) props.onMoveColumn?.(colDrag, c.key)
                setColDrag(null)
                setColOver(null)
              }}
              onDragEnd={() => {
                setColDrag(null)
                setColOver(null)
              }}
            >
              <button
                type="button"
                className={sortBy === c.key ? 'table__th table__th--sorted' : 'table__th'}
                onClick={() => onSort(c.key)}
                title={`${c.key === 'links' ? `${T.table.linksLegend}\n` : ''}${isTree ? T.table.sortTreeTooltip(c.label) : T.table.sortTooltip(c.label)}`}
              >
                {c.label}
                {sortBy === c.key && <span aria-hidden="true">{desc ? ' ▾' : ' ▴'}</span>}
              </button>
              {onResize && (
                <span
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={T.table.resize(c.label)}
                  title={T.table.resize(c.label)}
                  tabIndex={0}
                  className={live?.key === c.key ? 'table__resize table__resize--active' : 'table__resize'}
                  onPointerDown={(e) => startResize(e, c.key)}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    onResize(c.key, null)
                  }}
                  onKeyDown={(e) => resizeByKey(e, c.key)}
                />
              )}
            </div>
            )
          })}
        </div>
        {count === 0 ? (
          typeof emptyText === 'string' ? <p className="table__empty">{emptyText}</p> : emptyText
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {visible.map((v) => {
              const row = rowAt(v.index)
              const style = full ? { gridTemplateColumns: template, minHeight: ROW_HEIGHT, transform: `translateY(${v.start - HEADER_HEIGHT}px)` } : { gridTemplateColumns: template, height: ROW_HEIGHT, transform: `translateY(${v.start - HEADER_HEIGHT}px)` }
              if (row?.kind === 'more' || row?.kind === 'loading') {
                return (
                  <div key={v.key} role="row" data-index={v.index} ref={full ? virtualizer.measureElement : undefined} className={`table__row table__row--more${row.kind === 'loading' ? ' table__row--loading' : ''}`} style={style}>
                    <span className="table__td table__td--id" />
                    <span className="table__td" style={{ paddingInlineStart: `${8 + row.depth * INDENT + INDENT}px` }}>
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
              if (row?.kind === 'group') {
                return (
                  <div key={v.key} role="row" aria-level={1} data-index={v.index} ref={full ? virtualizer.measureElement : undefined} className="table__row table__row--group" style={style}>
                    <span role="gridcell" className="table__td table__td--group">
                      <button type="button" className="table__group-toggle" aria-expanded={row.open} onClick={() => tree.setGroupOpen(row.name, !row.open)} title={row.open ? T.table.groupClose(row.name || T.documents.loose) : T.table.groupOpen(row.name || T.documents.loose)}>
                        <span aria-hidden="true">{row.open ? '▾' : closedMark()}</span> <strong>{row.name || T.documents.loose}</strong> <span className="muted-inline">{T.table.groupCount(row.count)}</span>
                      </button>
                    </span>
                  </div>
                )
              }
              const item = row?.item
              const selected = item?.id === selectedId
              const isChosen = item ? chosen?.has(item.id) === true : false
              const dropClass = drag.drop?.index === v.index ? ` table__row--drop-${drag.drop.zone}` : ''
              const open = item ? tree.isOpen(item.id) : false
              return (
                <div
                  key={v.key}
                  role="row"
                  aria-rowindex={v.index + 1}
                  aria-selected={selected || isChosen}
                  aria-level={isTree && row ? row.depth + 1 : undefined}
                  aria-expanded={isTree && item && item.childCount > 0 ? open : undefined}
                  data-id={item?.id}
                  data-index={v.index}
                  ref={full ? virtualizer.measureElement : undefined}
                  className={`table__row${selected ? ' table__row--selected' : ''}${isChosen ? ' table__row--chosen' : ''}${dropClass}`}
                  style={style}
                  draggable={Boolean(item)}
                  onDragStart={(e) => item && drag.start(e, item.id)}
                  onDragEnd={drag.end}
                  onDragOver={(e) => row?.kind === 'item' && drag.over(e, v.index, row)}
                  onDragLeave={() => drag.leave(v.index)}
                  onDrop={(e) => row?.kind === 'item' && drag.dropOn(e, row)}
                  onClick={(e) => {
                    if (!item) return
                    if ((e.ctrlKey || e.metaKey) && onChoose) {
                      anchor.current = v.index
                      onChoose([item.id], 'toggle')
                      return
                    }
                    if (e.shiftKey && onChoose && anchor.current !== null) {
                      const [a, b] = anchor.current < v.index ? [anchor.current, v.index] : [v.index, anchor.current]
                      const ids: string[] = []
                      for (let i = a; i <= b; i++) {
                        const r = rowAt(i)
                        if (r?.kind === 'item') ids.push(r.item.id)
                      }
                      onChoose(ids, 'range')
                      return
                    }
                    anchor.current = v.index
                    if (chosen && chosen.size > 0) onChoose?.([], 'clear')
                    onSelect(item.id)
                  }}
                  onContextMenu={(e) => {
                    if (!item || !onRowMenu) return
                    e.preventDefault()
                    onRowMenu(item.id, e.clientX, e.clientY)
                  }}
                >
                  {row && item
                    ? columns.map((c) =>
                        c.key === 'title' && isTree ? (
                          <span key={c.key} role="gridcell" className="table__td table__td--tree" style={{ paddingInlineStart: `${4 + row.depth * INDENT}px` }} title={c.value(item)}>
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
                                {open ? '▾' : closedMark()}
                              </button>
                            ) : (
                              <span className="tree__toggle tree__toggle--leaf" aria-hidden="true" />
                            )}
                            {full ? (
                              <MainCell heading={isHeading(schema, item.type)} title={c.value(item)} text={item.text} marks={[incompleteMark(item.id), gapMark(item.id)]} />
                            ) : (
                              <span className={isHeading(schema, item.type) ? 'table__text table__text--heading' : 'table__text'} dir="auto">
                                {c.value(item)}
                              </span>
                            )}
                            {!full && incompleteMark(item.id)}
                            {!full && gapMark(item.id)}
                            {item.childCount > 0 && !open && <span className="table__count">{item.childCount.toLocaleString('en')}</span>}
                          </span>
                        ) : (
                          <span
                            key={c.key}
                            role="gridcell"
                            className={`table__td${c.key === 'id' ? ' table__td--id' : ''}${c.key === 'number' ? ' table__td--number' : ''}${c.key === 'links' ? ' table__td--links' : ''}${c.warn?.(item) ? ' table__td--warn' : ''}`}
                            title={c.key === 'links' ? linkTitle(item) : (c.tip?.(item) ?? c.value(item))}
                            aria-label={c.key === 'links' && c.value(item) ? linkTitle(item) : undefined}
                            // user content takes its own direction, so it is cut at the right end in either window (UX-02)
                            dir={c.key === 'number' || c.key === 'id' || c.key === 'links' ? undefined : 'auto'}
                          >
                            {c.key === 'title' && full ? <MainCell heading={isHeading(schema, item.type)} title={c.value(item)} text={item.text} marks={[incompleteMark(item.id), gapMark(item.id)]} /> : c.value(item)}
                            {c.key === 'title' && !full && incompleteMark(item.id)}
                            {c.key === 'title' && !full && gapMark(item.id)}
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

/**
 * The main column (D-19a), like the DOORS module view: a heading shows its title; any other item its title in bold and
 * its whole text below (formatted as in the editor's preview).
 */
/** `marks`: the incomplete and coverage-gap marks, right after the title (UI-15 of 0.20.0). */
function MainCell({ heading, title, text, marks }: { heading: boolean; title: string; text: string; marks?: ReactNode[] }) {
  const html = useMemo(() => (heading || !text.trim() ? '' : renderItemText(text, MAIN_TEXT_CHARS)), [heading, text])
  return (
    // a link in the text does not open from the table: a click there selects the row (CR19-11)
    <span className="table__main" dir="auto" onClickCapture={(e) => (e.target as HTMLElement).closest('a') && e.preventDefault()}>
      <span className="table__main-head">
        <span className={heading ? 'table__text table__text--heading' : 'table__text table__main-title'}>{title}</span>
        {marks}
      </span>
      {html && <span className="table__main-text markdown" dangerouslySetInnerHTML={{ __html: html }} />}
    </span>
  )
}

/** The IDs of every item that matches one marker filter (incomplete, coverage gap), all pages (UX18-14). */
function useIdSet(enabled: boolean, kind: 'incomplete' | 'gaps', dataVersion: number): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    if (!enabled) return
    let live = true
    void (async () => {
      const found = new Set<string>()
      for (let offset = 0; ; offset += 10_000) {
        const r = await window.reqochet.queryItems({ [kind]: true, limit: 10_000, offset, brief: true })
        for (const i of r.items) found.add(i.id)
        if (r.items.length === 0 || found.size >= r.total) break
      }
      if (live) setIds(found)
    })()
    return () => {
      live = false
    }
  }, [enabled, kind, dataVersion])
  return ids
}
