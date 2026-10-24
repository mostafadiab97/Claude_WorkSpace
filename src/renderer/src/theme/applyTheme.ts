// Turns the design tokens from config/theme.json into CSS custom properties on <html>.
// Every style in the UI reads these variables (var(--rm-...)); nothing hard-codes a colour, font or radius.
//   typography.fontFamily  -> --rm-font-family
//   shape.buttonRadius     -> --rm-shape-button-radius
//   modes.dark.primary     -> --rm-color-primary (when dark mode is active)
import type { ThemeConfig } from '../../../shared/api'
import { tokensToCssVars } from './tokens'

export type ThemeMode = 'system' | 'light' | 'dark'
const STORAGE_KEY = 'reqman.themeMode'

export function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(config: ThemeConfig, mode: ThemeMode): void {
  const effective = resolveMode(mode)
  const root = document.documentElement
  for (const [name, value] of Object.entries(tokensToCssVars(config, effective))) {
    root.style.setProperty(name, value)
  }
  root.dataset['theme'] = effective
  root.style.colorScheme = effective
}

export function loadSavedMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function saveMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    /* storage unavailable: the choice simply isn't remembered */
  }
}
