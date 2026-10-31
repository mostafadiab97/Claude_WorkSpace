// Pull, pull from another branch, and branches (M8). Rules decided with the product owner (29 Oct 2026):
//  - Items both sides changed are combined field by field (3-way: base / mine / theirs). Only a part changed
//    differently on both sides — or an item deleted on one side and changed on the other — is a question
//    "mine / theirs / edit". Until every question is answered nothing changes (M8-3, M8-7).
//  - "Pull from branch" brings any visible branch, local or on the remote, into the current one (M8-6).
//  - An item created on both sides with the same ID (review D-09) is repaired automatically: this branch's item
//    gets a new ID and the links/parents this branch added to it follow (O-02).
//  - Merging branches into each other on GitHub stays on GitHub (pull requests, code owners — M8-2); ReqMan only
//    shows what a branch would bring in (branchRange → the Changes view).
//  - Switching branches with uncommitted changes: commit first (the window), discard, or take them along when
//    the other branch has the same version of every changed file (M8-1).
// How a merge is made: `git merge-tree` computes Git's merge in memory; the decided files replace the clashing
// ones in a temporary index; `commit-tree` makes the merge commit; the working folder then fast-forwards to it.
// Nothing touches the working folder until that last step, and Git refuses it if it would overwrite
// uncommitted changes — so a pull either completes or leaves everything as it was (NFR-05).
import type { BranchInfo, GitResult, GitState, ItemChange, MergeAnswers, MergePart, MergePlan, MergeQuestion } from '../../shared/api'
import type { Item } from '../../shared/domain'
import { T } from '../../shared/text'
import { GitError, parseOverwrittenFiles, type GitAdapter } from '../git-adapter'
import { generateId, mergeItems, parseItemFile, renameReferences, sameItem, serializeItem } from '../items'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { Logger } from '../logger'
import { explainGitError, ID_FROM_PATH, reqPath, type createGitOps, type GitSession } from './gitOps'

export interface MergingDeps {
  git: GitAdapter
  log: Pick<Logger, 'info' | 'warn' | 'error'>
  resync(): Promise<void>
  ops: ReturnType<typeof createGitOps>
}

type Resolved = { path: string; content: string | null }

/** One file both sides changed in ways Git could not combine, as ReqMan sees it. */
type Entry =
  | { kind: 'combined'; path: string; content: string | null; change: ItemChange }
  | { kind: 'question'; path: string; question: MergeQuestion; resolve: (answers: Record<string, MergeAnswers[string][string]>) => Resolved[] | null }
  | { kind: 'duplicate'; path: string; id: string; theirs: string; mine: Item; change: ItemChange }

type Analysis =
  | { kind: 'upToDate' }
  | { kind: 'fastForward'; incoming: number }
  | { kind: 'merge'; base: string | null; tree: string; incoming: number; entries: Entry[] }

export function createMerging(deps: MergingDeps) {
  const { git, log, ops } = deps
  const { precheck, fail, done, toChange, remoteBranch } = ops.internal

  const countItems = (files: string[]): number => files.filter((f) => ID_FROM_PATH.test(f)).length

  /** What to pull from: this branch's remote branch, or the named branch (fetched first when it is a remote one). */
  async function sourceRef(s: GitSession, source: string | undefined, st: GitState): Promise<{ ref: string } | GitResult> {
    const root = s.repo.root
    if (source === undefined) {
      if (!st.hasRemote) return fail(s, T.gitMsg.noRemotePull)
      try {
        await git.fetch(root)
      } catch (e) {
        log.warn(`Fetch failed: ${String(e)}`)
        return fail(s, explainGitError(e))
      }
      const { ref } = await remoteBranch(s, await ops.state(s))
      if (!ref) return done(s, T.gitMsg.branchNotOnRemote(st.branch ?? ''))
      return { ref }
    }
    const refs = await git.refs(root)
    const found = refs.find((r) => r.name === source && r.kind !== 'tag')
    if (!found) return fail(s, T.merge.noSuchBranch(source))
    if (found.kind === 'branch' && found.name === st.branch) return fail(s, T.merge.sameBranch)
    if (found.kind === 'remote') {
      try {
        await git.fetch(root)
      } catch (e) {
        log.warn(`Fetch failed: ${String(e)}`)
        return fail(s, explainGitError(e))
      }
      if (!(await git.refExists(root, source))) return fail(s, T.merge.noSuchBranch(source))
    }
    return { ref: source }
  }

  /** Works out the merge of `theirs` into `head` without changing anything. */
  async function analyse(s: GitSession, head: string, theirs: string): Promise<Analysis | { kind: 'outside'; files: string[] }> {
    const root = s.repo.root
    const base = reqPath(s.repo)
    if (await git.isAncestor(root, theirs, head)) return { kind: 'upToDate' }
    if (await git.isAncestor(root, head, theirs)) {
      return { kind: 'fastForward', incoming: countItems(await git.changedFiles(root, head, theirs, base)) }
    }
    const mergeBase = await git.mergeBase(root, head, theirs)
    const check = await git.checkMerge(root, theirs, head)
    const incoming = countItems(await git.changedFiles(root, mergeBase ?? head, theirs, base).catch(() => []))
    const inFolder = (p: string): boolean => base === '.' || p.startsWith(`${base}/`)
    const outside = check.conflicts.filter((p) => !inFolder(p))
    if (outside.length > 0) return { kind: 'outside', files: outside }
    const paths = check.conflicts
    if (paths.length === 0) return { kind: 'merge', base: mergeBase, tree: check.tree, incoming, entries: [] }

    // the three versions of every clashing file, through one `cat-file` process
    const [baseIds, mineIds, theirIds] = await Promise.all([
      mergeBase ? git.blobIds(root, mergeBase, paths) : Promise.resolve(new Map<string, string>()),
      git.blobIds(root, head, paths),
      git.blobIds(root, theirs, paths)
    ])
    const blobs = await git.readBlobs(root, [...new Set([...baseIds.values(), ...mineIds.values(), ...theirIds.values()])])
    const text = (ids: Map<string, string>, p: string): string | null => {
      const oid = ids.get(p)
      return oid ? (blobs.get(oid) ?? null) : null
    }
    const schema = s.repo.schema
    const fieldIds = new Set(schema.fields.map((f) => f.id))
    const parse = (t: string | null): { item: Item | null; ok: boolean } => {
      if (t === null) return { item: null, ok: true }
      const r = parseItemFile(t, fieldIds)
      return r.ok ? { item: r.item, ok: true } : { item: null, ok: false }
    }
    const entries: Entry[] = []
    for (const path of paths) {
      const [bt, mt, tt] = [text(baseIds, path), text(mineIds, path), text(theirIds, path)]
      const [b, m, t] = [parse(bt), parse(mt), parse(tt)]
      const change = toChange(s, { path, kind: 'conflict' })
      const label = change.label
      const id = ID_FROM_PATH.exec(path)?.[1]
      if (id && b.ok && m.ok && t.ok) {
        if (bt === null && m.item && t.item && !sameItem(m.item, t.item) && tt !== null) {
          entries.push({ kind: 'duplicate', path, id, theirs: tt, mine: m.item, change: { ...change, label: `${id} ${m.item.title}`, title: m.item.title } })
          continue
        }
        const first = mergeItems(b.item, m.item, t.item, schema)
        const title = (m.item ?? t.item ?? b.item)?.title
        const named = title !== undefined ? { ...change, title, label: `${id} ${title}` } : change
        if (first.conflicts.length === 0) {
          entries.push({ kind: 'combined', path, content: first.item ? serializeItem(first.item, schema) : null, change: named })
          continue
        }
        entries.push({
          kind: 'question',
          path,
          question: { path, id, label: named.label, parts: first.conflicts },
          resolve: (answers) => {
            if (first.conflicts.some((c) => answers[c.key] === undefined)) return null
            const r = mergeItems(b.item, m.item, t.item, schema, answers)
            return [{ path, content: r.item ? serializeItem(r.item, schema) : null }]
          }
        })
        continue
      }
      // not an item (schema, settings) or a file ReqMan cannot read: the whole file, mine or theirs
      const part: MergePart = { key: 'file', label: T.merge.file, base: '', mine: mt === null ? T.merge.deleted : T.merge.fileMine, theirs: tt === null ? T.merge.deleted : T.merge.fileTheirs, editable: false }
      entries.push({
        kind: 'question',
        path,
        question: { path, ...(id ? { id } : {}), label, parts: [part] },
        resolve: (answers) => {
          const c = answers['file']
          if (c !== 'mine' && c !== 'theirs') return null
          return [{ path, content: c === 'mine' ? mt : tt }]
        }
      })
    }
    return { kind: 'merge', base: mergeBase, tree: check.tree, incoming, entries }
  }

  /** Uncommitted changes the pull would overwrite (Git refuses at the end anyway; this says it up front). */
  async function overwritten(s: GitSession, st: GitState, from: string, theirs: string): Promise<ItemChange[]> {
    if (st.changes.length === 0) return []
    const coming = new Set(await git.changedFiles(s.repo.root, from, theirs, reqPath(s.repo)).catch(() => []))
    return st.changes.filter((c) => coming.has(c.path))
  }

  async function plan(s: GitSession, source: string | undefined): Promise<GitResult | { plan: MergePlan; analysis: Analysis }> {
    const blocked = await precheck(s)
    if (blocked) return blocked
    const root = s.repo.root
    const st = await ops.state(s)
    const src = await sourceRef(s, source, st)
    if ('state' in src) return src
    const head = await git.head(root)
    const theirs = await git.resolve(root, src.ref)
    if (!theirs) return fail(s, T.merge.noSuchBranch(src.ref))
    if (!head) {
      // nothing committed here yet: simply take theirs
      return { plan: { source: src.ref, head: '', theirs, incoming: 0, combined: [], questions: [], duplicates: [], uncommitted: false }, analysis: { kind: 'fastForward', incoming: 0 } }
    }
    const a = await analyse(s, head, theirs)
    if (a.kind === 'outside') return fail(s, T.merge.outside(a.files.join(', ')))
    if (a.kind === 'upToDate') return done(s, source === undefined ? T.gitMsg.upToDate : T.merge.nothingToPull(src.ref))
    const clash = await overwritten(s, await ops.state(s), a.kind === 'merge' ? (a.base ?? head) : head, theirs)
    if (clash.length > 0) return fail(s, T.gitMsg.wouldOverwrite, clash)
    const entries = a.kind === 'merge' ? a.entries : []
    // Pull from another branch (owner, 31 Oct 2026): its changes arrive as uncommitted changes to review, keep or
    // discard. A pull of this branch's own remote branch still commits (otherwise the next push would be refused).
    const upstream = source === undefined ? null : (await remoteBranch(s, st)).ref
    const uncommitted = source !== undefined && src.ref !== upstream
    return {
      plan: {
        uncommitted,
        source: src.ref,
        head,
        theirs,
        incoming: a.incoming,
        combined: entries.flatMap((e) => (e.kind === 'combined' ? [e.change] : [])),
        questions: entries.flatMap((e) => (e.kind === 'question' ? [e.question] : [])),
        duplicates: entries.flatMap((e) => (e.kind === 'duplicate' ? [e.change] : []))
      },
      analysis: a
    }
  }

  async function finish(s: GitSession, p: MergePlan, a: Analysis, answers: MergeAnswers): Promise<GitResult> {
    const root = s.repo.root
    const st = await ops.state(s)
    const action = `pull ${p.source}` // Git's reflog names the step, so "what the last pull brought in" finds it (D-05)
    let decided = 0
    let repaired = ''
    try {
      if (a.kind === 'upToDate') return done(s, T.gitMsg.upToDate)
      if (a.kind === 'fastForward') {
        if (p.uncommitted) {
          const r = await bringIn(s, p.theirs)
          if (typeof r !== 'number') return r
          if (r === 0) return done(s, T.merge.nothingToPull(p.source))
        } else await git.merge(root, p.theirs, true, action)
      } else {
        const files: Resolved[] = []
        for (const e of a.entries) {
          if (e.kind === 'combined') files.push({ path: e.path, content: e.content })
          else if (e.kind === 'question') {
            const r = e.resolve(answers[e.path] ?? {})
            if (!r) return { ok: false, message: T.merge.unanswered, plan: p, state: await ops.state(s) }
            files.push(...r)
            decided++
          }
        }
        const dups = a.entries.filter((e): e is Extract<Entry, { kind: 'duplicate' }> => e.kind === 'duplicate')
        if (dups.length > 0) {
          const extra = await repairDuplicates(s, p, a, dups, files)
          files.push(...extra.files)
          repaired = extra.message
        }
        const commit = await git.commitTree(root, a.tree, files, [p.head, p.theirs], T.merge.mergeMessage(p.source, st.branch ?? 'HEAD'))
        if (p.uncommitted) {
          const r = await bringIn(s, commit)
          if (typeof r !== 'number') return r
          if (r === 0) return done(s, T.merge.nothingToPull(p.source))
        } else await git.merge(root, commit, true, action)
      }
    } catch (e) {
      const over = e instanceof GitError ? parseOverwrittenFiles(e.stderr) : []
      if (over.length > 0) return fail(s, T.gitMsg.wouldOverwrite, over.map((x) => toChange(s, { path: x, kind: 'modified' })))
      log.error('Pull failed', e)
      return fail(s, explainGitError(e))
    }
    await deps.resync()
    const combined = a.kind === 'merge' ? a.entries.filter((e) => e.kind === 'combined').length : 0
    log.info(`Pulled ${p.source}${p.uncommitted ? ' (as uncommitted changes)' : ''}: ${a.kind === 'merge' ? a.incoming : 0} item(s), ${combined} combined, ${decided} decided`)
    return done(s, (p.uncommitted ? T.merge.broughtIn(p.source, a.incoming, combined, decided) : T.merge.pulled(a.incoming, combined, decided)) + repaired)
  }

  /**
   * Writes the files of `commit` that differ from HEAD (under the requirements folder) into the working folder,
   * without committing: they show up as uncommitted changes. Refuses — before touching anything — when one of
   * those files has uncommitted changes of its own.
   */
  async function bringIn(s: GitSession, commit: string): Promise<GitResult | number> {
    const root = s.repo.root
    const base = reqPath(s.repo)
    const diff = await git.diffNameStatus(root, 'HEAD', commit, base)
    const touched = new Set(diff.flatMap((d) => (d.from ? [d.path, d.from] : [d.path])))
    const dirty = (await ops.state(s)).changes.filter((c) => touched.has(c.path))
    if (dirty.length > 0) return fail(s, T.gitMsg.wouldOverwrite, dirty)
    const restore = diff.filter((d) => d.status !== 'D').map((d) => d.path)
    const remove = [...diff.filter((d) => d.status === 'D').map((d) => d.path), ...diff.flatMap((d) => (d.status === 'R' && d.from ? [d.from] : []))]
    if (restore.length > 0) await git.restoreFrom(root, commit, restore)
    for (const r of remove) await rm(join(root, r), { force: true })
    return diff.length
  }

  /**
   * D-09: the same ID was created on both sides for different items. Theirs keeps the ID (it may be shared
   * already); mine gets a new one, and every reference this branch added to the old ID moves to the new one.
   */
  async function repairDuplicates(s: GitSession, p: MergePlan, a: Extract<Analysis, { kind: 'merge' }>, dups: Extract<Entry, { kind: 'duplicate' }>[], decided: Resolved[]): Promise<{ files: Resolved[]; message: string }> {
    const root = s.repo.root
    const schema = s.repo.schema
    const fieldIds = new Set(schema.fields.map((f) => f.id))
    const base = reqPath(s.repo)
    const prefix = base === '.' ? '' : `${base}/`
    const files = new Map<string, string | null>(decided.map((f) => [f.path, f.content]))
    const out = new Map<string, string | null>()
    const renames = new Map<string, string>()
    const taken = new Set<string>()
    for (const d of dups) {
      let newId = ''
      for (let tries = 0; tries < 10 && !newId; tries++) {
        const candidate = generateId((x) => s.index.get(x) !== undefined || taken.has(x))
        const there = await git.blobIds(root, p.theirs, [`${prefix}${s.repo.itemPath(candidate)}`])
        if (there.size === 0) newId = candidate
      }
      taken.add(newId)
      renames.set(d.id, newId)
      out.set(d.path, d.theirs)
      out.set(`${prefix}${s.repo.itemPath(newId)}`, serializeItem({ ...d.mine, id: newId }, schema))
    }
    // items this branch added or changed since the common ancestor that refer to a renamed ID
    const mine = a.base ? await git.diffNameStatus(root, a.base, p.head, base) : []
    const candidates = mine.filter((c) => c.status !== 'D' && ID_FROM_PATH.test(c.path) && !renames.has(ID_FROM_PATH.exec(c.path)?.[1] ?? ''))
    const merged = async (path: string): Promise<string | null> => (out.has(path) ? (out.get(path) ?? null) : files.has(path) ? (files.get(path) ?? null) : git.show(root, a.tree, path))
    const baseBlobs = a.base ? await git.blobIds(root, a.base, candidates.map((c) => c.path)) : new Map<string, string>()
    const readTexts = await git.readBlobs(root, [...new Set([...candidates.map((c) => c.newOid).filter((x): x is string => !!x), ...baseBlobs.values()])])
    for (const c of candidates) {
      const mineText = c.newOid ? readTexts.get(c.newOid) : null
      const baseOid = baseBlobs.get(c.path)
      const baseText = baseOid ? readTexts.get(baseOid) : null
      const mineItem = mineText ? parseItemFile(mineText, fieldIds) : null
      const baseItem = baseText ? parseItemFile(baseText, fieldIds) : null
      if (!mineItem?.ok) continue
      const refs = (i: Item): Set<string> => new Set([...(i.parent ? [i.parent] : []), ...i.links.map((l) => l.target)])
      const before = baseItem?.ok ? refs(baseItem.item) : new Set<string>()
      const now = refs(mineItem.item)
      const moved = [...renames].filter(([oldId]) => now.has(oldId) && !before.has(oldId))
      if (moved.length === 0) continue
      const current = await merged(c.path)
      const parsed = current ? parseItemFile(current, fieldIds) : null
      if (!parsed?.ok) continue
      let item = parsed.item
      for (const [oldId, newId] of moved) item = renameReferences(item, oldId, newId)
      out.set(c.path, serializeItem(item, schema))
    }
    const message = [...renames].map(([oldId, newId]) => T.merge.duplicate(oldId, newId)).join('')
    log.info(`Duplicate IDs repaired: ${[...renames].map(([o, n]) => `${o} → ${n}`).join(', ')}`)
    return { files: [...out].map(([path, content]) => ({ path, content })), message }
  }

  /** A pull (or pull from a branch): finishes at once when nothing needs a decision. */
  async function pull(s: GitSession, source: string | undefined): Promise<GitResult> {
    const r = await plan(s, source)
    if ('state' in r) return r
    if (r.plan.questions.length > 0) {
      return { ok: false, message: T.merge.needsDecision(r.plan.questions.length), plan: r.plan, state: await ops.state(s) }
    }
    return finish(s, r.plan, r.analysis, {})
  }

  return {
    pull: (s: GitSession) => pull(s, undefined),
    pullFrom: (s: GitSession, source: string) => pull(s, source),

    async finishPull(s: GitSession, p: MergePlan, answers: MergeAnswers): Promise<GitResult> {
      const blocked = await precheck(s)
      if (blocked) return blocked
      const head = await git.head(s.repo.root)
      if ((head ?? '') !== p.head) return fail(s, T.merge.moved)
      const a = await analyse(s, p.head, p.theirs)
      if (a.kind === 'outside') return fail(s, T.merge.outside(a.files.join(', ')))
      return finish(s, p, a, answers)
    },

    async listBranches(s: GitSession): Promise<BranchInfo[]> {
      if (!s.isGit) return []
      const st = await ops.state(s)
      const refs = await git.refs(s.repo.root).catch(() => [])
      return refs
        .filter((r) => r.kind !== 'tag')
        .map((r) => ({ name: r.name, kind: r.kind as 'branch' | 'remote', hash: r.hash, current: r.kind === 'branch' && r.name === st.branch }))
        .sort((x, y) => (x.kind === y.kind ? x.name.localeCompare(y.name) : x.kind === 'branch' ? -1 : 1))
    },

    async createBranch(s: GitSession, name: string): Promise<GitResult> {
      const blocked = await precheck(s)
      if (blocked) return blocked
      const root = s.repo.root
      const n = name.trim()
      if (!n || !(await git.checkBranchName(root, n))) return fail(s, T.merge.badName(n))
      if (await git.refExists(root, `refs/heads/${n}`)) return fail(s, T.merge.exists(n))
      try {
        // a new branch from the current commit has the same files, so uncommitted changes always come along
        await git.switchBranch(root, n, { startPoint: 'HEAD', track: false })
      } catch (e) {
        return fail(s, explainGitError(e))
      }
      ops.invalidate()
      log.info(`Created branch ${n}`)
      return done(s, T.merge.created(n))
    },

    async switchBranch(s: GitSession, name: string, changes: 'take' | 'discard'): Promise<GitResult> {
      const blocked = await precheck(s)
      if (blocked) return blocked
      const root = s.repo.root
      const st = await ops.state(s)
      const refs = await git.refs(root)
      const ref = refs.find((r) => r.name === name && r.kind !== 'tag')
      if (!ref) return fail(s, T.merge.noSuchBranch(name))
      // a remote-only branch: switch to the local branch of that name, created to follow it if needed
      const local = ref.kind === 'remote' ? name.slice(name.indexOf('/') + 1) : name
      if (local === st.branch) return fail(s, T.merge.sameBranch)
      const localExists = refs.some((r) => r.kind === 'branch' && r.name === local)
      const target = localExists ? local : name
      if (st.changes.length > 0) {
        const paths = st.changes.map((c) => c.path)
        if (changes === 'discard') {
          try {
            await git.discard(root, paths)
          } catch (e) {
            return fail(s, explainGitError(e))
          }
        } else {
          // safe only when the other branch has the same committed version of every changed file
          const [here, there] = await Promise.all([git.blobIds(root, 'HEAD', paths), git.blobIds(root, localExists ? local : name, paths)])
          const blocking = st.changes.filter((c) => here.get(c.path) !== there.get(c.path))
          if (blocking.length > 0) return fail(s, T.merge.blocking, blocking)
        }
      }
      try {
        if (ref.kind === 'remote' && !localExists) await git.switchBranch(root, local, { startPoint: name, track: true })
        else await git.switchBranch(root, target)
      } catch (e) {
        const over = e instanceof GitError ? parseOverwrittenFiles(e.stderr) : []
        if (over.length > 0) return fail(s, T.merge.blocking, over.map((x) => toChange(s, { path: x, kind: 'modified' })))
        return fail(s, explainGitError(e))
      } finally {
        await deps.resync()
      }
      ops.invalidate()
      log.info(`Switched to ${local}`)
      return done(s, T.merge.switched(local))
    },

    async deleteBranch(s: GitSession, name: string, force: boolean): Promise<GitResult> {
      const blocked = await precheck(s)
      if (blocked) return blocked
      const root = s.repo.root
      const st = await ops.state(s)
      if (name === st.branch) return fail(s, T.merge.deleteCurrent)
      const refs = await git.refs(root)
      if (!refs.some((r) => r.kind === 'branch' && r.name === name) || !(await git.checkBranchName(root, name))) return fail(s, T.merge.noSuchBranch(name))
      try {
        await git.deleteBranch(root, name, force)
      } catch (e) {
        if (!force && e instanceof GitError && /not fully merged/i.test(e.stderr)) {
          // its commits are not in this branch's history — but after "Pull from…" (uncommitted, then committed)
          // their *content* is: merging the branch would change nothing, so nothing can be lost
          const merged = await git.checkMerge(root, name, 'HEAD').catch(() => null)
          const contained = merged?.clean === true && merged.tree === (await git.treeOf(root, 'HEAD'))
          if (!contained) return { ok: false, message: T.merge.unmerged(name), unmerged: true, state: await ops.state(s) }
          try {
            await git.deleteBranch(root, name, true)
          } catch (x) {
            return fail(s, explainGitError(x))
          }
          log.info(`Deleted branch ${name} (its content is already here)`)
          return done(s, T.merge.branchDeleted(name))
        }
        return fail(s, explainGitError(e))
      }
      log.info(`Deleted branch ${name}${force ? ' (unmerged)' : ''}`)
      return done(s, T.merge.branchDeleted(name))
    },

    async branchRange(s: GitSession, name: string): Promise<{ from: string; to: string } | null> {
      if (!s.isGit) return null
      const root = s.repo.root
      const to = await git.resolve(root, name)
      const head = await git.head(root)
      if (!to || !head) return null
      const from = (await git.mergeBase(root, head, to)) ?? null
      return from ? { from, to } : null
    }
  }
}
