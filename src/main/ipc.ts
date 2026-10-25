// Exposes the core services to the UI over IPC, one handler per entry in src/shared/api.ts.
import { app, ipcMain, shell } from 'electron'
import { dirname, join } from 'node:path'
import { Channels, type AppInfo } from '../shared/api'
import type { Paths, Services } from './composition'

export function registerIpc(services: Services, paths: Paths): void {
  const { log } = services
  const themeFile = join(paths.configDir, 'theme.json')

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
    log.info(`Theme loaded from ${theme.source === 'file' ? themeFile : 'built-in defaults'}`)
    for (const w of theme.warnings) log.warn(`Theme: ${w}`)
    return theme
  })

  ipcMain.handle(Channels.openLogFolder, async () => {
    const err = await shell.openPath(dirname(log.filePath))
    if (err) log.error(`Could not open log folder: ${err}`)
  })

  ipcMain.handle(Channels.openThemeFolder, () => {
    shell.showItemInFolder(themeFile)
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
      `Theme: ${theme.source} (${a.themeFile}), warnings: ${theme.warnings.length}`,
      ...theme.warnings.map((w) => `  - ${w}`),
      `Log file: ${a.logFile}`
    ].join('\n')
  })
}
