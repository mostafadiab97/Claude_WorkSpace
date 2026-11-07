// Changing the project's field definitions (schema.yaml → fields), and telling the user beforehand how many
// items hold values the new definition does not allow (review D-08).
import type { FieldCheck, FieldDef, RepoInfo } from '../../shared/api'
import type { ItemTypeDef, LinkTypeDef } from '../../shared/domain'
import { T } from '../../shared/text'
import { validateItem } from '../items'
import { queryAll, syncInfo, type WorkspaceContext } from './context'

export function createSchemaFieldOps(ctx: WorkspaceContext, info: () => RepoInfo) {
  const { log } = ctx
  return {
    /** For every field whose kind or choices change: items whose value would no longer be allowed. */
    checkFields(fields: FieldDef[]): FieldCheck[] {
      const s = ctx.need()
      const before = new Map(s.repo.schema.fields.map((f) => [f.id, f]))
      const changed = fields.filter((f) => {
        const old = before.get(f.id)
        return old !== undefined && (old.type !== f.type || JSON.stringify(old.options ?? []) !== JSON.stringify(f.options ?? []))
      })
      if (changed.length === 0) return []
      const items = queryAll(s.index, { sort: { by: 'id' } })
      return changed
        .map((f) => {
          const schema = { ...s.repo.schema, fields: [f] }
          const bad = items.filter((it) => it.fields[f.id] !== undefined && validateItem({ ...it, extra: {} }, schema).some((i) => i.path === `fields.${f.id}`))
          return { fieldId: f.id, name: f.name, count: bad.length, examples: bad.slice(0, 5).map((i) => i.id) }
        })
        .filter((c) => c.count > 0)
    },

    typeUsage: () => ctx.need().index.typeUsage(),

    async saveSchemaTypes(itemTypes: ItemTypeDef[], linkTypes: LinkTypeDef[], schemaRevision: string): Promise<{ ok: true; info: RepoInfo } | { ok: false; message: string }> {
      const s = ctx.need()
      const used = s.index.typeUsage()
      // a type still in use cannot be removed (the owner, 5 Nov 2026 — S-04 a); the window shows the counts
      const goneItems = s.repo.schema.itemTypes.filter((t) => !itemTypes.some((x) => x.id === t.id) && (used.items[t.id] ?? 0) > 0)
      const goneLinks = s.repo.schema.linkTypes.filter((t) => !linkTypes.some((x) => x.id === t.id) && (used.links[t.id] ?? 0) > 0)
      if (goneItems.length) return { ok: false, message: T.types.stillUsed(goneItems.map((t) => `${t.name} (${used.items[t.id]})`).join(', ')) }
      if (goneLinks.length) return { ok: false, message: T.types.stillUsed(goneLinks.map((t) => `${t.name} (${used.links[t.id]})`).join(', ')) }
      if (itemTypes.length === 0) return { ok: false, message: T.types.atLeastOne }
      try {
        await s.repo.writeSchemaTypes(itemTypes, linkTypes, schemaRevision)
        log.info(`Schema types changed: ${itemTypes.map((t) => t.id).join(', ')} / ${linkTypes.map((t) => t.id).join(', ')}`)
        const repo = await ctx.openRepo(s.repo.root)
        s.repo = repo
        s.lastSync = syncInfo(await s.index.sync(repo))
        return { ok: true, info: info() }
      } catch (e) {
        return { ok: false, message: (e as Error).message }
      }
    },

    async saveSchemaFields(fields: FieldDef[], schemaRevision: string): Promise<{ ok: true; info: RepoInfo } | { ok: false; message: string }> {
      const s = ctx.need()
      try {
        await s.repo.writeSchemaFields(fields, schemaRevision)
        log.info(`Schema fields changed: ${fields.map((f) => f.id).join(', ')}`)
        // Re-open with the new schema. The index keeps every header key, so this re-reads no item file (P-05).
        const repo = await ctx.openRepo(s.repo.root)
        s.repo = repo
        s.lastSync = syncInfo(await s.index.sync(repo))
        return { ok: true, info: info() }
      } catch (e) {
        return { ok: false, message: (e as Error).message }
      }
    }
  }
}
