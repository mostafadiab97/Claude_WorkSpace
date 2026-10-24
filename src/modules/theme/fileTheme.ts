import { readFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type { LoadedTheme } from '../../shared/api'
import type { ThemeService } from './index'
import { validateTheme } from './defaults'

const MIME: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
}

/**
 * @param configDir   folder holding theme.json (shipped next to the app, user-editable)
 * @param resourceDir folder holding the logo file named in theme.json
 */
export function createFileThemeService(configDir: string, resourceDir: string): ThemeService {
  return {
    async load(): Promise<LoadedTheme> {
      let raw: unknown
      let source: LoadedTheme['source'] = 'file'
      const warnings: string[] = []
      try {
        raw = JSON.parse(await readFile(join(configDir, 'theme.json'), 'utf8'))
      } catch (e) {
        source = 'default'
        warnings.push(`Could not read theme.json (${(e as Error).message}); using built-in theme.`)
      }
      const result = validateTheme(raw ?? {})
      if (source === 'file') warnings.push(...result.warnings)

      // basename() stops a theme file from pointing outside the resources folder.
      const logoFile = basename(result.theme.brand.logo)
      let logoDataUrl = ''
      try {
        const bytes = await readFile(join(resourceDir, logoFile))
        const mime = MIME[extname(logoFile).toLowerCase()] ?? 'application/octet-stream'
        logoDataUrl = `data:${mime};base64,${bytes.toString('base64')}`
      } catch {
        warnings.push(`Logo "${logoFile}" not found in resources; showing the name only.`)
      }
      return { config: result.theme, logoDataUrl, source, warnings }
    }
  }
}
