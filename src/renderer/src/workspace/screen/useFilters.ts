// Search, filters and sorting of the item table (review S-03: grouped out of WorkspaceScreen).
import { useState } from 'react'
import type { ItemQuery, Schema, SortKey } from '../../../../shared/domain'
import { useDebounced } from '../../lib/hooks'

export type LinkFilter = '' | 'suspect' | 'none'

/** Header clicks: ascending → descending → back to document order. Pure. */
export function nextSort(s: { by: SortKey; descending: boolean }, key: SortKey): { by: SortKey; descending: boolean } {
  if (s.by !== key) return { by: key, descending: false }
  if (!s.descending) return { by: key, descending: true }
  return { by: 'order', descending: false }
}

/** The index query for the table. A search without a chosen column sorts by best match. Pure. */
export function buildQuery(
  schema: Schema,
  f: { search: string; types: string; linkFilter: LinkFilter; fieldFilters: Record<string, string>; sort: { by: SortKey; descending: boolean } }
): { query: Omit<ItemQuery, 'limit' | 'offset'>; filtered: boolean } {
  const fields = Object.entries(f.fieldFilters).filter(([k, v]) => v && schema.fields.some((d) => d.id === k))
  const filtered = Boolean(f.search.trim() || f.types || f.linkFilter || fields.length > 0)
  return {
    filtered,
    query: {
      ...(f.search.trim() ? { text: f.search } : {}),
      ...(f.types ? { types: [f.types] } : {}),
      ...(f.linkFilter ? { links: f.linkFilter } : {}),
      fields: Object.fromEntries(fields.map(([k, v]) => [k, [v]])),
      sort: f.search.trim() && f.sort.by === 'order' ? { by: 'relevance' } : f.sort
    }
  }
}

export function useFilters(schema: Schema) {
  const [text, setText] = useState('')
  const search = useDebounced(text, 200)
  const [types, setTypes] = useState('')
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('')
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({})
  // 'order' = document order (the hierarchy as arranged); column headers sort by that column instead.
  const [sort, setSort] = useState<{ by: SortKey; descending: boolean }>({ by: 'order', descending: false })
  const { query, filtered } = buildQuery(schema, { search, types, linkFilter, fieldFilters, sort })
  return {
    text,
    setText,
    types,
    setTypes,
    linkFilter,
    setLinkFilter,
    fieldFilters,
    setField: (id: string, value: string) => setFieldFilters((ff) => ({ ...ff, [id]: value })),
    query,
    filtered,
    onSort: (key: SortKey) => setSort((s) => nextSort(s, key)),
    clear: () => {
      setText('')
      setTypes('')
      setLinkFilter('')
      setFieldFilters({})
    }
  }
}

export type Filters = ReturnType<typeof useFilters>
