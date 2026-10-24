import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFileThemeService, DEFAULT_THEME, validateTheme } from '../src/modules/theme'

const repoRoot = join(__dirname, '..')

describe('theme module', () => {
  it('shipped config/theme.json matches the built-in default exactly', async () => {
    const shipped = JSON.parse(await readFile(join(repoRoot, 'config', 'theme.json'), 'utf8'))
    expect(shipped).toEqual(DEFAULT_THEME)
  })

  it('loads the shipped theme and logo without warnings', async () => {
    const t = await createFileThemeService(join(repoRoot, 'config'), join(repoRoot, 'resources')).load()
    expect(t.source).toBe('file')
    expect(t.warnings).toEqual([])
    expect(t.logoDataUrl.startsWith('data:image/svg+xml;base64,')).toBe(true)
  })

  it('overrides only the tokens a user changes', () => {
    const { theme, warnings } = validateTheme({ modes: { dark: { primary: '#ff0000' } } })
    expect(theme.modes.dark.primary).toBe('#ff0000')
    expect(theme.modes.light.primary).toBe(DEFAULT_THEME.modes.light.primary)
    expect(warnings).toEqual([])
  })

  it('ignores invalid values with a warning instead of breaking', () => {
    const { theme, warnings } = validateTheme({ shape: { buttonRadius: 6 }, spacing: 'big' })
    expect(theme.shape.buttonRadius).toBe(DEFAULT_THEME.shape.buttonRadius)
    expect(warnings).toHaveLength(2)
  })

  it('falls back to defaults when theme.json is missing or corrupt', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'reqman-theme-'))
    const missing = await createFileThemeService(dir, dir).load()
    expect(missing.source).toBe('default')
    await writeFile(join(dir, 'theme.json'), '{ not json')
    const corrupt = await createFileThemeService(dir, dir).load()
    expect(corrupt.config).toEqual(DEFAULT_THEME)
    expect(corrupt.warnings.length).toBeGreaterThan(0)
  })

  it('never reads a logo outside the resources folder', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'reqman-theme-'))
    await writeFile(join(dir, 'theme.json'), JSON.stringify({ brand: { logo: '../../secret.svg' } }))
    const t = await createFileThemeService(dir, dir).load()
    expect(t.logoDataUrl).toBe('')
  })
})
