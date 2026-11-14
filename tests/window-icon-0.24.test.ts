// 0.24.3 (the owner, 14 Nov 2026): the window and taskbar icon follow the colour mode shown in the app — the same tile
// as the logo in the top bar (Light → dark tile, Dark → white tile, Ember → Ember tile).
import { existsSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { isPackaged: false, getAppPath: () => process.cwd() }, nativeTheme: { shouldUseDarkColors: true } }))
const { windowIcon } = await import('../src/main/windowIcon')

describe('window icon (0.24.3)', () => {
  it('follows the app mode', () => {
    expect(windowIcon('light')).toMatch(/reqochet-icon-256\.png$/)
    expect(windowIcon('dark')).toMatch(/reqochet-icon-light-256\.png$/)
    expect(windowIcon('ember')).toMatch(/reqochet-icon-ember-256\.png$/)
  })
  it('before the window says its mode, Windows dark gives the white tile (as the app shows it in System mode)', () => {
    expect(windowIcon()).toMatch(/reqochet-icon-light-256\.png$/)
  })
  it('every icon file exists', () => {
    for (const m of ['light', 'dark', 'ember'] as const) expect(existsSync(windowIcon(m))).toBe(true)
  })
})
