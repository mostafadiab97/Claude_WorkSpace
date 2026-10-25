import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type { LoadedTheme, ThemeConfig } from '../../shared/api'
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
    const logoFile = basename(config.brand.logo)
    for (const dir of [userDir, resourceDir]) {
      try {
        const bytes = await readFile(join(dir, logoFile))
        const mime = MIME[extname(logoFile).toLowerCase()] ?? 'application/octet-stream'
        return `data:${mime};base64,${bytes.toString('base64')}`
      } catch {
        /* try next folder */
      }
    }
    warnings.push(`Logo "${logoFile}" not found in your ReqMan folder or the app; showing the name only.`)
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

    async ensureUserThemeFile(): Promise<string> {
      await mkdir(userDir, { recursive: true })
      // The user's file holds ONLY their changes, so improvements to the app theme in later updates
      // still reach them for every value they have not changed themselves.
      const starter = {
        _help:
          'Add only the values you want to change; everything else comes from the app theme. ' +
          `All available keys and their current values: ${shippedFile}. Save, then restart ReqMan.`,
        modes: { light: {}, dark: {} }
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
