import { useEffect, useRef } from 'react'
import { T } from '../../../shared/text'

/**
 * Right-click menu of a table row (M7): export this item with everything below it, or the chosen items.
 * Closes on Escape, on a click elsewhere and when the window scrolls.
 */
export function RowMenu(props: { id: string; x: number; y: number; chosenCount: number; onExportItem: () => void; onExportChosen: () => void; onOpen: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector('button')?.focus()
    const close = (e: Event): void => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return
      if (e instanceof MouseEvent && ref.current?.contains(e.target as Node)) return
      props.onClose()
    }
    window.addEventListener('keydown', close)
    window.addEventListener('mousedown', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('keydown', close)
      window.removeEventListener('mousedown', close)
      window.removeEventListener('blur', close)
    }
  }, [props])
  // keep the menu inside the window
  const left = Math.min(props.x, window.innerWidth - 280)
  const top = Math.min(props.y, window.innerHeight - 140)
  const act = (fn: () => void) => () => {
    props.onClose()
    fn()
  }
  return (
    <div ref={ref} className="row-menu" role="menu" aria-label={T.rowMenu.label(props.id)} style={{ left, top }}>
      <button type="button" role="menuitem" className="row-menu__item" onClick={act(props.onOpen)}>
        {T.rowMenu.open}
      </button>
      <button type="button" role="menuitem" className="row-menu__item" onClick={act(props.onExportItem)}>
        {T.rowMenu.exportItem}
      </button>
      {props.chosenCount > 1 && (
        <button type="button" role="menuitem" className="row-menu__item" onClick={act(props.onExportChosen)}>
          {T.rowMenu.exportChosen(props.chosenCount)}
        </button>
      )}
    </div>
  )
}
