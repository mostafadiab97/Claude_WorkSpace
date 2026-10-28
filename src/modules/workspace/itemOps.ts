// Reading, creating, saving and deleting single items, with the rules that need the whole repository
// (the parent must exist and must not create a loop; saves are refused if the file changed meanwhile).
import type { Item, ItemDetails, LinkInfo, SaveResult } from '../../shared/api'
import { validateItem } from '../items'
import { ConflictError } from '../repository-store'
import type { OpResult, Session, WorkspaceContext } from './context'
import type { LinkOps } from './links'
import { createsLoop, type StructureOps } from './structure'
import { T } from '../../shared/text'

export function createItemOps(ctx: WorkspaceContext, links: LinkOps, structure: StructureOps) {
  const { log } = ctx

  async function details(s: Session, id: string): Promise<ItemDetails | null> {
    const r = await s.repo.readItem(id)
    if (!r || !r.ok) return null
    const info = (other: string, type: string, suspect: boolean): LinkInfo => {
      const t = s.index.get(other)
      return { id: other, type, exists: t !== undefined, suspect, ...(t ? { title: t.title } : {}) }
    }
    return {
      item: r.item,
      revision: r.revision,
      outgoing: r.item.links.map((l) => {
        const fp = s.index.fingerprint(l.target)
        return info(l.target, l.type, l.confirmed !== undefined && fp !== undefined && l.confirmed !== fp)
      }),
      incoming: s.index.incomingLinks(id).map((l) => info(l.id, l.type, l.suspect)),
      childCount: s.index.query({ parent: id, limit: 0 }).total,
      issues: validateItem(r.item, s.repo.schema)
    }
  }

  return {
    getItem: (id: string): Promise<ItemDetails | null> => details(ctx.need(), id),

    newItem(type: string, parent?: string): Item {
      const s = ctx.need()
      const taken = { has: (id: string) => s.index.get(id) !== undefined } as ReadonlySet<string>
      return s.repo.createItem(type, taken, { ...(parent ? { parent } : {}), order: structure.nextOrder(s, parent) })
    },

    async saveItem(item: Item, revision: string | null): Promise<SaveResult> {
      const s = ctx.need()
      const clean: Item = { ...item, title: item.title.trim() }
      if (clean.parent === '') delete clean.parent
      const issues = validateItem(clean, s.repo.schema).filter((i) => i.severity === 'error')
      if (clean.parent) {
        if (!s.index.get(clean.parent)) issues.push({ itemId: clean.id, path: 'parent', message: T.wsMsg.parentMissing(clean.parent), severity: 'error' })
        else if (createsLoop(s, clean.id, clean.parent)) {
          issues.push({ itemId: clean.id, path: 'parent', message: T.wsMsg.parentLoop(clean.parent), severity: 'error' })
        }
      }
      if (issues.length > 0) return { ok: false, reason: 'invalid', message: issues.map((i) => i.message).join(' '), issues }
      try {
        await s.repo.writeItem(clean, { expectedRevision: revision })
        await s.index.syncPaths(s.repo, [s.repo.itemPath(clean.id)])
        const d = await details(s, clean.id)
        if (!d) return { ok: false, reason: 'error', message: T.wsMsg.savedUnreadable }
        log.info(`Saved ${clean.id}${revision === null ? ' (new)' : ''}`)
        return { ok: true, details: d }
      } catch (e) {
        if (e instanceof ConflictError) return { ok: false, reason: 'conflict', message: e.message }
        log.error(`Saving ${clean.id} failed`, e)
        return { ok: false, reason: 'error', message: (e as Error).message }
      }
    },

    async deleteItem(id: string, revision: string, opts?: { removeIncomingLinks?: boolean }): Promise<OpResult> {
      const s = ctx.need()
      const children = s.index.query({ parent: id, limit: 0 }).total
      if (children > 0) return { ok: false, message: T.wsMsg.hasChildren(id, children) }
      try {
        const path = s.repo.itemPath(id)
        await s.repo.deleteItem(id, { expectedRevision: revision })
        await s.index.syncPaths(s.repo, [path])
        log.info(`Deleted ${id}`)
        if (opts?.removeIncomingLinks) {
          const sources = [...new Set(s.index.incomingLinks(id).map((l) => l.id))]
          for (const src of sources) {
            const r = await links.editLinks(s, src, (ls) => ls.filter((l) => l.target !== id))
            if (!r.ok) return { ok: false, message: T.wsMsg.deletedLinksFailed(id, src, r.message) }
          }
        }
        return { ok: true }
      } catch (e) {
        if (!(e instanceof ConflictError)) log.error(`Deleting ${id} failed`, e)
        return { ok: false, message: (e as Error).message }
      }
    },

    /** Renames a file whose name does not match its ID to <ID>.md (review D-01). */
    async fixFileName(id: string): Promise<OpResult> {
      const s = ctx.need()
      try {
        const from = s.repo.itemPath(id)
        const to = await s.repo.fixFileName(id)
        await s.index.syncPaths(s.repo, [from, to])
        log.info(`Renamed ${from} to ${to}`)
        return { ok: true }
      } catch (e) {
        return { ok: false, message: (e as Error).message }
      }
    }
  }
}
