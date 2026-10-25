import { createHash } from 'node:crypto'
import type { Item } from './index'

/**
 * Short hash of the parts of an item whose change should make downstream links "suspect":
 * title, text and type. Status, owner, ordering and links do not count.
 */
export function contentFingerprint(item: Pick<Item, 'type' | 'title' | 'text'>): string {
  return createHash('sha256')
    .update(`${item.type}\u0000${item.title}\u0000${item.text.replace(/\r\n/g, '\n').trim()}`)
    .digest('hex')
    .slice(0, 12)
}
