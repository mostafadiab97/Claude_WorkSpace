// COMPOSITION ROOT — the single place where modules are created and connected.
// To swap a module for another implementation, change its line here; nothing else needs to know.
import { join } from 'node:path'
import { createSystemGitAdapter, type GitAdapter } from '../modules/git-adapter'
import { createSqliteIndexCache } from '../modules/index-cache'
import { createFileLogger, type Logger } from '../modules/logger'
import { createFileRepositoryStore, type RepositoryStore } from '../modules/repository-store'
import { createFileThemeService, type ThemeService } from '../modules/theme'
import { createGithubUpdater, type UpdateService } from '../modules/updater'
import { cacheFileName, createWorkspace, type WorkspaceService } from '../modules/workspace'
import { runReleaseSelfTest } from '../modules/self-test'
import type { ReleaseSelfTestResult } from '../shared/api'

export interface Services {
  git: GitAdapter
  theme: ThemeService
  log: Logger
  updater: UpdateService
  repositories: RepositoryStore
  workspace: WorkspaceService
  /** The in-app release self-test on a practice repository (Diagnostics). */
  releaseSelfTest(): Promise<ReleaseSelfTestResult>
}

export interface Paths {
  /** Folder with shipped configuration (theme.json, default-schema.yaml). */
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

export function createServices(paths: Paths, version = '0.0.0'): Services {
  const log = createFileLogger(paths.logDir)
  const git = createSystemGitAdapter()
  // New requirements folders start from the shipped default schema.
  const repositories = createFileRepositoryStore(join(paths.configDir, 'default-schema.yaml'))
  return {
    log,
    git,
    repositories,
    theme: createFileThemeService(paths.configDir, paths.resourceDir, paths.userDir),
    // Self-updating is supported for the installed Windows app (per-user NSIS installer).
    updater: createGithubUpdater({ enabled: paths.packaged && process.platform === 'win32', log }),
    releaseSelfTest: () =>
      runReleaseSelfTest({
        version,
        gitVersion: async () => {
          const g = await git.getGitInfo()
          return g.installed ? g.version : null
        },
        // a separate workspace with its own (temporary) settings and index folder
        createWorkspace: (userDir) =>
          createWorkspace({
            store: repositories,
            git,
            openIndex: (root) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(root))),
            userDir,
            log: { info: () => {}, warn: (m) => log.warn(`Self-test: ${m}`), error: (m, e) => log.error(`Self-test: ${m}`, e) }
          })
      }),
    workspace: createWorkspace({
      store: repositories,
      git,
      // One index file per repository, outside the repository: %APPDATA%\ReqMan\cache\<hash>.sqlite
      openIndex: (root) => createSqliteIndexCache(join(paths.userDir, 'cache', cacheFileName(root))),
      userDir: paths.userDir,
      log
    })
  }
}
