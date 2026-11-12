// 0.21.2 — fixes from whole-project review 2 (docs/reviews/2026-11-12-project-review-2.md).
import { execFileSync } from 'node:child_process'
import { copyFile, mkdtemp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { cacheFileName, createWorkspace, type WorkspaceService } from '../src/modules/workspace'
import { parseCsv } from '../src/modules/import-export'
import { parseItemFile, serializeItem } from '../src/modules/items'

const quiet = { info: () => undefined, warn: () => undefined, error: () => undefined }

async function setup(): Promise<{ ws: WorkspaceService; root: string }> {
  const base = await mkdtemp(join(tmpdir(), 'rq-r2-'))
  const root = join(base, 'work')
  execFileSync('git', ['init', '-q', '-b', 'main', root])
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: root })
  execFileSync('git', ['config', 'user.email', 't@example.invalid'], { cwd: root })
  const userDir = await mkdtemp(join(tmpdir(), 'rq-r2-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: (r: string) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(r))),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
  await ws.createProject(root)
  return { ws, root }
}

describe('0.21.2 review 2 fixes', () => {
  it('B-02: an ID in two files can be neither saved nor deleted until the copy gets a new ID', async () => {
    const { ws, root } = await setup()
    const first = (await ws.repoInfo())?.defaultDocument ?? ''
    const r = await ws.saveItem({ id: 'REQ-AAAAAAA', type: 'system-requirement', title: 'original', fields: {}, text: '', links: [], extra: {}, document: first } as Parameters<WorkspaceService['saveItem']>[0], null)
    expect(r.ok, r.ok ? '' : r.message).toBe(true)
    await ws.createDocument('Zeta')
    const from = join(root, 'requirements', first, 'REQ-AAAAAAA.md')
    await copyFile(from, join(root, 'requirements', 'Zeta', 'REQ-AAAAAAA.md'))
    await ws.refresh(true)
    const got = await ws.getItem('REQ-AAAAAAA')
    if (!got) throw new Error('no item')
    const del = await ws.deleteItem('REQ-AAAAAAA', got.revision)
    expect(del.ok).toBe(false)
    expect(del.ok ? '' : del.message).toMatch(/2 files/)
    expect(existsSync(from)).toBe(true) // the original is still there
    const save = await ws.saveItem({ ...got.item, title: 'changed' }, got.revision)
    expect(save.ok).toBe(false)
  })

  it('CR-1/CR-2 (0.21.2 review): a row with a space before its quote stays a row; many short quoted rows stay fast', () => {
    expect(parseCsv('a,b,c,d\n1,"x"\n2, "y",3,4\n')).toEqual([['a', 'b', 'c', 'd'], ['1', 'x'], ['2', ' "y"', '3', '4']])
    const many = 'a,b,c,d\n' + '1,"x"\n'.repeat(100_000)
    const t = Date.now()
    expect(parseCsv(many).length).toBe(100_001)
    expect(Date.now() - t).toBeLessThan(5_000)
  })

  it('O-6: Merge into… moves a document into the other one; identical copies go, differing ones stay', async () => {
    const { ws, root } = await setup()
    await ws.createDocument('Brakes')
    await ws.createDocument('Brake System')
    const mk = async (id: string, title: string): Promise<void> => {
      const r = await ws.saveItem({ id, type: 'system-requirement', title, fields: {}, text: '', links: [], extra: {}, document: 'Brakes' } as Parameters<WorkspaceService['saveItem']>[0], null)
      expect(r.ok, r.ok ? '' : r.message).toBe(true)
    }
    await mk('REQ-AAAAAAA', 'same')
    await mk('REQ-BBBBBBB', 'edited later')
    await mk('REQ-CCCCCCC', 'only here')
    // the other PC's name: copies of two items, one of them edited
    for (const id of ['REQ-AAAAAAA', 'REQ-BBBBBBB']) await copyFile(join(root, 'requirements', 'Brakes', `${id}.md`), join(root, 'requirements', 'Brake System', `${id}.md`))
    const { writeFile, readFile } = await import('node:fs/promises')
    const f = join(root, 'requirements', 'Brake System', 'REQ-BBBBBBB.md')
    await writeFile(f, (await readFile(f, 'utf8')).replace('edited later', 'edited on PC B'))
    await ws.refresh(true)
    const r = await ws.mergeDocument('Brakes', 'Brake System')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.differing).toEqual(['REQ-BBBBBBB'])
    expect(existsSync(join(root, 'requirements', 'Brakes', 'REQ-AAAAAAA.md'))).toBe(false) // identical: removed
    expect(existsSync(join(root, 'requirements', 'Brakes', 'REQ-BBBBBBB.md'))).toBe(true) // differs: stays
    expect(existsSync(join(root, 'requirements', 'Brake System', 'REQ-CCCCCCC.md'))).toBe(true) // moved
  })

  it('A-20/A-21: a list as title and a huge order number are kept as they were, never lost or crashing', () => {
    const text = '---\nid: REQ-AAAAAAA\ntype: x\ntitle:\n  - a\n  - b\norder: 1e60\n---\nT\n'
    const r = parseItemFile(text, new Set())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.item.title).toBe('')
    expect(r.item.order).toBeUndefined()
    const back = serializeItem(r.item, { fields: [] })
    expect(back).toContain('title:\n  - a\n  - b')
    expect(back).toMatch(/order: 1e\+?60/)
  })
})
