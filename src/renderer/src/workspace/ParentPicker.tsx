import { useEffect, useState } from 'react'
import type { Schema } from '../../../shared/domain'
import { ItemSearch } from './ItemSearch'
import { T } from '../../../shared/text'

/**
 * Choose an item's parent. With nothing typed it lists the top-level items (chapters, headings) in document
 * order; typing searches IDs and titles, best matches first. The item itself and the items below it are
 * shown greyed out, because choosing them would create a loop.
 */
export function ParentPicker({ schema, value, selfId, onChange, onShow }: { schema: Schema; value: string | undefined; selfId: string; onChange: (id: string | undefined) => void; onShow?: (id: string) => void }) {
  const [resolved, setResolved] = useState<{ value: string; label: string } | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!value) return
    let live = true
    void window.reqman.queryItems({ text: value, sort: { by: 'relevance' }, limit: 1, brief: true }).then((r) => {
      const hit = r.items.find((i) => i.id === value)
      if (live) setResolved({ value, label: hit ? `${hit.number ? `${hit.number} ` : ''}${hit.id} — ${hit.title}` : T.parentPicker.notFound(value) })
    })
    return () => {
      live = false
    }
  }, [value])
  const label = !value ? '' : resolved?.value === value ? resolved.label : value

  if (!open) {
    return (
      // UX-27: looks like a button with "Change…", so nobody tries to type into it; "Show" selects the parent
      <div className="picker picker--closed">
        <button type="button" className="input input--button picker__current" onClick={() => setOpen(true)} title={T.parentPicker.change}>
          <span className="picker__label" dir="auto">{label || <span className="muted-inline">{T.parentPicker.none}</span>}</span>
          <span className="picker__change">{T.parentPicker.change}</span>
        </button>
        {value && onShow && (
          <button type="button" className="link-btn" onClick={() => onShow(value)}>
            {T.parentPicker.show}
          </button>
        )}
      </div>
    )
  }
  return (
    <ItemSearch
      schema={schema}
      label={T.parentPicker.label}
      placeholder={T.parentPicker.placeholder}
      emptyQuery={{ parent: null, sort: { by: 'order' } }}
      emptyHint={T.parentPicker.hint}
      blocked={async (item) =>
        item.id === selfId || (item.parent !== undefined && (await window.reqman.getAncestors(item.id)).includes(selfId))
          ? T.parentPicker.blocked
          : null
      }
      onPick={(item) => {
        onChange(item.id)
        setOpen(false)
      }}
      onCancel={() => setOpen(false)}
      before={
        <li>
          <button
            type="button"
            className="picker__option"
            onMouseDown={(e) => {
              e.preventDefault()
              onChange(undefined)
              setOpen(false)
            }}
          >
            <span className="muted-inline">{T.parentPicker.makeTop}</span>
          </button>
        </li>
      }
    />
  )
}
