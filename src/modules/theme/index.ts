// PUBLIC ENTRY of the theme module. Other code may import only from this file.
// Responsibility: load design tokens and the logo in three layers —
//   built-in defaults ← shipped config/theme.json ← the user's own theme.json —
// validating each layer and ignoring invalid values with a warning.
import type { LoadedTheme, ThemeLayers, ThemeOverrides } from '../../shared/api'
import { createFileThemeService } from './fileTheme'

export interface ThemeService {
  load(): Promise<LoadedTheme>
  /** Absolute path of the user's own theme.json (it may not exist yet). */
  readonly userThemeFile: string
  /** Creates the user's theme.json from the shipped theme if it does not exist yet; returns its path. */
  ensureUserThemeFile(): Promise<string>
  /** 0.24.0 theme editor: the app theme (defaults ← shipped) and the user's own values. */
  layers(): Promise<ThemeLayers>
  /**
   * Writes the user's own values (only what differs from the app theme), checked like any theme layer; other keys of
   * the user's file (brand, notes) are kept. Atomic write. Returns the theme as now loaded.
   */
  saveUser(user: ThemeOverrides): Promise<LoadedTheme>
}

export { createFileThemeService }
export { DEFAULT_THEME, validateTheme } from './defaults'
