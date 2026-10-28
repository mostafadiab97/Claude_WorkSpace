// Bridges the UI and the core: exposes exactly the ReqManApi from src/shared/api.ts as window.reqman.
// Every call is built from the `Channels` table (review S-02): adding a call needs no change here.
import { contextBridge, ipcRenderer } from 'electron'
import { Channels, type InvokeMethod, type ReqManApi, type UpdateStatus } from '../shared/api'

const special = new Set<string>(['onUpdateStatus', 'reportUiError', 'updateStatusChanged'])
const invokers = Object.fromEntries(
  (Object.keys(Channels) as (keyof typeof Channels)[])
    .filter((name) => !special.has(name))
    .map((name) => [name, (...args: unknown[]) => ipcRenderer.invoke(Channels[name as InvokeMethod], ...args)])
) as Pick<ReqManApi, InvokeMethod>

const api: ReqManApi = {
  ...invokers,
  reportUiError: (message) => ipcRenderer.send(Channels.reportUiError, message),
  onUpdateStatus: (listener) => {
    const handler = (_e: Electron.IpcRendererEvent, status: UpdateStatus): void => listener(status)
    ipcRenderer.on(Channels.updateStatusChanged, handler)
    return () => ipcRenderer.removeListener(Channels.updateStatusChanged, handler)
  }
}

contextBridge.exposeInMainWorld('reqman', api)
