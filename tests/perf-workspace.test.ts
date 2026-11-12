// 0.21.0 speed (review 2026-11-10 W-20…W-23, W-27): the user actions that were slow at 50,000 items, measured
// through the workspace service. 1,000 items with every test run (correctness of the timing code); 10,000 with
// `npm run test:perf` (every build) and the release run; 50,000 with PERF=all PERF_WS50=1 (by hand).
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { generateItems } from '../src/modules/sample-data'
import { cacheFileName, createWorkspace } from '../src/modules/workspace'

const PERF = process.env['PERF'] === '1' || process.env['PERF'] === 'all'
// 50,000 only on request (PERF_WS50=1): building and committing 50,000 files took over 15 min on the Windows release
// runner (0.21.1); the data-layer test still covers 50,000 there
const PERF_ALL = process.env['PERF_WS50'] === '1'
const schemaFile = join(__dirname, '..', 'config', 'default-schema.yaml')
const quiet = { info: () => undefined, warn: () => undefined, error: () => undefined }

/** Generous limits (slow CI disks); the targets are about 1 s at 50,000 items. */
const LIMITS = {
  1_000: { compareMs: 3_000, saveMs: 1_000, sortMs: 500, versionMs: 5_000, pauseMs: 1_500 },
  10_000: { compareMs: 3_000, saveMs: 500, sortMs: 500, versionMs: 8_000, pauseMs: 1_500 },
  50_000: { compareMs: 6_000, saveMs: 1_500, sortMs: 1_500, versionMs: 25_000, pauseMs: 2_000 }
} as const

const time = async <T>(f: () => Promise<T> | T): Promise<[T, number]> => {
  const t = performance.now()
  const r = await f()
  return [r, Math.round(performance.now() - t)]
}

describe('workspace speed', () => {
  for (const count of [1_000, 10_000, 50_000] as const) {
    const run = count === 1_000 || (PERF && (count < 50_000 || PERF_ALL)) ? it : it.skip
    run(`${count.toLocaleString('en')} items: compare, save, sort by number, old version`, { timeout: 900_000 }, async () => {
      const base = await mkdtemp(join(tmpdir(), 'rq-perfws-'))
      try {
        const root = join(base, 'repo')
        const store = createFileRepositoryStore(schemaFile)
        const repo = await store.initialize(root)
        for (const item of generateItems(repo.schema, { count })) await repo.writeItem(item)
        const sh = (...a: string[]): string => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
        sh('init', '-q', '-b', 'main')
        sh('config', 'user.name', 'Perf')
        sh('config', 'user.email', 'perf@example.invalid')
        sh('add', '-A')
        sh('commit', '-q', '-m', 'all')
        const first = sh('rev-parse', 'HEAD').trim()
        const userDir = join(base, 'user')
        const ws = createWorkspace({
          store,
          git: createSystemGitAdapter(),
          openIndex: (r: string) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(r))),
          userDir,
          log: quiet,
          watchFiles: false
        } as Parameters<typeof createWorkspace>[0])
        await ws.open(root)
        const one = ws.query({ limit: 1, offset: 500 }).items[0]
        if (!one) throw new Error('no item')
        const got = await ws.getItem(one.id)
        if (!got) throw new Error('no item')
        const saves: number[] = []
        let revision = got.revision
        for (let k = 0; k < 5; k++) {
          const [r, ms] = await time(() => ws.saveItem({ ...got.item, title: `${got.item.title} ${k}` }, revision))
          if (!r.ok) throw new Error(r.message)
          revision = r.details.revision
          saves.push(ms)
        }
        const saveMs = saves.sort((a, b) => a - b)[2] as number
        expect((await ws.commit('one change')).ok).toBe(true)
        const [cmp, compareMs] = await time(() => ws.compareVersions(first, 'HEAD'))
        expect(cmp.entries.length).toBe(1)
        expect(cmp.entries[0]?.numberAfter).toBeTruthy()
        const [, sortMs] = await time(() => ws.query({ sort: { by: 'number' }, limit: 100 }))
        // the longest time the process could not answer anything while the old version was built (PW21-02)
        let last = performance.now()
        let longestPause = 0
        const ticker = setInterval(() => {
          const now = performance.now()
          longestPause = Math.max(longestPause, now - last)
          last = now
        }, 20)
        const [v, versionMs] = await time(() => ws.openVersion(first))
        clearInterval(ticker)
        longestPause = Math.round(longestPause)
        expect(v.ok).toBe(true)
        await ws.closeVersion()
        console.log(`[perf-ws] ${count} items — compare 1 change ${compareMs} ms, save ${saveMs} ms (median of 5), sort by number ${sortMs} ms, old version first open ${versionMs} ms (longest pause ${longestPause} ms)`)
        const L = LIMITS[count]
        expect(compareMs).toBeLessThan(L.compareMs)
        expect(saveMs).toBeLessThan(L.saveMs)
        expect(sortMs).toBeLessThan(L.sortMs)
        expect(versionMs).toBeLessThan(L.versionMs)
        expect(longestPause).toBeLessThan(L.pauseMs)
        await ws.close?.()
      } finally {
        await rm(base, { recursive: true, force: true }).catch(() => undefined)
      }
    })
  }
})
