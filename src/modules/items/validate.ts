import { T } from '../../shared/text'
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

  if (!isValidId(item.id)) add('id', T.validate.idFormat(item.id), 'warning')

  // the type is free to change: IDs no longer depend on it (0.9.0)
  if (!schema.itemTypes.some((t) => t.id === item.type)) add('type', T.validate.unknownType(item.type))
  if (!item.title.trim()) add('title', T.validate.emptyTitle, 'warning')

  for (const f of schema.fields) {
    const v = item.fields[f.id]
    if (v === undefined) continue
    const path = `fields.${f.id}`
    switch (f.type) {
      case 'enum':
        if (typeof v !== 'string' || !f.options?.includes(v)) {
          add(path, T.validate.notAllowed(String(v), f.name, f.options?.join(', ') ?? ''))
        }
        break
      case 'number':
        if (typeof v !== 'number') add(path, T.validate.mustNumber(f.name))
        break
      case 'date':
        if (typeof v !== 'string' || !DATE_RE.test(v)) add(path, T.validate.mustDate(f.name))
        break
      case 'list':
        if (!Array.isArray(v)) add(path, T.validate.mustList(f.name))
        break
      case 'text':
        if (typeof v !== 'string' && typeof v !== 'number') add(path, T.validate.mustText(f.name))
        break
    }
  }

  if (item.parent === item.id) add('parent', T.validate.ownParent)

  const seen = new Set<string>()
  item.links.forEach((l, i) => {
    if (!schema.linkTypes.some((t) => t.id === l.type)) add(`links[${i}].type`, T.validate.unknownLink(l.type))
    if (l.target === item.id) add(`links[${i}].target`, T.validate.selfLink)
    const key = `${l.type}>${l.target}`
    if (seen.has(key)) add(`links[${i}]`, T.validate.duplicateLink(l.type, l.target), 'warning')
    seen.add(key)
  })
  return issues
}
