import type { ThemeConfig } from '../../shared/api'

/**
 * Built-in fallback, used only if config/theme.json is missing or a token is invalid.
 * Keep it identical to config/theme.json as shipped.
 */
export const DEFAULT_THEME: ThemeConfig = {
  brand: { name: 'reqochet', logo: '' },
  typography: {
    fontFamily: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif",
    fontFamilyMono: "'Cascadia Mono', Consolas, monospace",
    fontSizeBase: '14px',
    fontSizeSmall: '12px',
    fontSizeBaseArabic: '15px',
    fontSizeSmallArabic: '13px',
    fontSizeMedium: '16px',
    fontSizeLarge: '18px',
    fontSizeTitle: '24px',
    fontWeightNormal: '400',
    fontWeightMedium: '500',
    fontWeightStrong: '600'
  },
  shape: {
    radiusSmall: '4px',
    radiusMedium: '8px',
    radiusLarge: '10px',
    buttonRadius: '6px',
    borderWidth: '1px',
    controlHeight: '32px',
    controlHeightSmall: '24px',
    shadowPopover: '0 6px 24px',
    shadowDialog: '0 16px 48px'
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px'
  },
  modes: {
    light: {
      background: '#f2f4f7',
      surface: '#ffffff',
      surfaceAlt: '#e9ecf1',
      text: '#1b1f27',
      textMuted: '#566070',
      border: '#d5dae2',
      borderStrong: '#7f8898',
      primary: '#2f5bd3',
      primaryHover: '#2449b0',
      primaryText: '#ffffff',
      success: '#137a39',
      warning: '#8a5300',
      gap: '#c96a00',
      danger: '#b9322d',
      focus: '#3866e0',
      rowHover: '#f1f3f7',
      selection: '#dfe8ff',
      scrollbarThumb: '#c3c9d3',
      scrollbarThumbHover: '#9aa3b2',
      diffOldBg: '#fdecec',
      diffNewBg: '#e6f6ec',
      diffOldMark: '#f5b5b2',
      diffNewMark: '#9fe2b8',
      successBg: '#e6f6ec',
      warningBg: '#fff4de',
      dangerBg: '#fdecec',
      infoBg: '#eaf0ff'
    },
    dark: {
      background: '#121519',
      surface: '#1b1f27',
      surfaceAlt: '#262b35',
      text: '#e7eaf0',
      textMuted: '#a3acba',
      border: '#343b48',
      borderStrong: '#6b7587',
      primary: '#7c9cff',
      primaryHover: '#94afff',
      primaryText: '#0e1220',
      success: '#4cc57f',
      warning: '#f0a73a',
      gap: '#f5a623',
      danger: '#ff7a74',
      focus: '#9db8ff',
      rowHover: '#20252d',
      selection: '#25345a',
      scrollbarThumb: '#3a414e',
      scrollbarThumbHover: '#566070',
      diffOldBg: '#3d1f22',
      diffNewBg: '#16362a',
      diffOldMark: '#7a2a30',
      diffNewMark: '#1a6b40',
      successBg: '#15301f',
      warningBg: '#3a2c12',
      dangerBg: '#3a1d20',
      infoBg: '#1d2946'
    },
    // 0.23.0 Ember (the owner, 13 Nov): a warm dark mode with orange accents and a soft glow; same keys as dark
    ember: {
      background: '#14100d',
      surface: '#1d1814',
      surfaceAlt: '#2a231d',
      text: '#f3ebe2',
      textMuted: '#b8aa9a',
      border: '#3d342b',
      borderStrong: '#8c7865',
      primary: '#ff8a3d',
      primaryHover: '#ffa35f',
      primaryText: '#1f0f04',
      success: '#6cc98a',
      warning: '#f2c14e',
      gap: '#f2c14e',
      danger: '#ff7b6e',
      focus: '#ffb070',
      rowHover: '#241e19',
      selection: '#4a2c14',
      scrollbarThumb: '#45392f',
      scrollbarThumbHover: '#65554a',
      diffOldBg: '#3f1d1c',
      diffNewBg: '#1b3324',
      diffOldMark: '#7d2b2b',
      diffNewMark: '#256b40',
      successBg: '#1a2f20',
      warningBg: '#3a2d10',
      dangerBg: '#3d1c1a',
      infoBg: '#3a2616'
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
    // "ReqMan" was the old default name, copied into users' themes before the rename: it does not override the new one
    if (typeof brand.name === 'string' && brand.name !== 'ReqMan') theme.brand.name = brand.name
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
    mergeGroup(theme.modes.ember, modes.ember, 'modes.ember')
  }
  return { theme, warnings }
}
