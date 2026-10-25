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
  },
  pickFolder: () => ipcRenderer.invoke(Channels.pickFolder),
  checkFolder: (path) => ipcRenderer.invoke(Channels.checkFolder, path),
  initializeRepository: (root) => ipcRenderer.invoke(Channels.initializeRepository, root),
  openRepository: (root) => ipcRenderer.invoke(Channels.openRepository, root),
  closeRepository: () => ipcRenderer.invoke(Channels.closeRepository),
  refreshRepository: () => ipcRenderer.invoke(Channels.refreshRepository),
  getRecentRepositories: () => ipcRenderer.invoke(Channels.getRecentRepositories),
  forgetRecentRepository: (root) => ipcRenderer.invoke(Channels.forgetRecentRepository, root),
  queryItems: (query) => ipcRenderer.invoke(Channels.queryItems, query),
  getItem: (id) => ipcRenderer.invoke(Channels.getItem, id),
  newItem: (type, parent) => ipcRenderer.invoke(Channels.newItem, type, parent),
  saveItem: (item, revision) => ipcRenderer.invoke(Channels.saveItem, item, revision),
  deleteItem: (id, revision, opts) => ipcRenderer.invoke(Channels.deleteItem, id, revision, opts ?? null),
  getGitState: () => ipcRenderer.invoke(Channels.getGitState),
  commit: (message) => ipcRenderer.invoke(Channels.commit, message),
  pull: () => ipcRenderer.invoke(Channels.pull),
  getCompareOptions: () => ipcRenderer.invoke(Channels.getCompareOptions),
  exportItems: (request) => ipcRenderer.invoke(Channels.exportItems, request),
  exportCompare: (from, to, format) => ipcRenderer.invoke(Channels.exportCompare, from, to, format),
  showInFolder: (path) => ipcRenderer.invoke(Channels.showInFolder, path),
  compareVersions: (from, to) => ipcRenderer.invoke(Channels.compareVersions, from, to),
  undoLastCommit: () => ipcRenderer.invoke(Channels.undoLastCommit),
  push: () => ipcRenderer.invoke(Channels.push),
  discardChanges: (paths) => ipcRenderer.invoke(Channels.discardChanges, paths),
  setGitIdentity: (name, email) => ipcRenderer.invoke(Channels.setGitIdentity, name, email),
  getItemHistory: (id) => ipcRenderer.invoke(Channels.getItemHistory, id),
  compareItemVersion: (id, hash) => ipcRenderer.invoke(Channels.compareItemVersion, id, hash),
  addLink: (source, type, target) => ipcRenderer.invoke(Channels.addLink, source, type, target),
  removeLink: (source, type, target) => ipcRenderer.invoke(Channels.removeLink, source, type, target),
  confirmLinks: (source, target) => ipcRenderer.invoke(Channels.confirmLinks, source, target ?? null),
  moveItem: (id, direction) => ipcRenderer.invoke(Channels.moveItem, id, direction),
  reparentItem: (id, parent, before) => ipcRenderer.invoke(Channels.reparentItem, id, parent, before ?? null),
  getAncestors: (id) => ipcRenderer.invoke(Channels.getAncestors, id),
  saveSchemaFields: (fields, revision) => ipcRenderer.invoke(Channels.saveSchemaFields, fields, revision)
}

contextBridge.exposeInMainWorld('reqman', api)
