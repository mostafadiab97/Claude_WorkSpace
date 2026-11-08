// Reading, creating, saving and deleting single items, with the rules that need the whole repository
// (the parent must exist and must not create a loop; saves are refused if the file changed meanwhile).
import type { Item, ItemDetails, LinkInfo, SaveResult } from '../../shared/api'
import { rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { documentOfPath } from '../../shared/domain'
import { generateId, validateItem } from '../items'
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
      ...(ctx.numbers(s).has(id) ? { number: ctx.numbers(s).get(id) as string } : {}),
      issues: [...validateItem(r.item, s.repo.schema), ...otherDocumentParent(s, r.item)]
    }
  }

  /** A parent in another document (only a hand-moved file or a pull can make one) is shown as a warning (QA-03). */
  const otherDocumentParent = (s: Session, item: Item): ItemDetails['issues'] => {
    const parent = item.parent ? s.index.get(item.parent) : undefined
    const mine = s.index.get(item.id)?.document ?? item.document ?? ''
    return parent && (parent.document ?? '') !== mine
      ? [{ itemId: item.id, path: 'parent', message: T.wsMsg.parentOtherDocument(parent.id, parent.document || T.wsMsg.looseFiles), severity: 'warning' as const }]
      : []
  }

  return {
    getItem: (id: string): Promise<ItemDetails | null> => details(ctx.need(), id),

    newItem(type: string, parent?: string, after?: string, document?: string): Item {
      const s = ctx.need()
      const taken = { has: (id: string) => s.index.get(id) !== undefined } as ReadonlySet<string>
      // "after" = right below that item, at its level (the owner, 5 Nov 2026: choose where a new item goes)
      const sibling = after ? s.index.get(after) : undefined
      // the document: of the item it goes next to or under (a tree never spans documents), else the chosen one (S-10)
      const under = sibling ? (sibling.parent ?? undefined) : parent
      const anchor = sibling ?? (parent ? s.index.get(parent) : undefined)
      const doc = anchor ? (anchor.document ?? '') : (document ?? s.repo.defaultDocument)
      if (sibling) return s.repo.createItem(type, taken, { ...(under ? { parent: under } : {}), order: structure.orderAfter(s, sibling.id), document: doc })
      return s.repo.createItem(type, taken, { ...(parent ? { parent } : {}), order: structure.nextOrder(s, parent, doc), document: doc })
    },

    async saveItem(item: Item, revision: string | null): Promise<SaveResult> {
      const s = ctx.need()
      const clean: Item = { ...item, title: item.title.trim() }
      if (clean.parent === '') delete clean.parent
      const issues = validateItem(clean, s.repo.schema).filter((i) => i.severity === 'error')
      if (clean.parent) {
        const parent = s.index.get(clean.parent)
        const mine = s.index.get(clean.id)?.document ?? clean.document ?? s.repo.defaultDocument
        if (!parent) issues.push({ itemId: clean.id, path: 'parent', message: T.wsMsg.parentMissing(clean.parent), severity: 'error' })
        // every document has its own tree (S-10): a parent from another document cannot hold this item
        else if ((parent.document ?? '') !== mine) issues.push({ itemId: clean.id, path: 'parent', message: T.wsMsg.parentOtherDocument(clean.parent, parent.document || T.wsMsg.looseFiles), severity: 'error' })
        else if (createsLoop(s, clean.id, clean.parent)) {
          issues.push({ itemId: clean.id, path: 'parent', message: T.wsMsg.parentLoop(clean.parent), severity: 'error' })
        }
      }
      if (issues.length > 0) return { ok: false, reason: 'invalid', message: issues.map((i) => i.message).join(' '), issues }
      try {
        await s.repo.writeItem(clean, { expectedRevision: revision })
        await s.index.syncPaths(s.repo, [s.repo.itemPath(clean.id, clean.document)])
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
    /**
     * Two files hold one ID — usually a file copied by hand into another document (the owner on 0.17.2). The copy
     * (the file Git does not know yet, else the newer one) gets a new ID and a matching file name; a parent from
     * another document is dropped, so the copy sits at the top of its own document.
     */
    async renewCopyId(id: string): Promise<OpResult & { newId?: string }> {
      const s = ctx.need()
      const paths = s.index.pathsOf(id)
      if (paths.length < 2) return { ok: true }
      try {
        const tracked = s.isGit ? new Set(await ctx.git.trackedFiles(s.repo.root, s.repo.folder)) : new Set<string>()
        const rel = (p: string): string => join(s.repo.folder, p).slice(s.repo.root.length + 1).split('\\').join('/')
        const untracked = paths.filter((p) => !tracked.has(rel(p)))
        const newest = async (ps: string[]): Promise<string> => {
          const times = await Promise.all(ps.map(async (p) => [p, (await stat(join(s.repo.folder, p))).mtimeMs] as const))
          return times.sort((a, b) => b[1] - a[1])[0]?.[0] as string
        }
        const copy = untracked.length === 1 ? (untracked[0] as string) : await newest(untracked.length > 1 ? untracked : paths)
        const read = await s.repo.readItemFile(copy)
        if (!read.ok) return { ok: false, message: read.error }
        const document = documentOfPath(copy)
        const newId = generateId((x) => s.index.get(x) !== undefined)
        const item: Item = { ...read.item, id: newId, document }
        const parent = item.parent ? s.index.get(item.parent) : undefined
        if (item.parent && (!parent || (parent.document ?? '') !== document)) {
          delete item.parent
          item.order = structure.nextOrder(s, undefined, document)
        }
        await s.repo.writeItem(item, { expectedRevision: null })
        await rm(join(s.repo.folder, copy))
        await s.index.syncPaths(s.repo, [copy, s.repo.itemPath(newId, document)])
        log.info(`Copied file ${copy}: ${id} → ${newId}`)
        return { ok: true, newId }
      } catch (e) {
        return { ok: false, message: (e as Error).message }
      }
    },

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
