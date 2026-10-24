// PUBLIC ENTRY of the theme module. Other code may import only from this file.
// Responsibility: load the user-editable design tokens (config/theme.json) and the logo,
// validate them, and fall back to built-in defaults for anything missing or broken.
import type { LoadedTheme } from '../../shared/api'
import { createFileThemeService } from './fileTheme'

export interface ThemeService {
  load(): Promise<LoadedTheme>
}

export { createFileThemeService }
export { DEFAULT_THEME, validateTheme } from './defaults'
