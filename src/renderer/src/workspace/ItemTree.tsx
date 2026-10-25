import { useEffect, useState } from 'react'
import type { IndexedItem, Schema } from '../../../shared/domain'
import { typeName } from '../lib/schema'

const CHILD_LIMIT = 500

/** The hierarchy: top-level items, each expandable to its children. Children load when expanded. */
export function ItemTree(props: { schema: Schema; dataVersion: number; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <nav className="tree scroll" aria-label="Hierarchy">
      <ul className="tree__list" role="tree">
        <TreeLevel {...props} parent={null} depth={0} />
      </ul>
    </nav>
  )
}

function TreeLevel(props: { schema: Schema; dataVersion: number; selectedId: string | null; onSelect: (id: string) => void; parent: string | null; depth: number }) {
  const { parent, dataVersion } = props
  const [items, setItems] = useState<IndexedItem[] | null>(null)
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(CHILD_LIMIT)

  useEffect(() => {
    let live = true
    void window.reqman.queryItems({ parent, sort: { by: 'order' }, limit }).then((r) => {
      if (!live) return
      setItems(r.items)
      setTotal(r.total)
    })
    return () => {
      live = false
    }
  }, [parent, dataVersion, limit])

  if (items === null) return <li className="tree__loading">…</li>
  if (items.length === 0 && props.depth === 0) return <li className="tree__empty">The hierarchy appears here.</li>
  return (
    <>
      {items.map((it) => (
        <TreeNode key={it.id} {...props} item={it} />
      ))}
      {total > items.length && (
        <li>
          <button type="button" className="tree__more" style={{ paddingLeft: `${8 + props.depth * 16}px` }} onClick={() => setLimit((l) => l + CHILD_LIMIT)}>
            Show more ({(total - items.length).toLocaleString('en')} hidden)
          </button>
        </li>
      )}
    </>
  )
}

function TreeNode(props: { schema: Schema; dataVersion: number; selectedId: string | null; onSelect: (id: string) => void; item: IndexedItem; depth: number }) {
  const { item, depth, selectedId, onSelect, schema } = props
  const [open, setOpen] = useState(false)
  const selected = item.id === selectedId
  return (
    <li role="treeitem" aria-expanded={item.childCount > 0 ? open : undefined} aria-selected={selected}>
      <div className={selected ? 'tree__row tree__row--selected' : 'tree__row'} style={{ paddingLeft: `${4 + depth * 16}px` }}>
        {item.childCount > 0 ? (
          <button type="button" className="tree__toggle" aria-label={open ? 'Collapse' : 'Expand'} onClick={() => setOpen((o) => !o)}>
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="tree__toggle tree__toggle--leaf" aria-hidden="true" />
        )}
        <button type="button" className="tree__label" onClick={() => onSelect(item.id)} title={`${item.id} · ${typeName(schema, item.type)}`}>
          <span className="tree__id">{item.id}</span>
          <span className="tree__title">{item.title || '(no title)'}</span>
        </button>
      </div>
      {open && item.childCount > 0 && (
        <ul role="group" className="tree__list">
          <TreeLevel {...props} parent={item.id} depth={depth + 1} />
        </ul>
      )}
    </li>
  )
}
