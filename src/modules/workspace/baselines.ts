// Baselines and the history list (1a part 2 — the owner's decisions S-06 a, S-08 a, S-09 a, 5 Nov 2026).
// A baseline is an annotated Git tag refs/tags/baseline/<name> with a note; it goes to the remote with the next
// Push. The history list shows the current branch's commits; an old commit can be looked at read-only, compared with
// now, made a baseline or used as the start of a new branch — never "stood on" (Git's detached HEAD is never used).
import type { Baseline, CreateBaselineRequest, GitResult, HistoryPage, Snapshot, SnapshotItem } from '../../shared/api'
import { documentOfPath } from '../../shared/domain'
import type { GitAdapter } from '../git-adapter'
import { parseItemFile } from '../items'
import type { Logger } from '../logger'
import type { createGitOps, GitSession } from './gitOps'
import { explainGitError, reqPath } from './gitOps'
import { outlineNumbers } from './structure'
import { T } from '../../shared/text'

const HISTORY_PAGE = 100
const COMMIT = /^[0-9a-f]{7,40}$/i

export function createBaselineOps(deps: { git: GitAdapter; log: Pick<Logger, 'info' | 'warn' | 'error'>; gitOps: ReturnType<typeof createGitOps> }) {
  const { git, log, gitOps } = deps
  const { precheck, fail, done } = gitOps.internal

  return {
    async list(s: GitSession): Promise<Baseline[]> {
      const [tags, pending] = await Promise.all([git.baselines(s.repo.root), git.pendingBaselines(s.repo.root).catch(() => [] as string[])])
      return tags.map((t) => ({ ...t, pending: pending.includes(t.name) }))
    },

    async create(s: GitSession, req: CreateBaselineRequest): Promise<GitResult & { baseline?: Baseline; needs?: 'uncommitted-decision' }> {
      const blocked = await precheck(s)
      if (blocked) return blocked
      const name = req.name.trim()
      if (!name || !(await git.checkBaselineName(s.repo.root, name))) return fail(s, T.baselines.badName)
      if ((await git.baselines(s.repo.root)).some((b) => b.name === name)) return fail(s, T.baselines.exists(name))
      const st = await gitOps.state(s)
      if (!st.identity.name || !st.identity.email) return fail(s, T.gitMsg.needIdentity)
      let commit = req.commit
      if (commit !== undefined && !COMMIT.test(commit)) return fail(s, T.baselines.badCommit)
      if (commit === undefined) {
        // the latest commit; uncommitted changes are committed first or left out — the user says which (S-08 a)
        if (st.changes.length > 0 && req.uncommitted === undefined) return { ...(await fail(s, T.baselines.uncommittedAsk(st.changes.length))), needs: 'uncommitted-decision' }
        if (st.changes.length > 0 && req.uncommitted === 'commit') {
          const c = await gitOps.commit(s, req.commitMessage?.trim() || T.baselines.commitMessage(name))
          if (!c.ok) return c
        }
        commit = (await git.head(s.repo.root)) ?? undefined
        if (!commit) return fail(s, T.gitMsg.nothingToPushYet, undefined, true)
      }
      try {
        await git.createBaseline(s.repo.root, name, commit, req.note.trim())
        const pending = await git.pendingBaselines(s.repo.root).catch(() => [] as string[])
        await git.setPendingBaselines(s.repo.root, [...pending.filter((p) => p !== name), name])
        gitOps.invalidate() // the Git bar shows the waiting baseline on Push
        log.info(`Baseline ${name} at ${commit.slice(0, 7)}`)
        const baseline = (await this.list(s)).find((b) => b.name === name)
        return { ...(await done(s, T.baselines.made(name, st.hasRemote))), ...(baseline ? { baseline } : {}) }
      } catch (e) {
        log.error('Baseline failed', e)
        return fail(s, explainGitError(e))
      }
    },

    async history(s: GitSession, req: { search?: string; skip?: number }): Promise<HistoryPage> {
      const r = await git.history(s.repo.root, reqPath(s.repo), { limit: HISTORY_PAGE, skip: Math.max(0, req.skip ?? 0), ...(req.search ? { search: req.search } : {}) })
      return { commits: r.commits.map(({ hash, author, email, date, message }) => ({ hash, author, email, date, message })), more: r.more }
    },

    /** Every item of an older version, read from Git without touching the working folder. */
    async snapshot(s: GitSession, ref: string): Promise<Snapshot> {
      const root = s.repo.root
      const base = reqPath(s.repo)
      const prefix = base === '.' ? '' : `${base}/`
      const all = await git.treeBlobs(root, ref, base === '.' ? '.' : base)
      const files = [...all].filter(([p]) => {
        const rest = p.slice(prefix.length)
        return rest.endsWith('.md') && !rest.startsWith('.') && rest.split('/').length <= 2 && rest.toLowerCase() !== 'readme.md'
      })
      const blobs = await git.readBlobs(root, [...new Set(files.map(([, oid]) => oid))])
      const fieldIds = new Set(s.repo.schema.fields.map((f) => f.id))
      const items: SnapshotItem[] = []
      for (const [path, oid] of files) {
        const text = blobs.get(oid)
        if (!text) continue
        const r = parseItemFile(text, fieldIds)
        if (!r.ok) continue
        const it = r.item
        items.push({
          id: it.id,
          title: it.title,
          type: it.type,
          document: documentOfPath(path.slice(prefix.length)),
          ...(it.parent ? { parent: it.parent } : {}),
          text: it.text,
          fields: it.fields,
          links: it.links.map((l) => ({ type: l.type, target: l.target })),
          ...(it.order !== undefined ? { order: it.order } : {})
        } as SnapshotItem & { order?: string })
      }
      // outline numbers as in that version (siblings by order key, then ID — like the index)
      const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
      const ordered = [...items].sort((a, b) => cmp((a as { order?: string }).order ?? '￿', (b as { order?: string }).order ?? '￿') || cmp(a.id, b.id))
      const numbers = outlineNumbers(ordered.map((i) => ({ id: i.id, document: i.document, ...(i.parent ? { parent: i.parent } : {}) })))
      for (const i of items) {
        const n = numbers.get(i.id)
        if (n) i.number = n
        delete (i as { order?: string }).order
      }
      const info = await git.commitInfo(root, ref)
      return { ref, label: info ? `${ref.slice(0, 7)} ${info.message}` : ref.slice(0, 7), items }
    },

    async branchAt(s: GitSession, name: string, commit: string): Promise<GitResult> {
      const blocked = await precheck(s)
      if (blocked) return blocked
      const n = name.trim()
      if (!COMMIT.test(commit)) return fail(s, T.baselines.badCommit)
      if (!n || !(await git.checkBranchName(s.repo.root, n))) return fail(s, T.merge.badName(n))
      try {
        await git.createBranchAt(s.repo.root, n, commit)
        log.info(`Branch ${n} at ${commit.slice(0, 7)}`)
        return done(s, T.baselines.branchMade(n))
      } catch (e) {
        return fail(s, explainGitError(e))
      }
    }
  }
}
