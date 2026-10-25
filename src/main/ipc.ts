// Exposes the core services to the UI over IPC, one handler per entry in src/shared/api.ts.
import { app, ipcMain, shell } from 'electron'
import { dirname, join } from 'node:path'
import { Channels, type AppInfo } from '../shared/api'
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
