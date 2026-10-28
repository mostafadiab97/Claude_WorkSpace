import { watch, type FSWatcher } from 'node:fs'
import { join } from 'node:path'

/**
 * Notices which files in the requirements folder changed (by ReqMan, Git or an editor) so that a refresh
 * re-reads only those instead of checking every file (review P-01). If the operating system cannot watch the
 * folder, or reports a change without a file name, the next refresh simply checks everything (`all`).
 *
 * Paths are relative to the requirements folder: "items/SYS-K7Q3XM.md", ".reqman/schema.yaml".
 */
export interface FolderWatch {
  /** Takes and clears the list of changes since the last call. */
  take(): { all: boolean; paths: string[]; schema: boolean }
  close(): void
}

/** More changed files than this → a normal full check is just as fast. */
const MANY = 2000

export function watchRequirementsFolder(folder: string, onError?: (e: unknown) => void): FolderWatch {
  const changed = new Set<string>()
  let all = false
  let schema = false
  const watchers: FSWatcher[] = []
  let failed = false

  const add = (dir: 'items' | '.reqman'): void => {
    try {
      const w = watch(join(folder, dir), { persistent: false }, (_event, name) => {
        if (!name) {
          all = true
          return
        }
        const file = String(name)
        if (dir === '.reqman') {
          if (file === 'schema.yaml') schema = true
          return
        }
        if (!file.endsWith('.md')) return
        changed.add(`items/${file}`)
        if (changed.size > MANY) all = true
      })
      w.on('error', (e) => {
        all = true
        onError?.(e)
      })
      watchers.push(w)
    } catch (e) {
      // e.g. the folder does not exist yet: every refresh checks everything
      all = true
      onError?.(e)
      failed = true
    }
  }
  add('items')
  add('.reqman')

  return {
    take() {
      const out = { all: all || failed, paths: [...changed], schema }
      changed.clear()
      all = false
      schema = false
      return out
    },
    close() {
      for (const w of watchers) w.close()
    }
  }
}
