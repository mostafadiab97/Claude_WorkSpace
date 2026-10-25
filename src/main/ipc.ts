// Exposes the core services to the UI over IPC, one handler per entry in src/shared/api.ts.
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { dirname, join } from 'node:path'
import { Channels, type AppInfo, type Item, type ItemQuery } from '../shared/api'
import { runDataBenchmark } from '../modules/sample-data'
import type { Paths, Services } from './composition'

export function registerIpc(services: Services, paths: Paths): void {
  const { log } = services
  const themeFile = services.theme.userThemeFile

  const appInfo = (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: `${process.platform} ${process.getSystemVersion()}`,
    electronVersion: process.versions.electron ?? '',
    logFile: log.filePath,
    themeFile
  })

  ipcMain.handle(Channels.getAppInfo, appInfo)

  ipcMain.handle(Channels.getGitInfo, async () => {
    const info = await services.git.getGitInfo()
    if (info.installed) log.info(`Git check: installed, version ${info.version}`)
    else log.warn(`Git check: not available — ${info.reason}`)
    return info
  })

  ipcMain.handle(Channels.getTheme, async () => {
    const theme = await services.theme.load()
    const from = { user: `your theme (${themeFile})`, file: 'the app theme', default: 'built-in defaults' }[theme.source]
    log.info(`Theme loaded from ${from}`)
    for (const w of theme.warnings) log.warn(`Theme: ${w}`)
    return theme
  })

  ipcMain.handle(Channels.openLogFolder, async () => {
    const err = await shell.openPath(dirname(log.filePath))
    if (err) log.error(`Could not open log folder: ${err}`)
  })

  ipcMain.handle(Channels.openThemeFolder, async () => {
    try {
      shell.showItemInFolder(await services.theme.ensureUserThemeFile())
    } catch (e) {
      log.error('Could not create your theme.json', e)
    }
  })

  ipcMain.handle(Channels.getUpdateStatus, () => services.updater.current())
  ipcMain.handle(Channels.checkForUpdates, () => services.updater.checkNow())
  ipcMain.handle(Channels.installUpdate, () => {
    log.info('Restarting to install update')
    services.updater.installAndRestart()
  })

  let selfTestRunning = false
  ipcMain.handle(Channels.runDataSelfTest, async (_e, count: unknown) => {
    const n = Math.min(Math.max(Math.round(Number(count) || 0), 100), 50_000)
    if (selfTestRunning) throw new Error('A self-test is already running.')
    selfTestRunning = true
    log.info(`Data self-test started with ${n} items`)
    try {
      const r = await runDataBenchmark(services.repositories, n)
      log.info(
        `Data self-test: ${n} items — write ${r.writeMs} ms, first index ${r.firstIndexMs} ms, ` +
          `re-open ${r.resyncMs} ms, slowest query ${r.slowestQueryMs} ms`
      )
      return r
    } catch (e) {
      log.error('Data self-test failed', e)
      throw e
    } finally {
      selfTestRunning = false
    }
  })

  // ---------- workspace
  const ws = services.workspace
  const str = (v: unknown, name: string): string => {
    if (typeof v !== 'string' || v.length === 0 || v.length > 4096) throw new Error(`Invalid ${name}.`)
    return v
  }

  ipcMain.handle(Channels.pickFolder, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const opts = { title: 'Choose the Git repository folder', properties: ['openDirectory' as const] }
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return r.canceled ? null : (r.filePaths[0] ?? null)
  })
  ipcMain.handle(Channels.checkFolder, (_e, path: unknown) => ws.checkFolder(str(path, 'folder')))
  ipcMain.handle(Channels.initializeRepository, (_e, root: unknown) => ws.initialize(str(root, 'folder')))
  ipcMain.handle(Channels.openRepository, (_e, root: unknown) => ws.open(str(root, 'folder')))
  ipcMain.handle(Channels.closeRepository, () => ws.close())
  ipcMain.handle(Channels.refreshRepository, () => ws.refresh())
  ipcMain.handle(Channels.getRecentRepositories, () => ws.recent())
  ipcMain.handle(Channels.forgetRecentRepository, (_e, root: unknown) => ws.forgetRecent(str(root, 'folder')))
  ipcMain.handle(Channels.queryItems, (_e, q: unknown) => ws.query((q ?? {}) as ItemQuery))
  ipcMain.handle(Channels.getItem, (_e, id: unknown) => ws.getItem(str(id, 'ID')))
  ipcMain.handle(Channels.newItem, (_e, type: unknown, parent: unknown) =>
    ws.newItem(str(type, 'type'), typeof parent === 'string' && parent ? parent : undefined)
  )
  ipcMain.handle(Channels.saveItem, (_e, item: unknown, revision: unknown) =>
    ws.saveItem(item as Item, typeof revision === 'string' ? revision : null)
  )
  ipcMain.handle(Channels.deleteItem, (_e, id: unknown, revision: unknown) => ws.deleteItem(str(id, 'ID'), str(revision, 'revision')))
  ipcMain.handle(Channels.moveItem, (_e, id: unknown, dir: unknown) => ws.moveItem(str(id, 'ID'), dir === 'up' ? 'up' : 'down'))

  ipcMain.on(Channels.reportUiError, (_e, message: unknown) => {
    log.error(`UI error: ${String(message).slice(0, 4000)}`)
  })

  ipcMain.handle(Channels.getDiagnostics, async () => {
    const a = appInfo()
    const git = await services.git.getGitInfo()
    const theme = await services.theme.load()
    return [
      `ReqMan ${a.version}`,
      `OS: ${a.platform} (${process.arch})`,
      `Electron: ${a.electronVersion}, Chrome: ${process.versions.chrome ?? ''}, Node: ${process.versions.node}`,
      `Git: ${git.installed ? git.version : `not available (${git.reason})`}`,
      `Theme: ${theme.source}; your theme file: ${a.themeFile}; app theme: ${join(paths.configDir, 'theme.json')}`,
      `Theme warnings: ${theme.warnings.length}`,
      ...theme.warnings.map((w) => `  - ${w}`),
      `Updates: ${JSON.stringify(services.updater.current())}`,
      `Log file: ${a.logFile}`
    ].join('\n')
  })
}
