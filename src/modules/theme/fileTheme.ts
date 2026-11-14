import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type { LoadedTheme, ThemeLayers, ThemeOverrides, ThemeConfig } from '../../shared/api'
import type { ThemeService } from './index'
import { DEFAULT_THEME, validateTheme } from './defaults'

const MIME: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
}

/**
 * Themes are layered:  built-in defaults  ←  shipped config/theme.json  ←  user theme.json.
 * The shipped file is replaced by every update; the user file (in the user's own folder) never is.
 *
 * @param configDir   folder with the shipped theme.json (part of the installed app)
 * @param resourceDir folder with the shipped logo
 * @param userDir     per-user folder for the user's own theme.json and custom logo (%APPDATA%\ReqMan)
 */
export function createFileThemeService(configDir: string, resourceDir: string, userDir: string): ThemeService {
  const shippedFile = join(configDir, 'theme.json')
  const userFile = join(userDir, 'theme.json')

  const readJson = async (file: string): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> => {
    try {
      return { ok: true, value: JSON.parse(await readFile(file, 'utf8')) }
    } catch (e) {
      const err = e as NodeJS.ErrnoException
      return { ok: false, error: err.code === 'ENOENT' ? 'ENOENT' : err.message }
    }
  }

  const loadLogo = async (config: ThemeConfig, warnings: string[]): Promise<string> => {
    // basename() stops a theme file from pointing outside the allowed folders.
    // no logo = the built-in reqochet brand (drawn by the window from resources/brand)
    if (!config.brand.logo.trim()) return ''
    const logoFile = basename(config.brand.logo)
    // "logo.svg" was ReqMan's own logo (themes copied before the rename name it): only a user's own file counts
    const dirs = logoFile === 'logo.svg' ? [userDir] : [userDir, resourceDir]
    for (const dir of dirs) {
      try {
        const bytes = await readFile(join(dir, logoFile))
        const mime = MIME[extname(logoFile).toLowerCase()] ?? 'application/octet-stream'
        return `data:${mime};base64,${bytes.toString('base64')}`
      } catch {
        /* try next folder */
      }
    }
    if (logoFile === 'logo.svg') return ''
    warnings.push(`Logo "${logoFile}" not found in your reqochet folder or the app; showing the name only.`)
    return ''
  }

  return {
    userThemeFile: userFile,

    async load(): Promise<LoadedTheme> {
      const warnings: string[] = []
      let theme = DEFAULT_THEME
      let source: LoadedTheme['source'] = 'default'

      const shipped = await readJson(shippedFile)
      if (shipped.ok) {
        const r = validateTheme(shipped.value, theme)
        theme = r.theme
        source = 'file'
        warnings.push(...r.warnings.map((w) => `App theme: ${w}`))
      } else {
        warnings.push(`App theme file could not be read (${shipped.error}); using built-in theme.`)
      }

      const user = await readJson(userFile)
      if (user.ok) {
        const r = validateTheme(user.value, theme)
        theme = r.theme
        source = 'user'
        warnings.push(...r.warnings.map((w) => `Your theme: ${w}`))
      } else if (user.error !== 'ENOENT') {
        warnings.push(`Your theme.json could not be read (${user.error}); it was ignored.`)
      }

      const logoDataUrl = await loadLogo(theme, warnings)
      return { config: theme, logoDataUrl, source, warnings }
    },

    async layers(): Promise<ThemeLayers> {
      const shipped = await readJson(shippedFile)
      const base = shipped.ok ? validateTheme(shipped.value, DEFAULT_THEME).theme : DEFAULT_THEME
      const user = await readJson(userFile)
      return { base, user: user.ok ? pickOverrides(user.value) : {} }
    },

    async saveUser(user: ThemeOverrides): Promise<LoadedTheme> {
      await mkdir(userDir, { recursive: true })
      const old = await readJson(userFile)
      // keep what the editor does not edit (brand, notes like _help); replace the four token groups
      const keep = old.ok && typeof old.value === 'object' && old.value !== null && !Array.isArray(old.value) ? { ...(old.value as Record<string, unknown>) } : {}
      for (const g of ['typography', 'shape', 'spacing', 'modes']) delete keep[g]
      const clean = pickOverrides(user)
      const next = { ...keep, ...clean }
      // check it like a theme layer would be: a value the app would ignore is refused, not written
      const { warnings } = validateTheme(next, DEFAULT_THEME)
      if (warnings.length > 0) throw new Error(warnings.join(' '))
      const tmp = `${userFile}.${process.pid}.tmp`
      await writeFile(tmp, JSON.stringify(next, null, 2) + '\n')
      await rename(tmp, userFile)
      return this.load()
    },

    async ensureUserThemeFile(): Promise<string> {
      await mkdir(userDir, { recursive: true })
      // The user's file holds ONLY their changes, so improvements to the app theme in later updates
      // still reach them for every value they have not changed themselves.
      const starter = {
        _help:
          'Add only the values you want to change; everything else comes from the app theme. ' +
          `All available keys and their current values: ${shippedFile}. Save, then restart reqochet.`,
        modes: { light: {}, dark: {}, ember: {} }
      }
      try {
        await writeFile(userFile, JSON.stringify(starter, null, 2) + '\n', { flag: 'wx' /* never overwrite */ })
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
      }
      return userFile
    }
  }
}

/** Only the four token groups, only non-empty string values, only known modes (the editor's view of a user file). */
function pickOverrides(value: unknown): ThemeOverrides {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const src = value as Record<string, unknown>
  const strings = (v: unknown): Record<string, string> | undefined => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined
    const out: Record<string, string> = {}
    for (const [k, x] of Object.entries(v)) if (typeof x === 'string' && x.trim() !== '') out[k] = x
    return Object.keys(out).length > 0 ? out : undefined
  }
  const out: ThemeOverrides = {}
  for (const g of ['typography', 'shape', 'spacing'] as const) {
    const v = strings(src[g])
    if (v) out[g] = v
  }
  const modes = src.modes as Record<string, unknown> | undefined
  if (modes && typeof modes === 'object') {
    const m: NonNullable<ThemeOverrides['modes']> = {}
    for (const k of ['light', 'dark', 'ember'] as const) {
      const v = strings(modes[k])
      if (v) m[k] = v
    }
    if (Object.keys(m).length > 0) out.modes = m
  }
  return out
}
