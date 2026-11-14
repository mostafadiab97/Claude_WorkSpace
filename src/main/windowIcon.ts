import { app, nativeTheme } from 'electron'
import { join } from 'node:path'

/**
 * The window and taskbar icon (Windows uses one for both): the same tile as the logo in the app's top bar for the colour
 * mode chosen in the app (the owner, 14 Nov 2026 — replaces "follow the Windows taskbar colour" of 8 Nov): Light → the
 * dark tile, Dark → the white tile, Ember → the Ember tile. Until the window says its mode, Windows' light/dark decides.
 */
export function windowIcon(mode?: 'light' | 'dark' | 'ember'): string {
  const shown = mode ?? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  const file = shown === 'ember' ? 'reqochet-icon-ember-256.png' : shown === 'dark' ? 'reqochet-icon-light-256.png' : 'reqochet-icon-256.png'
  return join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'resources', 'brand', 'icon', 'png', file)
}
