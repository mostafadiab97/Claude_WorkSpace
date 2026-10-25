import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '../../shared/api'
import type { UpdateService } from './index'

interface Deps {
  /** Only an installed build can update itself; in development the updater is inert. */
  enabled: boolean
  log: { info(m: string): void; warn(m: string): void; error(m: string, e?: unknown): void }
}

const SIX_HOURS = 6 * 60 * 60 * 1000

export function createGithubUpdater({ enabled, log }: Deps): UpdateService {
  let status: UpdateStatus = enabled ? { state: 'idle' } : { state: 'disabled', reason: 'only the installed Windows app updates itself' }
  let notify: (s: UpdateStatus) => void = () => {}
  const set = (s: UpdateStatus): void => {
    status = s
    notify(s)
  }

  if (enabled) {
    // Release feed: GitHub Releases configured in electron-builder.yml ("publish").
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.logger = { info: (m) => log.info(`Updater: ${m}`), warn: (m) => log.warn(`Updater: ${m}`), error: (m) => log.error(`Updater: ${m}`), debug: () => {} }
    autoUpdater.on('checking-for-update', () => set({ state: 'checking' }))
    autoUpdater.on('update-not-available', () => set({ state: 'up-to-date', checkedAt: new Date().toISOString() }))
    autoUpdater.on('update-available', (info) => set({ state: 'downloading', version: info.version, percent: 0 }))
    autoUpdater.on('download-progress', (p) => {
      if (status.state === 'downloading') set({ ...status, percent: Math.round(p.percent) })
    })
    autoUpdater.on('update-downloaded', (info) => set({ state: 'ready', version: info.version }))
    autoUpdater.on('error', (e) => {
      log.error('Update check failed', e)
      // Offline is normal for ReqMan; report it gently.
      set({ state: 'error', message: 'Could not check for updates (offline or GitHub unreachable).' })
    })
  }

  const checkNow = async (): Promise<void> => {
    if (!enabled) return
    try {
      await autoUpdater.checkForUpdates()
    } catch {
      /* reported through the 'error' event */
    }
  }

  return {
    start(onStatus) {
      notify = onStatus
      if (!enabled) return
      void checkNow()
      setInterval(() => void checkNow(), SIX_HOURS).unref()
    },
    checkNow,
    installAndRestart() {
      if (status.state === 'ready') autoUpdater.quitAndInstall(true, true)
    },
    current: () => status
  }
}
