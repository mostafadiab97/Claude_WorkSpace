# Project review — 25 Oct 2026 (after v0.7.0, end of the prototype)

**Scope:** the whole repository (≈ 8,400 lines of TypeScript in `src/`, 87 unit tests, the e2e journey, CI, docs,
data format) and the sandbox data. **No code was changed** for this review; every item below is a proposal to
discuss.

**Tags:** **F** = fact (checked in the code or measured), **I** = inference (likely, not reproduced),
**R** = recommendation. **Severity:** High = can lose work or block users; Medium = visible failures or slows
future work noticeably; Low = edge case or polish. **Effort:** S = a few hours, M = about a day, L = several days.

## Summary

The project is in good shape for a prototype: strict module boundaries, conflict-safe writes, real-Git tests,
no known data-loss path, 0 known vulnerabilities in dependencies, and fast enough at 10,000 items. The review
found **one confirmed defect**, **four likely defects** that would show up with real use on Windows, and a handful
of **structural points that are cheap to fix now and expensive later** — mainly before branches and merging (M8).

**Recommended before M7:** D-01, D-02, D-03, D-04, P-01, P-02, and the two refactors S-01 and S-02 (no behaviour
change; they make M7/M8 smaller). **Recommended before M8:** S-04 (ordering format) and S-05 (merge design).

| # | Finding | Severity | Effort | When |
| --- | --- | --- | --- | --- |
| D-01 | Item whose file name differs from its ID cannot be opened | Medium | S | before M7 |
| D-02 | Two ReqMan windows can run at once on the same data | Medium | S | before M7 |
| D-03 | Operations are not serialised (save during pull, double clicks) | Medium | S–M | before M7 |
| D-04 | No retry when Windows briefly locks a file (antivirus, indexer) | Medium | S | before M7 |
| D-05 | "Last pull" may be wrong after `pull --rebase` or other Git apps | Low | S | before M8 |
| D-06 | Small UI races in the item search box | Low | S | any time |
| D-07 | Changes panel reads deleted items one Git process each | Low | S | any time |
| D-08 | Changing a field's kind does not show how many items become invalid | Low | S | M9 |
| D-09 | Duplicate IDs across branches are only found after merging | Low | S | M8 |
| D-10 | Small settings files are written non-atomically | Low | S | any time |
| P-01 | Full refresh after every save and on every window focus | Medium | M | before M7 |
| P-02 | Git status refresh starts ~8 Git processes each time | Low–Med | S | before M7 |
| P-03 | 10,000+ files in one folder: some Git commands are slow by path | Low | — | keep in mind |
| P-04 | "Expand all" loads every item into the window | Low | M | at 50k |
| P-05 | A schema change re-indexes every file on every PC | Low | M | later |
| S-01 | `workspace.ts` does too many jobs | Medium | M | before M7 |
| S-02 | Each API call is written in 3 places by hand | Medium | M | before M7 |
| S-03 | Large UI components (`WorkspaceScreen`, `ItemTable`) | Medium | M | with M8 UI |
| S-04 | Ordering numbers cause many-file renumbering → merge conflicts | Medium–High | M | **before M8** |
| S-05 | Per-requirement merge needs a field-level 3-way design | — | L | **M8 design** |
| S-06 | UI texts are hard-coded English | Low now | M | decide |
| S-07 | Requirements folder is fixed at `<repo>/requirements` | Low now | M | before commercial |
| S-08 | Auto-update needs a public repository | — | M | before commercial |
| S-09 | `node:sqlite` is still marked experimental | Low | — | watch |
| S-10 | Text is Markdown but edited as plain text; no image/attachment design | — | M | before Word import |
| X-01 | IPC inputs are only partly validated | Low | S | with S-02 |
| X-02 | Installer is not code-signed | — | — | commercial decision |
| X-03 | No automatic dependency update checks | Low | S | any time |
| T-01 | The e2e journey is one long script | Medium | M | before M8 |
| T-02 | UI logic inside components has no unit tests | Low | S–M | with S-03 |
| T-03 | Sandbox "expected behaviour" is not tested automatically | Medium | S | before M7 |
| T-04 | Status is repeated in several documents (drift risk) | Low | S | now |
| T-05 | CI runs the 50k performance test on every push | Low | S | any time |

---

## A. Possible defects

### D-01 — An item whose file name differs from its ID cannot be opened (F, confirmed)
- **Evidence:** the sandbox file `items/RSK-RENAMD.md` contains `id: RSK-664XQZ`. It is indexed and shown in the
  table, but `getItem('RSK-664XQZ')` returns nothing (checked with a script on the sandbox), because
  `repository-store.readItem(id)` always reads `items/<ID>.md` (`fileStore.ts`, `fileFor(id)`). The editor shows
  "This item could not be read"; linking to it, moving it or editing it fails the same way. Writing it would create
  a second file `RSK-664XQZ.md` → two files with one ID.
- **When it happens:** someone renames a file by hand, a merge tool renames it, or an import produces it.
- The sandbox README and the v0.2.0 checklist claim "opens normally" — that expectation was never tested (see T-03).
- **R:** resolve an item's file through the index (it knows the path) for read/write/delete, report "file name does
  not match ID" as a repository problem, and offer a one-click "Fix file name" (a Git rename). **S.**

### D-02 — Two ReqMan windows can run at the same time (F)
- **Evidence:** no `app.requestSingleInstanceLock()` in `src/main/index.ts`. Starting ReqMan twice (double-click on
  the shortcut while it is open) starts a second full app on the same `%APPDATA%\ReqMan` folder.
- **Effect (I):** two processes write the same index cache, log file and recent list; both may download the same
  update; two editors can be open on the same item (the revision check still prevents silent overwrites).
- **R:** single-instance lock; a second start focuses the existing window (and opens the folder it was given). **S.**

### D-03 — Operations are not serialised (I)
- **Evidence:** every IPC handler is `async` and runs as soon as it arrives; the workspace has no queue. Examples:
  pressing Pull right after Save; Discard while a link is being added; double-clicking Commit; M7's import writing
  hundreds of files while the user drags a row.
- **Effect:** the revision check protects item files, but the index can be re-synced in between, Git can change
  files between "read revision" and "write", and the UI can show intermediate states. Rare, but hard to reproduce
  when it happens.
- **R:** one small operation queue (mutex) in the workspace: all writes and Git operations run one after another;
  reads stay parallel. UI buttons already disable during their own action. **S–M.**

### D-04 — No retry when Windows briefly locks a file (I)
- **Evidence:** `atomicWrite()` in `fileStore.ts` does `writeFile(tmp)` then `rename(tmp, file)` once. On Windows,
  antivirus scanners, the search indexer, OneDrive/Dropbox or an editor that has the file open often cause
  `EPERM`/`EBUSY` for a few milliseconds.
- **Effect:** occasional "Saving failed" or a failed move/link on the owner's PCs (Defender is active — the 50k
  first index took 18–73 s there).
- **R:** retry rename (and delete) a few times with a short back-off (the approach `graceful-fs` uses); keep the
  temp file on final failure for recovery. **S.**

### D-05 — "What the last pull brought in" can be wrong after `pull --rebase` or other Git apps (I)
- **Evidence:** `compare.ts` takes the newest reflog step whose text starts with `pull` or
  `merge <remote>/<branch>:`. A `git pull --rebase` writes several steps (`pull --rebase (start)`, `(pick)`,
  `(finish)`); VS Code / GitHub Desktop may write other texts.
- **R:** ReqMan records its own pulls (HEAD before/after) in its per-repository state, uses that first, and falls back
  to a broader reflog rule (first step of a rebase sequence). **S.**

### D-06 — Small races in the item search box (F)
- `ItemSearch.tsx`: Enter picks from `results` instead of the visible list (`shown`) — after clearing the box it can
  pick an old match; the 150 ms blur timer calls `onCancel` after a pick (harmless now). **R:** use `shown`, cancel
  the timer on pick. **S.**

### D-07 — Changes panel: deleted items cost one Git process each (F)
- `gitOps.state()` runs `git show HEAD:<path>` per deleted item to get its title. Deleting 500 items in one go
  (possible with M7 import or a bulk delete) → 500 processes on each refresh. **R:** use `readBlobs()` (already
  built for Compare). **S.**

### D-08 — Changing a field's kind (e.g. text → choice) silently leaves invalid values (F)
- The Fields dialog warns in general terms; values are kept (good) and flagged only when an item is opened. **R:**
  before saving, show "N items have values that are not allowed by the new definition" with a link to filter them.
  **S** (fits M9 schema editor).

### D-09 — Duplicate IDs across branches (F/I)
- IDs are `PREFIX-` + 6 random characters of 32 (≈ 1.07 billion per prefix). Uniqueness is checked against the local
  index only, so two people on different branches could pick the same ID; it is reported after merging
  ("2 files have the ID …"). With realistic numbers of items created on parallel branches the chance is tiny
  (well below 1 in 10,000 per merge). **R:** in M8, offer "give this item a new ID" (rewrites links pointing to it).
  Consider 7 characters for the commercial version (no format change: longer IDs are already valid). **S.**

### D-10 — Settings files written directly (F)
- `recent-repositories.json` and `export-settings.json` are written with plain `writeFile`; a crash mid-write leaves a
  broken file that is then treated as empty (no crash, but the recent list is lost). **R:** reuse the atomic write.
  **S.**

## B. Performance and scale

### P-01 — Full refresh after every save and on every window focus (F, measured)
- **Evidence:** `WorkspaceScreen.afterChange()` and the window-focus handler call `refreshRepository()`, which
  re-opens the schema, stats every item file and recomputes all repository problems. Measured on the 10,005-item
  sandbox (Linux container): **0.3–0.4 s per refresh**. On Windows with Defender, stat calls are several times
  slower (I: likely 1–3 s), and it runs after every save, link change, move and Alt-Tab.
- **R:** after ReqMan's own writes only the touched files are re-indexed (already done inside each operation) —
  skip the full refresh; on window focus, first check cheap signals (Git HEAD, the items folder's change time) or
  watch the folder (`fs.watch`) and re-read only changed files; compute repository problems incrementally. **M.**

### P-02 — Git status refresh starts about 8 Git processes (F)
- `gitOps.state()` runs `git --version`, `status`, `remote`, `config user.name`, `config user.email`, two
  `rev-parse`, and `log -1` after every data change. 108 ms on Linux; process start-up on Windows is much slower.
- **R:** cache Git version, identity and remotes per session (refresh on window focus); merge the rest into one or two
  commands. **S.**

### P-03 — 10,000+ files in one folder (F)
- Fine for NTFS and Git, but Git commands that look files up *by path* inside a commit get slow (measured: reading
  9,118 files by `<commit>:<path>` took 18 s; by blob ID 0.4 s — the latter is what ReqMan uses). **R:** keep the flat
  layout (simple, diff-friendly); never use per-path lookups in bulk. Note for future tools.

### P-04 — "Expand all" loads every item into the window (F)
- About 0.5 s and a few MB at 10k items; at 50k it will be several seconds and noticeable memory. **R:** load
  levels lazily while scrolling (the virtual list already knows which rows are visible). **M**, only if needed.

### P-05 — A schema change re-indexes every file (F)
- The index signature includes the field list, so adding a field (on any PC, then pulled) rebuilds the whole index
  (seconds at 10k, up to a minute at 50k with Defender). **R:** store field values generically so only the schema
  part is refreshed. **M**, later.

## C. Design and structure (what could slow future updates)

### S-01 — `workspace.ts` does too many jobs (F)
- 500 lines covering opening, recent list, items, links, moves/reordering, schema fields, export and delegation to
  Git and Compare. Every milestone adds to it (M7 import, M8 branches/merge).
- **R:** keep `WorkspaceService` as the single facade, but split the implementation into small services in the same
  module: `items`, `links`, `structure` (moves/order), `schemaFields`, `exporting`, plus the existing `gitOps` and
  `compare`. No behaviour change; tests stay as they are. **M.**

### S-02 — Each API call is hand-written in three places (F)
- 46 methods in `ReqManApi`, 44 `ipcMain.handle` entries in `ipc.ts`, and a matching list in `preload/index.ts`,
  with input checks written differently each time (see X-01).
- **R:** one typed table of channels → generate the preload object and register handlers in a loop, each with a
  small input validator. Adding a call becomes one entry. **M.** (Do it before M7 adds about ten new calls.)

### S-03 — Large UI components (F)
- `WorkspaceScreen.tsx` holds 27 pieces of state (filters, selection, Git, Compare, export, dialogs);
  `ItemTable.tsx` (614 lines) contains tree loading, flat paging, keyboard, drag and drop.
- **R:** move the tree/flat row hooks and drag-and-drop into their own files; group WorkspaceScreen state by area
  (filters, selection, git, compare) in small hooks or a reducer. Makes the M8 branch UI and M7 import wizard
  easier to add. **M.**

### S-04 — Ordering numbers cause renumbering → merge conflicts with branches (F/I) — decide before M8
- `order` is a number spaced by 10; inserting where there is no gap renumbers all siblings (many files). With
  branches, two people reordering in the same section produce conflicts in many files that neither of them "edited".
- **R:** switch to order keys that always have room between two neighbours (fractional / "LexoRank" style strings,
  e.g. `a0`, `a0V`, `a1`): a move then changes exactly one file. ReqMan can read old numbers and write keys only when
  an item is moved (no mass migration). **This is a data-format change — best decided now, before M8.** **M.**

### S-05 — Per-requirement merge (FR-13) needs a field-level design — M8
- Today a pull stops if both sides changed the same *file*. Most such cases are not real conflicts (one changed the
  status, the other the text; both added different links).
- **R (design for M8):** a `diff-merge` module that does a 3-way merge per item — base / mine / theirs — field by
  field, text as a whole (or by paragraph), links as sets; only true conflicts (same field changed differently) are
  shown for a choice "mine / theirs / edit". Use `git merge-tree` output to know which files need it; write the
  merged result and complete the merge commit. **L** (the core of M8).

### S-06 — UI texts are hard-coded English (F) — owner decision
- Messages and labels are written directly in about 20 components and in `gitOps.ts`. If an Arabic or German UI is
  wanted later, extracting them is easier now (I: a few hundred strings) than after M10. **R:** decide whether translation is
  ever needed; if yes, introduce a simple message table soon (no library needed). Right-to-left layout would be a
  separate step.

### S-07 — The requirements folder is fixed at `<repository top>/requirements` (F)
- A monorepo with several products cannot hold several requirement sets, and a project cannot choose another
  folder name. **R:** before the commercial version, allow a configurable folder (and several per repository);
  the store already keeps `root` and `folder` separate. **M.**

### S-08 — Automatic updates need a public repository (F)
- Tested earlier: a private repository gives 404 to installed copies. For a commercial product the update feed
  needs a private channel (token, or a simple static update host). The `updater` module is already isolated. **M**,
  before commercial.

### S-09 — Built-in `node:sqlite` is still experimental in Node (F)
- It works well and avoids native modules, and the index is behind `IndexCache`. **R:** keep the index tests strong;
  if a future Electron version changes the API, swap to `better-sqlite3` in one place.

### S-10 — Item text is Markdown but edited as plain text; no design yet for images/attachments (F)
- Fine for now. Word import and "rich text with images" (later) need a decision on where pictures live (e.g. an
  `attachments/` folder next to `items/`, referenced from the Markdown). **R:** add a Markdown preview in the editor
  (cheap), decide the attachment layout before Word import.

## D. Security and robustness

- **Good (F):** renderer sandboxed, `contextIsolation` on, `nodeIntegration` off, strict Content-Security-Policy,
  external links only `https://` and opened in the browser, Git called without a shell, no tokens stored, Git sign-in
  only through Git Credential Manager, `npm audit`: 0 vulnerabilities (25 Oct 2026), all dependencies MIT/ISC/Apache.
- **X-01 (F):** some IPC handlers cast inputs to the expected type instead of checking them (`exportItems`,
  `saveSchemaFields`, `saveItem`). The renderer is our own code, so this is a robustness, not a security, issue.
  **R:** a validator per channel as part of S-02. **S.**
- **X-02 (F):** the installer is not code-signed, so Windows SmartScreen warns and some company policies block it.
  Signing certificates cost money (conflicts with "free only" for the proof of concept). **Owner decision** for the
  commercial version.
- **X-03 (F):** no automatic dependency update checks. **R:** enable GitHub's free Dependabot for npm and
  GitHub Actions (security updates for Electron arrive every few weeks). **S.**

## E. Tests and process

- **T-01 (F):** `e2e/journey.e2e.mjs` is one 530-line script: an early failure hides everything after it, and it
  takes several minutes. **R:** split into independent scenarios (structure, links, Git, compare, export), each with
  its own fresh repository; run them in parallel. **M.**
- **T-02 (F):** logic inside components (e.g. Compare's default range, the export column list, drag-and-drop target
  rules) is only covered by the e2e journey. **R:** move such logic into small pure functions with unit tests
  (together with S-03). **S–M.**
- **T-03 (F):** the sandbox README lists expected behaviour for each broken file, but nothing checks it — that is how
  D-01 slipped through. **R:** a test that generates the scenario repository and asserts each expectation. **S.**
- **T-04 (F):** project status is repeated in `CLAUDE.md`, `README.md`, `DESIGN.md` and `CHANGELOG.md`. **R:** status
  lives in `CLAUDE.md` and `CHANGELOG.md`; the others link to them. **S.**
- **T-05 (F):** CI runs the 50,000-item performance test on every push (minutes). **R:** run 10k on every push, 50k
  only for releases. **S.**

## F. What works well — keep it

- Clear module boundaries enforced by lint, and a single composition root — the project can be taken over by a team.
- Files as the source of truth, rebuildable cache, revision-checked atomic writes: no data-loss path found.
- Git integration tested against real repositories (bare remote + two clones), including conflicts.
- The theme rule (no hard-coded colours) held through seven releases.
- Performance at 10k items is comfortable; the measurements are recorded and repeatable.
- Owner-facing checklists per release, and `CLAUDE.md` as project memory, made the hand-over possible.

## H. Product owner's test results and feature requests (27 Oct 2026)

**Test results:** the combined checklist v0.7.0 passed completely — Git (0.5.0), Compare (0.6.0) and Export (0.7.0)
all fine. The two-PC trial is postponed (only one user for now).

**New requests (to discuss one by one before planning; recommendations are added as each is discussed):**

| # | Request (owner's words, condensed) | Touches | Related findings |
| --- | --- | --- | --- |
| O-01 | **ID without type prefix:** an item's type may change over time, so the ID must not contain the type — only the random part | data format, IDs, editor (type becomes editable), migration of existing IDs | D-09 |
| O-02 | **ID pool per branch:** instead of relying on low collision probability, keep a pool of pre-generated IDs; each branch gets a share; when used up, sync with GitHub for more; unused IDs of merged/deleted branches return to the pool | IDs, Git/branches (M8), offline use | D-09 |
| O-03 | **Level (outline number) as its own value:** the level like "2.2" is currently part of the text, so it is wrong after a move (an item moved to 3.5.1 still says 2.2); it must be a separate value that updates instantly for the moved item and all affected items | data format, hierarchy, table, export | S-04 |
| O-04 | **Suspect links — user decides:** a changed text should not simply mark links as broken; ask the user per link to keep or unlink, with "keep all" and "unlink all" for many links | links, suspect links | — |
| O-05 | **GitHub-style difference view:** old version left in red, new right in green, changed words highlighted; for local (uncommitted) changes, a per-line / per-block "revert this change" arrow | Compare/History/Changes UI, diff engine | S-03 |
| O-06 | **Merge "Changes" and "Compare" into one "Changes" view:** opens with "Uncommitted changes" selected; clicking an item shows the split difference view; the side panel keeps discard / commit message / commit | UI structure | S-03 |
| O-07 | **Work with other tools' files, both directions:** open Excel/Word (etc.) files exported from other requirement tools, view and edit them inside ReqMan, save to the same file or a copy; optionally convert them into ReqMan items (full migration); export in formats other tools can import | import-export, new viewers/editors, ReqIF | FR-14, FR-15, FR-20 |

### Discussion log

- **O-01 decided (27 Oct 2026):** IDs no longer contain the type. Format: one fixed prefix **`REQ-`** for every item,
  plus the random part. The type becomes an ordinary, editable field. Existing items are **converted** — not by a
  conversion feature in ReqMan, but by changing the sandbox repository's data directly (new IDs, all links
  rewritten, files renamed so Git keeps history, old ID kept as `former-id`); the owner just pulls. To be done in the
  same release that introduces the new format (the current app would warn that `REQ-` does not match the type).
- **O-02 decided (27 Oct 2026):** no ID pool. IDs get **7 random characters** (`REQ-K7Q3XMB`, ~34 billion values)
  and ReqMan **repairs duplicates automatically at pull/merge** (renames the local, not-yet-shared item and its links,
  and tells the user). Keeps ReqMan fully offline. The 7 characters come with the new ID format; the repair with M8.
- **O-03 decided (27 Oct 2026):** the outline number (1, 1.2, 2.3.1 …) is **calculated** from parent + position
  whenever it is shown, never stored in files (a move changes one file). **Every item** gets a number. Shown as a
  "No." column, in the editor header, parent picker, Compare ("1.2 → 3.5.1") and exports. The typed numbers in the
  sandbox titles are removed when the sandbox is converted.
- **O-03 addition (27 Oct 2026):** the outline number must appear in **every export** — a "No." column in CSV/Excel
  and in Markdown/Word headings. A filtered export keeps the real numbers from the full document (no renumbering);
  M7 import can rebuild the hierarchy from another tool's numbers ("3.2.1" → child of "3.2").
- **O-04 decided (27 Oct 2026):** when the user saves a change to an item's type, title or text and other items link
  to it, a window lists those links with Keep / Unlink per row and **Keep all**, **Unlink all** (asks once more),
  **Apply my choices**, **Decide later** (leaves the ⚠ marks). Suspect links in the editor get Keep / Unlink and
  Keep all / Unlink all. Changes that arrive by pull do **not** open the window — they only show ⚠ marks, reviewed
  with the "With suspect links" filter.
- **O-05 decided (27 Oct 2026):** difference view = three blocks stacked top to bottom (Fields, Text, Links); inside each
  block old (red, left) and new (green, right) side by side, changed words highlighted, unchanged text lines folded.
  Revert arrows per field row, text block and link — only when comparing with uncommitted changes; other comparisons
  are read-only. Opens in the wide middle area; falls back to old-above-new when the window is narrow. **Split view
  only** (no unified switch). Line/word comparison via the `diff` library (BSD).
- **O-06 decided (27 Oct 2026):** one **Changes** view replaces Changes panel + Compare: Git bar = Changes (n) / Pull /
  Push. Middle area: "Show" menu (Uncommitted changes = default, last pull, last commit, choose two versions), counts,
  item list on top, split difference of the selected item below; side panel follows the menu (commit tools for
  uncommitted; Open item / Export otherwise). History tab in the editor stays. **No automatic pulls at all** (replaces
  the M5 rule "pull before any comparison"): before an action that involves the remote (compare with the last pull /
  remote versions, push …) ReqMan **offers** to pull first ("Pull first" / "Continue without pulling").
- **O-07 decided in part (27 Oct 2026):** phases agreed — (1) M7 Excel/CSV import wizard + Excel export; (2) ReqIF
  import/export for two-way exchange; (3) later: Excel "work on this file" mode and Word export/round-trip for
  ReqMan's own documents; no general editor for foreign Word files. Tools to test exchange against: **DOORS and Jama**
  (used in the company's previous projects). Owner's real concern behind the Excel mode: starting a project from an
  Excel file should not require creating a Git repository by hand first — proposal "start a project from a file"
  under discussion.
- **O-07 completed (27 Oct 2026):** instead of a separate file-editing mode: **"New project from a file"** (choose an
  Excel/CSV file and a folder → ReqMan creates the folder and a local Git repository itself, imports via the
  wizard, first commit "Imported from …") plus **"Update the Excel file"** (writes the current requirements back
  into the original file — same columns, only changed cells, formatting kept — or a copy; the source file and mapping
  are remembered) and **"Publish to GitHub"** later (paste the address of an empty repository). The "work on this
  file" mode stays a possible later item, not planned.
- **Group 1 — defects D-01 to D-10 approved (27 Oct 2026):** fix all in the first release of the next round
  (D-09 comes with branches, as decided in O-02).
- **Group 2 — speed approved (27 Oct 2026):** owner wants **all** fixes now, "to start the next versions on a clear
  page": P-01, P-02, P-04 and P-05 in the fix round (P-03 needs no action).
- **Deleted items (27 Oct 2026):** owner only wanted to be sure deleted files are removed (no "zombie" files) — they
  are (the file is removed; Git history keeps old versions). No restore button / deleted-items list wanted.
- **Group 3 (27 Oct 2026):** S-06 **yes** — all GUI texts in one central file now (future languages + easy label
  changes; "better to have a tool you don't need than need a tool you don't have"). S-07 **discarded** (one
  requirement set per repository). S-08 **later** (private update channel for a commercial version). S-03/S-04
  explained; S-10 becomes a feature discussion: **rich text** in the item text (images, tables, hyperlinks, links to
  other items, bold/italic/underline, bullet points, highlight …).
- **S-10 rich text (27 Oct 2026):** agreed: Markdown stays the stored format + a Word-like editor (toolbar, images in
  `requirements/attachments/<ID>/`, `@` references to items) — **in a later version** (owner: "this is extra").
  Item references inside text are **references only**, not traceability links. Tables: question about merged cells
  open.
- **S-03 agreed; S-04 agreed (27–28 Oct 2026)**, owner suggests re-spacing order values regularly (e.g. when pushing)
  so values stay small — proposal: at push time, re-space only sibling groups whose values got long, and only groups
  the user changed himself (to avoid clashes with colleagues' work). **Confirmed with a 4-character maximum**: at push,
  groups the user changed whose order values are longer than 4 characters are re-spaced.
- **Tables in rich text (28 Oct 2026):** recorded as a **future feature without milestone**; the later rich-text editor
  covers formatting (bold, italic, underline, highlight, lists, links, images) but no tables for now.
- **Group 4 approved (28 Oct 2026):** X-01, T-01 – T-05 in the fix round; X-02 (code signing) later. X-03 **done (28 Oct 2026)**:
  `.github/dependabot.yml` (npm weekly, Actions monthly) and `npm run check:deps` (audit + outdated), which also runs
  before every `npm run build` (locally and in CI) and **only warns, never blocks** (owner's decision). Dependabot
  security alerts/updates must be switched on by the owner in the repository settings (the API is not reachable
  from the cloud session).

- **Plan confirmed (28 Oct 2026):** release plan in `docs/design/DESIGN.md` → "Release plan". Owner additions:
  **export of chosen items** (one item or several selected items + everything below them) in 0.11.0 with the Excel
  export; **testing reduced**: a release self-test inside ReqMan (temporary practice repository, never the user's
  data) plus at most 5 manual steps per version, from 0.8.0. Dependabot alerts stay off (weekly updates are enough;
  `check:deps` warns about indirect libraries in every build).

- **Done in 0.8.0 (28 Oct 2026):** D-01 – D-04, D-06, D-07, D-08, D-10, P-01, P-02, P-04, P-05, S-01, S-02, S-03, S-06,
  X-01, T-01 – T-05 (T-01: the journey stays one story on purpose — its steps build on each other — but scenarios
  now share a harness, each has its own repository and profile, and they run side by side; new checks get their own
  scenario). Still open as planned: D-05 and D-09 (M8), S-04 (0.9.0), S-05 (M8), S-08 / X-02 (later).
- **Done in 0.9.0 (28 Oct 2026):** S-04 (order keys; a move writes one file; long keys re-spaced at push), O-01 (`REQ-`
  IDs, type editable), O-02 (7 characters, no pool), O-03 (calculated outline numbers everywhere, incl. exports).
  The sandbox was converted in its own repository.
- **Done in 0.10.0 (28 Oct 2026):** O-04 (Keep / Unlink window after a save; Keep / Unlink in the editor), O-05 (split
  difference with word marks, folded text, ↶ per field / text / link for uncommitted changes, stacked when narrow),
  O-06 (one Changes view, uncommitted by default, side panel follows the view; no automatic pulls — "Pull first"
  offers before the last-pull view and Push). Owner's extra request: draggable column widths.
- **Owner on 0.10.0 (29 Oct 2026):** all 5 steps passed; dark-mode diff colours too faint and "Changes (1)" with an empty
  list (a kept link's confirmation was hidden) — both fixed in 0.11.0. **Decision: ReqIF is merged into 0.11.0**
  (fewer test rounds); branches stay alone in 0.12.0 (two-PC trial). Asked for a GitHub-vs-RM-tool comparison
  (answered in chat, not stored).
- **M8 / 0.12.0 decisions (owner, 29 Oct 2026):**
  1. *Switching branches with uncommitted changes:* offer **Commit first**, **Discard**, or **Take the changes along**
     (common in his team: new branch from the current one, changes move with it). "Take along" only when it is safe:
     every changed file is the same on both branches (always true for a new branch from the current one); otherwise
     ReqMan lists the items that block it.
  2. *Merging branches only on GitHub* (pull requests, code owners approve; ReqMan has no access rights yet). ReqMan
     shows the differences between two branches per requirement — a local pull-request review. Creating, approving and
     merging pull requests inside ReqMan may come later, with access rights.
  3. *Conflicts field by field* (3-way: base / mine / theirs); only the same field (or text) changed differently on
     both sides, or delete vs change, asks "mine / theirs / edit".
  4. *Baselines (tags):* **delayed** (not in 0.12.0). Background: GitHub cannot require a review for a tag; it can
     restrict who creates tags and block deletion.
  5. *Two-PC trial:* two folders (two clones of the sandbox) on his PC.
  6. *Pull from branch:* besides the normal pull, ReqMan can bring any visible branch (local or on GitHub, not just
     `main`) into the current branch, with the same per-requirement resolution as 3.
  7. *Pull on the same branch* resolves per requirement (3) instead of stopping (answer "a").
- **Done in 0.11.0 (29 Oct 2026):** O-07 phases 1 + 2 — Excel/CSV/ReqIF import wizard, Excel and ReqIF export, "New
  project from a file", "Update the Excel file", "Publish to GitHub", export of chosen items.

## G. Order (confirmed 28 Oct 2026)

See `docs/design/DESIGN.md` → "Release plan": 0.8.0 clean page (all fixes of this review) → 0.9.0 new data format →
0.10.0 Changes view → 0.11.0 M7 Excel → 0.12.0 M8 branches → 0.13.0 ReqIF.
