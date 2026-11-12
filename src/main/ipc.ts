// Exposes the core services to the UI over IPC: one handler per call in src/shared/api.ts (review S-02).
// `handlers` must name every invoke call of ReqochetApi with the matching result type — the compiler reports a
// missing or wrong one. Every input is checked by src/main/validate.ts before it reaches a module (X-01).
import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { readFileSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { Channels, type AppInfo, type ExportFormat, type ExportResult, type InvokeMethod, type ReqochetApi } from '../shared/api'
import { runDataBenchmark } from '../modules/sample-data'
import { writeFileAtomic } from '../modules/safe-files'
import { FIRST_DOCUMENT, isDocumentName } from '../modules/repository-store'
import { buildProblemReport, problemReportName } from '../modules/logger'
import { createImportFiles, loadImportFile, updateTarget, writeSourceUpdate } from './importFiles'
import type { Paths, Services } from './composition'
import * as v from './validate'
import { closeForInstall } from './closeForInstall'
import { setLanguage, T } from '../shared/text'

/** The file types import reads (the dialog filter and the drop zone). */
const IMPORT_EXTENSIONS = ['xlsx', 'xlsm', 'csv', 'txt', 'reqif', 'reqifz']

type Handlers = {
  [K in InvokeMethod]: (e: IpcMainInvokeEvent, ...args: unknown[]) => Awaited<ReturnType<ReqochetApi[K]>> | ReturnType<ReqochetApi[K]>
}

export function registerIpc(services: Services, paths: Paths): void {
  const { log } = services
  const ws = services.workspace
  const themeFile = services.theme.userThemeFile

  // the releases page, read once from the installed app's update settings (no account name in the source — 0.14.4)
  let releasesPage: string | undefined
  try {
    const feed = readFileSync(join(dirname(paths.resourceDir), 'app-update.yml'), 'utf8')
    const owner = feed.match(/^owner:\s*(\S+)/m)?.[1]
    const repo = feed.match(/^repo:\s*(\S+)/m)?.[1]
    if (owner && repo) releasesPage = `https://github.com/${owner}/${repo}/releases`
  } catch {
    // development, or an installer without a GitHub feed
  }
  const appInfo = (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: `${process.platform} ${process.getSystemVersion()}`,
    electronVersion: process.versions.electron ?? '',
    logFile: log.filePath,
    themeFile,
    ...(releasesPage ? { releasesPage } : {})
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
      const filter = { markdown: { name: 'Markdown', extensions: ['md'] }, csv: { name: 'CSV (Excel)', extensions: ['csv'] }, xlsx: { name: 'Excel workbook', extensions: ['xlsx'] }, reqif: { name: 'ReqIF', extensions: ['reqif'] } }[format]
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
    const path = await openDialog(e, { title: T.importDialog.chooseTitle, properties: ['openFile'], filters: [{ name: T.importDialog.fileFilter, extensions: IMPORT_EXTENSIONS }] })
    if (!path) return null
    return readImportFile(path)
  }
  const readImportFile = async (path: string) => {
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

  const diagnostics = async (): Promise<string> => {
    const a = appInfo()
    const git = await services.git.getGitInfo()
    const theme = await services.theme.load()
    return [
      `reqochet ${a.version}`,
      `OS: ${a.platform} (${process.arch})`,
      `Electron: ${a.electronVersion}, Chrome: ${process.versions.chrome ?? ''}, Node: ${process.versions.node}`,
      `Git: ${git.installed ? git.version : `not available (${git.reason})`}`,
      `Theme: ${theme.source}; your theme file: ${a.themeFile}; app theme: ${join(paths.configDir, 'theme.json')}`,
      `Theme warnings: ${theme.warnings.length}`,
      ...theme.warnings.map((w) => `  - ${w}`),
      `Updates: ${JSON.stringify(services.updater.current())}`,
      `Log file: ${a.logFile}`
    ].join('\n')
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
    listEarlierVersions: async () => {
      try {
        return { ok: true, versions: (await services.updater.listEarlier()).map((r) => ({ version: r.version, date: r.date })) }
      } catch (err) {
        log.warn(`Could not list earlier versions: ${(err as Error).message}`)
        return { ok: false, message: T.settings.versions.listFailed }
      }
    },
    installEarlierVersion: (e, version) => services.updater.installEarlier(v.str(version, 'version', 40), () => closeForInstall(e.sender)),
    resumeUpdates: () => services.updater.resume(),
    installUpdate: async (e) => {
      if (!(await closeForInstall(e.sender))) return // the user kept editing (W-09)
      log.info('Restarting to install update')
      services.updater.installAndRestart()
    },
    getDiagnostics: () => diagnostics(),
    saveProblemReport: async (e, description) => {
      try {
        const text = v.text(description, 'description', 20_000)
        const readLog = (p: string): Promise<string> => readFile(p, 'utf8').catch(() => '')
        const report = buildProblemReport({
          description: text,
          diagnostics: await diagnostics(),
          log: await readLog(log.filePath),
          olderLog: await readLog(join(dirname(log.filePath), 'reqochet.old.log')),
          home: app.getPath('home')
        })
        const win = BrowserWindow.fromWebContents(e.sender)
        const opts = { title: T.settings.report.title, defaultPath: join(app.getPath('downloads'), problemReportName()), filters: [{ name: 'Text', extensions: ['txt'] }] }
        const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
        if (r.canceled || !r.filePath) return { ok: false, canceled: true }
        await writeFileAtomic(r.filePath, report)
        log.info(`Problem report saved to ${r.filePath}`)
        shell.showItemInFolder(r.filePath)
        return { ok: true, path: r.filePath }
      } catch (err) {
        log.error('Problem report failed', err)
        return { ok: false, message: (err as Error).message }
      }
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
      // only a local absolute path: a UNC path would make Explorer contact that server (SEC-WP3-06)
      if (p && /^[A-Za-z]:[\\/]/.test(p) && !p.includes('\0')) shell.showItemInFolder(p)
    },

    // ---------- workspace
    pickFolder: async (e) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const opts = { title: T.wsMsg.chooseRepo, properties: ['openDirectory' as const] }
      const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
      return r.canceled ? null : (r.filePaths[0] ?? null)
    },
    checkFolder: (_e, path) => ws.checkFolder(v.str(path, 'folder')),
    // a new project's first document is called Specification (S-10: the requirements folder holds only documents)
    initializeRepository: (_e, root) => ws.initialize(v.str(root, 'folder'), FIRST_DOCUMENT),
    openRepository: (_e, root) => ws.open(v.str(root, 'folder')),
    closeRepository: () => ws.close(),
    refreshRepository: (_e, focus) => ws.refresh(focus === true),
    getRecentRepositories: () => ws.recent(),
    forgetRecentRepository: (_e, root) => ws.forgetRecent(v.str(root, 'folder')),
    queryItems: (_e, q) => ws.query(v.query(q)),
    getItem: (_e, id) => ws.getItem(v.id(id)),
    newItem: (_e, type, parent, after, document) => ws.newItem(v.str(type, 'type'), v.optStr(parent, 'parent'), v.optStr(after, 'position'), v.optStr(document, 'document')),
    saveItem: (_e, item, revision) => ws.saveItem(v.item(item), v.optStr(revision, 'revision') ?? null),
    deleteItem: (_e, id, revision, opts) =>
      ws.deleteItem(v.id(id), v.str(revision, 'revision'), { removeIncomingLinks: (opts as { removeIncomingLinks?: unknown } | null)?.removeIncomingLinks === true }),
    moveItem: (_e, id, dir) => ws.moveItem(v.id(id), v.oneOf(dir, ['up', 'down'], 'direction')),
    reparentItem: (_e, id, parent, before) => ws.reparentItem(v.id(id), v.optStr(parent, 'parent') ?? null, v.optStr(before, 'position') ?? null),
    reparentItems: (_e, ids, parent, before) => ws.reparentItems(v.strings(ids, 'items', 100_000), v.optStr(parent, 'parent') ?? null, v.optStr(before, 'position') ?? null),
    getAncestors: (_e, id) => ws.ancestors(v.id(id)),
    renameProjectFolder: () => ws.renameProjectFolder(),
    createDocument: (_e, name) => ws.createDocument(v.str(name, 'document', 80)),
    deleteDocument: (_e, name) => ws.deleteDocument(v.str(name, 'document', 80)),
    mergeDocument: (_e, from, into) => ws.mergeDocument(v.str(from, 'document', 80), v.str(into, 'document', 80)),
    renameDocument: (_e, from, to) => ws.renameDocument(from === '' ? '' : v.str(from, 'document', 80), v.str(to, 'document', 80)),
    getFieldValues: (_e, field) => ws.fieldValues(v.str(field, 'field')),
    saveSchemaFields: (_e, fields, revision) => ws.saveSchemaFields(v.fieldDefs(fields), v.str(revision, 'revision')),
    checkFields: (_e, fields) => ws.checkFields(v.fieldDefs(fields)),
    getTypeUsage: () => ws.typeUsage(),
    saveSchemaTypes: (_e, itemTypes, linkTypes, revision) => ws.saveSchemaTypes(v.itemTypeDefs(itemTypes), v.linkTypeDefs(linkTypes), v.str(revision, 'revision')),
    saveSchemaRules: (_e, rules, revision) => ws.saveSchemaRules(v.coverageRules(rules), v.str(revision, 'revision')),
    // '' = the loose files in requirements/ (QA-1 of 0.20.0)
    getCoverage: (_e, document) => ws.getCoverage(document === undefined || document === null ? undefined : document === '' ? '' : v.str(document, 'document', 300)),
    getImpact: (_e, id) => ws.getImpact(v.id(id)),
    starterRules: () => ws.starterRules(),
    getMatrix: (_e, req) => ws.getMatrix(v.matrixRequest(req)),
    exportMatrix: (e, req) => {
      const r = v.matrixRequest(req)
      return saveExport(e, `traceability-matrix-${today()}`, 'xlsx', () => ws.exportMatrix(r))
    },
    // real items are checked as IDs (CRA-19); removeLink's target may be a broken link's text, so there it stays a string
    addLink: (_e, source, type, target) => ws.addLink(v.id(source), v.str(type, 'link type', 64), v.id(target)),
    removeLink: (_e, source, type, target) => ws.removeLink(v.id(source), v.str(type, 'link type', 64), v.str(target, 'target', 200)),
    decideLinks: (_e, decisions) => ws.decideLinks(v.linkDecisions(decisions)),
    revertChange: (_e, id, part) => ws.revertChange(v.id(id), v.revertPart(part)),
    fixFileName: (_e, id) => ws.fixFileName(v.id(id)),
    renewCopyId: (_e, id) => ws.renewCopyId(v.id(id)),

    // ---------- Git, Compare
    getGitState: () => ws.gitState(),
    commit: (_e, message) => ws.commit(v.text(message, 'commit message', 100_000)),
    pull: () => ws.pull(),
    pullFrom: (_e, source) => ws.pullFrom(v.str(source, 'branch', 300)),
    finishPull: (_e, plan, answers) => ws.finishPull(v.mergePlan(plan), v.mergeAnswers(answers)),
    listBranches: () => ws.listBranches(),
    createBranch: (_e, name) => ws.createBranch(v.str(name, 'branch name', 250)),
    listBaselines: () => ws.listBaselines(),
    createBaseline: (_e, req) => ws.createBaseline(v.baselineRequest(req)),
    getHistory: (_e, req) => ws.getHistory(v.historyRequest(req)),
    openVersion: (_e, ref) => ws.openVersion(v.commitRef(ref)),
    closeVersion: () => ws.closeVersion(),
    createBranchAt: (_e, name, commit) => ws.createBranchAt(v.str(name, 'branch name', 250), v.commitRef(commit)),
    switchBranch: (_e, name, changes) => ws.switchBranch(v.str(name, 'branch', 300), v.oneOf(changes, ['take', 'discard'] as const, 'choice')),
    branchRange: (_e, name) => ws.branchRange(v.str(name, 'branch', 300)),
    setLanguage: async (_e, lang) => setLanguage(v.oneOf(lang, ['en', 'ar'] as const, 'language')),
    deleteBranch: (_e, name, force) => ws.deleteBranch(v.str(name, 'branch', 300), force === true),
    push: () => ws.push(),
    discardChanges: (_e, paths) => ws.discardChanges(v.strings(paths, 'files')),
    setGitIdentity: (_e, name, email) => ws.setGitIdentity(v.text(name, 'name', 200), v.text(email, 'e-mail', 200)),
    undoLastCommit: () => ws.undoLastCommit(),
    getItemHistory: (_e, id) => ws.itemHistory(v.id(id)),
    compareItemVersion: (_e, id, hash) => ws.compareItemVersion(v.id(id), v.str(hash, 'version')),
    getCompareOptions: () => ws.compareOptions(),
    compareVersions: (_e, from, to) => ws.compareVersions(v.str(from, 'from'), v.str(to, 'to')),

    // ---------- import (M7)
    chooseImportFile: (e) => chooseFile(e),
    openImportFile: (_e, path) => readImportFile(v.importPath(path, IMPORT_EXTENSIONS)),
    previewImport: (_e, settings) => {
      const s = v.importSettings(settings)
      const { f, rows } = sheetOf(s.token, s.sheet)
      return ws.previewImport(rows, { ...s, textFile: f.kind === 'csv' })
    },
    runImport: (_e, settings, message) => {
      const s = v.importSettings(settings)
      const { f, rows } = sheetOf(s.token, s.sheet)
      const commit = v.text(message, 'commit message', 10_000)
      return ws.runImport(rows, { ...s, textFile: f.kind === 'csv' }, { path: f.path, name: f.name, kind: f.kind }, commit || undefined)
    },
    newProjectFromFile: async (e) => {
      try {
        const file = await chooseFile(e)
        if (!file) return { ok: false, canceled: true }
        // the folder must be empty: a full one is refused right there, and the folder dialog opens again
        for (;;) {
          const folder = await openDialog(e, { title: T.importDialog.folderTitle, properties: ['openDirectory', 'createDirectory', 'promptToCreate'] })
          if (!folder) return { ok: false, canceled: true }
          const inside = await readdir(folder).catch(() => [] as string[])
          // the first document is named after the file ("Brake spec.xlsx" → "Brake spec"), S-10
          const named = basename(file.path).replace(/\.[^.]+$/, '').trim()
          if (inside.length === 0) return { ok: true, info: await ws.createProject(folder, isDocumentName(named) ? named : FIRST_DOCUMENT), file }
          const win = BrowserWindow.fromWebContents(e.sender)
          const opts = { type: 'warning' as const, title: T.importDialog.titleNew, message: T.importMsg.notEmpty, detail: T.importMsg.notEmptyDetail(folder), buttons: [T.importDialog.chooseAnother, T.common.cancel], defaultId: 0, cancelId: 1, noLink: true }
          const answer = win ? await dialog.showMessageBox(win, opts) : await dialog.showMessageBox(opts)
          if (answer.response !== 0) return { ok: false, canceled: true }
        }
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
        if (src.kind === 'reqif') return { ok: false, message: T.importMsg.reqifNoUpdate }
        const f = await loadImportFile(src.path).catch(() => {
          throw new Error(T.importMsg.sourceMissing(src.path))
        })
        const sheet = f.sheets.find((x) => x.name === src.sheet) ?? (f.kind === 'csv' ? f.sheets[0] : undefined)
        if (!sheet) return { ok: false, message: T.importMsg.noSheet(src.sheet) }
        const u = await ws.sourceUpdate(sheet.rows)
        let target = src.path
        const macros = /\.xlsm$/i.test(src.path)
        if (m === 'original' && updateTarget(src.path, 'original') === null) return { ok: false, message: T.importMsg.macroOriginal }
        if (m === 'copy') {
          const win = BrowserWindow.fromWebContents(e.sender)
          const ext = f.kind === 'xlsx' ? 'xlsx' : 'csv'
          const opts = { title: T.importDialog.copyTitle, defaultPath: src.path.replace(/(\.[^.\\/]+)$/, macros ? ' (updated).xlsx' : ` (updated)$1`), filters: [{ name: T.importDialog.fileFilter, extensions: [ext] }] }
          const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
          if (r.canceled || !r.filePath) return { ok: false, canceled: true }
          // the macros cannot be kept (CR3-04): the copy is a plain workbook and must carry the .xlsx name
          target = updateTarget(src.path, 'copy', r.filePath) ?? r.filePath
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
      const f = v.oneOf(format, ['csv', 'markdown', 'xlsx', 'reqif'], 'export format')
      return saveExport(e, `requirement-changes-${today()}`, f, () => ws.exportCompare(v.str(from, 'from'), v.str(to, 'to'), f))
    }
  }

  for (const [name, handler] of Object.entries(handlers) as [InvokeMethod, Handlers[InvokeMethod]][]) {
    // only our own window's page may call (SEC-WP3-09): a frame from anywhere else is refused
    ipcMain.handle(Channels[name], (e, ...args) => {
      // (a real event always has the property — null when the frame is gone; only unit-test fakes leave it out)
      if (e.senderFrame !== undefined) {
        const url = e.senderFrame?.url ?? ''
        if (!e.senderFrame || e.senderFrame.parent || !(url.startsWith('file://') || (!app.isPackaged && url.startsWith('http://localhost')))) throw new Error('Refused: unknown caller')
      }
      return (handler as (e: Electron.IpcMainInvokeEvent, ...a: unknown[]) => unknown)(e, ...args)
    })
  }

  ipcMain.on(Channels.reportUiError, (_e, message: unknown) => {
    log.error(`UI error: ${String(message).slice(0, 4000)}`)
  })
}
