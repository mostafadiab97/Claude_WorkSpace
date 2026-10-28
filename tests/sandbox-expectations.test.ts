// The test-data repository (Claude_SandBox) promises in its README how ReqMan treats each deliberately broken
// file (chapter 9). This test builds the same data with the scenario generator and checks every promise
// (review T-03 — the missing check that let D-01 slip through).
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { createWorkspace, type WorkspaceService } from '../src/modules/workspace'
import type { RepoInfo } from '../src/shared/api'

const tools = join(__dirname, '..', 'tools')
let ws: WorkspaceService
let info: RepoInfo
let root: string

describe('sandbox data: chapter 9 "Deliberately broken data"', { timeout: 180_000 }, () => {
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'reqman-scenario-'))
    // a smaller copy of the sandbox: every chapter, fewer filler items
    execFileSync(process.execPath, [require.resolve('tsx/cli'), join(tools, 'generate-scenario-repo.mts'), root, '3000'], { stdio: 'pipe' })
    const userDir = await mkdtemp(join(tmpdir(), 'reqman-scenario-user-'))
    ws = createWorkspace({
      store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
      git: createSystemGitAdapter(),
      openIndex: () => createSqliteIndexCache(join(userDir, 'index.sqlite')),
      userDir,
      log: { info: () => {}, warn: () => {}, error: () => {} },
      watchFiles: false
    })
    info = await ws.open(root)
  }, 180_000)

  const problem = (re: RegExp) => info.issues.find((i) => re.test(i.message))
  const find = (title: string) => ws.query({ text: title, sort: { by: 'relevance' } }).items.find((i) => i.title === title)

  it('a link to SYS-ZZZZZZ, which does not exist → problem list', () => {
    expect(problem(/link to SYS-ZZZZZZ, which does not exist/)).toBeTruthy()
  })
  it('a parent SYS-YYYYYY that does not exist → problem list, findable by search', () => {
    expect(problem(/Parent SYS-YYYYYY does not exist/)).toBeTruthy()
    expect(find('PROBLEM: parent that does not exist')).toBeTruthy()
  })
  it('SYS-BROKEN.md and SW-BADYML.md → "could not be read"', () => {
    const unreadable = info.issues.filter((i) => i.path === 'file').map((i) => i.itemId)
    expect(unreadable).toEqual(expect.arrayContaining(['items/SYS-BROKEN.md', 'items/SW-BADYML.md']))
  })
  it('status "Done" → message when opened; saving refused until fixed', async () => {
    const hit = find('PROBLEM: status value not in the schema')
    const d = await ws.getItem(hit!.id)
    expect(d?.issues.some((i) => i.path === 'fields.status')).toBe(true)
    expect(await ws.saveItem(d!.item, d!.revision)).toMatchObject({ ok: false, reason: 'invalid' })
  })
  it('unknown link type "blocks" → message when opened', async () => {
    const d = await ws.getItem(find('PROBLEM: unknown link type')!.id)
    expect(d?.issues.some((i) => /Unknown link type "blocks"/.test(i.message))).toBe(true)
  })
  it('a test case with an SW- ID → warning when opened', async () => {
    const d = await ws.getItem(find('PROBLEM: ID prefix does not match the type')!.id)
    expect(d?.issues.some((i) => i.severity === 'warning' && i.path === 'id')).toBe(true)
  })
  it('RSK-RENAMD.md → opens normally, listed with "Fix file name"', async () => {
    const renamed = info.issues.find((i) => i.fix === 'file-name')
    expect(renamed).toBeTruthy()
    const d = await ws.getItem(renamed!.itemId)
    expect(d?.item.type).toBe('risk')
  })
  it('unknown header keys are kept after editing and saving', async () => {
    const hit = find('NOTE: header key unknown to ReqMan (kept, not a problem)')
    const d = await ws.getItem(hit!.id)
    const r = await ws.saveItem({ ...d!.item, text: `${d!.item.text} Edited.` }, d!.revision)
    expect(r.ok).toBe(true)
    const file = await readFile(join(root, 'requirements', 'items', `${hit!.id}.md`), 'utf8')
    expect(file).toContain('x-imported-from: DOORS')
    expect(file).toContain('x-legacy-id: REQ-00421')
  })
  it('suspect links exist for testing', () => {
    expect(ws.query({ links: 'suspect', limit: 0 }).total).toBeGreaterThan(0)
  })
})
