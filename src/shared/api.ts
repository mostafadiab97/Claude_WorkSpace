// The ONE contract between the UI (renderer) and the core (main process).
import type { FieldDef, Item, ItemDiff, ItemIssue, ItemQuery, QueryResult, Schema, SchemaProblem } from './domain'
export type * from './domain'

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

// ---------- workspace (an opened requirements repository)

export interface FolderCheck {
  /** The folder ReqMan will use: the top of the Git repository if the chosen folder is inside one. */
  root: string
  isGitRepository: boolean
  /** 'ready' = has a requirements folder; 'not-initialized' = can create one; 'missing' = folder not found. */
  state: 'ready' | 'not-initialized' | 'missing'
}

export interface RepoInfo {
  root: string
  /** Folder name, shown in the title bar. */
  name: string
  isGitRepository: boolean
  schema: Schema
  schemaProblems: SchemaProblem[]
  /** Hash of schema.yaml, passed back when saving schema changes (conflict check). */
  schemaRevision: string
  itemCount: number
  /** Whole-repository problems: duplicate IDs, broken links, missing parents, unreadable files. */
  issues: ItemIssue[]
  /** How long opening took and how much had to be re-read. */
  lastSync: { durationMs: number; full: boolean; changedFiles: number }
}

/** One end of a link, as shown in the editor. */
export interface LinkInfo {
  /** The item on the other end. */
  id: string
  type: string
  /** Its title, if it exists. */
  title?: string
  exists: boolean
  /** The target changed since the link was confirmed — the source may need review. */
  suspect: boolean
}

// ---------- Git (M4)

/** One changed file under requirements/, as an item where possible. */
export interface ItemChange {
  /** Path relative to the repository top folder, forward slashes. */
  path: string
  kind: 'added' | 'modified' | 'deleted' | 'renamed' | 'conflict'
  /** Item ID when the file is an item file. */
  id?: string
  title?: string
  /** What to show: "SYS-K7Q3XM Temperature accuracy", "Schema (schema.yaml)", or the file path. */
  label: string
}

export interface GitState {
  /** False when the folder is not a Git repository or Git is missing; `reason` says which. */
  available: boolean
  reason?: string
  branch: string | null
  detached: boolean
  /** e.g. "origin/main"; null when the branch is not on the remote yet. */
  upstream: string | null
  /** Commits to push / to pull, as of the last pull or fetch. */
  ahead: number
  behind: number
  hasRemote: boolean
  identity: { name: string | null; email: string | null }
  /** Uncommitted changes under requirements/. */
  changes: ItemChange[]
  /** The last commit can be taken back: it is not on the remote yet (and is not the first commit). */
  canUndoCommit: boolean
  lastCommitMessage: string | null
  /** The repository is in the middle of a merge with conflicts (started outside ReqMan). */
  mergeInProgress: boolean
}

export type GitResult =
  | { ok: true; message: string; state: GitState }
  | {
      ok: false
      message: string
      /** The items the message is about (e.g. changed on both sides). */
      items?: ItemChange[]
      state: GitState
    }

export interface HistoryEntry {
  /** Full commit hash; "working" for the uncommitted version. */
  hash: string
  author: string
  email: string
  /** ISO 8601; empty for "working". */
  date: string
  message: string
}

export interface ItemVersionCompare {
  /** The version before this change (null: the item was created here). */
  before: Item | null
  /** The version after it (null: deleted). */
  after: Item | null
  diff: ItemDiff
  /** A version that exists but could not be read (e.g. hand-broken file in an old commit). */
  unreadable?: string
}

export interface ItemDetails {
  item: Item
  /** Hash of the file as read; saving with an outdated revision is refused (someone else changed it). */
  revision: string
  /** Links stored in this item, pointing to other items. */
  outgoing: LinkInfo[]
  /** Links from other items to this one. */
  incoming: LinkInfo[]
  childCount: number
  /** Schema problems in this item. */
  issues: ItemIssue[]
}

export type SaveResult =
  | { ok: true; details: ItemDetails }
  | { ok: false; reason: 'conflict' | 'invalid' | 'error'; message: string; issues?: ItemIssue[] }

export interface RecentRepository {
  root: string
  name: string
  openedAt: string
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

  // workspace
  /** Shows the Windows folder picker; null if cancelled. */
  pickFolder(): Promise<string | null>
  checkFolder(path: string): Promise<FolderCheck>
  /** Creates the requirements folder (default schema) in a repository that has none, then opens it. */
  initializeRepository(root: string): Promise<RepoInfo>
  openRepository(root: string): Promise<RepoInfo>
  closeRepository(): Promise<void>
  /** Re-reads files changed outside ReqMan (e.g. after a Git pull or a hand edit). */
  refreshRepository(): Promise<RepoInfo>
  getRecentRepositories(): Promise<RecentRepository[]>
  forgetRecentRepository(root: string): Promise<void>
  queryItems(query: ItemQuery): Promise<QueryResult>
  getItem(id: string): Promise<ItemDetails | null>
  /** A new, unsaved item of `type` with a fresh ID, placed last under `parent`. */
  newItem(type: string, parent?: string): Promise<Item>
  /** `revision` null = a new item. */
  saveItem(item: Item, revision: string | null): Promise<SaveResult>
  deleteItem(id: string, revision: string, opts?: { removeIncomingLinks?: boolean }): Promise<{ ok: true } | { ok: false; message: string }>
  /**
   * Makes `parent` the new parent of `id` (null = top level); the item keeps its children.
   * Placed before the sibling `before`, or last when `before` is not given.
   */
  reparentItem(id: string, parent: string | null, before?: string | null): Promise<{ ok: true } | { ok: false; message: string }>
  /** IDs from the top-level item down to the item's parent (empty for a top-level item). */
  getAncestors(id: string): Promise<string[]>
  /** Replaces the project's field definitions in schema.yaml and re-opens the repository. */
  saveSchemaFields(fields: FieldDef[], schemaRevision: string): Promise<{ ok: true; info: RepoInfo } | { ok: false; message: string }>
  /** Adds a link stored in `source` ("source verifies target"); confirmed against the target as it is now. */
  addLink(source: string, type: string, target: string): Promise<{ ok: true } | { ok: false; message: string }>
  removeLink(source: string, type: string, target: string): Promise<{ ok: true } | { ok: false; message: string }>
  /** Marks suspect links of `source` as reviewed (all of them, or only the one to `target`). */
  confirmLinks(source: string, target?: string): Promise<{ ok: true } | { ok: false; message: string }>
  // --- Git (all operate on the open repository; only requirements/ is committed)
  getGitState(): Promise<GitState>
  /** Commits all changes under requirements/. */
  commit(message: string): Promise<GitResult>
  /** Fetches and merges the remote branch; stops without changing anything if items changed on both sides. */
  pull(): Promise<GitResult>
  /** Never forces. Publishes the branch if it is not on the remote yet. */
  push(): Promise<GitResult>
  /** Undoes uncommitted changes of these files (paths from GitState.changes). */
  discardChanges(paths: string[]): Promise<GitResult>
  setGitIdentity(name: string, email: string): Promise<GitResult>
  /** Takes back the last commit if it was not pushed; its changes become uncommitted again. */
  undoLastCommit(): Promise<GitResult>
  /** Commits that changed this item, newest first; first entry "working" if it has uncommitted changes. */
  getItemHistory(id: string): Promise<HistoryEntry[]>
  /** What one history entry changed in the item. */
  compareItemVersion(id: string, hash: string): Promise<ItemVersionCompare>
  /** Moves an item one place up or down among its siblings. */
  moveItem(id: string, direction: 'up' | 'down'): Promise<{ ok: true } | { ok: false; message: string }>
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
  updateStatusChanged: 'update:statusChanged',
  pickFolder: 'ws:pickFolder',
  checkFolder: 'ws:checkFolder',
  initializeRepository: 'ws:initialize',
  openRepository: 'ws:open',
  closeRepository: 'ws:close',
  refreshRepository: 'ws:refresh',
  getRecentRepositories: 'ws:recent',
  forgetRecentRepository: 'ws:forgetRecent',
  queryItems: 'ws:query',
  getItem: 'ws:getItem',
  newItem: 'ws:newItem',
  saveItem: 'ws:saveItem',
  deleteItem: 'ws:deleteItem',
  moveItem: 'ws:moveItem',
  reparentItem: 'ws:reparentItem',
  getAncestors: 'ws:ancestors',
  saveSchemaFields: 'ws:saveSchemaFields',
  addLink: 'ws:addLink',
  removeLink: 'ws:removeLink',
  confirmLinks: 'ws:confirmLinks',
  getGitState: 'git:state',
  commit: 'git:commit',
  pull: 'git:pull',
  push: 'git:push',
  discardChanges: 'git:discard',
  setGitIdentity: 'git:setIdentity',
  undoLastCommit: 'git:undoLastCommit',
  getItemHistory: 'git:itemHistory',
  compareItemVersion: 'git:compareItemVersion'
} as const
