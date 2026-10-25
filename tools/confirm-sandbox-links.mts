// One-off migration for the sandbox repository created before v0.4.0: records a confirmation fingerprint
// on every link (as the scenario generator now does) and makes a few links suspect, keeping all IDs.
//   npx tsx tools/confirm-sandbox-links.mts <repo-folder>
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { contentFingerprint } from '../src/modules/items/index.ts'
import { createFileRepositoryStore } from '../src/modules/repository-store/index.ts'

const root = resolve(process.argv[2] ?? '')
const repo = await createFileRepositoryStore(resolve(import.meta.dirname, '..', 'config', 'default-schema.yaml')).open(root)
const { items } = await repo.loadAll()
const byId = new Map(items.map((i) => [i.id, i]))
let seed = 4242
const chance = (p: number): boolean => {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648 < p
}
const hub = items.find((i) => i.title === 'Hub requirement linked by many test cases')
if (hub && !hub.text.includes('Reworded')) hub.text += ' Reworded after 12 of its test cases were confirmed — those 12 links are suspect.'
const changed = new Set<string>(hub ? [hub.id] : [])
let suspect = 0
for (const it of items) {
  for (const l of it.links) {
    const t = byId.get(l.target)
    if (!t || l.confirmed) continue
    const stale = t === hub ? it.title.startsWith('Hub verification ') && Number(it.title.slice(17)) <= 12 : chance(0.015)
    l.confirmed = contentFingerprint(stale ? { ...t, text: `${t.text} (earlier wording)` } : t)
    if (stale) suspect++
    changed.add(it.id)
  }
}
// files renamed by hand (RSK-RENAMD.md) are left alone, so no second file with the same ID appears
let skipped = 0
for (const id of changed) {
  if (!existsSync(join(repo.folder, repo.itemPath(id)))) {
    skipped++
    continue
  }
  await repo.writeItem(byId.get(id)!)
}
if (skipped) console.log(`${skipped} renamed file(s) skipped`)
console.log(`${changed.size} files updated, ${suspect} suspect links`)
