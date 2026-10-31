// The ONE contract between the UI (renderer) and the core (main process).
import type { FieldDef, Item, ItemDiff, ItemIssue, ItemQuery, QueryResult, Schema, SchemaProblem } from './domain'
export type * from './domain'

// The UI can do exactly what is listed here and nothing else. Adding a capability = a method in ReqManApi,
// its channel name in `Channels` below, and its handler in src/main/ipc.ts (the compiler reports a missing
// one). The preload builds window.reqman from `Channels` automatically.

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
  /** e.g. Git too old for some checks; shown in the Git bar. */
  warning?: string
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
      /** A pull needs the user's decisions first (M8): answer the questions and call finishPull. */
      plan?: MergePlan
      /** deleteBranch: the branch has commits no other branch has; ask before deleting with `force`. */
      unmerged?: boolean
      state: GitState
    }

// ---------- Branches and merging (M8)

export interface BranchInfo {
  /** "main", "feature-x", or "origin/feature-x" for a branch that is only on the remote */
  name: string
  kind: 'branch' | 'remote'
  hash: string
  current: boolean
}

/** One part of an item both sides changed differently (owner's decision M8-3: field by field). */
export interface MergePart {
  /** "title", "type", "position", "text", "field:<id>", "extra:<key>", "item" (deleted vs changed), "file" */
  key: string
  label: string
  base: string
  mine: string
  theirs: string
  /** The user may type a value of their own. */
  editable: boolean
}

export interface MergeQuestion {
  /** Repository-relative file path. */
  path: string
  id?: string
  /** "REQ-K7Q3XMB Temperature accuracy", or a file name. */
  label: string
  parts: MergePart[]
}

export type MergeChoice = 'mine' | 'theirs' | { edit: string }
/** Answers per question (path) and part (key). */
export type MergeAnswers = Record<string, Record<string, MergeChoice>>

/** What a pull will do, worked out without changing anything (M8-6/M8-7). Finishing uses exactly these commits. */
export interface MergePlan {
  /** What is pulled in: "origin/main", "feature-x" … */
  source: string
  head: string
  theirs: string
  /** Items the other side changed. */
  incoming: number
  /** Items both sides changed in different parts: combined automatically. */
  combined: ItemChange[]
  /** Items that need a decision. */
  questions: MergeQuestion[]
  /** Items created on both sides with the same ID (review D-09): this branch's item gets a new ID. */
  duplicates: ItemChange[]
  /**
   * Pull from another branch (owner, 31 Oct 2026): the result is written as uncommitted changes to review in
   * Changes (keep or discard, then commit). False for a pull of the branch's own remote branch (that one commits).
   */
  uncommitted: boolean
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

// ---------- Compare (M5)

/** One side of a comparison. */
export interface VersionLabel {
  /** Commit hash, or "WORKING" for the working folder (what is saved on this PC, committed or not). */
  ref: string
  /** "a1b2c3d Fix accuracy (Alice, 25 Oct 2026 14:02)" or "Your working folder" */
  label: string
}

export interface CompareOptions {
  /** What the last pull brought in: HEAD before and after it. Null if this PC never pulled anything. */
  lastPull: { from: string; to: string; date: string } | null
  /** Uncommitted changes exist under requirements/. */
  hasUncommitted: boolean
  /** Recent commits that changed the requirements folder, newest first. */
  commits: HistoryEntry[]
  /** Branches, remote branches and tags. */
  refs: { name: string; kind: 'branch' | 'remote' | 'tag'; hash: string }[]
  /** Current commit (null before the first commit). */
  head: string | null
}

export interface CompareEntry {
  id: string
  /** Title in the newer version (older one for deleted items). */
  title: string
  type: string
  kind: 'added' | 'deleted' | 'modified' | 'moved'
  /** What changed, in a few words: "Text, Status", "Parent, Position", "1 link added". */
  summary: string
  diff: ItemDiff
  /** Type, title or text changed: links pointing to this item become suspect. */
  contentChanged: boolean
  /** Links from other items to it today. */
  incoming: number
  /** Outline numbers in the older and the newer version ("1.2" → "3.5.1"), where it had one. */
  numberBefore?: string
  numberAfter?: string
  /** A version that exists but could not be read. */
  unreadable?: string
  /** The item's files in the two versions (one, or two when the file was renamed), repository-relative. */
  paths: string[]
}

/**
 * One part of an uncommitted change to take back (the ↶ arrows of the Changes view, O-05): a field row
 * (`DiffRow.key`: title, type, parent / order = the position, field:…, extra:…), the text, or one link.
 */
export type RevertPart = { kind: 'row'; key: string } | { kind: 'text' } | { kind: 'link'; type: string; target: string }

/** Keep (confirm against the target as it is now) or unlink one link (O-04). */
export interface LinkDecision {
  source: string
  type: string
  target: string
  keep: boolean
}

export interface LinkChange {
  source: string
  type: string
  target: string
  change: 'added' | 'removed'
}

export interface SchemaChange {
  fieldsAdded: string[]
  fieldsRemoved: string[]
  typesAdded: string[]
  typesRemoved: string[]
  linkTypesAdded: string[]
  linkTypesRemoved: string[]
  /** Something else changed (names, options, defaults…). */
  otherChanges: boolean
}

export interface CompareResult {
  from: VersionLabel
  to: VersionLabel
  /** Sorted by ID. */
  entries: CompareEntry[]
  links: LinkChange[]
  schema: SchemaChange | null
  /** Other changed files under requirements/ (e.g. .gitattributes), as paths. */
  otherFiles: string[]
  durationMs: number
}

// ---------- Export (M6)

export type ExportFormat = 'csv' | 'markdown' | 'xlsx' | 'reqif'

export interface ExportItemsRequest {
  /**
   * "all" = every item in document order (hierarchy); "filtered" = the current search/filter result;
   * "chosen" = the items in `ids` (and everything below them with `includeBelow`), in document order (M7).
   */
  scope: 'all' | 'filtered' | 'chosen'
  /** For "filtered": the table's query (search, filters, sort). */
  query?: Omit<ItemQuery, 'limit' | 'offset' | 'brief'>
  /** For "chosen". */
  ids?: string[]
  includeBelow?: boolean
  /** Column keys in order: id, title, type, parent, level, text, links, linkedFrom, field:<id>. */
  columns: string[]
  format: ExportFormat
}

// ---------- Excel / CSV import (M7)

/**
 * What a file column becomes: a built-in part, a field ("field:status"), this item's links of one type
 * ("link:verifies" — the cell lists target IDs), or links of one type stored in other items ("linkFrom:verifies",
 * e.g. a "Verified by" column). "links" / "linkedFrom" are ReqMan's own export format ("verifies REQ-…; …").
 */
export type ImportTarget =
  | 'ignore'
  | 'id'
  | 'number'
  | 'title'
  | 'text'
  | 'type'
  | 'parent'
  | 'level'
  | 'links'
  | 'linkedFrom'
  | `field:${string}`
  | `link:${string}`
  | `linkFrom:${string}`

/** A file chosen for import; its contents stay in the main process (the window refers to it by `token`). */
export interface ImportFile {
  token: string
  name: string
  path: string
  kind: 'xlsx' | 'csv' | 'reqif'
  sheets: { name: string; rowCount: number; sample: string[][] }[]
}

export interface ImportSettings {
  token: string
  sheet: string
  /** 0-based row of the column names. */
  headerRow: number
  /** One target per column; leave out to let ReqMan guess from the column names. */
  mapping?: ImportTarget[]
  /** Type of rows without a (known) type. */
  defaultType: string
}

export interface ImportProblem {
  /** Row number in the file (1-based, as Excel shows it). */
  row: number
  column?: string
  message: string
  severity: 'error' | 'warning'
}

export interface ImportPlanRow {
  row: number
  action: 'create' | 'update' | 'unchanged' | 'skip'
  id: string
  type: string
  title: string
}

export interface ImportPreview {
  headers: string[]
  mapping: ImportTarget[]
  counts: { create: number; update: number; unchanged: number; skip: number }
  /** Links added to existing items that are not rows of the file ("Verified by" columns). */
  extraLinks: number
  problems: ImportProblem[]
  /** The first rows, as they would be imported. */
  rows: ImportPlanRow[]
}

export type ImportResult =
  | { ok: true; created: number; updated: number; unchanged: number; skipped: number; committed: boolean; info: RepoInfo }
  | { ok: false; message: string }

/** The file the repository was last imported from on this PC ("Update the Excel file"). */
export interface ImportSource {
  path: string
  name: string
  kind: 'xlsx' | 'csv' | 'reqif'
  sheet: string
}

export type ExportResult = { ok: true; path: string; count: number } | { ok: false; canceled: true } | { ok: false; canceled?: false; message: string }

export interface ItemDetails {
  item: Item
  /** Hash of the file as read; saving with an outdated revision is refused (someone else changed it). */
  revision: string
  /** Links stored in this item, pointing to other items. */
  outgoing: LinkInfo[]
  /** Links from other items to this one. */
  incoming: LinkInfo[]
  childCount: number
  /** Outline number ("2.3.1"); none when the item is outside the hierarchy (missing parent, loop). */
  number?: string
  /** Schema problems in this item. */
  issues: ItemIssue[]
}

export type SaveResult =
  | { ok: true; details: ItemDetails }
  | { ok: false; reason: 'conflict' | 'invalid' | 'error'; message: string; issues?: ItemIssue[] }

/** Items holding values a changed field definition would no longer allow (shown before saving). */
export interface FieldCheck {
  fieldId: string
  name: string
  count: number
  /** Up to five of their IDs. */
  examples: string[]
}

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
  /**
   * Re-reads files changed on disk (by ReqMan, a Git pull or a hand edit) — only the changed ones when the
   * folder can be watched. `focus`: the window got focus again, so Git settings are re-read too.
   */
  refreshRepository(focus?: boolean): Promise<RepoInfo>
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
  /** Moves several items at once: they keep their order, land together before `before` (or last), keep their children. */
  reparentItems(ids: string[], parent: string | null, before?: string | null): Promise<{ ok: true } | { ok: false; message: string }>
  /** IDs from the top-level item down to the item's parent (empty for a top-level item). */
  getAncestors(id: string): Promise<string[]>
  /** Replaces the project's field definitions in schema.yaml and re-opens the repository. */
  saveSchemaFields(fields: FieldDef[], schemaRevision: string): Promise<{ ok: true; info: RepoInfo } | { ok: false; message: string }>
  /** Adds a link stored in `source` ("source verifies target"); confirmed against the target as it is now. */
  addLink(source: string, type: string, target: string): Promise<{ ok: true } | { ok: false; message: string }>
  removeLink(source: string, type: string, target: string): Promise<{ ok: true } | { ok: false; message: string }>
  /** Marks suspect links of `source` as reviewed (all of them, or only the one to `target`). */
  confirmLinks(source: string, target?: string): Promise<{ ok: true } | { ok: false; message: string }>
  /** Keeps (confirms) or removes each of these links; one file write per source item (O-04). */
  decideLinks(decisions: LinkDecision[]): Promise<{ ok: true; kept: number; unlinked: number } | { ok: false; message: string }>
  /** Takes back one part of an item's uncommitted change: that part becomes as in the last commit (O-05). */
  revertChange(id: string, part: RevertPart): Promise<{ ok: true } | { ok: false; message: string }>
  /** Renames the file holding `id` to <ID>.md when its name does not match (a repository problem). */
  fixFileName(id: string): Promise<{ ok: true } | { ok: false; message: string }>
  /** Before saving field definitions: how many items have values the changed definitions do not allow. */
  checkFields(fields: FieldDef[]): Promise<FieldCheck[]>
  // --- Git (all operate on the open repository; only requirements/ is committed)
  getGitState(): Promise<GitState>
  /** Commits all changes under requirements/. */
  commit(message: string): Promise<GitResult>
  /**
   * Fetches and merges the remote branch. Items both sides changed are combined field by field; when some part was
   * changed differently on both sides, nothing is changed yet and the result carries a `plan` with the questions.
   */
  pull(): Promise<GitResult>
  /** Like pull, from any branch (local or remote) into the current one (owner's decision M8-6). */
  pullFrom(source: string): Promise<GitResult>
  /** Completes a pull with the user's answers to the plan's questions. */
  finishPull(plan: MergePlan, answers: MergeAnswers): Promise<GitResult>
  /** Local branches, and remote branches that have no local branch of the same name. */
  listBranches(): Promise<BranchInfo[]>
  /** Creates a branch from the current one and switches to it; uncommitted changes come along. */
  createBranch(name: string): Promise<GitResult>
  /**
   * Switches branch. Uncommitted changes: `take` brings them along (refused, with the blocking items, when the
   * other branch has a different version of those files); `discard` throws them away first.
   */
  switchBranch(name: string, changes: 'take' | 'discard'): Promise<GitResult>
  /** The window's language (0.13.0): core messages follow it. */
  setLanguage(lang: 'en' | 'ar'): Promise<void>
  /** Deletes a branch on this PC (never the current one, never on the remote). `force` also when it has unmerged commits. */
  deleteBranch(name: string, force: boolean): Promise<GitResult>
  /** What a branch would bring into the current one, like a pull request: common ancestor → that branch. */
  branchRange(name: string): Promise<{ from: string; to: string } | null>
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
  // --- Compare (M5)
  getCompareOptions(): Promise<CompareOptions>
  /** Requirement-level differences between two versions; `to` may be "WORKING". */
  compareVersions(from: string, to: string): Promise<CompareResult>
  // --- Export (M6): each asks where to save, then writes the file
  // --- Excel / CSV import (M7)
  /** Asks for an .xlsx or .csv file and reads it; null when the user cancels. */
  chooseImportFile(): Promise<ImportFile | null>
  /** What importing the chosen sheet would do (nothing is written). */
  previewImport(settings: ImportSettings): Promise<ImportPreview>
  /** Imports it as uncommitted changes; with `commitMessage` (new project) commits right away. */
  runImport(settings: ImportSettings, commitMessage?: string): Promise<ImportResult>
  /** Asks for a file and an empty folder, creates a Git repository with a requirements folder there and opens it. */
  newProjectFromFile(): Promise<{ ok: true; info: RepoInfo; file: ImportFile } | { ok: false; canceled: true } | { ok: false; canceled?: false; message: string }>
  /** The file this repository was imported from on this PC, if any ("Update the Excel file"). */
  getImportSource(): Promise<ImportSource | null>
  /** Writes the current requirements back into that file (only changed cells, new items as new rows), or into a copy. */
  updateSourceFile(mode: 'original' | 'copy'): Promise<ExportResult>
  /** Connects the repository to an empty GitHub repository ("origin") and pushes for the first time. */
  publishToRemote(url: string): Promise<GitResult>
  exportItems(request: ExportItemsRequest): Promise<ExportResult>
  exportCompare(from: string, to: string, format: ExportFormat): Promise<ExportResult>
  /** Opens Explorer with the file selected. */
  showInFolder(path: string): Promise<void>
  /** Moves an item one place up or down among its siblings. */
  moveItem(id: string, direction: 'up' | 'down'): Promise<{ ok: true } | { ok: false; message: string }>
  /** Records an error that happened in the UI in the log file. */
  reportUiError(message: string): void
  /** A plain-text summary (versions, paths, checks) to paste into a bug report. */
  getDiagnostics(): Promise<string>
  /** Measures the data layer on this PC with `count` generated items in a temporary folder. */
  runDataSelfTest(count: number): Promise<DataSelfTestResult>
  /**
   * Runs the main actions (create, edit, links, commit, pull with a clash, push, compare, export) on a practice
   * repository with a fake "GitHub" in a temporary folder — never the user's data — and reports each step.
   */
  runReleaseSelfTest(): Promise<ReleaseSelfTestResult>
}

/** Calls that go through `ipcRenderer.invoke` (all except the event subscription and the fire-and-forget log). */
export type InvokeMethod = Exclude<keyof ReqManApi, 'onUpdateStatus' | 'reportUiError'>

export interface ReleaseSelfTestStep {
  name: string
  ok: boolean
  ms: number
  /** What went wrong, or a short note. */
  detail?: string
}

export interface ReleaseSelfTestResult {
  ok: boolean
  version: string
  gitVersion: string | null
  startedAt: string
  totalMs: number
  steps: ReleaseSelfTestStep[]
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
  runReleaseSelfTest: 'diag:runReleaseSelfTest',
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
  reparentItems: 'ws:reparentItems',
  getAncestors: 'ws:ancestors',
  saveSchemaFields: 'ws:saveSchemaFields',
  addLink: 'ws:addLink',
  removeLink: 'ws:removeLink',
  confirmLinks: 'ws:confirmLinks',
  decideLinks: 'ws:decideLinks',
  revertChange: 'ws:revertChange',
  fixFileName: 'ws:fixFileName',
  checkFields: 'ws:checkFields',
  getGitState: 'git:state',
  commit: 'git:commit',
  pull: 'git:pull',
  pullFrom: 'git:pullFrom',
  finishPull: 'git:finishPull',
  listBranches: 'git:listBranches',
  createBranch: 'git:createBranch',
  switchBranch: 'git:switchBranch',
  branchRange: 'git:branchRange',
  deleteBranch: 'git:deleteBranch',
  setLanguage: 'app:setLanguage',
  push: 'git:push',
  discardChanges: 'git:discard',
  setGitIdentity: 'git:setIdentity',
  undoLastCommit: 'git:undoLastCommit',
  getItemHistory: 'git:itemHistory',
  compareItemVersion: 'git:compareItemVersion',
  getCompareOptions: 'compare:options',
  compareVersions: 'compare:versions',
  chooseImportFile: 'import:choose',
  previewImport: 'import:preview',
  runImport: 'import:run',
  newProjectFromFile: 'import:newProject',
  getImportSource: 'import:source',
  updateSourceFile: 'import:updateSource',
  publishToRemote: 'git:publish',
  exportItems: 'export:items',
  exportCompare: 'export:compare',
  showInFolder: 'app:showInFolder'
} as const satisfies Record<Exclude<keyof ReqManApi, 'onUpdateStatus'> | 'updateStatusChanged', string>
