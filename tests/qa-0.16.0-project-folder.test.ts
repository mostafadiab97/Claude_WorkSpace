// QA 0.16.0 (helper agent, docs/AGENT-WORKFLOW.md): tries to break the project folder rename requirements/.reqman →
// .reqochet (repository store + workspace "Update this project"). A failing test shows a product bug — see
// docs/reviews/agents/0.16.0-qa.md.
import { execFileSync } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createWorkspace } from '../src/modules/workspace'

const store = createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml'))
const git = createSystemGitAdapter()
const sh = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' })
const quietLog = { info: () => {}, warn: () => {}, error: () => {} }

async function gitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'qa016-proj-'))
  sh(root, 'init', '-q', '-b', 'main')
  sh(root, 'config', 'user.name', 'T')
  sh(root, 'config', 'user.email', 't@example.com')
  return root
}

/** A project made with ReqMan (requirements/.reqman), committed unless `commit` is false. */
async function legacyProject(opts: { git?: boolean; commit?: boolean } = {}): Promise<string> {
  const root = opts.git === false ? await mkdtemp(join(tmpdir(), 'qa016-plain-')) : await gitRepo()
  await store.initialize(root)
  await rename(join(root, 'requirements', '.reqochet'), join(root, 'requirements', '.reqman'))
  if (opts.git !== false && opts.commit !== false) {
    sh(root, 'add', '-A')
    sh(root, 'commit', '-qm', 'made with ReqMan')
  }
  return root
}

async function workspace(watchFiles = false) {
  const userDir = await mkdtemp(join(tmpdir(), 'qa016-user-'))
  return createWorkspace({ store, git, openIndex: () => createSqliteIndexCache(join(userDir, 'i.sqlite')), userDir, log: quietLog, watchFiles })
}

const status = (root: string): string[] => sh(root, 'status', '--porcelain', '-uall').split('\n').filter(Boolean)

describe('QA project folder — which folder is used', () => {
  it('both folders with a schema: the new one wins, no rename offered', async () => {
    const root = await legacyProject()
    await mkdir(join(root, 'requirements', '.reqochet'))
    await writeFile(join(root, 'requirements', '.reqochet', 'schema.yaml'), await readFile(join(root, 'requirements', '.reqman', 'schema.yaml'), 'utf8'))
    const repo = await store.open(root)
    expect(repo.metaDir).toBe('.reqochet')
    const ws = await workspace()
    expect((await ws.open(root)).legacyFolder).toBeUndefined()
    await ws.close()
  })

  it('only .reqman without schema.yaml: not a project (set up offered), no crash', async () => {
    const root = await gitRepo()
    await mkdir(join(root, 'requirements', '.reqman'), { recursive: true })
    expect(await store.inspect(root)).toBe('not-initialized')
    await expect(store.open(root)).rejects.toThrow(/No requirements folder/)
  })

  it('QA-04: an empty .reqochet folder beside a working .reqman: the offered rename can never succeed', async () => {
    // e.g. a half-finished manual rename, or a colleague's tool created the folder: the notice shows (legacyFolder)
    // but "Update this project" always answers "Both … exist; keep one." — the user is stuck with the notice.
    const root = await legacyProject()
    await mkdir(join(root, 'requirements', '.reqochet'))
    const ws = await workspace()
    const info = await ws.open(root)
    expect(info.legacyFolder).toBe(true)
    const r = await ws.renameProjectFolder()
    expect(r.ok, r.ok ? '' : r.message).toBe(true)
    await ws.close()
  })
})

describe('QA project folder — "Update this project"', () => {
  it('an unrelated uncommitted item stays uncommitted; only the rename is in the commit', async () => {
    const root = await legacyProject()
    const ws = await workspace()
    await ws.open(root)
    const draft = await ws.newItem('system-requirement')
    const saved = await ws.saveItem({ ...draft, title: 'Uncommitted work' }, null)
    expect(saved.ok).toBe(true)
    const r = await ws.renameProjectFolder()
    expect(r.ok).toBe(true)
    const committed = sh(root, 'show', '--name-only', '--format=', 'HEAD').split('\n').filter(Boolean)
    expect(committed.every((p) => p.startsWith('requirements/.reqman/') || p.startsWith('requirements/.reqochet/'))).toBe(true)
    expect(status(root).some((l) => l.includes(`items/${draft.id}.md`))).toBe(true)
    await ws.close()
  })

  it('QA-05: an uncommitted schema edit is not swept into the rename commit', async () => {
    const root = await legacyProject()
    const schemaFile = join(root, 'requirements', '.reqman', 'schema.yaml')
    await writeFile(schemaFile, `${await readFile(schemaFile, 'utf8')}\n# my uncommitted note\n`)
    const ws = await workspace()
    await ws.open(root)
    const r = await ws.renameProjectFolder()
    // builder (0.16): the rename is refused until the edit is committed or discarded, so the commit can hold only the
    // rename; the edit stays where it was for review
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/not committed yet/)
    expect(await readFile(schemaFile, 'utf8')).toContain('my uncommitted note')
    expect(sh(root, 'log', '-1', '--format=%s')).not.toContain('Rename the project folder')
    await ws.close()
  })

  it('a staged change elsewhere stays staged and out of the rename commit', async () => {
    const root = await legacyProject()
    await writeFile(join(root, 'README.md'), 'hello')
    sh(root, 'add', 'README.md')
    const ws = await workspace()
    await ws.open(root)
    expect((await ws.renameProjectFolder()).ok).toBe(true)
    expect(sh(root, 'show', '--name-only', '--format=', 'HEAD')).not.toContain('README.md')
    expect(status(root)).toContain('A  README.md')
    await ws.close()
  })

  it('QA-06: a project folder never committed (.reqman untracked) — the rename works and the window is not left half-renamed', async () => {
    const root = await legacyProject({ commit: false })
    const ws = await workspace()
    expect((await ws.open(root)).legacyFolder).toBe(true)
    const r = await ws.renameProjectFolder()
    // whatever the answer, the workspace must match the disk afterwards
    const onDisk = await readdir(join(root, 'requirements'))
    const info = await ws.refresh()
    if (onDisk.includes('.reqochet')) expect(info.legacyFolder, 'renamed on disk, but the window still offers the rename').toBeUndefined()
    expect(r.ok, r.ok ? '' : r.message).toBe(true)
    // the schema can still be edited after the rename
    const fields = info.schema.fields
    const saved = await ws.saveSchemaFields(fields, info.schemaRevision)
    expect(saved.ok, saved.ok ? '' : saved.message).toBe(true)
    await ws.close()
  })

  it('QA-07: a commit hook that refuses the rename leaves the project usable (folder and window agree)', async () => {
    const root = await legacyProject()
    const hook = join(root, '.git', 'hooks', 'pre-commit')
    await writeFile(hook, '#!/bin/sh\necho "policy: no commits today" >&2\nexit 1\n')
    await chmod(hook, 0o755)
    const ws = await workspace()
    await ws.open(root)
    const r = await ws.renameProjectFolder()
    expect(r.ok).toBe(false) // refused: fine, it must say so …
    const onDisk = await readdir(join(root, 'requirements'))
    // … and then either the folder is back to .reqman, or the window works with .reqochet
    const info = await ws.refresh()
    const consistent = onDisk.includes('.reqman') ? info.legacyFolder === true : info.legacyFolder === undefined
    expect(consistent, `disk: ${onDisk.join(',')} · window legacyFolder=${String(info.legacyFolder)}`).toBe(true)
    const saved = await ws.saveSchemaFields(info.schema.fields, info.schemaRevision)
    expect(saved.ok, saved.ok ? '' : saved.message).toBe(true)
    await ws.close()
  })

  it('not a Git repository: the folder is renamed, nothing else happens', async () => {
    const root = await legacyProject({ git: false })
    const ws = await workspace()
    expect((await ws.open(root)).legacyFolder).toBe(true)
    const r = await ws.renameProjectFolder()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.info.legacyFolder).toBeUndefined()
    expect(await readdir(join(root, 'requirements'))).toContain('.reqochet')
    await ws.close()
  })

  it('rename, close, reopen, rename again: nothing to do, no second commit', async () => {
    const root = await legacyProject()
    let ws = await workspace()
    await ws.open(root)
    expect((await ws.renameProjectFolder()).ok).toBe(true)
    await ws.close()
    const commits = sh(root, 'rev-list', '--count', 'HEAD').trim()
    ws = await workspace()
    const info = await ws.open(root)
    expect(info.legacyFolder).toBeUndefined()
    expect((await ws.renameProjectFolder()).ok).toBe(true)
    expect(sh(root, 'rev-list', '--count', 'HEAD').trim()).toBe(commits)
    expect(status(root)).toEqual([])
    await ws.close()
  })

  it('QA-08: comparing across the rename commit does not report a schema change that did not happen', async () => {
    const root = await legacyProject()
    const ws = await workspace()
    await ws.open(root)
    expect((await ws.renameProjectFolder()).ok).toBe(true)
    const cmp = await ws.compareVersions('HEAD~1', 'HEAD')
    const s = cmp.schema
    const changed = s !== null && (s.otherChanges || [s.fieldsAdded, s.fieldsRemoved, s.typesAdded, s.typesRemoved, s.linkTypesAdded, s.linkTypesRemoved].some((x) => x.length > 0))
    // the Changes view shows the "Schema changed" chip whenever `schema` is not null
    expect(s === null || changed, `schema=${JSON.stringify(s)}`).toBe(true)
    expect(cmp.entries).toEqual([])
    await ws.close()
  })

  it('the folder watcher follows the rename: a schema edit in .reqochet is picked up', async () => {
    const root = await legacyProject()
    const ws = await workspace(true)
    await ws.open(root)
    expect((await ws.renameProjectFolder()).ok).toBe(true)
    const file = join(root, 'requirements', '.reqochet', 'schema.yaml')
    const text = await readFile(file, 'utf8')
    await writeFile(file, text.replace(/^fields:\n/m, 'fields:\n  - id: qa-extra\n    name: QA extra\n    type: text\n'))
    await new Promise((r) => setTimeout(r, 300))
    const info = await ws.refresh(true)
    expect(info.schema.fields.map((f) => f.id)).toContain('qa-extra')
    await ws.close()
  })
})
