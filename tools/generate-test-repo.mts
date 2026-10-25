// Creates a folder with a ReqMan requirements set of generated, fictional items.
//   npm run gen:repo -- <folder> [count]       e.g. npm run gen:repo -- ../test-repo-1k 1000
// The folder must not contain a requirements folder yet. Run `git init` in it afterwards to try Git features.
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createFileRepositoryStore } from '../src/modules/repository-store/index.ts'
import { generateItems } from '../src/modules/sample-data/index.ts'

const [folderArg, countArg] = process.argv.slice(2)
if (!folderArg) {
  console.error('Usage: npm run gen:repo -- <folder> [count]')
  process.exit(1)
}
const folder = resolve(folderArg)
const count = Number(countArg ?? 1000)
await mkdir(folder, { recursive: true })

const store = createFileRepositoryStore(join(import.meta.dirname, '..', 'config', 'default-schema.yaml'))
const repo = await store.initialize(folder)
const items = generateItems(repo.schema, { count })
let done = 0
for (const item of items) {
  await repo.writeItem(item)
  if (++done % 5000 === 0) console.log(`${done} / ${count}`)
}
console.log(`Created ${count} items in ${repo.folder}`)
