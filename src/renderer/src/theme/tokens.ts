// Pure mapping from design tokens to CSS variable names (no DOM access, so it is unit-testable).
//   typography.fontFamily  -> --rm-font-family
//   shape.buttonRadius     -> --rm-shape-button-radius
//   modes.dark.primary     -> --rm-color-primary (when dark mode is active)
import type { ThemeConfig } from '../../../shared/api'

const kebab = (s: string): string => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

export function tokensToCssVars(config: ThemeConfig, effective: 'light' | 'dark'): Record<string, string> {
  const vars: Record<string, string> = {}
  const add = (prefix: string, group: Record<string, string>): void => {
    for (const [k, v] of Object.entries(group)) vars[`--rm-${prefix}-${kebab(k)}`] = v
  }
  // typography.fontSizeBase -> --rm-font-size-base (the "font" prefix is not repeated)
  const typography = Object.entries(config.typography).map(([k, v]) => [
    k.replace(/^font([A-Z])/, (_m, c: string) => c.toLowerCase()),
    v
  ])
  add('font', Object.fromEntries(typography))
  add('shape', config.shape)
  add('space', config.spacing)
  add('color', config.modes[effective])
  return vars
}
