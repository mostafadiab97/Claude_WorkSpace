// Core (main) process entry: creates the window, wires services, registers the UI API.
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { createServices } from './composition'
import { registerIpc } from './ipc'

app.setName('ReqMan')

function resolvePaths(): { configDir: string; resourceDir: string } {
  // Installed app: config/ and resources/ are copied next to the app (electron-builder extraResources),
  // so the theme can be edited without rebuilding. During development they are read from the repo.
  const base = app.isPackaged ? process.resourcesPath : app.getAppPath()
  return { configDir: join(base, 'config'), resourceDir: join(base, 'resources') }
}

function createWindow(): void {
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

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  registerIpc(createServices(resolvePaths()))
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
