# Changelog

Each version was installed and tried by the product owner on Windows 11; his feedback is recorded under the
version it was about, and what it led to.

## 0.8.0 — 28 Oct 2026 — Clean page (all fixes of the project review)
- **Owner (28 Oct 2026):** update installed; release self-test on his PC **passed all 17 steps** in 32.7 s
  (Git 2.52.0). Git steps take 2–10 s each there (vs. < 0.5 s on Linux) — process start-up with antivirus.
  Checklist steps 3–5 pending.
- **Fixes:** an item whose file was renamed by hand opens, saves and deletes in place, is listed as a problem
  with a one-click **Fix file name** (D-01); only one ReqMan runs at a time — a second start brings the open
  window forward (D-02); writes, index changes and Git actions run one after another (D-03); short Windows file
  locks (antivirus, indexer, OneDrive) are retried instead of failing (D-04); item search: Enter picks what the
  list shows (D-06); changing a field's kind or choices first says how many items would hold values it no longer
  allows (D-08); settings files are written safely (D-10).
- **Speed:** after a save, a move or Alt+Tab only the changed files are re-read (the folder is watched) — 0.37 s →
  0.09 s at 10,000 items (P-01); the Git bar needs 3 Git commands instead of 8 per refresh (P-02); titles of
  deleted items in Changes come from one Git process (D-07); **Expand all** is instant and loads levels while
  scrolling (P-04); adding or removing a field re-reads no item file (P-05; the index cache is rebuilt once).
- **Inside (no visible change):** the workspace code is split into small services, every window call is listed
  once and its inputs are checked (S-01, S-02, X-01); the workspace screen and the table are split into smaller
  files (S-03); **every text on screen lives in one file**, `src/shared/text.ts` (S-06).
- **Testing:** new **release self-test** in Settings & diagnostics (the main actions on a practice repository on
  your PC); the checklist per version is now at most 5 steps; the end-to-end tests are independent scenarios run
  side by side (T-01); window logic has unit tests (T-02); the sandbox's broken-data promises are tested (T-03);
  the status is kept only in `CLAUDE.md` and this file (T-04); the 50,000-item test runs for releases only
  (T-05). 130 unit tests.
- Owner's decisions (28 Oct 2026): release plan 0.8.0 → 0.13.0 confirmed; export of chosen items added to M7;
  testing reduced to a self-test + 5 steps; Dependabot weekly is enough (alerts stay off).

## 0.7.0 — 25 Oct 2026 — M6 Export and hardening (prototype complete)
- **Owner (27 Oct 2026):** combined checklist for 0.5.0, 0.6.0 and 0.7.0 — all passed. Two-PC trial postponed.
- **Export…** in the table toolbar: all items in document order, or only the current search/filter result;
  columns = ID, Title and the table's visible columns, plus optional Level + Parent, full text, links in both
  directions. **CSV** for Excel (comma — the owner's Excel setting —, UTF-8 with BOM, CRLF, multi-line cells
  quoted, formula-like cells prefixed with `'`) or **Markdown** (one document, headings follow the hierarchy —
  the agreed format for AI tools). 10,005 items export in about half a second.
- **Compare → Export CSV / Export Markdown**: one row per changed item and per change (field, before, after),
  or a readable report.
- Save dialog remembers the last folder; "Show in folder" after exporting; clear message when the file is open in
  Excel.
- Hardening: error boundary (a broken view shows "Try again / Copy diagnostics / Reload" instead of a blank
  window, and logs the error); warning in the Git bar for Git older than 2.38; CI now also opens a generated
  10,000-item repository in the real app on every build.
- Testing: one combined checklist for 0.5.0–0.7.0 and a two-PC trial script (journey steps 1–8).
- Owner's decisions (25 Oct 2026): CSV with commas; after M6 → Excel export/import (M7), then branches and
  per-requirement conflict resolution (M8).

## 0.6.0 — 25 Oct 2026 — M5 Compare
- **Compare** button in the Git bar: pulls first (owner's decision), then shows by default **what the last pull
  brought in** (taken from Git's own record of where the branch was before and after the pull, so pulls made outside
  ReqMan count too). Other choices: uncommitted changes, the last commit, or any two versions (commits that changed
  requirements, branches, tags, the working folder).
- Per requirement: Added / Changed / Moved (parent or position only) / Deleted, with a short summary ("Text,
  Status", "1 link added") and a warning when other items link to a changed one (their links became suspect).
  Count chips work as filters; filter by ID/title; Links tab lists every link added or removed.
- Detail panel with the field table, text before/after and links; **Open the item**.
- Schema changes are reported (fields / item types / link types added or removed); other files are named.
- Fast for big ranges: all file versions are read through one `git cat-file` process by blob ID; files whose only
  difference is a link confirmation are skipped. Measured: 9,118 changed files → 0.4 s; 3,000 real edits → 1.8 s.
- Owner's decisions (25 Oct 2026): default = since the last pull; pull right before any comparison; exporting the
  list waits for M6.

## 0.5.0 — 25 Oct 2026 — M4 Git
- Git bar: branch, commits to push ↑ / pull ↓, **Changes**, **Pull**, **Push**; results with the affected items.
- Changes panel: uncommitted changes per item (new / changed / deleted / renamed), **Discard** per item,
  commit message + **Commit** (only `requirements/` is ever committed), name/e-mail form when Git doesn't know
  the user, **Undo last commit** for commits not pushed yet.
- Pull: fetch, then an in-memory check; if items were changed on both sides it **stops without changing anything**
  and names them; otherwise fast-forward or merge commit, then the table updates. Uncommitted changes the pull
  would overwrite are named too. Push never forces; a rejected push says "Pull first".
- History tab in the editor: commits of the item (author, date, message) plus "Not committed yet", and a
  field-by-field comparison of what each one changed (text before/after, links added/removed).
- Clear messages for sign-in, network, timeouts and hooks; sign-in happens through Git's own credential window.
- Owner's decisions (25 Oct 2026): stop on conflicts (resolve per item later), show the branch only (no
  create/switch yet), commit only `requirements/`.
- Owner could not install Node.js (no admin rights) — development continues in the cloud; see
  `docs/DEVELOPING.md` for the no-admin Node.js option.

## 0.4.1 — 25 Oct 2026
- Fix: opening a repository failed with "table items has no column named fp" when its index cache had been
  created by 0.3.x. The cache now stores its format version and is dropped and rebuilt when it changes.
- **Owner:** "all works fine."

## 0.4.0 — 25 Oct 2026 — M3 Links
- Links section in the editor: add links in either direction ("verifies" / "is verified by" — always stored in
  the source item), remove, open the other end. Saved immediately; locked while the item has unsaved edits.
- Suspect links: each link stores the target's fingerprint (type + title + text) when confirmed; a later change
  marks it ⚠ until **Confirm** / **Confirm all**. Status/owner/order changes don't count.
- Filters "With suspect links" / "Without any links"; sort by number of links; Links column `→out ←in ⚠suspect`.
- Delete offers to remove the links other items have to the deleted item.
- Owner's 0.3.0 feedback fixed: Type shown in the editor (read-only); Text and Links columns; Columns menu lists
  built-in columns and can reorder columns; Fields dialog refuses names of built-in parts.
- Sandbox data: confirmations added to all links, 175 suspect (IDs unchanged).
- **Owner:** reported the cache error fixed in 0.4.1.

## 0.3.0 — 25 Oct 2026 — M2 feedback
- The table itself is the hierarchy (expand/collapse, Expand all / Collapse all, child counts, reveal the selected
  item); flat list with best-match ranking while searching or filtering.
- Drag and drop rows: onto a row (child), its upper/lower edge (before/after), empty space (top level); whole
  sub-groups move; hovering opens a closed parent.
- Parent picker: lists top-level items when empty, relevance search, greys out the item and its descendants.
- Columns menu (show/hide, per repo on this PC) and Fields dialog (add/rename/reorder/remove fields in
  schema.yaml, comments preserved, conflict-safe).
- **Owner:** all fixed and working, except: Type not visible in the item panel; Text and Links not available as
  table columns or in the Columns menu, and adding them as fields created new, different fields → done in 0.4.0.

## 0.2.0 — 25 Oct 2026 — M2 Core UI
- Start screen with Open repository / recent repositories; create `requirements/` with the default schema.
- Item table (virtual scrolling, filters, search, sort), side hierarchy tree, schema-driven editor with Ctrl+S,
  unsaved-changes guard, conflict detection for outside edits, move up/down, add child, delete.
- Scrollbars at the right window edge, thumb only (owner's request after 0.1.0).
- **Owner:** all tests passed except test 6 — could not select a top-level parent and could not move a sub-group
  (the picker only showed the first 8 items by ID). Requested: tree view inside the table (flat only while
  searching) and GUI control to show/hide fields → done in 0.3.0. Also asked for the test-data repository
  Claude_SandBox (10,000 items).

## 0.1.0 — 25 Oct 2026 — M1 Data layer
- Schema, item file format, repository store, SQLite index with full-text search, performance tests, data
  self-test in the app, automatic updates.
- **Owner:** self-test 10k: all queries < 15 ms; 50k: first index 18–73 s (Windows Defender), queries ≤ 105 ms.
  Auto-update tested and working. Asked to align scrollbars to the window's right edge and show only the thumb.
  Making the repository private broke auto-update (404) → owner chose to keep it public.

## 0.0.4 — 25 Oct 2026
- Brighter light-mode success green (`#22c55e`) — owner feedback on 0.0.3 test step 4.
- `%APPDATA%\ReqMan\theme.json` now starts as an override-only file (a full copy froze every value).
- Zipped installer in each release (Chrome blocked the .exe download for the owner).

## 0.0.3 — 25 Oct 2026
- Automatic updates from GitHub Releases; user theme file survives updates.

## 0.0.2 — 25 Oct 2026
- Log file with rotation, diagnostics panel (copy diagnostics, open log folder), first manual test checklist.

## 0.0.1 — 25 Oct 2026 — M0 Foundations
- Electron + TypeScript + React skeleton, module boundaries enforced by lint, composition root, theme file with
  light/dark/system, Git check, Windows installer (per-user NSIS) built by GitHub Actions.
