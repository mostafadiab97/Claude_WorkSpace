import type { Schema } from '../schema'
import type { Item, ItemIssue } from './index'
import { isValidId } from './ids'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Checks one item against the schema. Problems that need the whole repository (a link to an item that
 * does not exist, two files with the same ID) are checked by the repository store.
 */
export function validateItem(item: Item, schema: Schema): ItemIssue[] {
  const issues: ItemIssue[] = []
  const add = (path: string, message: string, severity: ItemIssue['severity'] = 'error'): void =>
    void issues.push({ itemId: item.id, path, message, severity })

  if (!isValidId(item.id)) add('id', `"${item.id}" is not in the ReqMan ID format (e.g. REQ-K7Q3XMB).`, 'warning')

  // the type is free to change: IDs no longer depend on it (0.9.0)
  if (!schema.itemTypes.some((t) => t.id === item.type)) add('type', `Unknown item type "${item.type}".`)
  if (!item.title.trim()) add('title', 'The title is empty.', 'warning')

  for (const f of schema.fields) {
    const v = item.fields[f.id]
    if (v === undefined) continue
    const path = `fields.${f.id}`
    switch (f.type) {
      case 'enum':
        if (typeof v !== 'string' || !f.options?.includes(v)) {
          add(path, `"${String(v)}" is not an allowed ${f.name} (allowed: ${f.options?.join(', ')}).`)
        }
        break
      case 'number':
        if (typeof v !== 'number') add(path, `${f.name} must be a number.`)
        break
      case 'date':
        if (typeof v !== 'string' || !DATE_RE.test(v)) add(path, `${f.name} must be a date written as YYYY-MM-DD.`)
        break
      case 'list':
        if (!Array.isArray(v)) add(path, `${f.name} must be a list.`)
        break
      case 'text':
        if (typeof v !== 'string' && typeof v !== 'number') add(path, `${f.name} must be text.`)
        break
    }
  }

  if (item.parent === item.id) add('parent', 'An item cannot be its own parent.')

  const seen = new Set<string>()
  item.links.forEach((l, i) => {
    if (!schema.linkTypes.some((t) => t.id === l.type)) add(`links[${i}].type`, `Unknown link type "${l.type}".`)
    if (l.target === item.id) add(`links[${i}].target`, 'An item cannot link to itself.')
    const key = `${l.type}>${l.target}`
    if (seen.has(key)) add(`links[${i}]`, `Duplicate link "${l.type}" to ${l.target}.`, 'warning')
    seen.add(key)
  })
  return issues
}
