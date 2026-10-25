import { useEffect, useState } from 'react'
import type { IndexedItem, Schema } from '../../../shared/domain'
import { useDebounced } from '../lib/hooks'
import { typeName } from '../lib/schema'

const LIMIT = 30

/**
 * Choose an item's parent. With nothing typed it lists the top-level items (chapters, headings) in document
 * order; typing searches IDs and titles, best matches first. The item itself and the items below it are
 * shown greyed out, because choosing them would create a loop.
 */
export function ParentPicker({ schema, value, selfId, onChange }: { schema: Schema; value: string | undefined; selfId: string; onChange: (id: string | undefined) => void }) {
  const [resolved, setResolved] = useState<{ value: string; label: string } | null>(null)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<{ item: IndexedItem; blocked: boolean }[]>([])
  const [total, setTotal] = useState(0)
  const search = useDebounced(text, 150)

  useEffect(() => {
    if (!value) return
    let live = true
    void window.reqman.queryItems({ text: value, sort: { by: 'relevance' }, limit: 1, brief: true }).then((r) => {
      const hit = r.items.find((i) => i.id === value)
      if (live) setResolved({ value, label: hit ? `${hit.id} — ${hit.title}` : `${value} (not found)` })
    })
    return () => {
      live = false
    }
  }, [value])
  const label = !value ? '' : resolved?.value === value ? resolved.label : value

  useEffect(() => {
    if (!open) return
    let live = true
    const q = search.trim()
      ? { text: search, sort: { by: 'relevance' as const }, limit: LIMIT, brief: true }
      : { parent: null, sort: { by: 'order' as const }, limit: LIMIT, brief: true }
    void window.reqman.queryItems(q).then(async (r) => {
      // An item cannot go below itself or below one of its own children.
      const marked = await Promise.all(
        r.items.map(async (item) => ({ item, blocked: item.id === selfId || (item.parent !== undefined && (await window.reqman.getAncestors(item.id)).includes(selfId)) }))
      )
      if (!live) return
      setResults(marked)
      setTotal(r.total)
    })
    return () => {
      live = false
    }
  }, [search, open, selfId])

  return (
    <div className="picker">
      {open ? (
        <input
          className="input"
          autoFocus
          value={text}
          placeholder="Search by ID or title…"
          aria-label="Search for a parent"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      ) : (
        <button type="button" className="input input--button" onClick={() => { setText(''); setOpen(true) }}>
          {label || <span className="muted-inline">None (top level)</span>}
        </button>
      )}
      {open && (
        <ul className="picker__menu scroll" role="listbox">
          <li>
            <button type="button" className="picker__option" onMouseDown={() => { onChange(undefined); setOpen(false) }}>
              <span className="muted-inline">None — make it a top-level item</span>
            </button>
          </li>
          {!search.trim() && results.length > 0 && <li className="picker__hint">Top-level items — type to search all items</li>}
          {results.map(({ item, blocked }) => (
            <li key={item.id}>
              <button
                type="button"
                className="picker__option"
                disabled={blocked}
                title={blocked ? 'This is the item itself or one of its children' : `${item.id} · ${typeName(schema, item.type)}`}
                onMouseDown={() => {
                  if (blocked) return
                  onChange(item.id)
                  setOpen(false)
                }}
              >
                <span className="tree__id">{item.id}</span> <span className="picker__title">{item.title || '(no title)'}</span>
                <span className="picker__type">{typeName(schema, item.type)}</span>
              </button>
            </li>
          ))}
          {total > results.length && <li className="picker__hint">{(total - results.length).toLocaleString('en')} more — type more of the title to narrow down</li>}
          {search.trim() && results.length === 0 && <li className="picker__hint">Nothing found</li>}
        </ul>
      )}
    </div>
  )
}
