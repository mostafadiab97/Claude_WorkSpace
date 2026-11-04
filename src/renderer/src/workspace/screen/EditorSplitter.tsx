import { useEffect, useState, type CSSProperties, type ReactElement } from 'react'
import { T } from '../../../../shared/text'
import { isRtlDocument } from '../../lib/language'

const KEY = 'reqman.editorWidth'
const MIN = 360
const load = (): number | null => {
  try {
    const n = Number(localStorage.getItem(KEY))
    return Number.isFinite(n) && n >= MIN ? n : null
  } catch {
    return null
  }
}

/**
 * The editor's width, changed by dragging the line between table and editor (UI review UX-03); remembered on this PC.
 * Returns the style for the workspace (a CSS variable the editor reads) and the drag handle.
 */
export function useEditorWidth(): { style: CSSProperties; handle: ReactElement } {
  const [width, setWidth] = useState<number | null>(load)
  useEffect(() => {
    if (width === null) return
    try {
      localStorage.setItem(KEY, String(width))
    } catch {
      // private window: not remembered
    }
  }, [width])
  const start = (e: React.PointerEvent): void => {
    e.preventDefault()
    const move = (ev: PointerEvent): void => {
      const w = isRtlDocument() ? ev.clientX : window.innerWidth - ev.clientX
      setWidth(Math.round(Math.max(MIN, Math.min(w, window.innerWidth * 0.7))))
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  // keyboard (code review CR-10 / UXN-09): ← → change the width by 24 px (towards the table = wider), Home = default
  const onKey = (e: React.KeyboardEvent): void => {
    const toTable = isRtlDocument() ? 'ArrowRight' : 'ArrowLeft'
    const toEdge = isRtlDocument() ? 'ArrowLeft' : 'ArrowRight'
    if (e.key === 'Home') setWidth(null)
    else if (e.key === toTable || e.key === toEdge) {
      const now = width ?? 440
      setWidth(Math.round(Math.max(MIN, Math.min(now + (e.key === toTable ? 24 : -24), window.innerWidth * 0.7))))
    } else return
    e.preventDefault()
  }
  const handle = (
    <div
      className="editor-splitter"
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={T.workspace.editorWidth}
      aria-valuenow={width ?? undefined}
      title={T.workspace.editorWidth}
      onPointerDown={start}
      onKeyDown={onKey}
      onDoubleClick={() => setWidth(null)}
    />
  )
  // never more than 60 % of the window, so a width saved on a big screen cannot squeeze the table away (CR-10)
  return { style: width ? ({ '--rm-editor-width': `min(${width}px, 60vw)` } as CSSProperties) : {}, handle }
}
