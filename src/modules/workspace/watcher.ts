import { readdirSync, watch, type FSWatcher } from 'node:fs'
import { join } from 'node:path'
import { isDocumentName } from '../repository-store'

/**
 * Notices which files in the requirements folder changed (by ReqMan, Git or an editor) so that a refresh
 * re-reads only those instead of checking every file (review P-01). If the operating system cannot watch the
 * folder, or reports a change without a file name, the next refresh simply checks everything (`all`).
 *
 * Paths are relative to the requirements folder: "Specification/REQ-K7Q3XMB.md", ".reqochet/schema.yaml". Every
 * document folder is watched (S-10), and the requirements folder itself: a new or removed document folder means a
 * full check.
 */
export interface FolderWatch {
  /** Takes and clears the list of changes since the last call. */
  take(): { all: boolean; paths: string[]; schema: boolean }
  close(): void
  /** The document folders being watched, joined — to restart the watch when the documents change. */
  readonly documents: string
}

/** The document folders under requirements/ right now (plain folder names, not hidden). */
export const documentFolders = (folder: string): string[] => {
  try {
    return readdirSync(folder, { withFileTypes: true })
      .filter((d) => d.isDirectory() && isDocumentName(d.name)) // only what the full check reads (SEC-17-05)
      .map((d) => d.name)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  } catch {
    return []
  }
}

/** More changed files than this → a normal full check is just as fast. */
const MANY = 2000
/** More document folders than this are not watched one by one. */
const MAX_WATCHED_DOCUMENTS = 200

export function watchRequirementsFolder(folder: string, onError?: (e: unknown) => void, metaDir: string = '.reqochet'): FolderWatch {
  const changed = new Set<string>()
  let all = false
  let schema = false
  const watchers: FSWatcher[] = []
  let failed = false

  const add = (dir: string): void => {
    try {
      const w = watch(join(folder, dir), { persistent: false }, (_event, name) => {
        if (!name) {
          all = true
          return
        }
        const file = String(name)
        if (dir === metaDir) {
          if (file === 'schema.yaml') schema = true
          return
        }
        if (dir === '') {
          // the requirements folder itself: a loose item file, or a document folder added or removed
          // README.md is not an item (CR-14); a document folder's own change event is not a new folder (CR-08)
          if (file.endsWith('.md')) {
            if (file.toLowerCase() !== 'readme.md') changed.add(file)
          } else if (file !== '.gitattributes' && !docs.includes(file)) all = true
          return
        }
        if (!file.endsWith('.md') || file.toLowerCase() === 'readme.md') return
        changed.add(`${dir}/${file}`)
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
  const docs = documentFolders(folder).filter((d) => d !== metaDir && d !== '.reqman' && d !== '.reqochet')
  add('')
  // very many folders: no handle per folder — every refresh checks everything instead (SEC-17-05)
  if (docs.length > MAX_WATCHED_DOCUMENTS) failed = true
  else for (const d of docs) add(d)
  add(metaDir)

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
    },
    documents: docs.join('\u0000')
  }
}
