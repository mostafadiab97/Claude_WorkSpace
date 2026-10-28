import { readFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import type { RecentRepository } from '../../shared/api'
import { writeFileAtomic } from '../safe-files'

const MAX_RECENT = 10

/** Same folder regardless of letter case or trailing slash (Windows paths are case-insensitive). */
export const sameFolder = (a: string, b: string): boolean => resolve(a).toLowerCase() === resolve(b).toLowerCase()

/** The "recent repositories" list in %APPDATA%\ReqMan\recent-repositories.json (written atomically, D-10). */
export function createRecentList(userDir: string, warn: (m: string) => void) {
  const file = join(userDir, 'recent-repositories.json')

  async function read(): Promise<RecentRepository[]> {
    try {
      const v = JSON.parse(await readFile(file, 'utf8')) as unknown
      return Array.isArray(v) ? (v as RecentRepository[]).filter((r) => typeof r?.root === 'string') : []
    } catch {
      return []
    }
  }
  const write = (list: RecentRepository[]): Promise<void> => writeFileAtomic(file, JSON.stringify(list, null, 2), { mkdir: true })

  return {
    read,
    async remember(root: string): Promise<void> {
      const list = (await read()).filter((r) => !sameFolder(r.root, root))
      list.unshift({ root, name: basename(root), openedAt: new Date().toISOString() })
      await write(list.slice(0, MAX_RECENT)).catch((e: unknown) => warn(`Could not save recent list: ${String(e)}`))
    },
    async forget(root: string): Promise<void> {
      await write((await read()).filter((r) => !sameFolder(r.root, root)))
    }
  }
}
