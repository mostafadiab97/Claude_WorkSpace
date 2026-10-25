import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import type { FolderCheck, Item, ItemDetails, RecentRepository, RepoInfo, SaveResult } from '../../shared/api'
import type { GitAdapter } from '../git-adapter'
import type { IndexCache } from '../index-cache'
import { validateItem } from '../items'
import type { Logger } from '../logger'
import { ConflictError, type RepositoryStore, type RequirementsRepo } from '../repository-store'
import type { OpResult, WorkspaceService } from './index'

export interface WorkspaceDeps {
  store: RepositoryStore
  git: Pick<GitAdapter, 'findRepositoryRoot'>
  /** Creates (or reopens) the index cache for a repository root. */
  openIndex(root: string): IndexCache
  /** Folder for per-user state (recent repositories list). */
  userDir: string
  log: Pick<Logger, 'info' | 'warn' | 'error'>
}

const MAX_RECENT = 10
const ORDER_STEP = 10

interface Session {
  repo: RequirementsRepo
  index: IndexCache
  isGit: boolean
  lastSync: RepoInfo['lastSync']
}

/** Same folder regardless of letter case or trailing slash (Windows paths are case-insensitive). */
const sameFolder = (a: string, b: string): boolean => resolve(a).toLowerCase() === resolve(b).toLowerCase()

export function cacheFileName(root: string): string {
  return `${createHash('sha1').update(resolve(root).toLowerCase()).digest('hex').slice(0, 20)}.sqlite`
}

export function createWorkspace(deps: WorkspaceDeps): WorkspaceService {
  const { store, git, log } = deps
  const recentFile = join(deps.userDir, 'recent-repositories.json')
  let session: Session | null = null

  const need = (): Session => {
    if (!session) throw new Error('No repository is open.')
    return session
  }

  async function readRecent(): Promise<RecentRepository[]> {
    try {
      const v = JSON.parse(await readFile(recentFile, 'utf8')) as unknown
      return Array.isArray(v) ? (v as RecentRepository[]).filter((r) => typeof r?.root === 'string') : []
    } catch {
      return []
    }
  }
  async function writeRecent(list: RecentRepository[]): Promise<void> {
    await mkdir(deps.userDir, { recursive: true })
    await writeFile(recentFile, JSON.stringify(list, null, 2), 'utf8')
  }
  async function remember(root: string): Promise<void> {
    const list = (await readRecent()).filter((r) => !sameFolder(r.root, root))
    list.unshift({ root, name: basename(root), openedAt: new Date().toISOString() })
    await writeRecent(list.slice(0, MAX_RECENT)).catch((e) => log.warn(`Could not save recent list: ${String(e)}`))
  }

  function info(s: Session): RepoInfo {
    return {
      root: s.repo.root,
      name: basename(s.repo.root),
      isGitRepository: s.isGit,
      schema: s.repo.schema,
      schemaProblems: s.repo.schemaProblems,
      schemaRevision: s.repo.schemaRevision,
      itemCount: s.index.count(),
      issues: s.index.repositoryIssues(),
      lastSync: s.lastSync
    }
  }

  async function startSession(repo: RequirementsRepo, isGit: boolean): Promise<RepoInfo> {
    session?.index.close()
    session = null
    const index = deps.openIndex(repo.root)
    const stats = await index.sync(repo)
    session = {
      repo,
      index,
      isGit,
      lastSync: { durationMs: stats.durationMs, full: stats.full, changedFiles: stats.added + stats.updated + stats.removed }
    }
    log.info(
      `Opened ${repo.root}: ${stats.files} files, ${stats.added} added / ${stats.updated} updated / ${stats.removed} removed ` +
        `in ${stats.durationMs} ms${stats.full ? ' (full index)' : ''}`
    )
    await remember(repo.root)
    return info(session)
  }

  const siblings = (s: Session, parent: string | undefined): Item[] =>
    s.index
      .query({ parent: parent ?? null, sort: { by: 'order' }, limit: 10_000 })
      .items.map((i) => ({ id: i.id, type: i.type, title: i.title, fields: i.fields, links: i.links, text: i.text, extra: {}, ...(i.parent ? { parent: i.parent } : {}), ...(i.order !== undefined ? { order: i.order } : {}) }))

  /** Would making `newParent` the parent of `id` create a loop (newParent is id itself or below it)? */
  function createsLoop(s: Session, id: string, newParent: string): boolean {
    const seen = new Set<string>()
    let cur: string | undefined = newParent
    while (cur) {
      if (cur === id) return true
      if (seen.has(cur)) return false
      seen.add(cur)
      cur = s.index.get(cur)?.parent
    }
    return false
  }

  async function details(s: Session, id: string): Promise<ItemDetails | null> {
    const r = await s.repo.readItem(id)
    if (!r || !r.ok) return null
    return {
      item: r.item,
      revision: r.revision,
      incoming: s.index.incomingLinks(id),
      childCount: s.index.query({ parent: id, limit: 0 }).total,
      issues: validateItem(r.item, s.repo.schema)
    }
  }

  return {
    async checkFolder(path): Promise<FolderCheck> {
      const gitRoot = await git.findRepositoryRoot(path)
      const root = gitRoot ?? resolve(path)
      return { root, isGitRepository: gitRoot !== null, state: await store.inspect(root) }
    },

    async initialize(root) {
      const isGit = (await git.findRepositoryRoot(root)) !== null
      const repo = await store.initialize(root)
      log.info(`Created requirements folder in ${root}`)
      return startSession(repo, isGit)
    },

    async open(root) {
      const isGit = (await git.findRepositoryRoot(root)) !== null
      return startSession(await store.open(root), isGit)
    },

    close() {
      if (session) log.info(`Closed ${session.repo.root}`)
      session?.index.close()
      session = null
    },

    async refresh() {
      const s = need()
      // Re-open so changes to schema.yaml are picked up too.
      const repo = await store.open(s.repo.root)
      const stats = await s.index.sync(repo)
      s.repo = repo
      s.lastSync = { durationMs: stats.durationMs, full: stats.full, changedFiles: stats.added + stats.updated + stats.removed }
      return info(s)
    },

    isOpen: () => session !== null,
    recent: readRecent,
    forgetRecent: async (root) => writeRecent((await readRecent()).filter((r) => !sameFolder(r.root, root))),

    query: (q) => need().index.query(q),

    getItem: async (id) => details(need(), id),

    newItem(type, parent) {
      const s = need()
      const last = s.index.query({ parent: parent ?? null, sort: { by: 'order', descending: true }, limit: 1 }).items[0]
      const order = Math.floor((last?.order ?? 0) / ORDER_STEP) * ORDER_STEP + ORDER_STEP
      const taken = { has: (id: string) => s.index.get(id) !== undefined } as ReadonlySet<string>
      return s.repo.createItem(type, taken, { ...(parent ? { parent } : {}), order })
    },

    async saveItem(item, revision): Promise<SaveResult> {
      const s = need()
      const clean: Item = { ...item, title: item.title.trim() }
      if (clean.parent === '') delete clean.parent
      const issues = validateItem(clean, s.repo.schema).filter((i) => i.severity === 'error')
      if (clean.parent) {
        if (!s.index.get(clean.parent)) issues.push({ itemId: clean.id, path: 'parent', message: `Parent ${clean.parent} does not exist.`, severity: 'error' })
        else if (createsLoop(s, clean.id, clean.parent)) {
          issues.push({ itemId: clean.id, path: 'parent', message: `${clean.parent} is this item or one of its children; choose another parent.`, severity: 'error' })
        }
      }
      if (issues.length > 0) return { ok: false, reason: 'invalid', message: issues.map((i) => i.message).join(' '), issues }
      try {
        await s.repo.writeItem(clean, { expectedRevision: revision })
        await s.index.syncPaths(s.repo, [s.repo.itemPath(clean.id)])
        const d = await details(s, clean.id)
        if (!d) return { ok: false, reason: 'error', message: 'The item was saved but could not be read back.' }
        log.info(`Saved ${clean.id}${revision === null ? ' (new)' : ''}`)
        return { ok: true, details: d }
      } catch (e) {
        if (e instanceof ConflictError) return { ok: false, reason: 'conflict', message: e.message }
        log.error(`Saving ${clean.id} failed`, e)
        return { ok: false, reason: 'error', message: (e as Error).message }
      }
    },

    async deleteItem(id, revision): Promise<OpResult> {
      const s = need()
      const children = s.index.query({ parent: id, limit: 0 }).total
      if (children > 0) return { ok: false, message: `${id} has ${children} child item(s). Move or delete them first.` }
      try {
        await s.repo.deleteItem(id, { expectedRevision: revision })
        await s.index.syncPaths(s.repo, [s.repo.itemPath(id)])
        log.info(`Deleted ${id}`)
        return { ok: true }
      } catch (e) {
        if (!(e instanceof ConflictError)) log.error(`Deleting ${id} failed`, e)
        return { ok: false, message: (e as Error).message }
      }
    },

    ancestors(id) {
      const s = need()
      const chain: string[] = []
      const seen = new Set<string>([id])
      let cur = s.index.get(id)?.parent
      while (cur && !seen.has(cur)) {
        chain.unshift(cur)
        seen.add(cur)
        cur = s.index.get(cur)?.parent
      }
      return chain
    },

    async reparentItem(id, parent, before): Promise<OpResult> {
      const s = need()
      const current = await s.repo.readItem(id)
      if (!current?.ok) return { ok: false, message: `${id} could not be read.` }
      if (parent !== null) {
        if (!s.index.get(parent)) return { ok: false, message: `${parent} does not exist.` }
        if (createsLoop(s, id, parent)) return { ok: false, message: `${parent} is ${id} itself or one of its children.` }
      }
      // Its own children move with it: they keep pointing at it.
      const sibs = siblings(s, parent ?? undefined).filter((x) => x.id !== id)
      const at = before ? sibs.findIndex((x) => x.id === before) : -1
      const index = at < 0 ? sibs.length : at
      const prev = sibs[index - 1]?.order
      const next = sibs[index]?.order
      const plan: { id: string; order: number }[] = []
      if (index === sibs.length) {
        plan.push({ id, order: Math.floor((prev ?? 0) / ORDER_STEP) * ORDER_STEP + ORDER_STEP })
      } else if (next !== undefined && (index === 0 ? next > 1 : prev !== undefined && next - prev > 1)) {
        // there is room between the neighbours: only this file changes
        plan.push({ id, order: Math.floor(((index === 0 ? 0 : (prev as number)) + next) / 2) })
      } else {
        // no room: renumber the siblings 10, 20, 30… (only files whose order changes are written)
        const list: { id: string; order?: number }[] = [...sibs.slice(0, index), { id }, ...sibs.slice(index)]
        list.forEach((x, k) => {
          const order = (k + 1) * ORDER_STEP
          if (x.id === id || x.order !== order) plan.push({ id: x.id, order })
        })
      }
      try {
        for (const step of plan) {
          const cur = step.id === id ? current : await s.repo.readItem(step.id)
          if (!cur?.ok) return { ok: false, message: `${step.id} could not be read; moving stopped.` }
          const moved: Item = { ...cur.item, order: step.order }
          if (step.id === id) {
            if (parent === null) delete moved.parent
            else moved.parent = parent
          }
          await s.repo.writeItem(moved, { expectedRevision: cur.revision })
        }
        await s.index.syncPaths(s.repo, plan.map((p) => s.repo.itemPath(p.id)))
        log.info(`Moved ${id} under ${parent ?? 'top level'}${before ? ` before ${before}` : ''}`)
        return { ok: true }
      } catch (e) {
        log.error(`Moving ${id} failed`, e)
        return { ok: false, message: (e as Error).message }
      }
    },

    async saveSchemaFields(fields, schemaRevision) {
      const s = need()
      try {
        await s.repo.writeSchemaFields(fields, schemaRevision)
        log.info(`Schema fields changed: ${fields.map((f) => f.id).join(', ')}`)
        // Re-open: the new schema changes how files are read, so the index is rebuilt automatically.
        const repo = await store.open(s.repo.root)
        const stats = await s.index.sync(repo)
        s.repo = repo
        s.lastSync = { durationMs: stats.durationMs, full: stats.full, changedFiles: stats.added + stats.updated + stats.removed }
        return { ok: true, info: info(s) }
      } catch (e) {
        return { ok: false, message: (e as Error).message }
      }
    },

    async moveItem(id, direction): Promise<OpResult> {
      const s = need()
      const self = s.index.get(id)
      if (!self) return { ok: false, message: `${id} not found.` }
      const sibs = siblings(s, self.parent)
      const i = sibs.findIndex((x) => x.id === id)
      const j = direction === 'up' ? i - 1 : i + 1
      if (i < 0 || j < 0 || j >= sibs.length) return { ok: true } // already first/last
      const a = sibs[i] as Item
      const b = sibs[j] as Item
      // Normal case: swap the two order values — two files change. Only if orders are missing or equal
      // (e.g. hand-edited files) is the whole sibling list renumbered 10, 20, 30…
      let plan: { id: string; order: number }[]
      if (a.order !== undefined && b.order !== undefined && a.order !== b.order) {
        plan = [
          { id: a.id, order: b.order },
          { id: b.id, order: a.order }
        ]
      } else {
        const reordered = [...sibs]
        reordered[i] = b
        reordered[j] = a
        plan = reordered.map((x, k) => ({ id: x.id, order: (k + 1) * ORDER_STEP })).filter((p) => sibs.find((x) => x.id === p.id)?.order !== p.order)
      }
      try {
        for (const step of plan) {
          const current = await s.repo.readItem(step.id)
          if (!current?.ok) return { ok: false, message: `${step.id} could not be read; reordering stopped.` }
          await s.repo.writeItem({ ...current.item, order: step.order }, { expectedRevision: current.revision })
        }
        await s.index.syncPaths(s.repo, plan.map((p) => s.repo.itemPath(p.id)))
        return { ok: true }
      } catch (e) {
        log.error(`Moving ${id} failed`, e)
        return { ok: false, message: (e as Error).message }
      }
    }
  }
}
