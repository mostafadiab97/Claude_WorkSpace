// The switch from ReqMan to reqochet (0.16; owner, 31 Oct / 4 Nov 2026 — docs/reviews/2026-10-31-rename-impact.md §5):
// the new app has its own identity and settings folder. On its first start it copies the user's own settings from
// %APPDATA%\ReqMan, then removes the old folder (a clean switch: no files left under the old name). The index cache is
// not copied — it is rebuilt on the first opening of each repository. Node only, no Electron (unit-tested).
import { cp, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** What is the user's own and worth keeping: settings files, the import memory, a company logo, window settings. */
const KEEP_FILES = ['theme.json', 'recent-repositories.json', 'export-settings.json']
const KEEP_DIRS = ['imports', 'Local Storage']
const LOGO = /\.(svg|png|jpe?g|webp|gif)$/i
const MARKER = 'moved-from-reqman.txt'

const exists = async (p: string): Promise<boolean> => (await stat(p).catch(() => null)) !== null

export interface LegacyMoveResult {
  /** What was copied (names relative to the folders). */
  copied: string[]
  /** The old folder could be removed. */
  removedOld: boolean
}

/**
 * Copies the user's settings from `oldDir` into `newDir` once, then removes `oldDir`. Does nothing when `oldDir` does
 * not exist or `newDir` already holds settings (the move ran before, or the user started fresh and set things up).
 * Never throws: a failed copy only means default settings; a failed delete leaves the old folder for the next start.
 */
export async function moveLegacyUserData(oldDir: string, newDir: string, log: { info(m: string): void; warn(m: string): void }): Promise<LegacyMoveResult | null> {
  try {
    if (!(await exists(oldDir))) return null
    if ((await exists(join(newDir, MARKER))) || (await exists(join(newDir, 'theme.json'))) || (await exists(join(newDir, 'recent-repositories.json')))) {
      // already moved (or set up by hand): only finish removing the old folder
      return { copied: [], removedOld: await remove(oldDir, log) }
    }
    const copied: string[] = []
    for (const name of await readdir(oldDir)) {
      const keep = KEEP_FILES.includes(name) || KEEP_DIRS.includes(name) || LOGO.test(name)
      if (!keep) continue
      try {
        await cp(join(oldDir, name), join(newDir, name), { recursive: true, force: false, errorOnExist: false })
        copied.push(name)
      } catch (e) {
        log.warn(`Could not copy ${name} from the ReqMan folder: ${String(e)}`)
      }
    }
    await writeFile(join(newDir, MARKER), `Settings moved from ${oldDir} on ${new Date().toISOString()}: ${copied.join(', ') || 'nothing to move'}\n`)
    log.info(`Moved settings from ReqMan: ${copied.join(', ') || 'nothing to move'}`)
    return { copied, removedOld: await remove(oldDir, log) }
  } catch (e) {
    log.warn(`Moving settings from ReqMan failed: ${String(e)}`)
    return null
  }
}

async function remove(dir: string, log: { info(m: string): void; warn(m: string): void }): Promise<boolean> {
  try {
    await rm(dir, { recursive: true, force: true, maxRetries: 3 })
    log.info(`Removed the old ReqMan folder ${dir}`)
    return true
  } catch (e) {
    log.warn(`Could not remove the old ReqMan folder ${dir} (tried again at the next start): ${String(e)}`)
    return false
  }
}
