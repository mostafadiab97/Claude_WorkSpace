// An old version shown in the table itself (the owner's decision D-19b, 8 Nov 2026): every item file of a commit is
// read from Git (nothing in the working folder changes) into a temporary index of its own, and a read-only "session"
// on that index answers the table's questions — tree, filters, columns, search — like the real one. Writes and Git
// actions are refused while it is shown (workspace.ts); "Back to now" closes it and deletes the temporary index.
import { rm } from 'node:fs/promises'
import type { GitAdapter } from '../git-adapter'
import type { IndexCache } from '../index-cache'
import { parseItemFile } from '../items'
import type { RequirementsRepo } from '../repository-store'
import type { Session } from './context'
import { reqPath } from './gitOps'
import { T } from '../../shared/text'

/** An item is text; a huge file is not parsed (SEC-18-09, as the read-only window of 0.18.0). */
const MAX_BLOB = 5_000_000
const ALL_KEYS: ReadonlySet<string> = { has: () => true } as unknown as ReadonlySet<string>

export interface VersionView {
  ref: string
  label: string
  session: Session
  /** The temporary index file (deleted on close). */
  file: string
}

/** The key under which the temporary index is kept: the project folder and the commit (never a real folder). */
export const versionKey = (root: string, commit: string): string => `${root}\u0000version\u0000${commit}`

export async function openVersion(deps: {
  git: GitAdapter
  s: Session
  ref: string
  openIndex: (key: string) => IndexCache
  indexFile: (key: string) => string
}): Promise<VersionView> {
  const { git, s } = deps
  const root = s.repo.root
  const commit = await git.resolve(root, `${deps.ref}^{commit}`)
  if (!commit) throw new Error(T.baselines.badCommit)
  const base = reqPath(s.repo)
  const prefix = base === '.' ? '' : `${base}/`
  // the item files of that commit: <document>/<ID>.md or loose <ID>.md, never the project folder or a README
  const files = new Map<string, string>()
  for (const [p, oid] of await git.treeBlobs(root, commit, base === '.' ? '.' : base)) {
    const rest = p.slice(prefix.length)
    if (rest.endsWith('.md') && !rest.startsWith('.') && rest.split('/').length <= 2 && rest.toLowerCase() !== 'readme.md') files.set(rest, oid)
  }
  const blobs = await git.readBlobs(root, [...new Set(files.values())])
  const textOf = (path: string): string | null => {
    const oid = files.get(path)
    const t = oid ? blobs.get(oid) : undefined
    return t === undefined ? null : t
  }
  const key = versionKey(root, commit)
  const index = deps.openIndex(key)
  const fieldIds = new Set(s.repo.schema.fields.map((f) => f.id))
  const refuse = (): never => {
    throw new Error(T.version.readOnly)
  }
  // only what the index and the read calls use; anything that would write is refused
  const repo = {
    root: key,
    folder: s.repo.folder,
    metaDir: s.repo.metaDir,
    schema: s.repo.schema,
    schemaProblems: [],
    schemaRevision: '',
    defaultDocument: s.repo.defaultDocument,
    listItemFiles: async () => [...files.keys()].map((path) => ({ path, mtimeMs: 0, size: 0 })),
    listDocuments: async () => [...new Set([...files.keys()].filter((p) => p.includes('/')).map((p) => p.slice(0, p.indexOf('/'))))].sort(),
    async readItemFile(path: string, opts?: { allKeysAsFields?: boolean }) {
      const text = textOf(path)
      if (text === null) return { ok: false as const, error: T.version.notInVersion }
      if (text.length > MAX_BLOB) return { ok: false as const, error: T.version.tooLarge }
      return parseItemFile(text, opts?.allKeysAsFields ? ALL_KEYS : fieldIds)
    },
    async readItem(id: string) {
      const path = index.get(id)?.path
      const text = path ? textOf(path) : null
      if (path === undefined || text === null || text.length > MAX_BLOB) return null
      return { ...parseItemFile(text, fieldIds), revision: `version:${commit}` }
    },
    itemPath: (id: string) => index.get(id)?.path ?? `${s.repo.defaultDocument}/${id}.md`,
    defaultItemPath: (id: string, document?: string) => `${document ?? s.repo.defaultDocument}/${id}.md`,
    writeSchemaFields: refuse,
    writeSchemaTypes: refuse,
    fixFileName: refuse
  } as unknown as RequirementsRepo
  const stats = await index.sync(repo)
  const info = await git.commitInfo(root, commit)
  return {
    ref: commit,
    label: info ? `${commit.slice(0, 7)} ${info.message}` : commit.slice(0, 7),
    file: deps.indexFile(key),
    session: { repo, index, isGit: true, lastSync: { durationMs: stats.durationMs, full: true, changedFiles: stats.added }, watch: null }
  }
}

export async function closeVersion(v: VersionView): Promise<void> {
  v.session.index.close()
  for (const suffix of ['', '-wal', '-shm']) await rm(`${v.file}${suffix}`, { force: true }).catch(() => undefined)
}
