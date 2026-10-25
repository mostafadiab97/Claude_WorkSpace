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

Planned (see milestones): `repository-store`, `domain-core`, `index-cache`, `diff-merge`, `import-export`, `git-host`.
Keep this table up to date with every change.

## Folder layout

```
config/            user-editable configuration (theme.json)
resources/         static assets (logo)
src/shared/        UI ↔ core contract (api.ts)
src/main/          core entry, composition root, IPC handlers
src/modules/       one folder per module, each with index.ts as its only public entry
src/preload/       bridge exposing window.reqman
src/renderer/      UI (React)
tests/             unit tests (Vitest)
samples/, tools/   sample data and its generator
```
