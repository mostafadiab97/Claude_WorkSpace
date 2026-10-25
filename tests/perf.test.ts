// Performance checks against NFR-03: smooth up to 10,000 items, usable to about 50,000.
// The 1,000-item case runs with every test run; 10,000 and 50,000 run with `npm run test:perf`
// (and in the Windows build), because they take a minute.
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { runDataBenchmark } from '../src/modules/sample-data'

const store = createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml'))
const PERF = process.env['PERF'] === '1'

/** Limits are generous (slow CI disks, virus scanners); typical values are 5–20× lower. */
const LIMITS = {
  1_000: { firstIndexMs: 15_000, resyncMs: 2_000, queryMs: 100 },
  10_000: { firstIndexMs: 60_000, resyncMs: 5_000, queryMs: 150 },
  50_000: { firstIndexMs: 240_000, resyncMs: 20_000, queryMs: 300 }
} as const

describe('data layer performance', () => {
  for (const count of [1_000, 10_000, 50_000] as const) {
    const run = count === 1_000 || PERF ? it : it.skip
    run(`${count.toLocaleString('en')} items: indexing and typical queries stay within limits`, { timeout: 600_000 }, async () => {
      const r = await runDataBenchmark(store, count)
      console.log(
        `[perf] ${count} items — write ${r.writeMs} ms, first index ${r.firstIndexMs} ms, re-open ${r.resyncMs} ms, ` +
          `slowest query ${r.slowestQueryMs} ms\n` +
          r.queries.map((q) => `        ${q.name}: ${q.ms} ms (${q.total} matches)`).join('\n')
      )
      expect(r.queries.find((q) => q.name.startsWith('all'))?.total).toBe(count)
      expect(r.firstIndexMs).toBeLessThan(LIMITS[count].firstIndexMs)
      expect(r.resyncMs).toBeLessThan(LIMITS[count].resyncMs)
      expect(r.slowestQueryMs).toBeLessThan(LIMITS[count].queryMs)
    })
  }
})
