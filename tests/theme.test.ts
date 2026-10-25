import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFileThemeService, DEFAULT_THEME, validateTheme } from '../src/modules/theme'

const repoRoot = join(__dirname, '..')
const shippedConfig = join(repoRoot, 'config')
const shippedResources = join(repoRoot, 'resources')
const tempDir = (): Promise<string> => mkdtemp(join(tmpdir(), 'reqman-theme-'))

describe('theme module', () => {
  it('shipped config/theme.json matches the built-in default exactly', async () => {
    const shipped = JSON.parse(await readFile(join(shippedConfig, 'theme.json'), 'utf8'))
    expect(shipped).toEqual(DEFAULT_THEME)
  })

  it('loads the shipped theme and logo without warnings when the user has no theme', async () => {
    const t = await createFileThemeService(shippedConfig, shippedResources, await tempDir()).load()
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

  it('layers the user theme over the shipped theme', async () => {
    const user = await tempDir()
    await writeFile(join(user, 'theme.json'), JSON.stringify({ modes: { light: { primary: '#d32f2f' } } }))
    const t = await createFileThemeService(shippedConfig, shippedResources, user).load()
    expect(t.source).toBe('user')
    expect(t.config.modes.light.primary).toBe('#d32f2f')
    expect(t.config.modes.dark.primary).toBe(DEFAULT_THEME.modes.dark.primary)
  })

  it('ignores a broken user theme and keeps the shipped one', async () => {
    const user = await tempDir()
    await writeFile(join(user, 'theme.json'), '{ broken')
    const t = await createFileThemeService(shippedConfig, shippedResources, user).load()
    expect(t.source).toBe('file')
    expect(t.config).toEqual(DEFAULT_THEME)
    expect(t.warnings.some((w) => w.startsWith('Your theme.json could not be read'))).toBe(true)
  })

  it('falls back to built-in defaults when no theme file can be read', async () => {
    const dir = await tempDir()
    const t = await createFileThemeService(dir, dir, dir).load()
    expect(t.source).toBe('default')
    expect(t.config).toEqual(DEFAULT_THEME)
  })

  it('creates a starter user theme that changes nothing, and never overwrites it afterwards', async () => {
    const user = join(await tempDir(), 'ReqMan')
    const svc = createFileThemeService(shippedConfig, shippedResources, user)
    const file = await svc.ensureUserThemeFile()
    const loaded = await svc.load()
    expect(loaded.source).toBe('user')
    expect(loaded.config).toEqual(DEFAULT_THEME)
    expect(loaded.warnings).toEqual([])
    await writeFile(file, '{"brand":{"name":"Mine"}}')
    await svc.ensureUserThemeFile()
    expect(await readFile(file, 'utf8')).toBe('{"brand":{"name":"Mine"}}')
  })

  it('uses a custom logo from the user folder when present', async () => {
    const user = await tempDir()
    await writeFile(join(user, 'theme.json'), JSON.stringify({ brand: { logo: 'company.png' } }))
    await writeFile(join(user, 'company.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const t = await createFileThemeService(shippedConfig, shippedResources, user).load()
    expect(t.logoDataUrl.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('never reads a logo outside the allowed folders', async () => {
    const user = await tempDir()
    await writeFile(join(user, 'theme.json'), JSON.stringify({ brand: { logo: '../../secret.svg' } }))
    const t = await createFileThemeService(shippedConfig, await tempDir(), user).load()
    expect(t.logoDataUrl).toBe('')
  })
})
