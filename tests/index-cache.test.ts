import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createSqliteIndexCache, preview, type IndexCache } from '../src/modules/index-cache'
import { createFileRepositoryStore, type RequirementsRepo } from '../src/modules/repository-store'
import type { Item } from '../src/modules/items'

const store = createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml'))

async function setup(): Promise<{ repo: RequirementsRepo; cache: IndexCache; items: Record<string, Item> }> {
  const root = await mkdtemp(join(tmpdir(), 'reqman-idx-'))
  const repo = await store.initialize(root)
  const taken = new Set<string>()
  const make = (type: string, title: string, extra: Partial<Item> = {}): Item => {
    const it = { ...repo.createItem(type, taken, { title }), ...extra }
    taken.add(it.id)
    return it
  }
  const stk = make('stakeholder-need', 'Comfortable temperature', { text: 'Users want a stable room temperature.' })
  const sys = make('system-requirement', 'Temperature accuracy', {
    parent: stk.id,
    order: 10,
    text: 'The thermostat shall measure temperature within ±0.5 °C.',
    fields: { status: 'Approved', priority: 'High', owner: 'A. Hassan', tags: ['safety', 'performance'] }
  })
  const sys2 = make('system-requirement', 'Braking response', {
    parent: stk.id,
    order: 20,
    text: 'Schedules shall apply within 2 seconds.',
    fields: { status: 'Draft', priority: 'Low', tags: ['ux'] }
  })
  const tc = make('test-case', 'Verify accuracy', { links: [{ type: 'verifies', target: sys.id }] })
  sys.links = [{ type: 'refines', target: stk.id }]
  for (const i of [stk, sys, sys2, tc]) await repo.writeItem(i)
  const cache = createSqliteIndexCache(join(root, '..', `${root.split(/[\\/]/).pop()}.sqlite`))
  return { repo, cache, items: { stk, sys, sys2, tc } }
}

describe('index cache', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeAll(async () => {
    ctx = await setup()
    const stats = await ctx.cache.sync(ctx.repo)
    expect(stats).toMatchObject({ files: 4, added: 4, updated: 0, removed: 0, unreadable: 0, full: true })
  })

  it('returns full items by ID', () => {
    const expected: Partial<Item> = { ...ctx.items.sys! }
    delete expected.extra
    expect(ctx.cache.get(ctx.items.sys!.id)).toEqual({ ...expected, path: `items/${ctx.items.sys!.id}.md`, childCount: 0, incomingCount: 1, suspectCount: 0 })
  })

  it('finds words in title and text, with prefix matching and without accents', () => {
    const ids = (text: string): string[] => ctx.cache.query({ text }).items.map((i) => i.id)
    expect(ids('accur')).toEqual([ctx.items.sys!.id, ctx.items.tc!.id].sort())
    expect(ids('thermostat temperature')).toEqual([ctx.items.sys!.id])
    expect(ids('nothing-like-this')).toEqual([])
    expect(ids('"; DROP TABLE items; --')).toEqual([])
  })

  it('finds items by part of their ID', () => {
    const id = ctx.items.tc!.id
    expect(ctx.cache.query({ text: id.slice(3).toLowerCase() }).items.map((i) => i.id)).toContain(id)
  })

  it('filters by type and field values, including list fields', () => {
    expect(ctx.cache.query({ types: ['system-requirement'] }).total).toBe(2)
    expect(ctx.cache.query({ fields: { status: ['Approved'] } }).items.map((i) => i.id)).toEqual([ctx.items.sys!.id])
    expect(ctx.cache.query({ fields: { tags: ['ux', 'performance'] } }).total).toBe(2)
    expect(ctx.cache.query({ types: ['system-requirement'], fields: { priority: ['High'] } }).total).toBe(1)
  })

  it('lists children in order and top-level items', () => {
    expect(ctx.cache.query({ parent: ctx.items.stk!.id, sort: { by: 'order' } }).items.map((i) => i.id)).toEqual([
      ctx.items.sys!.id,
      ctx.items.sys2!.id
    ])
    expect(ctx.cache.query({ parent: null }).total).toBe(2)
  })

  it('sorts by title and by a field, both directions, with paging', () => {
    const titles = ctx.cache.query({ sort: { by: 'title' } }).items.map((i) => i.title)
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)))
    const desc = ctx.cache.query({ sort: { by: 'field:priority', descending: true }, limit: 1 })
    expect(desc.total).toBe(4)
    expect(desc.items).toHaveLength(1)
    expect(desc.items[0]?.fields.priority).toBe('Low')
  })

  it('answers reverse links ("verified by")', () => {
    expect(ctx.cache.incomingLinks(ctx.items.sys!.id)).toEqual([{ id: ctx.items.tc!.id, type: 'verifies', suspect: false }])
    expect(ctx.cache.incomingLinks(ctx.items.stk!.id)).toEqual([{ id: ctx.items.sys!.id, type: 'refines', suspect: false }])
  })

  it('re-reads only changed, new and removed files', async () => {
    const { repo, cache, items } = ctx
    expect(await cache.sync(repo)).toMatchObject({ added: 0, updated: 0, removed: 0, full: false })

    await repo.writeItem({ ...items.sys2!, title: 'Schedule response' })
    const file = join(repo.folder, 'items', `${items.sys2!.id}.md`)
    const future = new Date(Date.now() + 5000)
    await utimes(file, future, future) // make sure the change is visible even on coarse file clocks
    await repo.deleteItem(items.tc!.id)
    await writeFile(join(repo.folder, 'items', 'RSK-BROKEN.md'), 'not an item')

    expect(await cache.sync(repo)).toMatchObject({ added: 1, updated: 1, removed: 1, unreadable: 1, full: false })
    expect(cache.get(items.sys2!.id)?.title).toBe('Schedule response')
    expect(cache.get(items.tc!.id)).toBeUndefined()
    expect(cache.incomingLinks(items.sys!.id)).toEqual([])
    expect(cache.query({ text: 'braking' }).total).toBe(0)
    expect(cache.count()).toBe(3)
  })

  it('rebuilds from scratch on request and survives the cache file being deleted', async () => {
    const stats = await ctx.cache.rebuild(ctx.repo)
    expect(stats.full).toBe(true)
    expect(ctx.cache.count()).toBe(3)

    const root = await mkdtemp(join(tmpdir(), 'reqman-idx-del-'))
    const dbFile = join(root, 'cache', 'x.sqlite')
    const c1 = createSqliteIndexCache(dbFile)
    await c1.sync(ctx.repo)
    c1.close()
    await rm(join(root, 'cache'), { recursive: true, force: true })
    const c2 = createSqliteIndexCache(dbFile)
    expect(await c2.sync(ctx.repo)).toMatchObject({ full: true, added: 4, unreadable: 1 })
    expect(c2.count()).toBe(3)
    c2.close()
  })
  it('rebuilds a cache file written by an older version with a different table layout', async () => {
    const { DatabaseSync } = await import('node:sqlite')
    const dir = await mkdtemp(join(tmpdir(), 'reqman-oldcache-'))
    const file = join(dir, 'old.sqlite')
    // the v0.3.0 layout: no fingerprint column, no link confirmations
    const old = new DatabaseSync(file)
    old.exec(`CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE items (rid INTEGER PRIMARY KEY, path TEXT NOT NULL UNIQUE, id TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL,
        parent TEXT, ord REAL, text TEXT NOT NULL, fields_json TEXT NOT NULL, links_json TEXT NOT NULL);
      CREATE TABLE links (rid INTEGER NOT NULL, source TEXT NOT NULL, type TEXT NOT NULL, target TEXT NOT NULL);
      INSERT INTO meta VALUES ('signature', 'old');`)
    old.close()
    const cache = createSqliteIndexCache(file)
    const stats = await cache.sync(ctx.repo)
    expect(stats.full).toBe(true)
    expect(cache.get(ctx.items.sys!.id)?.suspectCount).toBe(0)
    expect(cache.query({ links: 'suspect' }).total).toBe(0)
    cache.close()
    await rm(dir, { recursive: true, force: true })
  })
})

describe('relevance ranking', () => {
  it('puts an exact ID first and title matches before text matches', async () => {
    const root = await mkdtemp(join(tmpdir(), 'reqman-rel-'))
    const repo = await store.initialize(root)
    const taken = new Set<string>()
    const make = async (type: string, title: string, text: string): Promise<Item> => {
      const it = { ...repo.createItem(type, taken, { title }), text }
      taken.add(it.id)
      await repo.writeItem(it)
      return it
    }
    // many items mention "heating" only in their text…
    for (let i = 0; i < 30; i++) await make('software-requirement', `Regulation ${i}`, 'The heating control loop shall run every 100 ms. Heating heating.')
    const chapter = await make('information', '1. Heating Control', 'Chapter.')
    const cache = createSqliteIndexCache(join(root, 'c.sqlite'))
    await cache.sync(repo)
    const top = cache.query({ text: 'heating control', sort: { by: 'relevance' }, limit: 3 }).items
    expect(top[0]?.id).toBe(chapter.id)
    const byId = cache.query({ text: chapter.id, sort: { by: 'relevance' }, limit: 1 }).items
    expect(byId[0]?.id).toBe(chapter.id)
    cache.close()
  })
  it('makes a plain-text preview of Markdown text', () => {
    expect(preview('# Heading\n\n- one **bold**\n- two\n\n```\ncode\n```\n| a | b |')).toBe('Heading one bold two a b')
    expect(preview('x'.repeat(500))).toHaveLength(200)
  })
})
