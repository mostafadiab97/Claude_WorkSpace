// Exposes the core services to the UI over IPC: one handler per call in src/shared/api.ts (review S-02).
// `handlers` must name every invoke call of ReqManApi with the matching result type — the compiler reports a
// missing or wrong one. Every input is checked by src/main/validate.ts before it reaches a module (X-01).
import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Channels, type AppInfo, type ExportFormat, type ExportResult, type InvokeMethod, type ReqManApi } from '../shared/api'
import { runDataBenchmark } from '../modules/sample-data'
import { writeFileAtomic } from '../modules/safe-files'
import { createImportFiles, loadImportFile, writeSourceUpdate } from './importFiles'
import type { Paths, Services } from './composition'
import * as v from './validate'
import { T } from '../shared/text'

type Handlers = {
  [K in InvokeMethod]: (e: IpcMainInvokeEvent, ...args: unknown[]) => Awaited<ReturnType<ReqManApi[K]>> | ReturnType<ReqManApi[K]>
}

export function registerIpc(services: Services, paths: Paths): void {
  const { log } = services
  const ws = services.workspace
  const themeFile = services.theme.userThemeFile

  const appInfo = (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: `${process.platform} ${process.getSystemVersion()}`,
    electronVersion: process.versions.electron ?? '',
    logFile: log.filePath,
    themeFile
  })

  // ---------- export: build the content, ask where to save (remembering the last folder), write it
  const exportSettings = join(paths.userDir, 'export-settings.json')
  const lastFolder = async (): Promise<string> => {
    try {
      return (JSON.parse(await readFile(exportSettings, 'utf8')) as { folder?: string }).folder ?? app.getPath('documents')
    } catch {
      return app.getPath('documents')
    }
  }
  const saveExport = async (e: IpcMainInvokeEvent, name: string, format: ExportFormat, build: () => Promise<{ content: string | Uint8Array; count: number }>): Promise<ExportResult> => {
    try {
      const { content, count } = await build()
      const win = BrowserWindow.fromWebContents(e.sender)
      const ext = format === 'markdown' ? 'md' : format
      const filter = { markdown: { name: 'Markdown', extensions: ['md'] }, csv: { name: 'CSV (Excel)', extensions: ['csv'] }, xlsx: { name: 'Excel workbook', extensions: ['xlsx'] } }[format]
      const opts = { title: T.wsMsg.exportTitle, defaultPath: join(await lastFolder(), `${name}.${ext}`), filters: [filter] }
      const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
      if (r.canceled || !r.filePath) return { ok: false, canceled: true }
      await writeFileAtomic(r.filePath, content)
      await writeFileAtomic(exportSettings, JSON.stringify({ folder: dirname(r.filePath) }), { mkdir: true }).catch(() => {})
      log.info(`Exported ${count} entries to ${r.filePath}`)
      return { ok: true, path: r.filePath, count }
    } catch (err) {
      const message = err instanceof Error && /EBUSY|EPERM/.test(err.message) ? T.wsMsg.exportBusy : (err as Error).message
      log.error('Export failed', err)
      return { ok: false, message }
    }
  }
  const today = (): string => new Date().toISOString().slice(0, 10)

  // ---------- import (M7): the chosen files stay here; the window refers to them by token
  const importFiles = createImportFiles()
  const openDialog = async (e: IpcMainInvokeEvent, opts: Electron.OpenDialogOptions): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return r.canceled ? null : (r.filePaths[0] ?? null)
  }
  const chooseFile = async (e: IpcMainInvokeEvent) => {
    const path = await openDialog(e, { title: T.importDialog.chooseTitle, properties: ['openFile'], filters: [{ name: T.importDialog.fileFilter, extensions: ['xlsx', 'xlsm', 'csv', 'txt'] }] })
    if (!path) return null
    const f = await loadImportFile(path)
    log.info(`Import file chosen: ${path} (${f.sheets.length} sheet(s))`)
    return importFiles.add(f)
  }
  const sheetOf = (token: string, sheet: string) => {
    const f = importFiles.get(token)
    if (!f) throw new Error(T.importMsg.fileGone)
    const s = f.sheets.find((x) => x.name === sheet)
    if (!s) throw new Error(T.importMsg.noSheet(sheet))
    return { f, rows: s.rows }
  }

  let selfTestRunning = false
  const exclusiveTest = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    if (selfTestRunning) throw new Error(T.wsMsg.selfTestRunning)
    selfTestRunning = true
    log.info(`${name} started`)
    try {
      return await fn()
    } catch (e) {
      log.error(`${name} failed`, e)
      throw e
    } finally {
      selfTestRunning = false
    }
  }

  const handlers: Handlers = {
    // ---------- app, theme, diagnostics, updates
    getAppInfo: appInfo,
    getGitInfo: async () => {
      const info = await services.git.getGitInfo()
      if (info.installed) log.info(`Git check: installed, version ${info.version}`)
      else log.warn(`Git check: not available — ${info.reason}`)
      return info
    },
    getTheme: async () => {
      const theme = await services.theme.load()
      const from = { user: `your theme (${themeFile})`, file: 'the app theme', default: 'built-in defaults' }[theme.source]
      log.info(`Theme loaded from ${from}`)
      for (const w of theme.warnings) log.warn(`Theme: ${w}`)
      return theme
    },
    openLogFolder: async () => {
      const err = await shell.openPath(dirname(log.filePath))
      if (err) log.error(`Could not open log folder: ${err}`)
    },
    openThemeFolder: async () => {
      try {
        shell.showItemInFolder(await services.theme.ensureUserThemeFile())
      } catch (e) {
        log.error('Could not create your theme.json', e)
      }
    },
    getUpdateStatus: () => services.updater.current(),
    checkForUpdates: () => services.updater.checkNow(),
    installUpdate: () => {
      log.info('Restarting to install update')
      services.updater.installAndRestart()
    },
    getDiagnostics: async () => {
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
    },
    runDataSelfTest: (_e, count) => {
      const n = Math.min(Math.max(Math.round(Number(count) || 0), 100), 50_000)
      return exclusiveTest(`Data self-test with ${n} items`, async () => {
        const r = await runDataBenchmark(services.repositories, n)
        log.info(`Data self-test: ${n} items — write ${r.writeMs} ms, first index ${r.firstIndexMs} ms, re-open ${r.resyncMs} ms, slowest query ${r.slowestQueryMs} ms`)
        return r
      })
    },
    runReleaseSelfTest: () =>
      exclusiveTest('Release self-test', async () => {
        const r = await services.releaseSelfTest()
        log.info(`Release self-test: ${r.ok ? 'passed' : 'FAILED'} in ${r.totalMs} ms — ${r.steps.map((s) => `${s.ok ? '✓' : '✗'} ${s.name}${s.detail && !s.ok ? ` (${s.detail})` : ''}`).join('; ')}`)
        return r
      }),
    showInFolder: (_e, path) => {
      const p = v.optStr(path, 'path')
      if (p) shell.showItemInFolder(p)
    },

    // ---------- workspace
    pickFolder: async (e) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const opts = { title: T.wsMsg.chooseRepo, properties: ['openDirectory' as const] }
      const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
      return r.canceled ? null : (r.filePaths[0] ?? null)
    },
    checkFolder: (_e, path) => ws.checkFolder(v.str(path, 'folder')),
    initializeRepository: (_e, root) => ws.initialize(v.str(root, 'folder')),
    openRepository: (_e, root) => ws.open(v.str(root, 'folder')),
    closeRepository: () => ws.close(),
    refreshRepository: (_e, focus) => ws.refresh(focus === true),
    getRecentRepositories: () => ws.recent(),
    forgetRecentRepository: (_e, root) => ws.forgetRecent(v.str(root, 'folder')),
    queryItems: (_e, q) => ws.query(v.query(q)),
    getItem: (_e, id) => ws.getItem(v.str(id, 'ID')),
    newItem: (_e, type, parent) => ws.newItem(v.str(type, 'type'), v.optStr(parent, 'parent')),
    saveItem: (_e, item, revision) => ws.saveItem(v.item(item), v.optStr(revision, 'revision') ?? null),
    deleteItem: (_e, id, revision, opts) =>
      ws.deleteItem(v.str(id, 'ID'), v.str(revision, 'revision'), { removeIncomingLinks: (opts as { removeIncomingLinks?: unknown } | null)?.removeIncomingLinks === true }),
    moveItem: (_e, id, dir) => ws.moveItem(v.str(id, 'ID'), v.oneOf(dir, ['up', 'down'], 'direction')),
    reparentItem: (_e, id, parent, before) => ws.reparentItem(v.str(id, 'ID'), v.optStr(parent, 'parent') ?? null, v.optStr(before, 'position') ?? null),
    getAncestors: (_e, id) => ws.ancestors(v.str(id, 'ID')),
    saveSchemaFields: (_e, fields, revision) => ws.saveSchemaFields(v.fieldDefs(fields), v.str(revision, 'revision')),
    checkFields: (_e, fields) => ws.checkFields(v.fieldDefs(fields)),
    addLink: (_e, source, type, target) => ws.addLink(v.str(source, 'source'), v.str(type, 'link type'), v.str(target, 'target')),
    removeLink: (_e, source, type, target) => ws.removeLink(v.str(source, 'source'), v.str(type, 'link type'), v.str(target, 'target')),
    confirmLinks: (_e, source, target) => ws.confirmLinks(v.str(source, 'source'), v.optStr(target, 'target')),
    decideLinks: (_e, decisions) => ws.decideLinks(v.linkDecisions(decisions)),
    revertChange: (_e, id, part) => ws.revertChange(v.str(id, 'ID'), v.revertPart(part)),
    fixFileName: (_e, id) => ws.fixFileName(v.str(id, 'ID')),

    // ---------- Git, Compare
    getGitState: () => ws.gitState(),
    commit: (_e, message) => ws.commit(v.text(message, 'commit message', 100_000)),
    pull: () => ws.pull(),
    push: () => ws.push(),
    discardChanges: (_e, paths) => ws.discardChanges(v.strings(paths, 'files')),
    setGitIdentity: (_e, name, email) => ws.setGitIdentity(v.text(name, 'name', 200), v.text(email, 'e-mail', 200)),
    undoLastCommit: () => ws.undoLastCommit(),
    getItemHistory: (_e, id) => ws.itemHistory(v.str(id, 'ID')),
    compareItemVersion: (_e, id, hash) => ws.compareItemVersion(v.str(id, 'ID'), v.str(hash, 'version')),
    getCompareOptions: () => ws.compareOptions(),
    compareVersions: (_e, from, to) => ws.compareVersions(v.str(from, 'from'), v.str(to, 'to')),

    // ---------- import (M7)
    chooseImportFile: (e) => chooseFile(e),
    previewImport: (_e, settings) => {
      const s = v.importSettings(settings)
      return ws.previewImport(sheetOf(s.token, s.sheet).rows, s)
    },
    runImport: (_e, settings, message) => {
      const s = v.importSettings(settings)
      const { f, rows } = sheetOf(s.token, s.sheet)
      const commit = v.text(message, 'commit message', 10_000)
      return ws.runImport(rows, s, { path: f.path, name: f.name, kind: f.kind }, commit || undefined)
    },
    newProjectFromFile: async (e) => {
      try {
        const file = await chooseFile(e)
        if (!file) return { ok: false, canceled: true }
        const folder = await openDialog(e, { title: T.importDialog.folderTitle, properties: ['openDirectory', 'createDirectory', 'promptToCreate'] })
        if (!folder) return { ok: false, canceled: true }
        const inside = await readdir(folder).catch(() => [] as string[])
        if (inside.length > 0) return { ok: false, message: T.importMsg.notEmpty }
        return { ok: true, info: await ws.createProject(folder), file }
      } catch (err) {
        log.error('New project from a file failed', err)
        return { ok: false, message: (err as Error).message }
      }
    },
    getImportSource: () => ws.importSource(),
    updateSourceFile: async (e, mode) => {
      const m = v.oneOf(mode, ['original', 'copy'], 'mode')
      try {
        const src = await ws.importSource()
        if (!src) return { ok: false, message: T.importMsg.noSource }
        const f = await loadImportFile(src.path).catch(() => {
          throw new Error(T.importMsg.sourceMissing(src.path))
        })
        const sheet = f.sheets.find((x) => x.name === src.sheet) ?? (f.kind === 'csv' ? f.sheets[0] : undefined)
        if (!sheet) return { ok: false, message: T.importMsg.noSheet(src.sheet) }
        const u = await ws.sourceUpdate(sheet.rows)
        let target = src.path
        if (m === 'copy') {
          const win = BrowserWindow.fromWebContents(e.sender)
          const ext = f.kind === 'xlsx' ? 'xlsx' : 'csv'
          const opts = { title: T.importDialog.copyTitle, defaultPath: src.path.replace(/(\.[^.\\/]+)$/, ` (updated)$1`), filters: [{ name: T.importDialog.fileFilter, extensions: [ext] }] }
          const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
          if (r.canceled || !r.filePath) return { ok: false, canceled: true }
          target = r.filePath
        }
        await writeSourceUpdate(f, u.sheet, u.edits, u.append, target)
        log.info(`Updated ${target}: ${u.edits.length} cell(s), ${u.added} new row(s)`)
        return { ok: true, path: target, count: u.changedItems + u.added }
      } catch (err) {
        const message = err instanceof Error && /EBUSY|EPERM/.test(err.message) ? T.wsMsg.exportBusy : (err as Error).message
        log.error('Updating the source file failed', err)
        return { ok: false, message }
      }
    },
    publishToRemote: (_e, url) => ws.publish(v.str(url, 'address', 2000)),

    // ---------- export
    exportItems: (e, request) => {
      const req = v.exportRequest(request)
      return saveExport(e, `requirements-${today()}`, req.format, () => ws.exportItems(req))
    },
    exportCompare: (e, from, to, format) => {
      const f = v.oneOf(format, ['csv', 'markdown', 'xlsx'], 'export format')
      return saveExport(e, `requirement-changes-${today()}`, f, () => ws.exportCompare(v.str(from, 'from'), v.str(to, 'to'), f))
    }
  }

  for (const [name, handler] of Object.entries(handlers) as [InvokeMethod, Handlers[InvokeMethod]][]) {
    ipcMain.handle(Channels[name], handler)
  }

  ipcMain.on(Channels.reportUiError, (_e, message: unknown) => {
    log.error(`UI error: ${String(message).slice(0, 4000)}`)
  })
}
