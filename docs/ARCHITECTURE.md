# reqochet architecture

reqochet is a **modular monolith**: one desktop application (Electron) split into modules with narrow,
documented interfaces. Full rationale, requirements and decisions live in the project analysis document.

> New here? Start with `docs/ONBOARDING.md` — it has diagrams of the system, the modules and the main flows.

## Processes

| Process | Code | Can do |
| --- | --- | --- |
| Core (main) | `src/main/`, `src/modules/` | Files, Git, configuration — everything with side effects |
| Bridge (preload) | `src/preload/` | Exposes exactly `ReqochetApi` to the UI as `window.reqochet` |
| UI (renderer) | `src/renderer/` | Screens only. No Node, no file system, no Git — only `window.reqochet` |

The UI ↔ core contract is **one file**: `src/shared/api.ts`. Adding a capability means:
1. add it to `ReqochetApi` and `Channels` in `src/shared/api.ts`,
2. handle it in `src/main/ipc.ts`, checking its inputs with `src/main/validate.ts`.
The preload needs no change: it exposes every `Channels` entry as `window.reqochet.<name>` (CR2-17).

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
   contains literal words. Messages the core sends (Git, saving) come from the same file. (the owner's decision
   S-06, 27 Oct 2026: a later translation is a copy of that one object.)
7. **Every window call is checked.** `src/main/ipc.ts` has one handler per `ReqochetApi` call (the compiler
   reports a missing one) and checks every argument with `src/main/validate.ts` first; `src/preload` builds
   `window.reqochet` from the `Channels` table, so adding a call never touches the preload.

## Module map

| Module | Interface (`index.ts`) | Implementation | Used by |
| --- | --- | --- | --- |
| `git-adapter` | `GitAdapter` — `getGitInfo()`, `findRepositoryRoot()`, `status()`, `reflog()`, `refs()`, `commits()`, `diffNameStatus()` (raw, with blob IDs), `readBlobs()` (one `cat-file --batch` process), `remotes()`, `identity()`, `commit()`, `fetch()`, `checkMerge()`, `merge()`, `push()`, `log()`, `show()`, `discard()`, `undoLastCommit()`… | `systemGit.ts`: calls the installed Git with argument arrays (no shell), `GIT_TERMINAL_PROMPT=0` (sign-in only through Git Credential Manager's window), timeouts (30 s local, 180 s network); `GitError` carries exit code and Git's output | `workspace`, `main/ipc.ts` |
| `logger` | `Logger` — `info/warn/error`, `filePath` | `fileLogger.ts`: appends to `%APPDATA%\reqochet-dev\logs\reqochet.log`, rotates at 1 MB, never throws | `main/index.ts`, `main/ipc.ts` |
| `theme` | `ThemeService` — `load()`, `userThemeFile`, `ensureUserThemeFile()` | `fileTheme.ts`: layers defaults ← `config/theme.json` ← `%APPDATA%\reqochet-dev\theme.json`, validates each, loads logo | `main/ipc.ts` |
| `updater` | `UpdateService` — `start()`, `checkNow()`, `installAndRestart()`, `current()` | `githubUpdater.ts`: electron-updater against GitHub Releases; background download, user-chosen restart. If the feed check fails (0.18.0), one try through the GitHub API (`newerRelease` in `versions.ts`) and, when it finds a newer version, a generic feed at `releases/download/v<ver>`; the next check starts with the GitHub feed again | `main/index.ts`, `main/ipc.ts` |

| `schema` | `parseSchema(text)` → `{ schema, problems }`; types `Schema`, `ItemTypeDef`, `FieldDef`, `LinkTypeDef` | `parse.ts`: reads `requirements/.reqochet/schema.yaml`, skips invalid entries with a message | `items`, `repository-store` |
| `items` (domain core) | `Item`, `Link`; `parseItemFile`, `serializeItem`, `generateId`, `validateItem`, `contentFingerprint`, `diffItems` | Pure logic, no I/O: file format, IDs, per-item validation, suspect-link fingerprint | `repository-store`, `index-cache`, `sample-data` |
| `repository-store` | `RepositoryStore` — `inspect()`, `initialize()`, `open(root, { locate })`; `RequirementsRepo` — `loadAll()`, `createItem()`, `writeItem()`, `deleteItem()`, `itemPath()`, `fixFileName()`… | `fileStore.ts`: files in `requirements/`, atomic writes (`safe-files`), never overwrites unreadable files; `locate` (the index) says where an item's file really is, so a file renamed by hand is read and written in place; `checks.ts`: duplicate IDs, broken links, parent loops | `main/composition.ts`, `index-cache`, `sample-data` `writeItem(item, { path, expectedRevision })` writes one exact file (the same ID in two files), checked against `readItemAt(path)`'s revision (0.20.2). |
| `safe-files` | `writeFileAtomic()`, `removeFile()`, `renameFile()`, `withRetry()` | Temporary file + rename; retries for ~1.5 s while Windows briefly locks a file (antivirus, indexer, OneDrive); keeps the temporary file if the final rename fails | `repository-store`, `workspace`, `main/ipc.ts` |
| `self-test` | `runReleaseSelfTest(deps)` | The in-app release self-test: the main actions on a practice repository with a bare "GitHub" in a temporary folder; never touches the user's data or Git settings | `main/composition.ts` |
| `index-cache` | `IndexCache` — `sync()`, `syncPaths()`, `rebuild()`, `query()` (incl. link filters/counts), `get()`, `incomingLinks()`, `fingerprint()`, `repositoryIssues()` | `sqliteIndex.ts`: SQLite (built into Electron) with full-text search, outside the repo, re-reads only changed files; stores **every** header key, results show the schema's fields only — so a field change re-reads no file; each item's document (`doc`) and whether it is at its document's top level (`top`) are stored (format 5, 0.18.0); whole-repository checks as SQL (incl. "file name ≠ ID") | `workspace` |
| `workspace` | `WorkspaceService` — `checkFolder()`, `initialize()`, `open()`, `refresh(focus)`, `repoInfo()`, `query()`, `getItem()`, `newItem()`, `saveItem()`, `deleteItem()`, `moveItem()`, `fixFileName()`, `renewCopyId()` (a copied file gets a new ID, copied children follow), `openVersion()` / `closeVersion()` (an old commit shown in the table: `versionView.ts` reads its item files from Git into a temporary index keyed `<root>\0version\0<commit>`, the read calls — query, getItem, ancestors, fieldValues, repoInfo, export, field checks — answer from it through a second set of services on a context whose `need()` returns that session, and the queue wrapper `q` refuses every write and Git action while it is open; `qr` marks the queued calls allowed then), `checkFields()`, `saveSchemaRules()` / `getCoverage()` / `getImpact()` / `getMatrix()` / `exportMatrix()` / `starterRules()` (theme 1b, `traceability.ts`: coverage per rule from the index — `gapSql` in `sqliteIndex.ts` counts the other end's non-Obsolete items per rule; the impact chain walks incoming links except `relates-to` plus children, breadth first, each item once, at most 5,000; the matrix takes the filtered row items and only the column items linked to them, at most 2,000 rows drawn, the Excel export has all), `listBaselines()`, `createBaseline()`, `getHistory()`, `createBranchAt()`, `createDocument()`, `renameDocument()`, `getTypeUsage()`, `saveSchemaTypes()`, `recent()`… | `workspace.ts`: the facade over small services, and **one queue** through which every write, index change and Git action runs (one after another); `context.ts` (open repository, shared helpers), `itemOps.ts` (read/create/save/delete, conflict-safe, no parent loops), `links.ts` (add, remove, confirm, and `decideLinks` = keep / unlink many at once), `importing.ts` (M7: reads the existing items the rows refer to, places new items after the existing children, confirms new links against the final version, writes, remembers the file per repository on this PC in `%APPDATA%\reqochet-dev\imports\`, and computes "Update the Excel file" cell edits), `revert.ts` (take back one part of an uncommitted change: a field, the position, the text or one link becomes as in HEAD), `structure.ts` (moves and order — the ordering rules are pure functions), `schemaFields.ts` (field definitions + "how many items become invalid"), `exporting.ts`, `recent.ts` (`%APPDATA%\\reqochet\\recent-repositories.json`), `watcher.ts` (watches `requirements/` and every document folder, so a refresh re-reads only the changed files; closed during pull, switch, discard and undo — Windows refuses to remove a watched folder). `gitOps.ts`: changes per item, commit (requirements folder only), push (never forced), discard, undo unpushed commit, per-item history and field-level comparison. `merging.ts` (M8): pull and "pull from branch" (0.13.0: from another branch the result is written as **uncommitted** changes — `bringIn` restores the merged files from the merge commit without moving HEAD; a pull of the own upstream still commits), delete branch (refuses the current one; unmerged → asks again unless its content is already contained) — `git merge-tree` in memory, every clashing item merged field by field with `items/merge.ts` (3-way: base / mine / theirs; links and lists as sets; parent+order = one "place"), only parts changed differently on both sides become questions (`MergePlan`); the decided files replace Git's in a temporary index (`GIT_INDEX_FILE`), `commit-tree` makes the merge commit and the working folder fast-forwards to it (nothing touched before; Git refuses if uncommitted edits would be overwritten); the reflog step is named `pull <branch>` (D-05); duplicate IDs created on both sides: mine gets a new ID and the references this branch added follow (D-09); branches: list, create (changes come along), switch (take along only if the other branch has the same committed version of every changed file, or discard), `branchRange` = merge-base → branch for the local pull-request review. `baselines.ts` (0.18.0): baselines = annotated tags `refs/tags/baseline/<name>` (`git.createBaseline`), the ones made here listed in the repository's own Git config (`reqochet.baselinesToPush`) until the next Push sends them one by one; a name GitHub already has is moved to `reqochet.baselinesRefused` and marked in the list; the branch history (`git.history`, search by message or commit ID), a branch at an old commit (`git branch`, never a detached HEAD). `compare.ts`: two versions of the whole set (last pull from the reflog, any commit/branch/tag, or the working folder), paired by item ID (or `former-id`), summarised per item and per link, schema changes; a file renamed by hand is listed ("File name changed") with both paths, so it can be discarded | `main/ipc.ts` |
| `import-export` | Word and web page (`itemsToDocx`, `itemsToHtml`, `fillPart` — `document.ts`, JSZip; the PDF is the print version of the web page, printed by `main/pdf.ts` in a hidden window), CSV (`toCsv`, `parseCsv`, `detectSeparator`), Markdown, Excel (`writeXlsx`, `readXlsx`, `updateXlsx` — ExcelJS), ReqIF (`readReqif`, `writeReqif` — saxes), import planning (`guessMapping`, `guessHeaderRow`, `planImport`) | Pure functions, bytes/text in and out. **Every import format becomes a table** (ReqIF: one row per object in hierarchy order, a column per attribute and per relation type), so one wizard, one column guess and one plan serve Excel, CSV and ReqIF. `planImport` decides create / update / unchanged / skip per row and lists problems; IDs from other tools are kept as `source-id` so a re-import updates. `readXlsx` first rewrites absolute part paths (openpyxl files) that ExcelJS 4.4 cannot follow | `workspace` |
| `sample-data` | `generateItems()`, `runDataBenchmark()` | Fictional thermostat requirements; used by tests, `npm run gen:repo` and the in-app self-test | `main/ipc.ts`, tests |

Planned (see the release plan): `git-host` (GitHub pull requests, theme 4). The per-item merge of M8 lives in `items/merge.ts` and `workspace/merging.ts` (0.12.0).
Keep this table up to date with every change.

## Data format (in the project's Git repository)

```
requirements/
  .reqochet/schema.yaml   item types, fields, link types, coverage rules `rules:` (0.20.0; missing = never decided, `[]` = none) (copied from config/default-schema.yaml, then owned by the project)
  .gitattributes        LF line endings for identical diffs on every PC
  System/REQ-K7Q3XMB.md one file per item: YAML header + Markdown text; the folder is the item's document
  Software/…            another document (0.17, S-10): its own tree and outline numbers
```

- **Documents** (0.17, S-10): every folder directly under `requirements/` that does not start with a dot is a
  document; an item's document is the first folder of its path (`documentOfPath`, `shared/domain.ts`), never a key in
  the file. Projects made before 0.17 have one document called `items` (the window offers a real name: a folder rename
  in one commit, `workspace.renameDocument`). `.md` files directly in `requirements/` (except README.md) are "loose"
  items, document `''`. A tree never spans documents (save, move, multi-move and import refuse or avoid a parent from another document; a hand-moved or copied file whose parent is elsewhere gets a warning, is listed and numbered at its own document's top level and not under the old parent — the index's top-level query takes items whose parent is in another document or missing, and the children query keeps to the parent's document); outline
  numbers restart per document (`outlineNumbers` groups the top level by document). The index derives the document
  from the path (no table change); `ItemQuery.document` filters by it.

- **IDs** (0.9.0): `REQ-` + 7 random characters (Crockford base32, no I/L/O/U), the same prefix for every type, so
  the **type can change** without changing the ID. Random, not sequential, so items created on different branches
  practically never collide (32^7 ≈ 34 billion). Older IDs (`SYS-K7Q3XM`) and other tools' IDs stay valid; a
  converted item keeps its old ID as `former-id`, and Compare pairs the two.
- **Positions** (0.9.0, review S-04): `order:` is an *order key* — short text that sorts like a number with
  unlimited decimals (`a0` < `a0V` < `a1`; `src/modules/items/orderKey.ts`). There is always room between two
  neighbours, so **a move rewrites only the moved item's file** (no renumbering of siblings, no merge conflicts in
  files nobody edited). Older files' numbers (`order: 30`) are read as keys that sort the same way. At push time,
  sibling groups the user changed whose keys got longer than 4 characters get short keys again, as one extra
  commit "Tidy positions of N items" (only groups without uncommitted edits).
- **Outline numbers** (0.9.0, O-03): "1", "1.2", "2.3.1" are **calculated** from parent + position whenever they are
  shown (table "No.", editor header, pickers, Compare "1.2 → 3.5.1", every export) — never stored, so they are
  always right after a move. Items outside the hierarchy (missing parent, loop) have none.
- **Header order is fixed**: id, type, title, schema fields in schema order, unknown keys (sorted), parent, order,
  links. The same item always produces the same bytes, so Git diffs show only real changes.
- **Links are stored only on the source item**; the reverse view ("verified by") comes from the index.
  Adding a link from the target's side ("is verified by TC-1") therefore writes TC-1's file.
- **Suspect links.** Each link stores `confirmed:` — the target's content fingerprint (type + title + text) when the
  link was created or last confirmed. If the target's fingerprint is different now, the link is *suspect* (⚠) until
  someone confirms it. Status, owner, order or links of the target do not count as a change. Links without
  `confirmed` (written by hand or imported) are never suspect. The index keeps each item's fingerprint, so
  "items with suspect links" is one SQL query.
- **Unknown header keys are preserved**, so files written by a newer reqochet or another tool lose nothing.
- **The index is a cache**: `%APPDATA%\reqochet-dev\cache\…sqlite`, rebuilt automatically when missing or when its
  format changes (format 5 since 0.18.0 — `FORMAT_VERSION` in `sqliteIndex.ts`). It stores every header key, so a field change
  re-reads nothing.

## Decisions changed during implementation

| Planned | Built | Why |
| --- | --- | --- |
| `better-sqlite3` for the index | Node's built-in `node:sqlite` (in Electron 45) | No native module to compile for Windows; same SQL and full-text search. Hidden behind `IndexCache`, so swappable in one place |
| Metadata folder `.reqtool/` | `.reqochet/` (0.16; was `.reqman/`, still read) | Matches the product name |
| Requirement text in field `description` | Built-in property `text` (the Markdown body) | The body of the file is the text; keeps the header small |
| Suspect links in the MVP (FR-17) | Built in M3 (v0.4.0) | Cheap once links existed; the format already had `confirmed` |
| Per-requirement merge in the MVP (FR-13) | M4 (0.5.0–0.11.x): pull stopped on items changed on both sides. **0.12.0 (M8):** field-level 3-way merge, a decision window only for parts changed differently on both sides (`items/merge.ts`, `workspace/merging.ts`) | The owner's decisions 25 Oct (stop safely first) and 29 Oct 2026 (M8-3, M8-7) |
| Branches shown only (FR-12) | 0.12.0: create, switch (commit first / take along / discard), pull from any branch, compare a branch like a pull request; merging branches stays on GitHub | The owner's decisions M8-1, M8-2, M8-6 (29 Oct 2026) |

## Folder layout

```
config/            shipped configuration: theme.json, default-schema.yaml
resources/         static assets (logo)
src/shared/        UI ↔ core contract (api.ts) and shared data types (domain.ts)
src/main/          core entry, composition root, IPC handlers
src/modules/       one folder per module, each with index.ts as its only public entry
src/preload/       bridge exposing window.reqochet
src/renderer/      UI (React): screens/ (start, workspace, settings), workspace/ (editor, Git, Changes view, fields…), workspace/table/ (columns, rows, drag & drop), workspace/screen/ (toolbar, problems, filter and Git hooks), components/
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
| Toolbar (one row since 0.13.0; wraps when narrow since 0.21.1) | `workspace/screen/Toolbar.tsx` | Search, **Filters** pop-up (type, enum/list fields, links; count of active filters), Clear filters, Columns, Import, Export, ⊞/⊟, New item |
| Language (0.13.0) | `lib/language.ts`, `shared/text.ts` + `shared/text-ar.ts` | `setLanguage()` swaps the texts of `T` in place (never copy a text into a module-level constant — read `T` when rendering); `document.dir = rtl` for Arabic; CSS uses only logical properties (`margin-inline-start`, `inset-inline-end`, `text-align: start` …); memoised parts read `useLanguage()`; the core is told with `setLanguage` (IPC) so its messages follow; choice in local storage |
| Table | `workspace/ItemTable.tsx` + `workspace/table/` | Tree mode (no search/filter): the hierarchy, children loaded per parent when opened (500, then "Show more"); Expand all opens every level at once and loads levels as they scroll into view (`rows.ts`); drag & drop calls `reparentItem(id, parent, before)`. Flat mode (search/filter): rows fetched 100 at a time. Virtual scrolling in both; sticky header and ID column |
| Columns & fields | `workspace/FieldsPanel.tsx` | Hidden columns, column order and widths (drag a header edge; double-click = automatic) per repository in the PC's local storage (personal); built-in parts (ID, Title, Type, Parent, Text, Links) cannot be added as fields; field definitions saved to `schema.yaml` through `saveSchemaFields` (comment-preserving, refused if the file changed since it was read) |
| Links | `workspace/LinksSection.tsx` | Both directions grouped by link type; add (forward or reverse relation + item search), remove, Keep / Unlink suspect links (Keep all / Unlink all) — each saved immediately; locked while the item has unsaved edits |
| Item search | `workspace/ItemSearch.tsx` | Shared search-and-pick list for the parent picker and link targets |
| Parent picker | `workspace/ParentPicker.tsx` | Empty = top-level items; typed = relevance search; loops greyed out via `getAncestors` |
| Editor | `workspace/ItemEditor.tsx` | Fields generated from the schema; Ctrl+S; conflict message if the file changed outside reqochet. A save that changes type, title or text of an item others link to opens `SuspectLinksDialog` (Keep / Unlink per link, Keep all, Unlink all, Decide later — `decideLinks`, O-04) |
| Top bar (0.13.0) | `app/App.tsx` | Brand face + name (`components/Brand.tsx`) or a company logo, repository name with ✕ (close — asks about unsaved edits, waits for pull/push), the **Git slot** (the workspace renders its `GitBar` into it with a React portal), settings. Language and light/dark are in Settings → Appearance and on the start screen (UX-13) |
| Git bar | `workspace/GitPanels.tsx` (`GitBar`, shown inside the top bar) | Branch button, then Changes (counts items, "+ settings") / Pull (n) / Push (n) — the counts are on the buttons; Push first offers "Pull first, then push" (no automatic pulls, O-06); result message with the affected items (clickable) |
| Branch drop-down (0.12.0; reworked 0.12.1; delete 0.13.0) | `workspace/BranchMenu.tsx`, helpers in `workspace/mergeAnswers.ts` | 🗑 per local branch (asks; a second question for unmerged work; `deleteBranch`). Anchored under the branch button, at most 460 × 560 px, list scrolls inside; current branch on top with **Pull from…** and **Compare with…** (each turns the list into a chooser); otherwise a click on a branch name switches (asks Commit first / Take along / Discard when there are uncommitted changes — counted fresh when it opens); search box from 7 other branches; new branch at the bottom; Esc or a click outside closes |
| Pull decisions (0.12.0) | `workspace/MergeDialog.tsx`; state `plan` in `useGit.ts` | Opens when `pull`/`pullFrom` returns a `plan` with questions: per item, per part yours/theirs side by side, Keep yours / Take theirs / Write it myself; Keep all / Take all; Finish (calls `finishPull`) only when everything is decided; Cancel changes nothing |
| Changes view (0.10.0, O-06) | `workspace/ChangesView.tsx`, state in `workspace/screen/useChanges.ts` | One view for uncommitted changes and comparisons; replaces the table while open (table and editor stay mounted, so unsaved edits survive). "Show": uncommitted (default; before the first commit it compares with Git's empty tree, `EMPTY`), last pull (offers to pull first), last commit, two versions, what a branch would bring in (0.12.0: `branchRange` = common ancestor → branch, like a pull request). Count chips, filter, Items / Links tabs. Since 0.19.0 (D-19c): the changed items on the left (title, ID below; the change at the top of the right side is marked), every change one after another on the right — a window of at most 150 cards that loads 25 more near its end and shows earlier ones with a button; a click on the left moves the window there — each with ↶ per part (`revertChange`, uncommitted only) and Discard. Export CSV / Markdown in the header for comparisons. Side panel `ChangesSide` only for uncommitted changes: `CommitTools` (commit, name/e-mail, Undo last commit) |
| Import wizard (M7) | `workspace/ImportDialog.tsx`; files in `main/importFiles.ts` | Three steps (file / sheet / header row → columns guessed, "Use as" per column, default type → check: counts, problems per row, first rows) with a live preview; the main process keeps the chosen file and gives the window a token only. Start screen: "New project from a file" (empty folder → `git init` → wizard → first commit) |
| Chosen items (M7) | `ItemTable` (`chosen`, `onChoose`, `onRowMenu`), `workspace/RowMenu.tsx` | Ctrl+click toggles, Shift+click a range of loaded rows, a plain click clears; right-click menu: Open, Export this item and everything below it, Export the N chosen items |
| Export | `workspace/ExportDialog.tsx` | Scope (all in document order / current result / chosen items with "Include the items below"), extra columns, Excel (default), Word (project templates in `requirements/.reqochet/templates/`), PDF, web page, ReqIF, CSV or Markdown; document name, traceability table and template for the first three; "Update <imported file>" (changed cells + new rows, backup kept) or an updated copy; the Changes view has its own Export buttons |
| Icons (visual polish, Nov 2026) | `components/icons.tsx` | The one icon set: `<Icon name=… />` and `<Chevron open=… />` — inline SVG line drawings (Lucide paths, ISC licence notice in the file; no package), drawn in the text colour, hidden from screen readers (the button keeps its `aria-label`). Icons that point along the reading direction are mirrored in Arabic by CSS (`.icon--dir`). No typed characters as icons |
| Error boundary | `components/ErrorBoundary.tsx` | Around the workspace and settings: logs, offers Try again / Copy diagnostics / Reload |
| Change view | `workspace/ChangeView.tsx` + `lib/textDiff.ts` | Shared by History and the Changes view (O-05): Fields, Text and Links blocks, old left (red) / new right (green), changed words marked (`diff` library), unchanged text lines folded; stacked old-above-new in a narrow column (container query) |
| History | `workspace/HistoryView.tsx` | Editor tab: commits of the item (plus "Not committed yet"), and for the selected one a field/text/link comparison |
| Documents (0.17.0) | `workspace/screen/DocumentBar.tsx` | Document picker above the table; new / rename / delete a document (a folder under `requirements/`) |
| Item types and rules (0.17.0, 0.20.0) | `workspace/TypesPanel.tsx` + `workspace/RulesPanel.tsx` | Tabs Types / Coverage rules, both mounted; required fields per type; a type a rule uses cannot be removed |
| Versions and history (0.18.0) | `workspace/HistoryDialog.tsx`, `components/VersionsCard.tsx` | Baselines and commits; "Show in the table" opens an old version read-only (version bar, `versionView.ts`); VersionsCard = going back to an earlier app version |
| Traceability (0.20.0) | `workspace/TraceabilityView.tsx`, `workspace/ImpactView.tsx` | Full-width view with Coverage and Matrix tabs; the Impact tab in the editor; gaps marked in the table (`MainCell`) and listed in Problems |
| Keyboard (0.21.1) | `lib/keys.ts` | Arrow keys in the reading direction (`arrowDirection`), the tab-row keyboard (`onTabListKeyDown`), the closed triangle (`closedMark`) |
| Close before installing (0.20.2) | `main/closeForInstall.ts` | Restart to update and Go back to version X close the window the normal way first (unsaved-changes question); `quitHeld()` keeps the app alive for the installer; the app quits by itself after 20 s if no installer takes over |
| Settings | `screens/SettingsScreen.tsx` | One page per group: Appearance, Updates and Versions, Features, Environment and diagnostics, Report a problem, Self-tests (`components/ReleaseSelfTestCard.tsx`), and the built-in user guide (one page per section, `src/shared/guide.ts`); the workspace stays mounted behind it |
