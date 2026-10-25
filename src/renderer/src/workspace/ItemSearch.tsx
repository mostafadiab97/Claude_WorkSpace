import { useEffect, useState, type ReactNode } from 'react'
import type { IndexedItem, ItemQuery, Schema } from '../../../shared/domain'
import { useDebounced } from '../lib/hooks'
import { typeName } from '../lib/schema'

const LIMIT = 30

/**
 * A search box with a result list for choosing an item (parent picker, link target).
 * Typing searches IDs, titles and texts, best matches first. `emptyQuery` = what to list before anything is typed.
 * `blocked` returns a reason when an item may not be chosen; such items are shown greyed out.
 */
export function ItemSearch(props: {
  schema: Schema
  placeholder: string
  label: string
  emptyQuery?: Omit<ItemQuery, 'limit' | 'brief'>
  emptyHint?: string
  blocked?: (item: IndexedItem) => Promise<string | null> | string | null
  onPick: (item: IndexedItem) => void
  onCancel: () => void
  /** Extra entries above the results (e.g. "None — top level"). */
  before?: ReactNode
}) {
  const { schema, emptyQuery, blocked } = props
  const [text, setText] = useState('')
  const search = useDebounced(text, 150)
  const [results, setResults] = useState<{ item: IndexedItem; reason: string | null }[]>([])
  const [total, setTotal] = useState(0)
  const emptyKey = JSON.stringify(emptyQuery ?? null)
  // nothing typed and nothing to list: show no (stale) results
  const shown = search.trim() || emptyQuery ? results : []

  useEffect(() => {
    let live = true
    const q: ItemQuery | null = search.trim()
      ? { text: search, sort: { by: 'relevance' }, limit: LIMIT, brief: true }
      : emptyQuery
        ? { ...emptyQuery, limit: LIMIT, brief: true }
        : null
    if (!q) return
    void window.reqman.queryItems(q).then(async (r) => {
      const marked = await Promise.all(r.items.map(async (item) => ({ item, reason: blocked ? await blocked(item) : null })))
      if (!live) return
      setResults(marked)
      setTotal(r.total)
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- emptyKey stands for emptyQuery; blocked is fixed per opening
  }, [search, emptyKey])

  return (
    <div className="picker">
      <input
        className="input"
        autoFocus
        value={text}
        placeholder={props.placeholder}
        aria-label={props.label}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') props.onCancel()
          if (e.key === 'Enter') {
            const first = results.find((r) => !r.reason)
            if (first) props.onPick(first.item)
          }
        }}
        onBlur={() => setTimeout(props.onCancel, 150)}
      />
      <ul className="picker__menu scroll" role="listbox" aria-label="Matching items">
        {props.before}
        {!search.trim() && results.length > 0 && props.emptyHint && <li className="picker__hint">{props.emptyHint}</li>}
        {!search.trim() && !emptyQuery && <li className="picker__hint">Type an ID or words of the title</li>}
        {shown.map(({ item, reason }) => (
          <li key={item.id}>
            <button
              type="button"
              className="picker__option"
              disabled={reason !== null}
              title={reason ?? `${item.id} · ${typeName(schema, item.type)}`}
              onMouseDown={(e) => {
                e.preventDefault()
                if (!reason) props.onPick(item)
              }}
            >
              <span className="tree__id">{item.id}</span> <span className="picker__title">{item.title || '(no title)'}</span>
              <span className="picker__type">{typeName(schema, item.type)}</span>
            </button>
          </li>
        ))}
        {shown.length > 0 && total > shown.length && <li className="picker__hint">{(total - shown.length).toLocaleString('en')} more — type more to narrow down</li>}
        {search.trim() && shown.length === 0 && <li className="picker__hint">Nothing found</li>}
      </ul>
    </div>
  )
}
