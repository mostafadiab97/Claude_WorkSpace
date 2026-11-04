// The switch from ReqMan to reqochet (0.16; owner, 31 Oct / 4 Nov 2026 — docs/reviews/2026-10-31-rename-impact.md §5):
// the new app has its own identity and settings folder. On its first start it copies the user's own settings from
// %APPDATA%\ReqMan, then removes the old folder (a clean switch: no files left under the old name). The index cache is
// not copied — it is rebuilt on the first opening of each repository. Node only, no Electron (unit-tested).
import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
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
 * Copies the user's settings from `oldDir` into `newDir`, then removes `oldDir` — but only when every piece was copied.
 * Does nothing when `oldDir` does not exist. Never throws; anything that fails leaves the old folder for the next start.
 */
export async function moveLegacyUserData(oldDir: string, newDir: string, log: { info(m: string): void; warn(m: string): void }): Promise<LegacyMoveResult | null> {
  try {
    if (!(await exists(oldDir))) return null
    // done before (the marker is written only after everything was copied): only finish removing the old folder
    if (await exists(join(newDir, MARKER))) return { copied: [], removedOld: await remove(oldDir, log) }
    await mkdir(newDir, { recursive: true })
    // Copy what is missing — also after a first start that stopped half way (QA-01): files already in the new folder
    // are kept (force: false). The old folder is removed only when every piece arrived (QA-02, code review CR-01).
    const copied: string[] = []
    let failed = false
    for (const name of await readdir(oldDir)) {
      const isFile = KEEP_FILES.includes(name) || LOGO.test(name)
      const keep = isFile || KEEP_DIRS.includes(name)
      if (!keep) continue
      const from = join(oldDir, name)
      const info = await stat(from)
      // a folder named like a settings file is not a setting (QA-03)
      if (isFile && !info.isFile()) continue
      if (KEEP_DIRS.includes(name) && !info.isDirectory()) continue
      try {
        await cp(from, join(newDir, name), { recursive: true, force: false, errorOnExist: false })
        copied.push(name)
      } catch (e) {
        failed = true
        log.warn(`Could not copy ${name} from the ReqMan folder (the old folder is kept; tried again at the next start): ${String(e)}`)
      }
    }
    if (failed) return { copied, removedOld: false }
    await writeFile(join(newDir, MARKER), `Settings moved from ${oldDir} on ${new Date().toISOString()}: ${copied.join(', ') || 'nothing to move'}\n`)
    log.info(`Moved settings from ReqMan: ${copied.join(', ') || 'nothing to move'}`)
    return { copied, removedOld: await remove(oldDir, log) }
  } catch (e) {
    log.warn(`Moving settings from ReqMan failed (the old folder is kept): ${String(e)}`)
    return null
  }
}

/** ReqMan's update downloads (%LOCALAPPDATA%\reqman-updater, about 100 MB): of no use to the new app (code review CR-07). */
export async function removeLegacyUpdaterCache(localAppData: string, log: { info(m: string): void; warn(m: string): void }): Promise<void> {
  const dir = join(localAppData, 'reqman-updater')
  if (await exists(dir)) await remove(dir, log)
}

async function remove(dir: string, log: { info(m: string): void; warn(m: string): void }): Promise<boolean> {
  try {
    await rm(dir, { recursive: true, force: true, maxRetries: 3 })
    log.info(`Removed the old folder ${dir}`)
    return true
  } catch (e) {
    log.warn(`Could not remove the old folder ${dir} (tried again at the next start): ${String(e)}`)
    return false
  }
}
