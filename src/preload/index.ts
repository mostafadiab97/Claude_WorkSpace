// Bridges the UI and the core: exposes exactly the ReqManApi from src/shared/api.ts as window.reqman.
import { contextBridge, ipcRenderer } from 'electron'
import { Channels, type ReqManApi, type UpdateStatus } from '../shared/api'

const api: ReqManApi = {
  getAppInfo: () => ipcRenderer.invoke(Channels.getAppInfo),
  getGitInfo: () => ipcRenderer.invoke(Channels.getGitInfo),
  getTheme: () => ipcRenderer.invoke(Channels.getTheme),
  openLogFolder: () => ipcRenderer.invoke(Channels.openLogFolder),
  openThemeFolder: () => ipcRenderer.invoke(Channels.openThemeFolder),
  reportUiError: (message) => ipcRenderer.send(Channels.reportUiError, message),
  getDiagnostics: () => ipcRenderer.invoke(Channels.getDiagnostics),
  runDataSelfTest: (count) => ipcRenderer.invoke(Channels.runDataSelfTest, count),
  getUpdateStatus: () => ipcRenderer.invoke(Channels.getUpdateStatus),
  checkForUpdates: () => ipcRenderer.invoke(Channels.checkForUpdates),
  installUpdate: () => ipcRenderer.invoke(Channels.installUpdate),
  onUpdateStatus: (listener) => {
    const handler = (_e: Electron.IpcRendererEvent, status: UpdateStatus): void => listener(status)
    ipcRenderer.on(Channels.updateStatusChanged, handler)
    return () => ipcRenderer.removeListener(Channels.updateStatusChanged, handler)
  }
}

contextBridge.exposeInMainWorld('reqman', api)
