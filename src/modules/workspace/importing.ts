// Excel / CSV import (M7): preview and import a sheet the main process read, remember the file per repository on
// this PC, and work out what "Update the Excel file" must change in it. The plan itself is pure
// (import-export/importPlan.ts); this file gathers the existing items, places new items, confirms new links and
// writes everything as uncommitted changes (or the first commit of a new project).
import { mkdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { ImportPreview, ImportResult, ImportSettings, ImportSource, ImportTarget, RepoInfo } from '../../shared/api'
import type { Item, Link } from '../../shared/domain'
import { guessMapping, planImport, type CellEdit, type ExistingItems, type ImportPlan } from '../import-export'
import { contentFingerprint, generateId, isValidId, keysBetween, validateItem } from '../items'
import { writeFileAtomic } from '../safe-files'
import { queryAll, type Session, type WorkspaceContext } from './context'
import type { StructureOps } from './structure'
import { T } from '../../shared/text'

/** What is remembered about the last import of a repository on this PC (per-user file, not shared). */
interface Remembered extends ImportSource {
  headerRow: number
  mapping: ImportTarget[]
  headers: string[]
  defaultType: string
}

export function createImportOps(ctx: WorkspaceContext, structure: StructureOps, opts: { userDir: string; cacheName: (root: string) => string; info: () => RepoInfo }) {
  const rememberFile = (root: string): string => join(opts.userDir, 'imports', opts.cacheName(root).replace(/\.sqlite$/, '.json'))

  /** The rows' existing items: every ID the file names (ours or, through `source-id`, another tool's). */
  async function existingFor(s: Session, keys: string[]): Promise<{ existing: ExistingItems; revisions: Map<string, string> }> {
    const byId = new Map<string, Item>()
    const revisions = new Map<string, string>()
    const bySource = new Map<string, string>()
    const read = async (id: string): Promise<void> => {
      const r = await s.repo.readItem(id)
      if (r?.ok) {
        byId.set(id, r.item)
        revisions.set(id, r.revision)
        const src = r.item.extra['source-id']
        if (typeof src === 'string') bySource.set(src, id)
      }
    }
    const ours = keys.filter((k) => s.index.get(k) !== undefined)
    const foreign = keys.filter((k) => s.index.get(k) === undefined && !isValidId(k))
    // another tool's IDs: only the item files know which item came from which row, so read them all once
    const ids = foreign.length > 0 ? queryAll(s.index, { sort: { by: 'id' } }).map((i) => i.id) : ours
    for (let i = 0; i < ids.length; i += 32) await Promise.all(ids.slice(i, i + 32).map(read))
    return { existing: { byId, bySource, exists: (id) => s.index.get(id) !== undefined }, revisions }
  }

  async function plan(s: Session, sheet: string[][], settings: ImportSettings): Promise<{ plan: ImportPlan; headers: string[]; mapping: ImportTarget[]; revisions: Map<string, string> }> {
    if (!s.repo.schema.itemTypes.some((t) => t.id === settings.defaultType)) throw new Error(T.importMsg.unknownType2(settings.defaultType))
    const headers = (sheet[settings.headerRow] ?? []).map((h) => h.trim())
    const rows = sheet.slice(settings.headerRow + 1)
    const width = Math.max(headers.length, ...rows.map((r) => r.length))
    for (let c = headers.length; c < width; c++) headers.push('')
    const mapping = settings.mapping && settings.mapping.length === width ? settings.mapping : guessMapping(headers, s.repo.schema)
    const idCol = mapping.indexOf('id')
    const keys = idCol >= 0 ? [...new Set(rows.map((r) => (r[idCol] ?? '').trim()).filter(Boolean))] : []
    const { existing, revisions } = await existingFor(s, keys)
    const taken = new Set<string>()
    const p = planImport({
      rows,
      firstRow: settings.headerRow + 2,
      headers,
      mapping,
      schema: s.repo.schema,
      defaultType: settings.defaultType,
      existing,
      newId: () => {
        const id = generateId((x) => taken.has(x) || s.index.get(x) !== undefined)
        taken.add(id)
        return id
      },
      isValidId: (id) => isValidId(id) && s.index.get(id) === undefined
    })
    breakLoops(s, p)
    return { plan: p, headers, mapping, revisions }
  }

  /** A parent column can describe a loop (A under B, B under A): such items go to the top level. */
  function breakLoops(s: Session, p: ImportPlan): void {
    const planned = new Map(p.items.map((x) => [x.item.id, x]))
    const parentOf = (id: string): string | undefined => (planned.has(id) ? planned.get(id)?.item.parent : s.index.get(id)?.parent)
    for (const x of p.items) {
      const seen = new Set<string>([x.item.id])
      let cur = x.item.parent
      while (cur) {
        if (seen.has(cur)) {
          delete x.item.parent
          p.problems.push({ row: x.row, message: T.importMsg.ownParent, severity: 'warning' })
          break
        }
        seen.add(cur)
        cur = parentOf(cur)
      }
    }
  }

  /** New items, and items the file moved to another parent, go after the existing children of that parent. */
  function placeItems(s: Session, p: ImportPlan): void {
    const moving = p.items.filter((x) => x.action !== 'unchanged' && (x.action === 'create' || (x.placed && s.index.get(x.item.id)?.parent !== x.item.parent)))
    const movingIds = new Set(moving.map((x) => x.item.id))
    const groups = new Map<string, typeof moving>()
    for (const x of moving) groups.set(x.item.parent ?? '', [...(groups.get(x.item.parent ?? '') ?? []), x])
    for (const [parent, list] of groups) {
      const stay = parent && !s.index.get(parent) ? [] : structure.siblings(s, parent || undefined).filter((x) => !movingIds.has(x.id))
      // byte-wise largest key among the children that stay (order keys compare as plain text, never by language)
      const last = stay.reduce<string | null>((m, x) => (x.order !== undefined && (m === null || x.order > m) ? x.order : m), null)
      const keys = keysBetween(last, null, list.length)
      list.sort((a, b) => a.seq - b.seq).forEach((x, i) => {
        x.item.order = keys[i] as string
      })
    }
  }

  return {
    async preview(sheet: string[][], settings: ImportSettings): Promise<ImportPreview> {
      const s = ctx.need()
      const { plan: p, headers, mapping } = await plan(s, sheet, settings)
      return { headers, mapping, counts: p.counts, extraLinks: p.extraLinks.length, problems: p.problems.slice(0, 500), rows: p.preview.slice(0, 300) }
    },

    /** Writes the planned items. With `commitMessage` (new project from a file) the result is committed at once. */
    async run(sheet: string[][], settings: ImportSettings, source: Omit<ImportSource, 'sheet'>, commitMessage?: string): Promise<ImportResult> {
      const s = ctx.need()
      const { plan: p, headers, mapping, revisions } = await plan(s, sheet, settings)
      if (!mapping.includes('title') && !mapping.includes('text')) return { ok: false, message: T.importMsg.noTitleColumn }
      placeItems(s, p)
      const writes = p.items.filter((x) => x.action !== 'unchanged')
      // a new link is confirmed against its target as it will be after the import
      const final = new Map(p.items.map((x) => [x.item.id, x.item]))
      const confirm = (l: Link): Link => {
        if (l.confirmed) return l
        const t = final.get(l.target)
        const fp = t ? contentFingerprint(t) : s.index.fingerprint(l.target)
        return fp ? { ...l, confirmed: fp } : l
      }
      for (const x of writes) x.item.links = x.item.links.map(confirm)
      // check everything before the first file is written (NFR-05)
      for (const x of writes) {
        const errors = validateItem(x.item, s.repo.schema).filter((i) => i.severity === 'error')
        if (errors.length) return { ok: false, message: `${T.importMsg.rowFailed(x.row)} ${errors.map((e) => e.message).join(' ')}` }
      }
      const paths: string[] = []
      for (const x of writes) {
        await s.repo.writeItem(x.item, { expectedRevision: x.action === 'create' ? null : (revisions.get(x.item.id) ?? null) })
        paths.push(s.repo.itemPath(x.item.id))
      }
      // "Verified by" columns: links stored in existing items outside the file
      const bySource = new Map<string, Link[]>()
      for (const e of p.extraLinks) bySource.set(e.source, [...(bySource.get(e.source) ?? []), e.link])
      for (const [source, links] of bySource) {
        const cur = await s.repo.readItem(source)
        if (!cur?.ok) continue
        const next = [...cur.item.links]
        for (const l of links) if (!next.some((x) => x.type === l.type && x.target === l.target)) next.push(confirm(l))
        await s.repo.writeItem({ ...cur.item, links: next }, { expectedRevision: cur.revision })
        paths.push(s.repo.itemPath(source))
      }
      await s.index.syncPaths(s.repo, paths)
      ctx.log.info(`Imported ${source.path} (${settings.sheet}): ${p.counts.create} new, ${p.counts.update} updated, ${p.counts.unchanged} unchanged, ${p.counts.skip} skipped`)
      // remember the file for "Update the Excel file" (this PC only)
      const remembered: Remembered = { ...source, sheet: settings.sheet, headerRow: settings.headerRow, mapping, headers, defaultType: settings.defaultType }
      await mkdir(join(opts.userDir, 'imports'), { recursive: true })
      await writeFileAtomic(rememberFile(s.repo.root), JSON.stringify(remembered, null, 2)).catch((e: unknown) => ctx.log.warn(`Could not remember the import source: ${String(e)}`))
      let committed = false
      if (commitMessage) {
        try {
          await ctx.git.commit(s.repo.root, relative(s.repo.root, s.repo.folder).split('\\').join('/') || '.', commitMessage)
          committed = true
        } catch (e) {
          ctx.log.warn(`First commit after the import failed: ${String(e)}`)
        }
      }
      const counts = p.counts
      return { ok: true, created: counts.create, updated: writes.length - counts.create, unchanged: p.items.length - writes.length, skipped: counts.skip, committed, info: opts.info() }
    },

    async source(): Promise<ImportSource | null> {
      const s = ctx.need()
      try {
        const r = JSON.parse(await readFile(rememberFile(s.repo.root), 'utf8')) as Remembered
        return { path: r.path, name: r.name, kind: r.kind, sheet: r.sheet }
      } catch {
        return null
      }
    },

    /**
     * "Update the Excel file": the cells of the remembered columns whose value differs from the repository now,
     * and rows for items the file does not have yet. Rows of items deleted in ReqMan stay (the file is the
     * user's; nothing is removed from it).
     */
    async sourceUpdate(sheet: string[][]): Promise<{ edits: CellEdit[]; append: string[][]; sheet: string; changedItems: number; added: number }> {
      const s = ctx.need()
      let r: Remembered
      try {
        r = JSON.parse(await readFile(rememberFile(s.repo.root), 'utf8')) as Remembered
      } catch {
        throw new Error(T.importMsg.noSource)
      }
      const idCol = r.mapping.indexOf('id')
      const rows = sheet.slice(r.headerRow + 1)
      const all = queryAll(s.index, { sort: { by: 'order' } })
      const numbers = ctx.numbers(s)
      // which row holds which item: the file's ID (ours, or the other tool's through source-id)
      const keys = idCol >= 0 ? [...new Set(rows.map((x) => (x[idCol] ?? '').trim()).filter(Boolean))] : []
      const { existing } = await existingFor(s, keys)
      const rowOf = new Map<string, number>()
      rows.forEach((x, i) => {
        const k = idCol >= 0 ? (x[idCol] ?? '').trim() : ''
        const id = existing.byId.has(k) ? k : existing.bySource.get(k)
        if (id && !rowOf.has(id)) rowOf.set(id, i)
      })
      const fileId = (id: string): string => {
        const src = existing.byId.get(id)?.extra['source-id']
        return typeof src === 'string' ? src : id
      }
      const schema = s.repo.schema
      const valueOf = (it: (typeof all)[number], t: ImportTarget): string | null => {
        const linkName = (type: string, reverse: boolean): string => {
          const l = schema.linkTypes.find((x) => x.id === type)
          return l ? (reverse ? l.reverseName : l.name) : type
        }
        switch (t) {
          case 'id':
            return fileId(it.id)
          case 'number':
            return numbers.get(it.id) ?? ''
          case 'title':
            return it.title
          case 'text':
            return it.text
          case 'type':
            return schema.itemTypes.find((x) => x.id === it.type)?.name ?? it.type
          case 'parent':
            return it.parent ? fileId(it.parent) : ''
          case 'level':
            return String((numbers.get(it.id) ?? '').split('.').length)
          case 'links':
            return it.links.map((l) => `${linkName(l.type, false)} ${fileId(l.target)}`).join('; ')
          default:
            if (t.startsWith('field:')) {
              const v = it.fields[t.slice(6)]
              return v === undefined ? '' : Array.isArray(v) ? v.join(', ') : String(v)
            }
            if (t.startsWith('link:')) return it.links.filter((l) => l.type === t.slice(5)).map((l) => fileId(l.target)).join(', ')
            if (t.startsWith('linkFrom:')) return s.index.incomingLinks(it.id).filter((l) => l.type === t.slice(9)).map((l) => fileId(l.id)).join(', ')
            return null // ignored columns and "linked from" lists are left as they are
        }
      }
      const listFields = new Set(schema.fields.filter((f) => f.type === 'list').map((f) => `field:${f.id}`))
      const edits: CellEdit[] = []
      const append: string[][] = []
      let changedItems = 0
      for (const it of all) {
        const i = rowOf.get(it.id)
        const row = i === undefined ? null : rows[i]
        const out: string[] = []
        let changed = false
        r.mapping.forEach((t, c) => {
          const v = valueOf(it, t)
          if (v === null) return
          out[c] = v
          if (row && !sameCell(t, row[c] ?? '', v, listFields)) {
            edits.push({ row: r.headerRow + 2 + (i as number), col: c + 1, value: v })
            changed = true
          }
        })
        if (!row) append.push(Array.from({ length: r.mapping.length }, (_v, c) => out[c] ?? ''))
        else if (changed) changedItems++
      }
      edits.sort((a, b) => a.row - b.row || a.col - b.col)
      return { edits, append, sheet: r.sheet, changedItems, added: append.length }
    }
  }
}

export type ImportOps = ReturnType<typeof createImportOps>

/** A list (links, tags) in another order, or with other separators, is the same value. */
function sameCell(t: ImportTarget, file: string, now: string, listFields: ReadonlySet<string>): boolean {
  const list = t === 'links' || t.startsWith('link:') || t.startsWith('linkFrom:') || listFields.has(t)
  if (!list) return file.trim() === now.trim()
  const items = (x: string): string => x.split(/[;,\n]+/).map((y) => y.trim()).filter(Boolean).sort().join('\n')
  return items(file) === items(now)
}
