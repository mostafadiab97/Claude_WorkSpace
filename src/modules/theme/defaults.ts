import type { ThemeConfig } from '../../shared/api'

/**
 * Built-in fallback, used only if config/theme.json is missing or a token is invalid.
 * Keep it identical to config/theme.json as shipped.
 */
export const DEFAULT_THEME: ThemeConfig = {
  brand: { name: 'ReqMan', logo: 'logo.svg' },
  typography: {
    fontFamily: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif",
    fontFamilyMono: "'Cascadia Mono', Consolas, monospace",
    fontSizeBase: '14px',
    fontSizeSmall: '12px',
    fontSizeLarge: '18px',
    fontSizeTitle: '24px',
    fontWeightNormal: '400',
    fontWeightStrong: '600'
  },
  shape: {
    radiusSmall: '4px',
    radiusMedium: '8px',
    radiusLarge: '12px',
    buttonRadius: '6px',
    borderWidth: '1px'
  },
  spacing: { xs: '4px', sm: '8px', md: '12px', lg: '20px', xl: '32px' },
  modes: {
    light: {
      background: '#f6f7f9',
      surface: '#ffffff',
      surfaceAlt: '#eef0f4',
      text: '#1b1f27',
      textMuted: '#5d6676',
      border: '#d9dde5',
      primary: '#2f5bd3',
      primaryHover: '#2449b0',
      primaryText: '#ffffff',
      success: '#22c55e',
      warning: '#b26b00',
      danger: '#c23934',
      focus: '#7aa2ff',
      rowHover: '#f1f3f7',
      selection: '#e3ebff',
      scrollbarThumb: '#c3c9d3',
      scrollbarThumbHover: '#9aa3b2',
      diffOldBg: '#fdecec',
      diffNewBg: '#e6f6ec',
      diffOldMark: '#f5b5b2',
      diffNewMark: '#9fe2b8'
    },
    dark: {
      background: '#14171c',
      surface: '#1c2027',
      surfaceAlt: '#252a33',
      text: '#e7eaf0',
      textMuted: '#9aa3b2',
      border: '#323844',
      primary: '#6f93ff',
      primaryHover: '#8aa8ff',
      primaryText: '#0e1220',
      success: '#4cc57f',
      warning: '#f0a73a',
      danger: '#ff6b65',
      focus: '#9db8ff',
      rowHover: '#20252d',
      selection: '#263352',
      scrollbarThumb: '#3a414e',
      scrollbarThumbHover: '#566070',
      diffOldBg: '#3d1f22',
      diffNewBg: '#16362a',
      diffOldMark: '#8c3036',
      diffNewMark: '#1e7a48'
    }
  }
}

const GROUPS = ['typography', 'shape', 'spacing'] as const

/**
 * Merges a theme file over a base theme (by default the built-in one). Unknown or wrongly-typed values
 * are ignored with a warning, so a typo in theme.json can never break the app.
 */
export function validateTheme(
  input: unknown,
  base: ThemeConfig = DEFAULT_THEME
): { theme: ThemeConfig; warnings: string[] } {
  const warnings: string[] = []
  const theme: ThemeConfig = structuredClone(base)
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { theme, warnings: ['theme.json is not a JSON object; ignored.'] }
  }
  const src = input as Record<string, unknown>

  const brand = src.brand as Record<string, unknown> | undefined
  if (brand) {
    if (typeof brand.name === 'string') theme.brand.name = brand.name
    if (typeof brand.logo === 'string') theme.brand.logo = brand.logo
  }

  const mergeGroup = (target: Record<string, string>, value: unknown, path: string): void => {
    if (value === undefined) return
    if (typeof value !== 'object' || value === null) {
      warnings.push(`${path} must be an object; ignored.`)
      return
    }
    for (const [key, v] of Object.entries(value)) {
      if (typeof v === 'string' && v.trim() !== '') target[key] = v
      else warnings.push(`${path}.${key} must be a non-empty string; ignored.`)
    }
  }

  for (const group of GROUPS) mergeGroup(theme[group], src[group], group)
  const modes = src.modes as Record<string, unknown> | undefined
  if (modes) {
    mergeGroup(theme.modes.light, modes.light, 'modes.light')
    mergeGroup(theme.modes.dark, modes.dark, 'modes.dark')
  }
  return { theme, warnings }
}
