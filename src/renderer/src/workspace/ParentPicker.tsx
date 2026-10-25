import { useEffect, useState } from 'react'
import type { IndexedItem } from '../../../shared/domain'
import { useDebounced } from '../lib/hooks'

/** Choose an item's parent by searching for it (ID or words of the title). */
export function ParentPicker({ value, selfId, onChange }: { value: string | undefined; selfId: string; onChange: (id: string | undefined) => void }) {
  const [resolved, setResolved] = useState<{ value: string; label: string } | null>(null)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<IndexedItem[]>([])
  const search = useDebounced(text, 150)

  useEffect(() => {
    if (!value) return
    let live = true
    void window.reqman.queryItems({ text: value, limit: 5 }).then((r) => {
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
    void window.reqman.queryItems({ ...(search.trim() ? { text: search } : {}), limit: 8 }).then((r) => setResults(r.items.filter((i) => i.id !== selfId)))
  }, [search, open, selfId])

  return (
    <div className="picker">
      {open ? (
        <input
          className="input"
          autoFocus
          value={text}
          placeholder="Search by ID or title…"
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
        <ul className="picker__menu" role="listbox">
          <li>
            <button type="button" className="picker__option" onMouseDown={() => { onChange(undefined); setOpen(false) }}>
              <span className="muted-inline">None (top level)</span>
            </button>
          </li>
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" className="picker__option" onMouseDown={() => { onChange(r.id); setOpen(false) }}>
                <span className="tree__id">{r.id}</span> {r.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
