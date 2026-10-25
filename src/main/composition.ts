// COMPOSITION ROOT — the single place where modules are created and connected.
// To swap a module for another implementation, change its line here; nothing else needs to know.
import { createSystemGitAdapter, type GitAdapter } from '../modules/git-adapter'
import { createFileLogger, type Logger } from '../modules/logger'
import { createFileThemeService, type ThemeService } from '../modules/theme'

export interface Services {
  git: GitAdapter
  theme: ThemeService
  log: Logger
}

export interface Paths {
  /** Folder with user-editable configuration (theme.json, later: default schema, export templates). */
  configDir: string
  /** Folder with static assets such as the logo. */
  resourceDir: string
  /** Folder for the log file (per user). */
  logDir: string
}

export function createServices(paths: Paths): Services {
  return {
    git: createSystemGitAdapter(),
    theme: createFileThemeService(paths.configDir, paths.resourceDir),
    log: createFileLogger(paths.logDir)
  }
}
