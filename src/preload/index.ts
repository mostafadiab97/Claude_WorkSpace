// Bridges the UI and the core: exposes exactly the ReqManApi from src/shared/api.ts as window.reqman.
import { contextBridge, ipcRenderer } from 'electron'
import { Channels, type ReqManApi } from '../shared/api'

const api: ReqManApi = {
  getAppInfo: () => ipcRenderer.invoke(Channels.getAppInfo),
  getGitInfo: () => ipcRenderer.invoke(Channels.getGitInfo),
  getTheme: () => ipcRenderer.invoke(Channels.getTheme),
  openLogFolder: () => ipcRenderer.invoke(Channels.openLogFolder),
  openThemeFolder: () => ipcRenderer.invoke(Channels.openThemeFolder),
  reportUiError: (message) => ipcRenderer.send(Channels.reportUiError, message),
  getDiagnostics: () => ipcRenderer.invoke(Channels.getDiagnostics)
}

contextBridge.exposeInMainWorld('reqman', api)
