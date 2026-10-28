// Links between items: always stored in the source item's file, each with the target's fingerprint at the
// time it was confirmed (a later change of the target makes the link "suspect").
import type { Link } from '../../shared/domain'
import type { OpResult, Session, WorkspaceContext } from './context'
import { T } from '../../shared/text'

export function createLinkOps(ctx: WorkspaceContext) {
  const { log } = ctx

  /** Rewrites the links of one item file (conflict-safe) and updates the index. */
  async function editLinks(s: Session, id: string, change: (links: Link[]) => Link[]): Promise<OpResult> {
    try {
      const current = await s.repo.readItem(id)
      if (!current?.ok) return { ok: false, message: T.wsMsg.unreadable(id) }
      const links = change(current.item.links)
      const path = s.repo.itemPath(id)
      await s.repo.writeItem({ ...current.item, links }, { expectedRevision: current.revision })
      await s.index.syncPaths(s.repo, [path])
      log.info(`Links of ${id} changed (${current.item.links.length} → ${links.length})`)
      return { ok: true }
    } catch (e) {
      return { ok: false, message: (e as Error).message }
    }
  }

  return {
    editLinks,

    async addLink(source: string, type: string, target: string): Promise<OpResult> {
      const s = ctx.need()
      if (!s.repo.schema.linkTypes.some((t) => t.id === type)) return { ok: false, message: T.wsMsg.unknownLinkType(type) }
      if (source === target) return { ok: false, message: T.wsMsg.selfLink }
      const fp = s.index.fingerprint(target)
      if (fp === undefined) return { ok: false, message: T.wsMsg.missing(target) }
      if (!s.index.get(source)) return { ok: false, message: T.wsMsg.missing(source) }
      return editLinks(s, source, (links) => {
        if (links.some((l) => l.type === type && l.target === target)) throw new Error(T.wsMsg.alreadyLinked(source, target))
        return [...links, { type, target, confirmed: fp }]
      })
    },

    removeLink: (source: string, type: string, target: string): Promise<OpResult> =>
      editLinks(ctx.need(), source, (links) => {
        const kept = links.filter((l) => !(l.type === type && l.target === target))
        if (kept.length === links.length) throw new Error(T.wsMsg.noSuchLink(source, type, target))
        return kept
      }),

    confirmLinks(source: string, target?: string): Promise<OpResult> {
      const s = ctx.need()
      return editLinks(s, source, (links) =>
        links.map((l) => {
          if (target !== undefined && l.target !== target) return l
          const fp = s.index.fingerprint(l.target)
          return fp === undefined ? l : { ...l, confirmed: fp }
        })
      )
    }
  }
}

export type LinkOps = ReturnType<typeof createLinkOps>
