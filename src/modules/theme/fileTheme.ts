import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
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

  let saving: Promise<unknown> = Promise.resolve()
  const saveNow = async (user: ThemeOverrides, expectedRevision: string): Promise<LoadedTheme> => {
    await mkdir(userDir, { recursive: true })
    // never write over a file that changed since the editor read it (NFR-05; code review 0.24.0 C3)
    if ((await revisionOf(userFile)) !== expectedRevision) throw new ThemeFileError('changed')
    const old = await readJson(userFile)
    // a hand-edited file with a mistake is never overwritten (code review 0.24.0 C1)
    if (!old.ok && old.error !== 'ENOENT') throw new ThemeFileError('broken')
    if (old.ok && (typeof old.value !== 'object' || old.value === null || Array.isArray(old.value))) throw new ThemeFileError('broken')
    // keep what the editor does not edit (brand, notes like _help, modes it does not know); replace the token groups
    const keep = old.ok ? { ...(old.value as Record<string, unknown>) } : {}
    const oldModes = keep['modes']
    for (const g of ['typography', 'shape', 'spacing', 'modes']) delete keep[g]
    const clean = pickOverrides(user)
    // nothing that loads files or ends the declaration (QA 0.24.0 Q2) — the window input check refuses it too
    const all = [clean.typography, clean.shape, clean.spacing, clean.modes?.light, clean.modes?.dark, clean.modes?.ember].flatMap((g) => Object.values(g ?? {}))
    if (all.some((x) => /url\s*\(|@import|[;{}<>]|\\/i.test(x))) throw new Error('A theme value may not contain url(…), @import or ; { } < > \\.')
    const otherModes: Record<string, unknown> = {}
    if (typeof oldModes === 'object' && oldModes !== null && !Array.isArray(oldModes))
      for (const [k, v] of Object.entries(oldModes)) if (k !== 'light' && k !== 'dark' && k !== 'ember') otherModes[k] = v
    const next: Record<string, unknown> = { ...keep, ...clean }
    if (Object.keys(otherModes).length > 0) next['modes'] = { ...otherModes, ...(clean.modes ?? {}) }
    // check it like a theme layer would be: a value the app would ignore is refused, not written
    const { warnings } = validateTheme({ ...next, modes: clean.modes }, DEFAULT_THEME)
    if (warnings.length > 0) throw new Error(warnings.join(' '))
    const tmp = `${userFile}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    try {
      await writeFile(tmp, JSON.stringify(next, null, 2) + '\n')
      await rename(tmp, userFile)
    } catch (e) {
      await rm(tmp, { force: true }).catch(() => undefined)
      throw e
    }
    return service.load()
  }

  const service: ThemeService = {
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
      return { base, user: user.ok ? pickOverrides(user.value) : {}, revision: await revisionOf(userFile) }
    },

    saveUser(user: ThemeOverrides, expectedRevision: string): Promise<LoadedTheme> {
      // one save at a time (code review 0.24.0 C3, QA Q1)
      const run = saving.then(() => saveNow(user, expectedRevision))
      saving = run.catch(() => undefined)
      return run
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
  return service
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

/** The file's revision for the conflict check: a hash of its bytes, or "none" when it does not exist. */
async function revisionOf(file: string): Promise<string> {
  try {
    return createHash('sha1').update(await readFile(file)).digest('hex')
  } catch {
    return 'none'
  }
}

/** Why a theme save was refused: the file changed since it was read, or it has a mistake the user must fix first. */
export class ThemeFileError extends Error {
  constructor(readonly reason: 'changed' | 'broken') {
    super(reason === 'changed' ? 'THEME_FILE_CHANGED' : 'THEME_FILE_BROKEN')
  }
}
