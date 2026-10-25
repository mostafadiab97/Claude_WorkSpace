// The ONE contract between the UI (renderer) and the core (main process).
// The UI can do exactly what is listed here and nothing else. Adding a capability = adding it here,
// implementing it in src/main/ipc.ts, and exposing it in src/preload/index.ts.

export interface AppInfo {
  name: string
  version: string
  platform: string
  electronVersion: string
  /** Full path of the log file, shown in the Diagnostics panel. */
  logFile: string
  /** Full path of the user's own theme.json (in %APPDATA%\\ReqMan; survives updates). */
  themeFile: string
}

export type GitInfo =
  | { installed: true; version: string }
  | { installed: false; reason: string; downloadUrl: string }

/** Design tokens loaded from config/theme.json. See docs/THEMING.md. */
export interface ThemeConfig {
  brand: { name: string; logo: string }
  typography: Record<string, string>
  shape: Record<string, string>
  spacing: Record<string, string>
  modes: { light: Record<string, string>; dark: Record<string, string> }
}

export interface LoadedTheme {
  config: ThemeConfig
  /** Logo as a data: URL, ready for an <img src>. */
  logoDataUrl: string
  /** Top layer in use: the user's own theme.json, the app's shipped theme, or the built-in fallback. */
  source: 'user' | 'file' | 'default'
  warnings: string[]
}

export type UpdateStatus =
  | { state: 'disabled'; reason: string }
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'up-to-date'; checkedAt: string }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }

/** Result of the built-in data self-test (generates, indexes and queries a temporary repository). */
export interface DataSelfTestResult {
  items: number
  writeMs: number
  firstIndexMs: number
  resyncMs: number
  slowestQueryMs: number
  queries: { name: string; ms: number; total: number }[]
}

export interface ReqManApi {
  getAppInfo(): Promise<AppInfo>
  getGitInfo(): Promise<GitInfo>
  getTheme(): Promise<LoadedTheme>
  /** Opens the folder containing the log file in Windows Explorer. */
  openLogFolder(): Promise<void>
  /** Creates the user's theme.json if needed, then shows it in Windows Explorer. */
  openThemeFolder(): Promise<void>
  getUpdateStatus(): Promise<UpdateStatus>
  checkForUpdates(): Promise<void>
  /** Restarts ReqMan to install a downloaded update. */
  installUpdate(): Promise<void>
  /** Subscribes to update status changes; returns an unsubscribe function. */
  onUpdateStatus(listener: (status: UpdateStatus) => void): () => void
  /** Records an error that happened in the UI in the log file. */
  reportUiError(message: string): void
  /** A plain-text summary (versions, paths, checks) to paste into a bug report. */
  getDiagnostics(): Promise<string>
  /** Measures the data layer on this PC with `count` generated items in a temporary folder. */
  runDataSelfTest(count: number): Promise<DataSelfTestResult>
}

/** IPC channel names, shared so main and preload can never drift apart. */
export const Channels = {
  getAppInfo: 'app:getInfo',
  getGitInfo: 'git:getInfo',
  getTheme: 'theme:get',
  openLogFolder: 'diag:openLogFolder',
  openThemeFolder: 'diag:openThemeFolder',
  reportUiError: 'diag:reportUiError',
  getDiagnostics: 'diag:get',
  runDataSelfTest: 'diag:runDataSelfTest',
  getUpdateStatus: 'update:getStatus',
  checkForUpdates: 'update:check',
  installUpdate: 'update:install',
  updateStatusChanged: 'update:statusChanged'
} as const
