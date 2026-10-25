// COMPOSITION ROOT — the single place where modules are created and connected.
// To swap a module for another implementation, change its line here; nothing else needs to know.
import { createSystemGitAdapter, type GitAdapter } from '../modules/git-adapter'
import { createFileLogger, type Logger } from '../modules/logger'
import { createFileThemeService, type ThemeService } from '../modules/theme'
import { createGithubUpdater, type UpdateService } from '../modules/updater'

export interface Services {
  git: GitAdapter
  theme: ThemeService
  log: Logger
  updater: UpdateService
}

export interface Paths {
  /** Folder with user-editable configuration (theme.json, later: default schema, export templates). */
  configDir: string
  /** Folder with static assets such as the logo. */
  resourceDir: string
  /** Folder for the log file (per user). */
  logDir: string
  /** Per-user folder for the user's own settings such as theme.json (%APPDATA%\\ReqMan). Survives updates. */
  userDir: string
  /** True for an installed build; enables self-updating. */
  packaged: boolean
}

export function createServices(paths: Paths): Services {
  const log = createFileLogger(paths.logDir)
  return {
    log,
    git: createSystemGitAdapter(),
    theme: createFileThemeService(paths.configDir, paths.resourceDir, paths.userDir),
    // Self-updating is supported for the installed Windows app (per-user NSIS installer).
    updater: createGithubUpdater({ enabled: paths.packaged && process.platform === 'win32', log })
  }
}
