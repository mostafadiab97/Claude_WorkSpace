// Before an installer replaces the app (Restart to update, Go back to version X), the window closes the normal way,
// so unsaved edits get the usual "Unsaved changes" question. W-09: the installer used to start first and the app quit
// under it — "Keep editing" could not keep anything.
import { app, BrowserWindow, type WebContents } from 'electron'

/** How long a closed app waits for the installer to take over before it quits by itself. */
export const INSTALLER_GRACE_MS = 20_000

let held = false
/** True while a window is closing for an installer: the app must not quit on "all windows closed" by itself. */
export const quitHeld = (): boolean => held

/** Closes the window of `sender`; true when it closed, false when the user chose to keep editing. */
export function closeForInstall(sender: WebContents): Promise<boolean> {
  const win = BrowserWindow.fromWebContents(sender)
  if (!win || win.isDestroyed()) return Promise.resolve(true)
  held = true
  return new Promise((resolve) => {
    const done = (closed: boolean): void => {
      win.removeListener('closed', onClosed)
      if (!win.isDestroyed()) win.webContents.removeListener('will-prevent-unload', onAsked)
      if (!closed) held = false
      resolve(closed)
    }
    const onClosed = (): void => {
      // if no installer takes over (it failed, or there was nothing to install) the app must not stay running without
      // a window: quit anyway after a while (CR-03)
      setTimeout(() => app.quit(), INSTALLER_GRACE_MS).unref?.()
      done(true)
    }
    // runs after the "Unsaved changes" dialog's listener (registered when the window was made): not prevented = kept
    const onAsked = (event: Electron.Event): void => {
      if (!event.defaultPrevented) done(false)
    }
    win.once('closed', onClosed)
    win.webContents.on('will-prevent-unload', onAsked)
    win.close()
  })
}
