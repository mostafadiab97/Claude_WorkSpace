# ReqMan architecture

ReqMan is a **modular monolith**: one desktop application (Electron) split into modules with narrow,
documented interfaces. Full rationale, requirements and decisions live in the project analysis document.

> New here? Start with `docs/ONBOARDING.md` — it has diagrams of the system, the modules and the main flows.

## Processes

| Process | Code | Can do |
| --- | --- | --- |
| Core (main) | `src/main/`, `src/modules/` | Files, Git, configuration — everything with side effects |
| Bridge (preload) | `src/preload/` | Exposes exactly `ReqManApi` to the UI as `window.reqman` |
| UI (renderer) | `src/renderer/` | Screens only. No Node, no file system, no Git — only `window.reqman` |

The UI ↔ core contract is **one file**: `src/shared/api.ts`. Adding a capability means:
1. add it to `ReqManApi` and `Channels` in `src/shared/api.ts`,
2. handle it in `src/main/ipc.ts`,
3. expose it in `src/preload/index.ts`.

## Rules (enforced on every build)

1. **One public entry per module.** Each folder in `src/modules/` has an `index.ts` that declares its
   interface. Code outside the module imports only that file. ESLint (`eslint.config.mjs`) fails the
   build on any import of module internals.
2. **Wiring in one place.** `src/main/composition.ts` creates every module. Replacing a module =
   write a new implementation of its interface and change one line there.
3. **UI is isolated.** ESLint blocks the renderer from importing `main/`, `modules/`, `electron` or Node APIs.
4. **Theme tokens only.** UI styles use `var(--rm-...)` tokens from `config/theme.json`; a test fails the
   build if a literal colour appears in UI code. See `docs/THEMING.md`.
5. **Settings over code.** Anything teams may want to change lives in `config/`, shipped as plain files
   next to the installed app.
6. **All texts in one file.** Every word the user sees comes from `src/shared/text.ts` (`T.<area>.<key>`;
   texts with values are small functions). A test (`tests/ui-texts.test.ts`) fails the build if screen code
   contains literal words. Messages the core sends (Git, saving) come from the same file. (Owner's decision
   S-06, 27 Oct 2026: a later translation is a copy of that one object.)
7. **Every window call is checked.** `src/main/ipc.ts` has one handler per `ReqManApi` call (the compiler
   reports a missing one) and checks every argument with `src/main/validate.ts` first; `src/preload` builds
   `window.reqman` from the `Channels` table, so adding a call never touches the preload.

## Module map

| Module | Interface (`index.ts`) | Implementation | Used by |
| --- | --- | --- | --- |
| `git-adapter` | `GitAdapter` — `getGitInfo()`, `findRepositoryRoot()`, `status()`, `reflog()`, `refs()`, `commits()`, `diffNameStatus()` (raw, with blob IDs), `readBlobs()` (one `cat-file --batch` process), `remotes()`, `identity()`, `commit()`, `fetch()`, `checkMerge()`, `merge()`, `push()`, `log()`, `show()`, `discard()`, `undoLastCommit()`… | `systemGit.ts`: calls the installed Git with argument arrays (no shell), `GIT_TERMINAL_PROMPT=0` (sign-in only through Git Credential Manager's window), timeouts (30 s local, 180 s network); `GitError` carries exit code and Git's output | `workspace`, `main/ipc.ts` |
| `logger` | `Logger` — `info/warn/error`, `filePath` | `fileLogger.ts`: appends to `%APPDATA%\ReqMan\logs\reqman.log`, rotates at 1 MB, never throws | `main/index.ts`, `main/ipc.ts` |
| `theme` | `ThemeService` — `load()`, `userThemeFile`, `ensureUserThemeFile()` | `fileTheme.ts`: layers defaults ← `config/theme.json` ← `%APPDATA%\ReqMan\theme.json`, validates each, loads logo | `main/ipc.ts` |
| `updater` | `UpdateService` — `start()`, `checkNow()`, `installAndRestart()`, `current()` | `githubUpdater.ts`: electron-updater against GitHub Releases; background download, user-chosen restart | `main/index.ts`, `main/ipc.ts` |

| `schema` | `parseSchema(text)` → `{ schema, problems }`; types `Schema`, `ItemTypeDef`, `FieldDef`, `LinkTypeDef` | `parse.ts`: reads `requirements/.reqman/schema.yaml`, skips invalid entries with a message | `items`, `repository-store` |
| `items` (domain core) | `Item`, `Link`; `parseItemFile`, `serializeItem`, `generateId`, `validateItem`, `contentFingerprint`, `diffItems` | Pure logic, no I/O: file format, IDs, per-item validation, suspect-link fingerprint | `repository-store`, `index-cache`, `sample-data` |
| `repository-store` | `RepositoryStore` — `inspect()`, `initialize()`, `open(root, { locate })`; `RequirementsRepo` — `loadAll()`, `createItem()`, `writeItem()`, `deleteItem()`, `itemPath()`, `fixFileName()`… | `fileStore.ts`: files in `requirements/`, atomic writes (`safe-files`), never overwrites unreadable files; `locate` (the index) says where an item's file really is, so a file renamed by hand is read and written in place; `checks.ts`: duplicate IDs, broken links, parent loops | `main/composition.ts`, `index-cache`, `sample-data` |
| `safe-files` | `writeFileAtomic()`, `removeFile()`, `renameFile()`, `withRetry()` | Temporary file + rename; retries for ~1.5 s while Windows briefly locks a file (antivirus, indexer, OneDrive); keeps the temporary file if the final rename fails | `repository-store`, `workspace`, `main/ipc.ts` |
| `self-test` | `runReleaseSelfTest(deps)` | The in-app release self-test: the main actions on a practice repository with a bare "GitHub" in a temporary folder; never touches the user's data or Git settings | `main/composition.ts` |
| `index-cache` | `IndexCache` — `sync()`, `syncPaths()`, `rebuild()`, `query()` (incl. link filters/counts), `get()`, `incomingLinks()`, `fingerprint()`, `repositoryIssues()` | `sqliteIndex.ts`: SQLite (built into Electron) with full-text search, outside the repo, re-reads only changed files; stores **every** header key, results show the schema's fields only — so a field change re-reads no file (format 3); whole-repository checks as SQL (incl. "file name ≠ ID") | `workspace` |
| `workspace` | `WorkspaceService` — `checkFolder()`, `initialize()`, `open()`, `refresh(focus)`, `repoInfo()`, `query()`, `getItem()`, `newItem()`, `saveItem()`, `deleteItem()`, `moveItem()`, `fixFileName()`, `checkFields()`, `recent()`… | `workspace.ts`: the facade over small services, and **one queue** through which every write, index change and Git action runs (one after another); `context.ts` (open repository, shared helpers), `itemOps.ts` (read/create/save/delete, conflict-safe, no parent loops), `links.ts`, `structure.ts` (moves and order — the ordering rules are pure functions), `schemaFields.ts` (field definitions + "how many items become invalid"), `exporting.ts`, `recent.ts` (`%APPDATA%\\ReqMan\\recent-repositories.json`), `watcher.ts` (notices which files changed, so a refresh re-reads only those). `gitOps.ts`: changes per item, commit (requirements folder only), pull (fetch, in-memory merge check, stop on items changed on both sides), push (never forced), discard, undo unpushed commit, per-item history and field-level comparison. `compare.ts`: two versions of the whole set (last pull from the reflog, any commit/branch/tag, or the working folder), paired by item ID, summarised per item and per link, schema changes | `main/ipc.ts` |
| `import-export` | `toCsv()`, `parseCsv()`, `itemsToCsv()`, `itemsToMarkdown()`, `compareToCsv()`, `compareToMarkdown()` | Pure functions: CSV for Excel (comma, UTF-8 BOM, CRLF, formula guard), Markdown for AI tools; M7 adds Excel read/write and import mapping. The workspace collects the rows (document order), `main/ipc.ts` asks where to save and writes | `workspace` |
| `sample-data` | `generateItems()`, `runDataBenchmark()` | Fictional thermostat requirements; used by tests, `npm run gen:repo` and the in-app self-test | `main/ipc.ts`, tests |

Planned (see milestones): `diff-merge` (per-item merge, M8), `git-host` (GitHub pull requests).
Keep this table up to date with every change.

## Data format (in the project's Git repository)

```
requirements/
  .reqman/schema.yaml   item types, fields, link types (copied from config/default-schema.yaml, then owned by the project)
  .gitattributes        LF line endings for identical diffs on every PC
  items/SYS-K7Q3XM.md   one file per item: YAML header + Markdown text
```

- **IDs**: type prefix + 6 random characters (Crockford base32, no I/L/O/U). Random, not sequential, so items
  created on different branches never collide.
- **Header order is fixed**: id, type, title, schema fields in schema order, unknown keys (sorted), parent, order,
  links. The same item always produces the same bytes, so Git diffs show only real changes.
- **Links are stored only on the source item**; the reverse view ("verified by") comes from the index.
  Adding a link from the target's side ("is verified by TC-1") therefore writes TC-1's file.
- **Suspect links.** Each link stores `confirmed:` — the target's content fingerprint (type + title + text) when the
  link was created or last confirmed. If the target's fingerprint is different now, the link is *suspect* (⚠) until
  someone confirms it. Status, owner, order or links of the target do not count as a change. Links without
  `confirmed` (written by hand or imported) are never suspect. The index keeps each item's fingerprint, so
  "items with suspect links" is one SQL query.
- **Unknown header keys are preserved**, so files written by a newer ReqMan or another tool lose nothing.
- **The index is a cache**: `%APPDATA%\ReqMan\cache\…sqlite`, rebuilt automatically when missing or when the
  schema's fields change.

## Decisions changed during implementation

| Planned | Built | Why |
| --- | --- | --- |
| `better-sqlite3` for the index | Node's built-in `node:sqlite` (in Electron 45) | No native module to compile for Windows; same SQL and full-text search. Hidden behind `IndexCache`, so swappable in one place |
| Metadata folder `.reqtool/` | `.reqman/` | Matches the product name |
| Requirement text in field `description` | Built-in property `text` (the Markdown body) | The body of the file is the text; keeps the header small |
| Suspect links in the MVP (FR-17) | Built in M3 (v0.4.0) | Cheap once links existed; the format already had `confirmed` |
| Per-requirement merge in the MVP (FR-13) | M4 pull stops on items changed on both sides and names them; "Undo last commit" + "Discard" lets the user take the other version | Owner's decision 25 Oct 2026: stop safely now, choose per item later |

## Folder layout

```
config/            shipped configuration: theme.json, default-schema.yaml
resources/         static assets (logo)
src/shared/        UI ↔ core contract (api.ts) and shared data types (domain.ts)
src/main/          core entry, composition root, IPC handlers
src/modules/       one folder per module, each with index.ts as its only public entry
src/preload/       bridge exposing window.reqman
src/renderer/      UI (React): screens/ (start, workspace, settings), workspace/ (editor, Git, Compare, fields…), workspace/table/ (columns, rows, drag & drop), workspace/screen/ (toolbar, problems, filter and Git hooks), components/
src/shared/text.ts every text the user sees
e2e/               end-to-end scenarios that drive the built app: harness.mjs (shared), scenarios/*.e2e.mjs, run.mjs (runs them two at a time)
tests/             unit tests (Vitest); tests/ui/ = window-side logic, type-checked with the renderer's settings
samples/, tools/   sample data and its generator
```

## UI structure

| Area | Component | Notes |
| --- | --- | --- |
| Start | `screens/StartScreen.tsx` | Open repository (folder picker → Git root detection → create `requirements/` if missing), recent list |
| Workspace | `screens/WorkspaceScreen.tsx` | Selection, unsaved-changes guard, refresh on window focus; filters in `workspace/screen/useFilters.ts`, Git state in `useGit.ts`, toolbar and problem list (with "Fix file name") in `Toolbar.tsx` / `Problems.tsx` |
| Table | `workspace/ItemTable.tsx` + `workspace/table/` | Tree mode (no search/filter): the hierarchy, children loaded per parent when opened (500, then "Show more"); Expand all opens every level at once and loads levels as they scroll into view (`rows.ts`); drag & drop calls `reparentItem(id, parent, before)`. Flat mode (search/filter): rows fetched 100 at a time. Virtual scrolling in both; sticky header and ID column |
| Columns & fields | `workspace/FieldsPanel.tsx` | Hidden columns and column order per repository in the PC's local storage (personal); built-in parts (ID, Title, Type, Parent, Text, Links) cannot be added as fields; field definitions saved to `schema.yaml` through `saveSchemaFields` (comment-preserving, refused if the file changed since it was read) |
| Links | `workspace/LinksSection.tsx` | Both directions grouped by link type; add (forward or reverse relation + item search), remove, confirm suspect links — each saved immediately; locked while the item has unsaved edits |
| Item search | `workspace/ItemSearch.tsx` | Shared search-and-pick list for the parent picker and link targets |
| Parent picker | `workspace/ParentPicker.tsx` | Empty = top-level items; typed = relevance search; loops greyed out via `getAncestors` |
| Editor | `workspace/ItemEditor.tsx` | Fields generated from the schema; Ctrl+S; conflict message if the file changed outside ReqMan |
| Git bar | `workspace/GitPanels.tsx` (`GitBar`) | Branch, ↑ahead ↓behind, Changes / Pull / Push; result message with the affected items (clickable) |
| Changes panel | `workspace/GitPanels.tsx` (`ChangesPanel`) | Replaces the editor column while open (the editor stays mounted, so unsaved edits survive); per-item Discard, commit message, name/e-mail form, Undo last commit |
| Compare | `workspace/CompareView.tsx` | Replaces the table while open (the table stays mounted); preset / custom range, count chips as filters, Items and Links tabs; `CompareDetail` on the right; pulls first (in `WorkspaceScreen`) |
| Export | `workspace/ExportDialog.tsx` | Scope (all in document order / current result), extra columns, CSV or Markdown; Compare has its own Export buttons |
| Error boundary | `components/ErrorBoundary.tsx` | Around the workspace and settings: logs, offers Try again / Copy diagnostics / Reload |
| Change view | `workspace/ChangeView.tsx` | Shared by History and Compare: changed fields before/after, text before/after, links added/removed |
| History | `workspace/HistoryView.tsx` | Editor tab: commits of the item (plus "Not committed yet"), and for the selected one a field/text/link comparison |
| Settings | `screens/SettingsScreen.tsx` | Environment, diagnostics, release self-test (`components/ReleaseSelfTestCard.tsx`), data self-test; the workspace stays mounted behind it |
