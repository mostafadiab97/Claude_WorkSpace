// Compare (M5): requirement-level differences between two versions of the requirements folder — the
// "REQ-12 text changed", "TC-4 → REQ-7 link added" view instead of changed file lines (journey step 6).
import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { CompareEntry, CompareOptions, CompareResult, LinkChange, SchemaChange, VersionLabel } from '../../shared/api'
import type { Item, ItemDiff, Schema } from '../../shared/domain'
import type { GitAdapter, NameStatus } from '../git-adapter'
import type { IndexCache } from '../index-cache'
import { contentFingerprint, diffItems, parseItemFile } from '../items'
import { parseSchema } from '../schema'
import type { RequirementsRepo } from '../repository-store'

export const WORKING = 'WORKING'

interface Session {
  repo: RequirementsRepo
  index: IndexCache
  isGit: boolean
}

const ITEM_FILE = /\/items\/([^/]+)\.md$/
const reqPath = (repo: RequirementsRepo): string => relative(repo.root, repo.folder).split('\\').join('/') || '.'

/** A pull or a merge of a remote branch in the reflog: "pull: Fast-forward", "merge origin/main: Merge made by …". */
const PULL_STEP = /^(pull\b|merge [^\s:]+\/[^\s:]+:)/

/** "Text, Status · 1 link added" */
export function summarize(diff: ItemDiff): string {
  const parts = diff.rows.map((r) => r.label)
  // Title first, then Text, then the rest
  if (diff.text) parts.splice(diff.rows[0]?.key === 'title' ? 1 : 0, 0, 'Text')
  const links: string[] = []
  if (diff.linksAdded.length) links.push(`${diff.linksAdded.length} link${diff.linksAdded.length === 1 ? '' : 's'} added`)
  if (diff.linksRemoved.length) links.push(`${diff.linksRemoved.length} link${diff.linksRemoved.length === 1 ? '' : 's'} removed`)
  return [parts.join(', '), links.join(', ')].filter(Boolean).join(' · ') || 'Formatting only'
}

function schemaChange(before: Schema | null, after: Schema | null): SchemaChange {
  const ids = <T extends { id: string }>(xs: T[] | undefined): Set<string> => new Set((xs ?? []).map((x) => x.id))
  const added = (a: Set<string>, b: Set<string>): string[] => [...b].filter((x) => !a.has(x))
  const bf = ids(before?.fields)
  const af = ids(after?.fields)
  const bt = ids(before?.itemTypes)
  const at = ids(after?.itemTypes)
  const bl = ids(before?.linkTypes)
  const al = ids(after?.linkTypes)
  const change: SchemaChange = {
    fieldsAdded: added(bf, af),
    fieldsRemoved: added(af, bf),
    typesAdded: added(bt, at),
    typesRemoved: added(at, bt),
    linkTypesAdded: added(bl, al),
    linkTypesRemoved: added(al, bl),
    otherChanges: false
  }
  const structural = Object.values(change).some((v) => Array.isArray(v) && v.length > 0)
  change.otherChanges = !structural && JSON.stringify(before) !== JSON.stringify(after)
  return change
}

export function createCompare(git: GitAdapter) {
  async function label(s: Session, ref: string): Promise<VersionLabel> {
    if (ref === WORKING) return { ref, label: 'Your working folder (everything saved on this PC)' }
    const c = await git.commitInfo(s.repo.root, ref)
    if (!c) return { ref, label: ref.slice(0, 7) }
    return { ref, label: `${ref.slice(0, 7)} ${c.message} (${c.author}, ${c.date.slice(0, 16).replace('T', ' ')})` }
  }

  return {
    async options(s: Session): Promise<CompareOptions> {
      const root = s.repo.root
      const [reflog, commits, refs, head, status] = await Promise.all([
        git.reflog(root),
        git.commits(root, reqPath(s.repo), 100).catch(() => []),
        git.refs(root).catch(() => []),
        git.head(root),
        git.status(root, reqPath(s.repo)).catch(() => null)
      ])
      let lastPull: CompareOptions['lastPull'] = null
      const i = reflog.findIndex((e) => PULL_STEP.test(e.subject))
      const before = i >= 0 ? reflog[i + 1] : undefined
      if (i >= 0 && before) lastPull = { from: before.hash, to: (reflog[i] as { hash: string }).hash, date: (reflog[i] as { date: string }).date }
      return {
        lastPull,
        hasUncommitted: (status?.changes.length ?? 0) > 0,
        commits: commits.map((c) => ({ hash: c.hash, author: c.author, email: c.email, date: c.date, message: c.message })),
        refs,
        head
      }
    },

    async compare(s: Session, fromRef: string, toRef: string): Promise<CompareResult> {
      const started = performance.now()
      const root = s.repo.root
      const base = reqPath(s.repo)
      const from = await git.resolve(root, fromRef)
      if (!from) throw new Error(`"${fromRef}" is not a commit, branch or tag of this repository.`)
      const toWorking = toRef === WORKING
      const to = toWorking ? null : await git.resolve(root, toRef)
      if (!toWorking && !to) throw new Error(`"${toRef}" is not a commit, branch or tag of this repository.`)

      const changes: NameStatus[] = from === to ? [] : await git.diffNameStatus(root, from, to, base)
      const schemaPath = `${base === '.' ? '' : `${base}/`}.reqman/schema.yaml`
      const blobs = await git.readBlobs(root, changes.flatMap((c) => [c.oldOid, c.newOid].filter((o): o is string => o !== null)))
      // working folder side: files without a blob ID are read from disk
      const fromDisk = toWorking ? await readWorking(root, changes.filter((c) => c.status !== 'D' && !c.newOid).map((c) => c.path)) : new Map<string, string | null>()
      const beforeText = (c: NameStatus): string | null => (c.oldOid ? (blobs.get(c.oldOid) ?? null) : null)
      const afterText = (c: NameStatus): string | null => (c.status === 'D' ? null : c.newOid ? (blobs.get(c.newOid) ?? null) : (fromDisk.get(c.path) ?? null))

      const fieldIds = new Set(s.repo.schema.fields.map((f) => f.id))
      type Side = { item: Item | null; error?: string }
      const parse = (text: string | null | undefined): Side => {
        if (text === null || text === undefined) return { item: null }
        const r = parseItemFile(text, fieldIds)
        return r.ok ? { item: r.item } : { item: null, error: r.error }
      }
      // Pair versions by item ID (a file renamed by hand keeps its ID)
      const pairs = new Map<string, { before: Side; after: Side; path: string }>()
      const otherFiles: string[] = []
      let schema: SchemaChange | null = null
      for (const c of changes) {
        const oldPath = c.from ?? c.path
        if (c.path === schemaPath || oldPath === schemaPath) {
          const b = beforeText(c)
          const a = afterText(c)
          schema = schemaChange(b ? parseSchema(b).schema : null, a ? parseSchema(a).schema : null)
          continue
        }
        if (!ITEM_FILE.test(c.path) && !ITEM_FILE.test(oldPath)) {
          otherFiles.push(c.path)
          continue
        }
        // Fast path: only link confirmations or line endings differ → nothing a reader would call a change
        if (c.status === 'M' && sameIgnoringConfirmations(beforeText(c), afterText(c))) continue
        const before = c.status === 'A' ? { item: null } : parse(beforeText(c))
        const after = c.status === 'D' ? { item: null } : parse(afterText(c))
        const id = after.item?.id ?? before.item?.id ?? ITEM_FILE.exec(c.path)?.[1] ?? c.path
        const known = pairs.get(id)
        if (known) {
          // the same item deleted in one file and added in another
          if (!known.before.item && before.item) known.before = before
          if (!known.after.item && after.item) known.after = after
        } else pairs.set(id, { before, after, path: c.path })
      }

      const entries: CompareEntry[] = []
      const links: LinkChange[] = []
      for (const [id, p] of pairs) {
        const diff = diffItems(p.before.item, p.after.item, s.repo.schema)
        const unreadable = p.before.error ?? p.after.error
        const nothing = diff.rows.length === 0 && !diff.text && diff.linksAdded.length === 0 && diff.linksRemoved.length === 0
        if (nothing && !unreadable) continue // e.g. only a link re-confirmed, or line endings
        const onlyPosition = diff.kind === 'modified' && !diff.text && diff.linksAdded.length + diff.linksRemoved.length === 0 && diff.rows.every((r) => r.key === 'parent' || r.key === 'order')
        const b = p.before.item
        const a = p.after.item
        const shown = a ?? b
        entries.push({
          id,
          title: shown?.title ?? '',
          type: shown?.type ?? '',
          kind: diff.kind === 'unchanged' ? 'modified' : onlyPosition ? 'moved' : diff.kind,
          summary: unreadable && nothing ? 'Could not be read' : diff.kind === 'added' ? 'New item' : diff.kind === 'deleted' ? 'Deleted' : summarize(diff),
          diff,
          contentChanged: !b || !a || contentFingerprint(b) !== contentFingerprint(a),
          incoming: s.index.get(id)?.incomingCount ?? 0,
          ...(unreadable ? { unreadable } : {})
        })
        for (const l of diff.linksAdded) links.push({ source: id, type: l.type, target: l.target, change: 'added' })
        for (const l of diff.linksRemoved) links.push({ source: id, type: l.type, target: l.target, change: 'removed' })
      }
      entries.sort((x, y) => x.id.localeCompare(y.id))
      links.sort((x, y) => x.source.localeCompare(y.source) || x.target.localeCompare(y.target))

      return {
        from: await label(s, from),
        to: await label(s, to ?? WORKING),
        entries,
        links,
        schema,
        otherFiles,
        durationMs: Math.round(performance.now() - started)
      }
    }
  }
}

const CONFIRMED_LINE = /^[ \t]+confirmed:[^\n]*\n?/gm
function sameIgnoringConfirmations(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false
  const norm = (t: string): string => t.replace(/\r\n/g, '\n').replace(CONFIRMED_LINE, '')
  return norm(a) === norm(b)
}

async function readWorking(root: string, paths: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(32, paths.length) }, async () => {
      while (next < paths.length) {
        const p = paths[next++] as string
        out.set(p, await readFile(join(root, p), 'utf8').catch(() => null))
      }
    })
  )
  return out
}
