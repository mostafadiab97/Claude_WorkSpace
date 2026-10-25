// PUBLIC ENTRY of the theme module. Other code may import only from this file.
// Responsibility: load design tokens and the logo in three layers —
//   built-in defaults ← shipped config/theme.json ← the user's own theme.json —
// validating each layer and ignoring invalid values with a warning.
import type { LoadedTheme } from '../../shared/api'
import { createFileThemeService } from './fileTheme'

export interface ThemeService {
  load(): Promise<LoadedTheme>
  /** Absolute path of the user's own theme.json (it may not exist yet). */
  readonly userThemeFile: string
  /** Creates the user's theme.json from the shipped theme if it does not exist yet; returns its path. */
  ensureUserThemeFile(): Promise<string>
}

export { createFileThemeService }
export { DEFAULT_THEME, validateTheme } from './defaults'
