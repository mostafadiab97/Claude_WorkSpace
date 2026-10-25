# Welcome to ReqMan — onboarding guide for engineers

Read this first (about 30 minutes). It explains what ReqMan is, how the parts fit together, how data moves through
them, and how to make your first change safely. Deeper references are linked at the end.

## 1. What ReqMan is, in one picture

ReqMan is a **small desktop app for managing requirements** (needs, system/software/hardware requirements, tests,
risks…) that replaces scattered Word and Excel files. It has **no server and no database of its own**:

- every requirement is a **plain text file** in a `requirements/` folder **inside the project's own Git repository**;
- **Git is the database and the version control**: history, sharing (pull/push), branches and reviews come from Git
  and GitHub;
- ReqMan is the window that understands those files: a tree table, an editor, typed links between items, "suspect"
  links, and Git actions shown per requirement instead of per file line.

![System context](images/system-context.png)

```mermaid
flowchart LR
  U(["Engineer"]) --> APP["ReqMan app (offline)"]
  APP --> WF[("Repository folder: requirements/")]
  APP --> GIT["Git for Windows"]
  GIT --> GH[("GitHub: shared copy")]
  APP --> AD[("%APPDATA% › ReqMan: cache, logs, theme")]
  APP -.-> REL[("GitHub Releases: updates")]
```

## 2. Five ideas that explain most of the code

1. **Files are the truth.** One Markdown file per item (`requirements/items/<ID>.md`), YAML header + text. Anything
   else (the SQLite index, the UI state) can be thrown away and rebuilt from the files.
2. **Never lose or overwrite someone's work.** Every write checks that the file is still the version that was read
   (a *revision* hash); otherwise it refuses with a clear message. Writes are atomic (temp file + rename). Unknown
   header keys are kept. Git pushes are never forced; a pull that would clash stops before changing anything.
3. **Modules with one front door.** Each folder in `src/modules/<name>/` has an `index.ts` — the only file other code
   may import (ESLint enforces it). `src/main/composition.ts` is the one place where implementations are created
   and connected, so a module can be swapped in one line.
4. **The window cannot touch files or Git.** The UI (renderer) runs sandboxed; it only calls `window.reqman.*`,
   defined in `src/shared/api.ts`. All file, Git and database work happens in the main process.
5. **One theme file.** Colours, fonts, sizes, radii and spacing come from `config/theme.json` as CSS variables
   (`--rm-*`). Hard-coded colours in the UI fail a test.

## 3. The parts and how they connect

![Modules](images/modules.png)

```mermaid
flowchart TB
  subgraph R["Renderer (React window)"]
    UI["screens/ + workspace/ components"]
  end
  BR{{"window.reqman (preload) — contract: shared/api.ts"}}
  subgraph M["Main process (Node/Electron)"]
    IPC["main/ipc.ts"]
    WS["workspace (+ gitOps, compare)"]
    RS["repository-store"]
    IC["index-cache (SQLite)"]
    GA["git-adapter"]
    IE["import-export"]
    IT["items (domain core)"]
    SC["schema"]
    OTHER["logger · theme · updater · sample-data"]
  end
  UI --> BR --> IPC --> WS
  IPC --> OTHER
  WS --> RS & IC & GA & IE & IT
  RS --> IT & SC
  IC --> IT
  IT --> SC
```

| Part | Role in one sentence | Main files | Used by |
| --- | --- | --- | --- |
| **Renderer** (`src/renderer/src`) | Everything on screen: start screen, tree table, editor, links, Git bar, Changes, Compare, History, Fields, Export | `app/App.tsx`, `screens/WorkspaceScreen.tsx`, `workspace/*.tsx`, `styles.css` | the user |
| **Preload** (`src/preload/index.ts`) | The bridge: exposes `window.reqman`, turning each call into an IPC message | one file | renderer |
| **Contract** (`src/shared/api.ts`, `domain.ts`) | The types both sides agree on: every call, every data shape, every channel name | two files | everyone |
| **main/ipc.ts** | Receives calls, checks inputs, shows native dialogs (open folder, save file), forwards to modules | one file | preload |
| **main/composition.ts** | Builds all modules and wires them together — the only place to swap an implementation | one file | `main/index.ts` |
| **workspace** | "The open repository": opens/creates it and runs every user operation with the rules that need the whole set (no parent loops, conflict-safe saves, links, moves, schema fields, export); `gitOps.ts` = commit/pull/push/history, `compare.ts` = Compare | `workspace.ts`, `gitOps.ts`, `compare.ts` | ipc |
| **repository-store** | Reads and writes the files in `requirements/` — atomic, revision-checked | `fileStore.ts` | workspace |
| **index-cache** | A local SQLite copy of all items for fast search, filters, counts, suspect links and problems; re-reads only changed files | `sqliteIndex.ts` | workspace |
| **git-adapter** | Runs the installed `git` (argument arrays, no shell, timeouts) and parses its output | `systemGit.ts` | workspace |
| **import-export** | Pure functions that turn items or a comparison into CSV (Excel) or Markdown; M7 adds Excel and import | `csv.ts`, `items.ts`, `compare.ts` | workspace |
| **items** | The domain core: item file format, IDs, validation, content fingerprint, field-level diff | `itemFile.ts`, `ids.ts`, `validate.ts`, `diff.ts` | store, index, workspace |
| **schema** | Reads `schema.yaml` (item types, fields, link types) and reports problems | `parse.ts` | store, items |
| **logger / theme / updater** | Log file with rotation · layered theme file · automatic updates from GitHub Releases | one implementation each | main |
| **sample-data** | Fictional requirement sets for tests and the in-app self-test | `generate.ts`, `benchmark.ts` | tests, ipc |

## 4. What the data looks like

An item file (`requirements/items/SYS-0033FV.md`):

```markdown
---
id: SYS-0033FV
type: system-requirement
title: Main PCB authenticates safety limits
status: Approved
priority: High
owner: L. Samir
tags:
  - i18n
  - release-1.0
parent: INFO-A6P9A8
order: 1620
links:
  - type: refines
    target: STK-ZWN5M8
    confirmed: 994b9d44bde8
---
The main PCB shall limit access tokens in all supported languages.
```

- `id` is `PREFIX-` + 6 random characters, so two people never need to coordinate numbers.
- `parent` + `order` build the hierarchy; `links` are stored only on the source item ("this verifies that").
- `confirmed` is the fingerprint (type + title + text) of the target when the link was last confirmed; if the
  target changes, the link becomes **suspect** until someone confirms it.
- The project's `requirements/.reqman/schema.yaml` defines item types (with ID prefixes), fields (text, choice,
  list, number, date) and link types (name + reverse name). It is versioned with the requirements.

## 5. How a request travels — two examples

**Saving an item** (conflict-safe):

![Save flow](images/save-flow.png)

**Compare** (pulls first, then shows what changed per requirement):

![Pull and compare flow](images/pull-compare-flow.png)

The diagram sources are in `docs/diagrams/*.mmd` (Mermaid). GitHub renders the Mermaid blocks above; the PNG/SVG
copies in `docs/images/` are regenerated with `npx -y @mermaid-js/mermaid-cli -i docs/diagrams/<name>.mmd -o
docs/images/<name>.png -b white -w 1600` (or any Mermaid tool).

## 6. Your first day

1. Set up the PC: `docs/DEVELOPING.md` (Git, Node 22 — also without admin rights —, VS Code).
2. Clone this repository and the test data `Claude_SandBox` **next to** it, then `npm ci` and `npm run check`.
3. `npm run dev` starts ReqMan from the source. Open the sandbox clone: 10,005 fictional items with every kind of
   structure, link and deliberately broken file (see its README).
4. Click through the checklist in `docs/TESTING.md` once — it is the fastest tour of every feature.
5. Read `CLAUDE.md` (project memory: rules, decisions, pitfalls) and skim `docs/ARCHITECTURE.md`.

## 7. Making a change end to end (checklist)

Example: a new operation "mark several items as Approved".

1. **Domain/logic** in the right module (e.g. a pure helper in `items`, or the operation in `workspace`), using
   existing pieces: `repository-store.writeItem` with `expectedRevision`, then `index.syncPaths`.
2. **Contract:** add the call to `ReqManApi` and its channel name to `Channels` in `src/shared/api.ts`.
3. **Main:** handle the channel in `src/main/ipc.ts` (check inputs) and expose it in `src/preload/index.ts`.
   The TypeScript compiler tells you if one side is missing.
4. **UI:** call `window.reqman.<name>()` from a component; use only `--rm-*` CSS variables for styling.
5. **Tests:** a unit test in `tests/` (real temp folders and real Git, no mocks for files), and extend
   `e2e/journey.e2e.mjs` when the user can see the feature.
6. **Docs and release:** the owner's checklist in `docs/TESTING.md`, `CHANGELOG.md`, `docs/ARCHITECTURE.md`
   (module map/UI table), the status in `CLAUDE.md`; bump `version` in `package.json` and push — the Windows build
   and release run on GitHub Actions.

If you change the SQLite tables, bump `FORMAT_VERSION` in `src/modules/index-cache/sqliteIndex.ts` and add a test
that opens an old cache file.

## 8. What protects you

| Check | Command | Runs in CI |
| --- | --- | --- |
| Type checking (main and renderer separately) | `npm run typecheck` | yes |
| Lint incl. module boundaries and React hooks rules | `npm run lint` | yes |
| Unit tests (incl. real Git with a bare remote and two clones) | `npm test` | yes |
| All three | `npm run check` | yes |
| Performance with 10,000 and 50,000 items | `npm run test:perf` | yes |
| The whole user journey in the real app (Playwright) | `npm run build && npm run test:e2e` | yes |
| A generated 10,000-item repository opened in the real app | `npm run measure:ui -- <folder>` | yes |

## 9. Glossary

| Term | Meaning |
| --- | --- |
| Item | One requirement, test, risk, heading… = one file |
| Schema | The project's item types, fields and link types (`schema.yaml`) |
| Link / reverse name | A typed relation stored on the source ("TC-1 verifies SYS-1"); shown from the other side by its reverse name ("verified by") |
| Suspect link | A link whose target's type, title or text changed after the link was confirmed |
| Fingerprint | Short hash of an item's type, title and text, used for suspect links |
| Revision | Short hash of a file's content when it was read; writes are refused if it changed meanwhile |
| Index cache | The SQLite file in `%APPDATA%\ReqMan\cache` — fast search; rebuildable at any time |
| Upstream | The remote branch a local branch pulls from / pushes to (e.g. `origin/main`) |
| Reflog | Git's local record of where the branch pointed over time — used to find "what the last pull brought in" |
| Working folder | The files on disk, including changes not committed yet |

## 10. Where to read more

- `CLAUDE.md` — project memory and working agreement (status, decisions, pitfalls). Keep it current.
- `docs/design/DESIGN.md` — domain analysis of five RM tools, every product decision, requirements, roadmap.
- `docs/ARCHITECTURE.md` — module map, rules, data format, UI structure.
- `docs/TESTING.md` — the owner's manual checklists and the two-PC trial.
- `docs/reviews/` — project reviews with known risks and proposed improvements.
- `CHANGELOG.md` — what changed in each version and what testing found.
