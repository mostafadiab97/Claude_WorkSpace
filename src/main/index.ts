// Core (main) process entry: creates the window, wires services, registers the UI API.
import { app, BrowserWindow, dialog, nativeTheme, session, shell } from 'electron'
import { join } from 'node:path'
import { createServices, type Paths } from './composition'
import { registerIpc } from './ipc'
import { moveLegacyUserData, removeLegacyUpdaterCache } from './legacyData'
import { quitHeld } from './closeForInstall'
import { T } from '../shared/text'
import { Channels } from '../shared/api'

// The name comes from package.json "productName": reqochet-dev in the development repository, reqochet in the release
// repository (owner, 4 Nov 2026). It decides the settings folder (%APPDATA%\<name>) and, with electron-builder's
// appId, the installed app — the two tools can sit side by side on one PC.
const PRODUCT = app.getName()

// One app per user (review D-02): a second start (e.g. a double-click on the shortcut while ReqMan is open)
// brings the open window to the front instead of starting a second app on the same data.
const firstInstance = app.requestSingleInstanceLock()
if (!firstInstance) app.quit()
app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
})

function resolvePaths(): Paths {
  // Installed app: config/ and resources/ are copied next to the app (electron-builder extraResources),
  // so the theme can be edited without rebuilding. During development they are read from the repo.
  const base = app.isPackaged ? process.resourcesPath : app.getAppPath()
  return {
    configDir: join(base, 'config'),
    resourceDir: join(base, 'resources'),
    // Windows: %APPDATA%\ReqMan\logs and %APPDATA%\ReqMan
    logDir: app.getPath('logs'),
    userDir: app.getPath('userData'),
    packaged: app.isPackaged
  }
}

/** The window and taskbar icon for the current Windows colours (the taskbar's own colour where Windows tells it). */
function windowIcon(): string {
  const dark = process.platform === 'win32' ? nativeTheme.shouldUseDarkColorsForSystemIntegratedUI : nativeTheme.shouldUseDarkColors
  return join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'resources', 'brand', 'icon', 'png', dark ? 'reqochet-icon-256.png' : 'reqochet-icon-light-256.png')
}

function createWindow(services: ReturnType<typeof createServices>): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 560,
    show: false,
    title: PRODUCT,
    // the brand icon in the taskbar follows Windows: dark tile on a dark taskbar, light tile on a light one (the owner,
    // 8 Nov 2026); the .exe, Start menu and desktop shortcut carry the light tile (they cannot change by themselves)
    icon: windowIcon(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  win.once('ready-to-show', () => win.show())
  const followTheme = (): void => {
    if (!win.isDestroyed()) win.setIcon(windowIcon())
  }
  nativeTheme.on('updated', followTheme)
  win.on('closed', () => nativeTheme.off('updated', followTheme))

  // Links open in the user's browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  // Security check 3 Nov 2026: the window never navigates away from ReqMan's own page (a link or a file dropped on it
  // would otherwise load a foreign page that could reach window.reqochet). External https links go to the browser.
  win.webContents.on('will-navigate', (event, url) => {
    if (url === win.webContents.getURL()) return
    event.preventDefault()
    if (url.startsWith('https://')) void shell.openExternal(url)
  })

  // The UI blocks closing while it has unsaved changes; ask the user instead of silently refusing.
  win.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: [T.app.unsavedDiscard, T.app.unsavedKeep],
      defaultId: 1,
      cancelId: 1,
      title: T.app.unsavedTitle,
      message: T.app.unsavedMessage,
      detail: T.app.unsavedDetail
    })
    if (choice === 0) event.preventDefault() // preventDefault here means: allow the window to close
  })

  win.webContents.on('render-process-gone', (_e, details) => {
    services.log.error(`UI process stopped: ${details.reason} (exit code ${details.exitCode})`)
  })
  win.webContents.on('did-fail-load', (_e, code, description) => {
    services.log.error(`UI failed to load: ${description} (${code})`)
  })

  // the dev server only in development: an installed app always loads its own files (SEC-WP3-08)
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(async () => {
  if (!firstInstance) return
  // the app needs one web permission — writing text to the clipboard (the "Copy report" buttons); every other
  // request (camera, microphone, notifications…) is refused (SEC-WP3-10). Refusing all of them broke Copy report
  // in 0.21.3 (the owner's report, 12 Nov).
  const allowed = (permission: string): boolean => permission === 'clipboard-sanitized-write'
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed(permission)))
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed(permission))
  const paths = resolvePaths()
  // 0.16: the first start after the switch from ReqMan copies the user's settings over and removes the old folder —
  // only for the installed app in its normal settings folder (never for tests or a --user-data-dir).
  const moved: string[] = []
  const defaultUserData = join(app.getPath('appData'), PRODUCT)
  if (app.isPackaged && paths.userDir === defaultUserData) {
    const note = { info: (m: string) => moved.push(m), warn: (m: string) => moved.push(`WARN ${m}`) }
    await moveLegacyUserData(join(app.getPath('appData'), 'ReqMan'), paths.userDir, note)
    if (process.env['LOCALAPPDATA']) await removeLegacyUpdaterCache(process.env['LOCALAPPDATA'], note)
  }
  const services = createServices(paths, app.getVersion())
  const { log } = services
  for (const m of moved) {
    if (m.startsWith('WARN ')) log.warn(m.slice(5))
    else log.info(m)
  }

  log.info(
    `${PRODUCT} ${app.getVersion()} starting — ${process.platform} ${process.getSystemVersion()} ${process.arch}, ` +
      `Electron ${process.versions.electron}, packaged=${app.isPackaged}`
  )
  log.info(`Config folder: ${paths.configDir}`)
  process.on('uncaughtException', (e) => log.error('Unexpected error in core', e))
  process.on('unhandledRejection', (e) => log.error('Unhandled promise rejection in core', e))

  registerIpc(services, paths)
  createWindow(services)
  services.updater.start((status) => {
    log.info(`Update status: ${JSON.stringify(status)}`)
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send(Channels.updateStatusChanged, status)
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(services)
  })
  app.on('will-quit', () => log.info(`${PRODUCT} closed normally`))
})

app.on('window-all-closed', () => {
  if (quitHeld()) return // an installer is about to take over and quits the app itself (W-09)
  if (process.platform !== 'darwin') app.quit()
})
