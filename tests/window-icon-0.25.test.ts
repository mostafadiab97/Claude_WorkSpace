// 0.25.0 (the owner on 0.24.3 test 2): the window icon must stand out on the title bar — a white tile on a dark title
// bar, the dark tile on a light one. The app's mode now also sets the title bar's colour (nativeTheme.themeSource).
import { existsSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

const nativeTheme = { themeSource: 'system', shouldUseDarkColors: true }
vi.mock('electron', () => ({ app: { isPackaged: false, getAppPath: () => process.cwd() }, nativeTheme }))
const { windowIcon, themeSourceFor, applyWindowMode } = await import('../src/main/windowIcon')

describe('title bar and window icon (0.25.0)', () => {
  it('white tile on a dark bar, dark tile on a light bar', () => {
    expect(windowIcon(true)).toMatch(/reqochet-icon-light-256\.png$/)
    expect(windowIcon(false)).toMatch(/reqochet-icon-256\.png$/)
  })
  it('the app mode decides the title bar; Ember is a dark bar; System leaves it to Windows', () => {
    expect(themeSourceFor('light')).toBe('light')
    expect(themeSourceFor('dark')).toBe('dark')
    expect(themeSourceFor('ember')).toBe('dark')
    expect(themeSourceFor('system')).toBe('system')
  })
  it('applying a mode sets the bar and an icon that stands out on it', () => {
    const set = vi.fn()
    nativeTheme.shouldUseDarkColors = false // what Electron reports after themeSource = light
    applyWindowMode({ setIcon: set }, 'light')
    expect(nativeTheme.themeSource).toBe('light')
    expect(set).toHaveBeenLastCalledWith(expect.stringMatching(/reqochet-icon-256\.png$/))
    nativeTheme.shouldUseDarkColors = true
    applyWindowMode({ setIcon: set }, 'ember')
    expect(nativeTheme.themeSource).toBe('dark')
    expect(set).toHaveBeenLastCalledWith(expect.stringMatching(/reqochet-icon-light-256\.png$/))
  })
  it('both icon files exist', () => {
    expect(existsSync(windowIcon(true)) && existsSync(windowIcon(false))).toBe(true)
  })
})
