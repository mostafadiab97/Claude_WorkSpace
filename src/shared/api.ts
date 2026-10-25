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
  /** Full path of the theme file the app is using. */
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
  /** Where the theme came from: the user-editable file, or the built-in fallback. */
  source: 'file' | 'default'
  warnings: string[]
}

export interface ReqManApi {
  getAppInfo(): Promise<AppInfo>
  getGitInfo(): Promise<GitInfo>
  getTheme(): Promise<LoadedTheme>
  /** Opens the folder containing the log file in Windows Explorer. */
  openLogFolder(): Promise<void>
  /** Opens the folder containing theme.json in Windows Explorer, with the file selected. */
  openThemeFolder(): Promise<void>
  /** Records an error that happened in the UI in the log file. */
  reportUiError(message: string): void
  /** A plain-text summary (versions, paths, checks) to paste into a bug report. */
  getDiagnostics(): Promise<string>
}

/** IPC channel names, shared so main and preload can never drift apart. */
export const Channels = {
  getAppInfo: 'app:getInfo',
  getGitInfo: 'git:getInfo',
  getTheme: 'theme:get',
  openLogFolder: 'diag:openLogFolder',
  openThemeFolder: 'diag:openThemeFolder',
  reportUiError: 'diag:reportUiError',
  getDiagnostics: 'diag:get'
} as const
