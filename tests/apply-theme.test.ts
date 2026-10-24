import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME } from '../src/modules/theme'
import { tokensToCssVars } from '../src/renderer/src/theme/tokens'

describe('tokensToCssVars', () => {
  it('maps tokens to predictable CSS variable names', () => {
    const vars = tokensToCssVars(DEFAULT_THEME, 'dark')
    expect(vars['--rm-font-family']).toBe(DEFAULT_THEME.typography.fontFamily)
    expect(vars['--rm-font-size-base']).toBe('14px')
    expect(vars['--rm-shape-button-radius']).toBe('6px')
    expect(vars['--rm-space-lg']).toBe('20px')
    expect(vars['--rm-color-primary']).toBe(DEFAULT_THEME.modes.dark.primary)
    expect(vars['--rm-color-text-muted']).toBe(DEFAULT_THEME.modes.dark.textMuted)
  })
})
