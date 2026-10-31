# Changelog

Each version was installed and tried by the product owner on Windows 11; his feedback is recorded under the
version it was about, and what it led to.

## 0.13.0 — 31 Oct 2026 — Arabic, fewer bars, pull from a branch for review, delete a branch
- **Owner (31 Oct 2026) on 0.12.1:** steps 1, 2, 3, 5 passed; self-test 21/21 in 50.7 s. Step 4: "Pull from" another
  branch committed the result at once (Push (1)) — he wants to decide first. Plus three requests, all here:
- **Pull from another branch → uncommitted changes.** The combined result is written into the working folder and
  Changes opens on it: keep (Commit) or take back (Discard / ↶). Nothing is committed. A normal Pull of the branch's
  own GitHub branch still commits (otherwise the next Push would be refused). Cause of the old behaviour: "Pull from"
  reused the normal pull's last step (fast-forward to the merge commit).
- **Delete a branch** (🗑 next to each branch on this PC in the branch panel): asks first; never the current branch;
  never on GitHub; a branch whose work exists nowhere else asks a second time. A branch whose changes were already
  taken over with "Pull from" (same content, different commits) is deleted without the second question.
- **Fewer bars (two less):** the Git controls moved into the top bar (repository name, branch, ↑↓, Changes, Pull,
  Push); "Close repository" is a small ✕; the toolbar is one row — the filters open in a pop-up behind **Filters**
  (with the number of active filters), Expand/Collapse all are icons ⊞ ⊟; Git messages float under the top bar and
  success messages close themselves after a few seconds.
- **Arabic** (the "brave move"): an **English | العربية** switch next to Light/Dark. Every text of the window and of
  the core (Git, saving, import messages) in Arabic — 860 lines, checked by the compiler against the English keys;
  the window mirrors to right-to-left (all spacing rules turned into start/end rules; column resizing follows the
  direction; IDs and paths stay left-to-right inside Arabic lines); unsaved edits survive the switch; the choice is
  remembered. Data stays as written.
- Also recorded: the complete feature catalogue (163 features from ~190 tools, `docs/reviews/2026-10-31-feature-catalogue.md`);
  decisions: the rename also renames the `.reqman` folder in projects (a Git rename) and uninstalls the old app; no
  Rust migration now.
- Tests: 191 unit tests (new: Arabic texts complete and switchable; pull from a branch leaves uncommitted changes;
  delete branch incl. unmerged and current); e2e: new `language` scenario (switch, right-to-left, unsaved edit kept,
  restart); `branches` (uncommitted pull, delete); journey uses the Filters pop-up; self-test step 13 deletes a branch.

## 0.12.1 — 31 Oct 2026 — The branch drop-down (owner's points on 0.12.0)
- **Owner (31 Oct 2026) on 0.12.0:** all 5 steps passed (the two-folder trial), self-test 21/21 in 44.6 s (Git 2.52.0).
  Four points on the branch panel, all done here:
  1. The buttons were far from the branch names (panel stretched across the window) → the panel is now a small
     drop-down **under the branch button** (at most 460 × 560 px).
  2. **Click a branch name to switch** — the Switch buttons are gone.
  3. **Pull from…** and **Compare with…** appear only next to the **current** branch; each turns the list into a
     chooser ("Pull into main from which branch?"). Esc goes back, a click outside closes.
  4. **Tens of branches:** the list scrolls inside the panel and a "Find a branch" box appears from 7 other branches —
     tested in the e2e scenario with 41 branches.
- Analyses written for the owner's decisions (`docs/reviews/`): features other tools have and we don't (ranked, with a
  proposed plan 0.13–0.16), the impact of renaming "ReqMan" (the name is taken by another RM tool), and whether Rust
  would make the tool faster (recommendation: no rewrite). Documentation brought up to date for a hand-over.

## 0.12.0 — 29 Oct 2026 — Branches and a pull that decides per requirement (M8)
- **Pull no longer stops** when you and someone else changed the same item. Each item is combined part by part
  (title, type, place in the document, text, every field, links): a part only one side changed is taken from that
  side; links and list values (tags) from both sides are kept. Only a part **both** changed differently — or an
  item deleted on one side and changed on the other — is shown in a window **"your decision"**: Keep yours, Take
  theirs, or Write it myself. Nothing changes until **Finish the pull**; Cancel leaves everything as it was.
- **Branches** (the ⎇ button in the Git bar): create a branch from the current one (uncommitted changes come
  along), switch branches (with uncommitted changes: Commit first / Take them along — only when the other branch has
  the same version of those items, otherwise ReqMan lists them / Discard), **Pull into …** any branch on this PC or on
  GitHub (owner's decision 6), and **Compare** = what a branch would bring in, like a pull request on GitHub (merging
  into main stays on GitHub, where code owners approve — decision 2). The Changes view has this as a new choice too.
- **Same ID created on both sides** (review D-09): fixed automatically during the pull — your item gets a new ID and
  the links/parents you added to it follow; the notice says which.
- **"What the last pull brought in"** (review D-05) also works after `git pull --rebase` in another Git tool, and
  ReqMan names its own pulls in Git's record.
- Inside: the merge commit is built without touching the working folder (temporary Git index), then the folder
  moves to it in one step — a pull either completes or changes nothing. New module code `items/merge.ts`,
  `workspace/merging.ts`.
- Tests: 187 unit tests (new: field-by-field merge rules; real Git with two clones — combined parts, delete vs change,
  edited answer, stale plan, duplicate-ID repair, uncommitted edits, branches create/switch/take along/discard,
  pull from a remote branch, the rebase case), a new e2e scenario `branches`, the journey now decides a conflict in
  the window, and the release self-test has 21 steps (pull with a decision, branches).
- **Owner's decisions (29 Oct 2026):** 1 switch with Commit / Discard / Take along (safe only when both branches
  have the same version); 2 merging branches only on GitHub, ReqMan shows the differences; 3 conflicts field by field;
  4 baselines (tags) delayed; 5 two-PC trial with two folders on his PC; 6 "Pull from branch" from any visible
  branch; 7 pull on the same branch resolves per requirement.

## 0.11.1 — 29 Oct 2026 — Owner's requests on 0.11.0
- **Owner (29 Oct 2026):** all 5 steps passed; release self-test 20/20 in 62.4 s (twice the usual: the Git steps
  were slower on his PC that time, e.g. step 11 25.8 s instead of 7 s — nothing failed).
- **New project from a file:** a folder that is not empty is refused right away with "Choose another folder…"; the
  folder dialog opens again instead of the whole process stopping.
- **Move several items at once:** drag one of the chosen rows (Ctrl/Shift+click) — all chosen items move together,
  in their document order, each with its children (an item whose parent is chosen too stays under it).
- **Scrolling while dragging:** near the top or bottom edge of the table it scrolls, faster closer to the edge.
- **Changes:** tick boxes on the uncommitted list, **Discard N chosen** and **Discard all changes** (each confirmed).
- **Right-click menu:** one export entry only — on a chosen item "Export the N chosen items and everything below
  them…", on any other item "Export this item and everything below it…".
- **ReqIF checked against the official schema:** every ReqIF file ReqMan writes is now validated in the automated
  tests with the OMG ReqIF schema (as published by Eclipse RMF) — the check DOORS, Jama and other tools make first.
- **Owner (29 Oct 2026) on 0.11.0:** all 5 steps passed, self-test 20/20 (30.5 s); asked for the points above; no
  DOORS/Jama access to try the ReqIF file (hence the schema check; ReqIF Studio is a free viewer).

## 0.11.0 — 29 Oct 2026 — Excel and ReqIF (M7)
- **Import from Excel, CSV or ReqIF** (Import… in the toolbar): a wizard in three steps — file, sheet and the row
  with the column names → what each column means (guessed from the names: ID, No., Title, Text, Type, Parent,
  Level, every field, link columns such as "Verified by") → check (new / updated / unchanged / skipped, every problem
  by row). Writes uncommitted changes. IDs from other tools are kept as `source-id`, so importing the file again
  updates the same items; the hierarchy comes from a parent column, outline numbers (3.2.1) or a level column.
  Separators `,` `;` and tab, UTF-8 or Windows-1252 CSV.
- **ReqIF** (DOORS, Jama, Polarion …, merged into this release — owner, 29 Oct 2026): import through the same wizard
  (one sheet per specification; XHTML text becomes Markdown, enumerations by name, relations by type), export with
  the hierarchy, every field, links as relations and the exact Markdown text for ReqMan itself. Objects that came
  from ReqIF keep their identifier on export.
- **Excel export** (now the default format): one row per item, titles indented, rows grouped by the hierarchy (+/−),
  long texts wrapped. The Changes view exports Excel too.
- **Export of chosen items**: Ctrl+click / Shift+click rows, right-click → "Export this item and everything below it"
  or "Export the N chosen items"; "Include the items below" (ticked); every item once, in document order, full
  outline numbers.
- **Update the Excel file**: Export… → "Update <file>" writes the current values into the file you imported from —
  only changed cells, new items as new rows, formatting kept, a backup copy next to it — or saves an updated copy.
- **New project from a file** on the start screen: empty folder → Git repository → wizard → first commit.
  **Publish to GitHub…** in the Git bar for repositories without a remote.
- Round trips measured on the 10,005-item sandbox: Excel export 1.8 s, ReqIF export 4.9 s, import of all items into
  a new project 11.7 s; importing either export again finds **10,005 unchanged** (broken references stay as they were).
- **Fixes (owner, 0.10.0):** the Changes view's red and green were hardly visible in dark mode (own theme colours
  now, `diffOldBg` …); "Changes (1)" with an empty list — a kept link changes only a confirmation, which is now listed.
- Libraries added (all free for commercial use): ExcelJS (MIT), JSZip (MIT), saxes (ISC); uuid pinned to 11 (security
  advisory). Release self-test: 20 steps. 165 unit tests; new e2e scenario `excel`.
- **Owner (29 Oct 2026) on 0.10.0:** all 5 steps passed, self-test 18/18 (33.7 s); found the two issues above.
  Decision: ReqIF merged into 0.11.0; branches stay alone as 0.12.0.

## 0.10.0 — 28 Oct 2026 — Changes view
- **One Changes view** (O-06) instead of the Changes panel and Compare: the Git bar has Changes / Pull / Push.
  It opens in the middle on **Uncommitted changes** (also before the very first commit); **Show** switches to what
  the last pull brought in, the last commit or any two versions. The changed items are listed on top, the selected
  item's difference below; the side panel has the commit tools (uncommitted) or the export (comparisons).
- **GitHub-style difference** (O-05): Fields, Text and Links blocks, old on the left in red, new on the right in
  green, the changed words marked, long unchanged parts of the text folded ("⋯ Show 12 unchanged lines"); in a
  narrow column old sits above new. Also used by the History tab.
- **Take back one part** of an uncommitted change with **↶** — a field, the position, the text or one link becomes
  as in the last commit, the rest stays — or **Discard this item's changes**. A file renamed by hand is listed
  ("File name changed") and can be discarded too.
- **Check the links** (O-04): saving a changed type, title or text of an item others link to opens a window — Keep
  or Unlink per link, Keep all, Unlink all (asks once more), Apply my choices, Decide later (leaves the ⚠ marks).
  Suspect links in the editor have Keep / Unlink and Keep all / Unlink all. Pulled changes only mark links ⚠.
- **No automatic pulls** (O-06, replaces "Compare pulls first"): "What the last pull brought in" and Push *offer*
  to pull first.
- **Column widths** (owner's request on 0.9.0): drag the edge of a column header; double-click = automatic;
  remembered per repository on this PC. The No. column starts wider.
- Docs: `docs/diagrams/index.html` navigates all diagrams; skills (`release-to-owner`, `whole-project-review`,
  `owner-decision-walkthrough`) and `tools/README.md` are in the repository.
- Release self-test: 18 steps (take back one part of a change; keep a suspect link). Library added: `diff`
  (jsdiff, BSD-3-Clause) for line and word comparison. 154 unit tests.

## 0.9.0 — 28 Oct 2026 — New data format
- **Owner (28 Oct 2026):** all 5 checklist steps passed; release self-test 17/17 in 26.7 s; the Compare + Changes
  bug is fixed. New request: the No. column cuts deep numbers ("2.1.1....") → column widths can be dragged
  (0.10.0). Also asked for a navigator page for the diagrams and the skills in the repository (done).
- **IDs:** every new item gets `REQ-` + 7 random characters, whatever its type (O-01, O-02). The type can now be
  changed in the editor; the ID stays. Older IDs (`SYS-K7Q3XM` …) remain valid; the schema no longer needs a
  prefix per type.
- **Positions:** `order:` is now a short *order key* (`a0`, `a0V` …) — there is always room between two keys, so
  moving an item rewrites **only the moved file** (S-04; fewer merge conflicts later with branches). Numbers
  written by older versions are read as before. At **push**, sibling groups you changed whose keys grew longer than
  4 characters are re-spaced in a separate commit "Tidy positions of N items".
- **Outline numbers** (1, 1.2, 2.3.1 …) are calculated from parent + position, never stored (O-03): new **No.**
  column in the table (between ID and Title, can be hidden, sortable = document order), in the editor header, the
  item search, the parent picker, Compare ("moved 3.2.4 → 5.1") and every export (CSV column *No.*, Markdown
  headings "## 1.2 REQ-… — Title").
- **Compare** pairs an item with its `former-id`, so a converted repository shows changed items, not deletions +
  additions.
- **Fix:** opening **Changes** while Compare was open showed both panels on top of each other; Compare now closes.
- **Sandbox converted** (`tools/convert-sandbox-0.9.mts`): new IDs (old ones kept as `former-id`), links and
  parents rewritten, `git mv` first so every file's history continues, typed numbers removed from heading titles.
- Index cache format 4 (rebuilt once on first open). Diagrams in `docs/` redrawn with Archify. 145 unit tests.

## 0.8.0 — 28 Oct 2026 — Clean page (all fixes of the project review)
- **Owner (28 Oct 2026):** update installed; release self-test on his PC **passed all 17 steps** in 32.7 s
  (Git 2.52.0). Git steps take 2–10 s each there (vs. < 0.5 s on Linux) — process start-up with antivirus.
  Checklist steps 3–5 passed (Expand all "shows instantly"); found the Compare + Changes overlap (fixed in 0.9.0).
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
