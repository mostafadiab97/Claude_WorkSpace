// Exposes the core services to the UI over IPC, one handler per entry in src/shared/api.ts.
import { app, ipcMain } from 'electron'
import { Channels, type AppInfo } from '../shared/api'
import type { Services } from './composition'

export function registerIpc(services: Services): void {
  ipcMain.handle(Channels.getAppInfo, (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    electronVersion: process.versions.electron ?? ''
  }))
  ipcMain.handle(Channels.getGitInfo, () => services.git.getGitInfo())
  ipcMain.handle(Channels.getTheme, () => services.theme.load())
}
