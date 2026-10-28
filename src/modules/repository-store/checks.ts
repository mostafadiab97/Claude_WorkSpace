import { validateItem, type Item, type ItemIssue } from '../items'
import type { Schema } from '../schema'

/**
 * Checks that need the whole set of items. `fileNameIds` maps item ID → its file name's ID, so a file
 * renamed by hand is noticed.
 */
export function checkRepository(items: Item[], schema: Schema, fileNameIds?: Map<Item, string>): ItemIssue[] {
  const issues: ItemIssue[] = []
  const byId = new Map<string, Item>()
  for (const item of items) {
    issues.push(...validateItem(item, schema))
    if (byId.has(item.id)) {
      issues.push({ itemId: item.id, path: 'id', message: `Two files have the ID ${item.id}.`, severity: 'error' })
    } else byId.set(item.id, item)
    const fileId = fileNameIds?.get(item)
    if (fileId !== undefined && fileId !== item.id) {
      issues.push({ itemId: item.id, path: 'id', message: `The file is named ${fileId} but contains ID ${item.id}.`, severity: 'warning', fix: 'file-name' })
    }
  }

  for (const item of items) {
    item.links.forEach((l, i) => {
      if (l.target !== item.id && !byId.has(l.target)) {
        issues.push({ itemId: item.id, path: `links[${i}].target`, message: `Links to ${l.target}, which does not exist.`, severity: 'error' })
      }
    })
    if (item.parent && item.parent !== item.id && !byId.has(item.parent)) {
      issues.push({ itemId: item.id, path: 'parent', message: `Parent ${item.parent} does not exist.`, severity: 'error' })
    }
  }

  // Parent cycles (A → B → A) would make the hierarchy endless.
  const reported = new Set<string>()
  for (const start of items) {
    const path = new Set<string>([start.id])
    let cur = start.parent ? byId.get(start.parent) : undefined
    while (cur) {
      if (path.has(cur.id)) {
        if (!reported.has(start.id) && cur.id === start.id) {
          issues.push({ itemId: start.id, path: 'parent', message: 'The parent chain loops back to this item.', severity: 'error' })
          reported.add(start.id)
        }
        break
      }
      path.add(cur.id)
      cur = cur.parent ? byId.get(cur.parent) : undefined
    }
  }
  return issues
}
