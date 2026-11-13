// Turns the design tokens from config/theme.json into CSS custom properties on <html>.
// Every style in the UI reads these variables (var(--rm-...)); nothing hard-codes a colour, font or radius.
//   typography.fontFamily  -> --rm-font-family
//   shape.buttonRadius     -> --rm-shape-button-radius
//   modes.dark.primary     -> --rm-color-primary (when dark mode is active)
import { useEffect, useState } from 'react'
import type { ThemeConfig } from '../../../shared/api'
import { tokensToCssVars } from './tokens'

export type ThemeMode = 'system' | 'light' | 'dark' | 'ember'
/** The colour set shown: Ember is a dark mode of its own (0.23.0). */
export type Shown = 'light' | 'dark' | 'ember'
const STORAGE_KEY = 'reqman.themeMode'

export function resolveMode(mode: ThemeMode): Shown {
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
  root.style.colorScheme = effective === 'light' ? 'light' : 'dark'
}

export function loadSavedMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' || v === 'ember' || v === 'system' ? v : 'system'
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

/** Light or dark as shown now — follows Windows while the mode is System; Ember counts as dark (to pick the brand files). */
export function useEffectiveMode(mode: ThemeMode): 'light' | 'dark' {
  const [system, setSystem] = useState<'light' | 'dark'>(() => (resolveMode('system') === 'dark' ? 'dark' : 'light'))
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => setSystem(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mode === 'system' ? system : mode === 'ember' ? 'dark' : mode
}
