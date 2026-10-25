// Core (main) process entry: creates the window, wires services, registers the UI API.
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { createServices, type Paths } from './composition'
import { registerIpc } from './ipc'

app.setName('ReqMan')

function resolvePaths(): Paths {
  // Installed app: config/ and resources/ are copied next to the app (electron-builder extraResources),
  // so the theme can be edited without rebuilding. During development they are read from the repo.
  const base = app.isPackaged ? process.resourcesPath : app.getAppPath()
  return {
    configDir: join(base, 'config'),
    resourceDir: join(base, 'resources'),
    // Windows: %APPDATA%\ReqMan\logs
    logDir: app.getPath('logs')
  }
}

function createWindow(services: ReturnType<typeof createServices>): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 560,
    show: false,
    title: 'ReqMan',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  win.once('ready-to-show', () => win.show())

  // Links open in the user's browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('render-process-gone', (_e, details) => {
    services.log.error(`UI process stopped: ${details.reason} (exit code ${details.exitCode})`)
  })
  win.webContents.on('did-fail-load', (_e, code, description) => {
    services.log.error(`UI failed to load: ${description} (${code})`)
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  const paths = resolvePaths()
  const services = createServices(paths)
  const { log } = services

  log.info(
    `ReqMan ${app.getVersion()} starting — ${process.platform} ${process.getSystemVersion()} ${process.arch}, ` +
      `Electron ${process.versions.electron}, packaged=${app.isPackaged}`
  )
  log.info(`Config folder: ${paths.configDir}`)
  process.on('uncaughtException', (e) => log.error('Unexpected error in core', e))
  process.on('unhandledRejection', (e) => log.error('Unhandled promise rejection in core', e))

  registerIpc(services, paths)
  createWindow(services)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(services)
  })
  app.on('will-quit', () => log.info('ReqMan closed normally'))
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
