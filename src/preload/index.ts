// Bridges the UI and the core: exposes exactly the ReqManApi from src/shared/api.ts as window.reqman.
import { contextBridge, ipcRenderer } from 'electron'
import { Channels, type ReqManApi } from '../shared/api'

const api: ReqManApi = {
  getAppInfo: () => ipcRenderer.invoke(Channels.getAppInfo),
  getGitInfo: () => ipcRenderer.invoke(Channels.getGitInfo),
  getTheme: () => ipcRenderer.invoke(Channels.getTheme)
}

contextBridge.exposeInMainWorld('reqman', api)
