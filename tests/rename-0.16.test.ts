// 0.16 rename to reqochet: projects still under ReqMan's folder name (requirements/.reqman) keep working, and the
// window offers to rename the folder as one commit (owner, 31 Oct / 4 Nov 2026).
import { execFileSync } from 'node:child_process'
import { mkdtemp, readdir, rename } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createWorkspace } from '../src/modules/workspace'
import { guessMapping } from '../src/modules/import-export'
import { parseSchema } from '../src/modules/schema'
import { readFileSync } from 'node:fs'

const store = createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml'))
const git = createSystemGitAdapter()
const sh = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' })
const quietLog = { info: () => {}, warn: () => {}, error: () => {} }

async function legacyProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'rq-legacy-'))
  sh(root, 'init', '-q', '-b', 'main')
  sh(root, 'config', 'user.name', 'T')
  sh(root, 'config', 'user.email', 't@example.com')
  await store.initialize(root)
  await rename(join(root, 'requirements', '.reqochet'), join(root, 'requirements', '.reqman'))
  sh(root, 'add', '-A')
  sh(root, 'commit', '-qm', 'made with ReqMan')
  return root
}

describe('project folder name', () => {
  it('new projects get requirements/.reqochet', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rq-new-'))
    const repo = await store.initialize(root)
    expect(repo.metaDir).toBe('.reqochet')
    expect(await readdir(join(root, 'requirements'))).toContain('.reqochet')
  })

  it('a project made with ReqMan opens as before and is offered the rename', async () => {
    const root = await legacyProject()
    expect(await store.inspect(root)).toBe('ready')
    const repo = await store.open(root)
    expect(repo.metaDir).toBe('.reqman')
    expect(repo.schema.itemTypes.length).toBeGreaterThan(0)
    await expect(store.initialize(root)).rejects.toThrow(/already has a requirements folder/)
  })

  it('"Update this project" renames the folder in one commit; Git sees a rename; nothing else is committed', async () => {
    const root = await legacyProject()
    const userDir = await mkdtemp(join(tmpdir(), 'rq-user-'))
    const ws = createWorkspace({ store, git, openIndex: () => createSqliteIndexCache(join(userDir, 'i.sqlite')), userDir, log: quietLog, watchFiles: false })
    const info = await ws.open(root)
    expect(info.legacyFolder).toBe(true)
    // an unrelated uncommitted change must stay uncommitted
    const id = (await ws.newItem('system-requirement')).id
    expect(id).toBeTruthy()
    const r = await ws.renameProjectFolder()
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.info.legacyFolder).toBeUndefined()
    expect(await readdir(join(root, 'requirements'))).toEqual(expect.arrayContaining(['.reqochet']))
    expect(await readdir(join(root, 'requirements'))).not.toContain('.reqman')
    expect(sh(root, 'log', '-1', '--format=%s').trim()).toBe('Rename the project folder .reqman to .reqochet (reqochet)')
    expect(sh(root, 'show', '--stat', '-M', '--format=', 'HEAD')).toMatch(/\.reqman.*=>.*\.reqochet|\{\.reqman => \.reqochet\}/)
    // a second click has nothing to do
    expect((await ws.renameProjectFolder()).ok).toBe(true)
    await ws.close()
  })
})

describe('our own ReqIF exports, before and after the rename', () => {
  const schema = parseSchema(readFileSync(join(__dirname, '..', 'config', 'default-schema.yaml'), 'utf8')).schema
  it('reads "reqochet.Type / .Markdown" and the old "ReqMan.Type / .Markdown" the same way', () => {
    for (const p of ['reqochet', 'ReqMan']) {
      const headers = ['ReqIF.ForeignID', 'ReqIF.Name', 'ReqIF.Text', `${p}.Type`, `${p}.Number`, `${p}.Markdown`]
      const m = guessMapping(headers, schema)
      expect(m[headers.indexOf(`${p}.Type`)]).toBe('type')
      expect(m[headers.indexOf(`${p}.Markdown`)]).toBe('text')
      expect(m[headers.indexOf('ReqIF.Text')]).toBe('ignore')
    }
  })
})
