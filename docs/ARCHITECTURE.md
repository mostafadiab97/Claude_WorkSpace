# ReqMan architecture

ReqMan is a **modular monolith**: one desktop application (Electron) split into modules with narrow,
documented interfaces. Full rationale, requirements and decisions live in the project analysis document.

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

## Module map

| Module | Interface (`index.ts`) | Implementation | Used by |
| --- | --- | --- | --- |
| `git-adapter` | `GitAdapter` — `getGitInfo()` | `systemGit.ts`: calls the installed Git | `main/ipc.ts` |
| `logger` | `Logger` — `info/warn/error`, `filePath` | `fileLogger.ts`: appends to `%APPDATA%\ReqMan\logs\reqman.log`, rotates at 1 MB, never throws | `main/index.ts`, `main/ipc.ts` |
| `theme` | `ThemeService` — `load()`, `userThemeFile`, `ensureUserThemeFile()` | `fileTheme.ts`: layers defaults ← `config/theme.json` ← `%APPDATA%\ReqMan\theme.json`, validates each, loads logo | `main/ipc.ts` |
| `updater` | `UpdateService` — `start()`, `checkNow()`, `installAndRestart()`, `current()` | `githubUpdater.ts`: electron-updater against GitHub Releases; background download, user-chosen restart | `main/index.ts`, `main/ipc.ts` |

| `schema` | `parseSchema(text)` → `{ schema, problems }`; types `Schema`, `ItemTypeDef`, `FieldDef`, `LinkTypeDef` | `parse.ts`: reads `requirements/.reqman/schema.yaml`, skips invalid entries with a message | `items`, `repository-store` |
| `items` (domain core) | `Item`, `Link`; `parseItemFile`, `serializeItem`, `generateId`, `validateItem`, `contentFingerprint` | Pure logic, no I/O: file format, IDs, per-item validation, suspect-link fingerprint | `repository-store`, `index-cache`, `sample-data` |
| `repository-store` | `RepositoryStore` — `inspect()`, `initialize()`, `open()`; `RequirementsRepo` — `loadAll()`, `createItem()`, `writeItem()`, `deleteItem()`… | `fileStore.ts`: files in `requirements/`, atomic writes, never overwrites unreadable files; `checks.ts`: duplicate IDs, broken links, parent loops | `main/composition.ts`, `index-cache`, `sample-data` |
| `index-cache` | `IndexCache` — `sync()`, `syncPaths()`, `rebuild()`, `query()`, `get()`, `incomingLinks()`, `repositoryIssues()` | `sqliteIndex.ts`: SQLite (built into Electron) with full-text search, outside the repo, re-reads only changed files; whole-repository checks as SQL | `workspace` |
| `workspace` | `WorkspaceService` — `checkFolder()`, `initialize()`, `open()`, `refresh()`, `query()`, `getItem()`, `newItem()`, `saveItem()`, `deleteItem()`, `moveItem()`, `recent()` | `workspace.ts`: the open repository; conflict-safe saving (file revision check), no parent loops, delete only leaf items, reordering by swapping two files; recent list in `%APPDATA%\\ReqMan\\recent-repositories.json` | `main/ipc.ts` |
| `sample-data` | `generateItems()`, `runDataBenchmark()` | Fictional thermostat requirements; used by tests, `npm run gen:repo` and the in-app self-test | `main/ipc.ts`, tests |

Planned (see milestones): `diff-merge`, `import-export`, `git-host`.
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
- **Unknown header keys are preserved**, so files written by a newer ReqMan or another tool lose nothing.
- **The index is a cache**: `%APPDATA%\ReqMan\cache\…sqlite`, rebuilt automatically when missing or when the
  schema's fields change.

## Decisions changed during implementation

| Planned | Built | Why |
| --- | --- | --- |
| `better-sqlite3` for the index | Node's built-in `node:sqlite` (in Electron 45) | No native module to compile for Windows; same SQL and full-text search. Hidden behind `IndexCache`, so swappable in one place |
| Metadata folder `.reqtool/` | `.reqman/` | Matches the product name |
| Requirement text in field `description` | Built-in property `text` (the Markdown body) | The body of the file is the text; keeps the header small |

## Folder layout

```
config/            shipped configuration: theme.json, default-schema.yaml
resources/         static assets (logo)
src/shared/        UI ↔ core contract (api.ts) and shared data types (domain.ts)
src/main/          core entry, composition root, IPC handlers
src/modules/       one folder per module, each with index.ts as its only public entry
src/preload/       bridge exposing window.reqman
src/renderer/      UI (React): screens/ (start, workspace, settings), workspace/ (table, tree, editor), components/
e2e/               end-to-end test that drives the built app (npm run test:e2e)
tests/             unit tests (Vitest)
samples/, tools/   sample data and its generator
```

## UI structure (M2)

| Area | Component | Notes |
| --- | --- | --- |
| Start | `screens/StartScreen.tsx` | Open repository (folder picker → Git root detection → create `requirements/` if missing), recent list |
| Workspace | `screens/WorkspaceScreen.tsx` | Filters/search/sort state, selection, unsaved-changes guard, refresh on window focus |
| Hierarchy | `workspace/ItemTree.tsx` | Lazy: children load when expanded, 500 at a time |
| Table | `workspace/ItemTable.tsx` | Virtual scrolling; rows fetched from the index 100 at a time; sticky header and ID column |
| Editor | `workspace/ItemEditor.tsx` | Fields generated from the schema; Ctrl+S; conflict message if the file changed outside ReqMan |
| Settings | `screens/SettingsScreen.tsx` | Environment, diagnostics, data self-test; the workspace stays mounted behind it |
