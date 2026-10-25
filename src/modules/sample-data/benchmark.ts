import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSqliteIndexCache } from '../index-cache'
import type { RepositoryStore } from '../repository-store'
import { generateItems } from './generate'

export interface BenchmarkResult {
  items: number
  writeMs: number
  firstIndexMs: number
  /** Re-sync with nothing changed (what happens every time a repository is reopened). */
  resyncMs: number
  /** Slowest of a set of typical table queries (filter, search, sort, page). */
  slowestQueryMs: number
  queries: { name: string; ms: number; total: number }[]
}

const time = async <T>(fn: () => Promise<T> | T): Promise<[T, number]> => {
  const t = performance.now()
  const r = await fn()
  return [r, Math.round((performance.now() - t) * 10) / 10]
}

/**
 * Creates a temporary requirements repository with `count` generated items, indexes it and runs typical
 * queries. Used by the performance tests and by the in-app self-test ("Run data self-test").
 */
export async function runDataBenchmark(store: RepositoryStore, count: number): Promise<BenchmarkResult> {
  const root = await mkdtemp(join(tmpdir(), 'reqman-bench-'))
  try {
    const repo = await store.initialize(root)
    const items = generateItems(repo.schema, { count, seed: 42 })
    const [, writeMs] = await time(async () => {
      let next = 0
      await Promise.all(
        Array.from({ length: 32 }, async () => {
          while (next < items.length) {
            const item = items[next++]
            if (item) await repo.writeItem(item)
          }
        })
      )
    })
    const cache = createSqliteIndexCache(join(root, 'cache.sqlite'))
    try {
      const [, firstIndexMs] = await time(() => cache.sync(repo))
      const [, resyncMs] = await time(() => cache.sync(repo))
      const someParent = items.find((i) => i.type === 'system-requirement')?.id ?? ''
      const cases: [string, Parameters<typeof cache.query>[0]][] = [
        ['all, sorted by ID, first page', { limit: 100 }],
        ['type filter', { types: ['software-requirement'], limit: 100 }],
        ['status + priority filter', { fields: { status: ['Approved'], priority: ['High'] }, limit: 100 }],
        ['tag filter (list field)', { fields: { tags: ['safety'] }, limit: 100 }],
        ['text search', { text: 'temperature sensor', limit: 100 }],
        ['sort by title, page 50', { sort: { by: 'title' }, limit: 100, offset: 5000 }],
        ['sort by status descending', { sort: { by: 'field:status', descending: true }, limit: 100 }],
        ['children of one item', { parent: someParent, sort: { by: 'order' } }]
      ]
      const queries: BenchmarkResult['queries'] = []
      for (const [name, q] of cases) {
        cache.query(q) // warm-up
        const [r, ms] = await time(() => cache.query(q))
        queries.push({ name, ms, total: r.total })
      }
      return {
        items: count,
        writeMs,
        firstIndexMs,
        resyncMs,
        slowestQueryMs: Math.max(...queries.map((q) => q.ms)),
        queries
      }
    } finally {
      cache.close()
    }
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {})
  }
}
