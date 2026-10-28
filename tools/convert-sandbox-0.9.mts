// One-time conversion of the test-data repository (Claude_SandBox) to the 0.9.0 data format (owner's decisions
// O-01 – O-03 and S-04, 27–28 Oct 2026). Kept in the repository as the record of what was done.
//   npx tsx tools/convert-sandbox-0.9.mts <sandbox-clone>
//
// Two commits, so Git keeps every item's history:
//   1. rename every item file to its new ID (contents unchanged → Git sees exact renames, however many);
//   2. rewrite the contents: new `id` (old one kept as `former-id`), parents and link targets mapped to the new
//      IDs, positions as short order keys, typed numbers removed from heading titles (outline numbers are
//      calculated now), link confirmations kept valid where they were valid, and the schema's ID prefixes removed.
// Deliberately broken files stay as they are; RSK-RENAMD.md keeps its (deliberately wrong) file name.
import { execFileSync } from 'node:child_process'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { contentFingerprint, generateId, keysBetween, parseItemFile, serializeItem, type Item } from '../src/modules/items/index.ts'
import { parseSchema } from '../src/modules/schema/index.ts'

const root = resolve(process.argv[2] ?? '')
// optional lines appended to both commit messages (e.g. Co-Authored-By)
const TRAILER = process.env['COMMIT_TRAILER'] ? `\n\n${process.env['COMMIT_TRAILER']}` : ''
const git = (...args: string[]): string => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
if (git('status', '--porcelain').trim()) throw new Error('The sandbox clone has uncommitted changes; commit or discard them first.')

const itemsDir = join(root, 'requirements', 'items')
const schemaFile = join(root, 'requirements', '.reqman', 'schema.yaml')
const schemaText = await readFile(schemaFile, 'utf8')
const { schema } = parseSchema(schemaText)
const fieldIds = new Set(schema.fields.map((f) => f.id))
const KEEP_NAME = new Set(['RSK-RENAMD.md'])
// order keys sort character by character (as the index does), never by language rules
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

// ---- read everything
const files = (await readdir(itemsDir)).filter((f) => f.endsWith('.md')).sort()
const items: { file: string; item: Item; raw: string }[] = []
for (const file of files) {
  const raw = await readFile(join(itemsDir, file), 'utf8')
  const r = parseItemFile(raw, fieldIds)
  if (r.ok) items.push({ file, item: r.item, raw })
  else console.log(`unchanged (unreadable on purpose): ${file}`)
}
const byOld = new Map(items.map((x) => [x.item.id, x]))
const fpOld = new Map(items.map((x) => [x.item.id, contentFingerprint(x.item)]))

// ---- new IDs
const taken = new Set<string>()
const newId = new Map<string, string>()
for (const x of items) {
  if (newId.has(x.item.id)) continue // a duplicate ID would map to the same new ID
  const id = generateId((c) => taken.has(c))
  taken.add(id)
  newId.set(x.item.id, id)
}
const mapId = (id: string): string => newId.get(id) ?? id // links to missing items stay as they are

// ---- commit 1: renames only
let renamed = 0
for (const x of items) {
  if (KEEP_NAME.has(x.file)) continue
  const target = `${newId.get(x.item.id)}.md`
  if (target === x.file) continue
  git('mv', join('requirements', 'items', x.file), join('requirements', 'items', target))
  x.file = target
  renamed++
}
git('commit', '-q', '-m', `Convert to ReqMan 0.9.0 (1/2): rename ${renamed} item files to their new REQ- IDs\n\nContents unchanged in this commit, so Git follows every file's history.${TRAILER}`)

// ---- order keys per sibling group, in the old order
const groups = new Map<string, typeof items>()
for (const x of items) {
  const key = x.item.parent ?? ''
  const g = groups.get(key)
  if (g) g.push(x)
  else groups.set(key, [x])
}
const newOrder = new Map<string, string>()
for (const g of groups.values()) {
  g.sort((a, b) => (a.item.order === undefined ? 1 : 0) - (b.item.order === undefined ? 1 : 0) || cmp(a.item.order ?? '', b.item.order ?? '') || (a.item.id < b.item.id ? -1 : 1))
  const keys = keysBetween(null, null, g.length)
  g.forEach((x, k) => newOrder.set(x.item.id, keys[k] as string))
}

// ---- commit 2: contents
const NUMBERED = /^\d+(\.\d+)*\.?\s+/
const converted = new Map<string, Item>()
for (const x of items) {
  const old = x.item
  const title = old.type === 'information' ? old.title.replace(NUMBERED, '') : old.title
  const item: Item = {
    ...old,
    id: mapId(old.id),
    title,
    order: newOrder.get(old.id) as string,
    extra: { ...old.extra, 'former-id': old.id },
    links: old.links.map((l) => ({ ...l, target: mapId(l.target) }))
  }
  if (old.parent) item.parent = mapId(old.parent)
  converted.set(old.id, item)
}
// link confirmations: a link that was confirmed against the target as it was stays confirmed against the target
// as it is now (only heading titles changed); a link that was suspect stays suspect
for (const x of items) {
  const item = converted.get(x.item.id) as Item
  item.links = item.links.map((l, i) => {
    const oldLink = x.item.links[i]
    const oldTarget = oldLink ? byOld.get(oldLink.target) : undefined
    if (!oldLink?.confirmed || !oldTarget) return l
    const wasValid = oldLink.confirmed === fpOld.get(oldTarget.item.id)
    return wasValid ? { ...l, confirmed: contentFingerprint(converted.get(oldTarget.item.id) as Item) } : l
  })
}
for (const x of items) await writeFile(join(itemsDir, x.file), serializeItem(converted.get(x.item.id) as Item, schema), 'utf8')
await writeFile(schemaFile, schemaText.replace(/,\s*prefix:\s*[A-Z0-9]+/g, '').replace(/name: Heading \/ Information\s*,\s*requirement/, 'name: Heading / Information, requirement'), 'utf8')
git('add', '-A', '--', 'requirements')
git(
  'commit',
  '-q',
  '-m',
  `Convert to ReqMan 0.9.0 (2/2): REQ- IDs inside the files, order keys, no typed numbers\n\n- id: REQ- + 7 characters; the old ID is kept as former-id\n- parent and link targets use the new IDs; confirmed links stay confirmed, suspect links stay suspect\n- order: short order keys (a0, a1, …) in the old order\n- typed numbers removed from heading titles (ReqMan calculates outline numbers)\n- schema: ID prefixes removed (IDs no longer depend on the type)${TRAILER}`
)
console.log(`Converted ${items.length} items (${renamed} files renamed); ${[...converted.values()].filter((i) => i.title !== byOld.get(i.extra['former-id'] as string)?.item.title).length} titles lost their typed number.`)
