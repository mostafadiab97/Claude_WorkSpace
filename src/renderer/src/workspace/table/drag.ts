// Drag and drop of table rows: dropping onto a row (child), its upper/lower edge (before/after), or the empty
// space below the rows (top level). The rules are pure functions so they are unit-tested (review T-02).
import { useRef, useState, type DragEvent } from 'react'
import { ROOT, type Level, type Row } from './rows'

export type Zone = 'before' | 'into' | 'after'
type ItemRow = Row & { kind: 'item' }

/**
 * Which part of a row the pointer is over: `y` = position inside the row from 0 (top) to 1 (bottom). Returns
 * null when the dragged item cannot go there (onto itself or one of its own descendants). In a search result
 * only "into" makes sense (there are no neighbours to place it between).
 */
export function dropZone(dragged: string, row: ItemRow, y: number, tree: boolean): Zone | null {
  if (row.item.id === dragged || row.path.includes(dragged)) return null
  if (!tree) return 'into'
  return y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'into'
}

/** The move a drop means: new parent (null = top level) and the sibling to place it before (null = last). */
export function dropMove(
  dragged: string,
  row: ItemRow,
  zone: Zone,
  tree: boolean,
  levels: ReadonlyMap<string, Level>,
  isOpen: (id: string) => boolean
): { parent: string | null; before: string | null } {
  const parentOf = (r: ItemRow): string | null => (tree ? (r.path.at(-1) ?? null) : (r.item.parent ?? null))
  if (zone === 'into') return { parent: row.item.id, before: null }
  if (zone === 'before') return { parent: parentOf(row), before: row.item.id }
  // after: below an open parent means "first child"; otherwise "before the next sibling"
  const children = levels.get(row.item.id)?.items
  if (isOpen(row.item.id) && children?.length) return { parent: row.item.id, before: children[0]?.id ?? null }
  const parent = parentOf(row)
  const sibs = levels.get(parent ?? ROOT)?.items ?? []
  const k = sibs.findIndex((s) => s.id === row.item.id)
  const next = sibs.slice(k + 1).find((s) => s.id !== dragged)
  return { parent, before: next?.id ?? null }
}

/** Event handlers and the drop marker for the table. */
export function useRowDrag(opts: {
  tree: boolean
  levels: ReadonlyMap<string, Level>
  isOpen: (id: string) => boolean
  open: (id: string) => void
  onMove: (id: string, parent: string | null, before: string | null) => void
}) {
  const dragging = useRef<string | null>(null)
  const [drop, setDrop] = useState<{ index: number; zone: Zone } | null>(null)
  const expandTimer = useRef<{ id: string; timer: number } | null>(null)
  const clear = (): void => {
    dragging.current = null
    setDrop(null)
    if (expandTimer.current) window.clearTimeout(expandTimer.current.timer)
    expandTimer.current = null
  }
  const zoneOf = (e: DragEvent<HTMLElement>, row: ItemRow): Zone | null => {
    const id = dragging.current
    if (!id) return null
    const rect = e.currentTarget.getBoundingClientRect()
    return dropZone(id, row, (e.clientY - rect.top) / rect.height, opts.tree)
  }

  return {
    drop,
    start(e: DragEvent<HTMLElement>, id: string): void {
      dragging.current = id
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', id)
    },
    end: clear,
    over(e: DragEvent<HTMLElement>, index: number, row: ItemRow): void {
      const zone = zoneOf(e, row)
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
      if (opts.tree && zone === 'into' && row.item.childCount > 0 && !opts.isOpen(row.item.id) && expandTimer.current?.id !== row.item.id) {
        if (expandTimer.current) window.clearTimeout(expandTimer.current.timer)
        expandTimer.current = { id: row.item.id, timer: window.setTimeout(() => opts.open(row.item.id), 700) }
      }
    },
    leave(index: number): void {
      if (drop?.index === index) setDrop(null)
    },
    dropOn(e: DragEvent<HTMLElement>, row: ItemRow): void {
      e.preventDefault()
      e.stopPropagation()
      const id = dragging.current
      const zone = zoneOf(e, row)
      clear()
      if (!id || !zone) return
      const m = dropMove(id, row, zone, opts.tree, opts.levels, opts.isOpen)
      opts.onMove(id, m.parent, m.before)
    },
    // Dropping on the empty space below the rows makes the item a top-level item.
    areaOver(e: DragEvent<HTMLElement>): void {
      if (!dragging.current || !opts.tree) return
      e.preventDefault()
      setDrop(null)
    },
    areaDrop(e: DragEvent<HTMLElement>): void {
      const id = dragging.current
      clear()
      if (!id || !opts.tree) return
      e.preventDefault()
      opts.onMove(id, null, null)
    }
  }
}
