// Bridges the UI and the core: exposes exactly the ReqochetApi from src/shared/api.ts as window.reqochet.
// Every call is built from the `Channels` table (review S-02): adding a call needs no change here — except calls
// answered here without the core (`pathOfDroppedFile`, which only Electron's preload can answer).
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { Channels, type InvokeMethod, type ReqochetApi, type UpdateStatus } from '../shared/api'

const special = new Set<string>(['onUpdateStatus', 'reportUiError', 'updateStatusChanged'])
const invokers = Object.fromEntries(
  (Object.keys(Channels) as (keyof typeof Channels)[])
    .filter((name) => !special.has(name))
    .map((name) => [name, (...args: unknown[]) => ipcRenderer.invoke(Channels[name as InvokeMethod], ...args)])
) as Pick<ReqochetApi, InvokeMethod>

const api: ReqochetApi = {
  ...invokers,
  reportUiError: (message) => ipcRenderer.send(Channels.reportUiError, message),
  pathOfDroppedFile: (file) => webUtils.getPathForFile(file),
  onUpdateStatus: (listener) => {
    const handler = (_e: Electron.IpcRendererEvent, status: UpdateStatus): void => listener(status)
    ipcRenderer.on(Channels.updateStatusChanged, handler)
    return () => ipcRenderer.removeListener(Channels.updateStatusChanged, handler)
  }
}

contextBridge.exposeInMainWorld('reqochet', api)
