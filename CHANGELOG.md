# Changelog

Each version was installed and tried by the owner (product owner) on Windows 11; his feedback is recorded under the
version it was about, and what it led to.

## 0.20.2 — 10 Nov 2026 — data safety (whole-project review before the first release)
The owner's decisions on the review (`docs/reviews/2026-11-10-project-review.md`, O-1…O-7, 10 Nov 2026): data safety
first, then speed, then screens, Arabic and documents. Each fix below was reproduced in a test first
(`tests/review-whole-0.20.test.ts`, QA's `tests/qa-whole-0.20-journeys.test.ts`).
- **W-01** "Give the copy a new ID" on a copied heading could rewrite the **original** child instead of the copy's
  child (when the copy's document sorts after the original's). The save now writes the exact file it read.
- **W-02** Documents with Arabic (or any non-English) names: Git printed their paths in an escaped form, so a pull where
  both PCs edited the same item stopped with "conflict outside the requirements folder", and history missed entries.
  Every Git call now asks for plain paths.
- **W-03** A pull that merged changes from both PCs dropped extra keys on links (a note, another tool's key).
- **W-04** Exporting while an old version is shown wrote invisible control characters into the title (the ReqIF file
  was not valid); control characters are also left out of all ReqIF text.
- **W-05** CSV import: a short row ending in a quoted cell swallowed every row after it.
- **W-06** A crafted 17 KB Excel file (one cell in row 50,000,000) closed the app on Import; it is now refused at once.
- **W-07** Compare showed "B became C" when one item was deleted and a different one added; now one deletion + one
  addition.
- **W-08** Commit, pull, branch switch and undo now get the long time limit (15 min) like the other bulk Git steps —
  the owner hit the 30-second limit on 8 Nov with a virus scanner.
- **W-09** Restart to update and Go back to version X now close the window the normal way first, so unsaved edits get
  the usual question (takes effect for the update after this one).
- **W-11** Push names exactly what it sends (this branch to its upstream), so personal Git settings can never push
  other branches or force a push. **W-12** Windows: long paths allowed for Git.
- **W-31** CI: libraries are installed without running their install scripts (the release token is never near
  library code); a release is made only from main. **W-32** Electron 45.0.0 → 45.2.3 (security fixes).
- **W-33** Problem reports show `%USERPROFILE%` instead of the Windows user folder (O-7).
- Code reviewer on the patch (`docs/reviews/agents/0.20.2-code-reviewer.md`, 16 findings, all handled): Push refuses a branch that follows an upstream of another name (CR-01) and uses a push remote when set; the CSV fix no longer ends a multi-line cell early (CR-02); the app quits by itself if no installer takes over (CR-03); link notes changed on both PCs become a merge question; the unsaved-changes question is in Arabic too.
- Owner's answers recorded: O-2 the `gh api` permission stays, every GitHub change is reported (CLAUDE.md); O-3 10k
  items a must, 50k a should; O-4 keep "Changes + settings" with a tooltip; O-5 coverage gaps as their own chip; O-6
  clearer message when two PCs rename the same document. The Word AI prompt now reads a whole folder (one file per
  version → Git history with baselines), reports conflicts, keeps shared requirements in both modules and records the
  documents' format (`docs/guides/word-template-prompt.md`).

## 0.21.0 — 11 Nov 2026 — speed at 50,000 items (review W-20…W-23, W-27)
The owner's decision O-3 (10 Nov 2026): 10,000 items a must, 50,000 a should. Measured with the new
`tests/perf-workspace.test.ts` (Linux container; Windows is slower, the ratios hold):

| Action | 50,000 items before | 50,000 items now | 10,000 now |
| --- | --- | --- | --- |
| Compare two commits, 1 change (W-20) | 10.5 s (window frozen) | 1.1 s | 0.18 s |
| Save one item (W-21) | 0.16–0.6 s | 6 ms | 22 ms |
| Sort by outline number (W-22) | 0.9–4 s | 0.66 s | 0.12 s |
| Open an old version, first time (W-23) | 8–14 s, window frozen | 7.4 s, window stays usable | 1.3 s |

- **W-20** Compare reads only `id`, `parent` and `order` from each file of a commit for the outline numbers (a small
  header reader; the full parser only for files not in reqochet's own form), and keeps the numbers of the last few
  commits (Compare, then its export, ask twice).
- **W-21** Saving a text or field change keeps the outline numbers instead of renumbering every item.
- **W-22** Sort by number uses each item's place, worked out once per change of the project.
- **W-23** The first build of an old version pauses every 200 files, so the window keeps answering; the message
  says the first time takes a few seconds in a big project.
- **W-27** The speed test now covers these actions (1,000 items every run, 10,000 every build, 50,000 for releases).
- Push asks Git for the branch details in one call instead of five (the 0.20.2 self-test was 30 s slower than
  0.20.1; each Git call costs time on Windows).
- Code reviewer on the patch (`docs/reviews/agents/0.21.0-code-reviewer.md`, 10 findings): the fast header reader now gives up on anything not in reqochet's plain form (numbers like 1e3, repeated keys, no type), so it always agrees with the full parser; unnumbered items stay last when sorting descending.
- O-8 (owner, 10 Nov): nothing more is masked in problem reports — the GitHub account in update addresses is the
  release repository's owner.

**Owner (11 Nov 2026), 0.21.0:** self-test 25/25 in **77.6 s** (0.20.2: 120.9 s, 0.20.1: 90.9 s — the one-call push
helped); sort by number almost instant; saves instant; old version opens with the message and the window usable.
Compare of an old commit with the newest on the sandbox: **about 4 s** (expected about 1 s — the measurement had one
changed item). The owner's comparison had **10,007 changed items**; with few differences it took under a second — **all 5 steps passed**.

**Owner (10 Nov 2026, evening), 0.20.2:** all 4 steps passed (self-test 25/25 in 120.9 s, 0.20.1 took 90.9 s;
Arabic-named document committed, pushed, history shown; Compare showed one Deleted and one Added; the problem report
shows `%USERPROFILE%`). Found in the attached report: the opened project's path (a folder on drive D: named after the
owner) and the update download addresses (the GitHub account) still show personal names — `%USERPROFILE%` only covers
the Windows user folder. **Owner's choice (O-8): leave both** — the account is the release repository's owner (public, the same in every copy), and folder paths are useful.

## 0.20.1 — 10 Nov 2026 — the owner's points on 0.20.0
- **Owner (10 Nov 2026), 0.20.1:** all 5 steps passed (self-test 25/25, 90.9 s).
- **Owner (10 Nov 2026), 0.20.0:** all 5 steps passed (self-test 25/25, 84.0 s), with points: the gap mark is hard to
  see (test 2); a way back to Traceability from the gaps table (test 3); the matrix header row scrolled away and was
  very tall (test 4 — reproduced first in the `trace-0.20` e2e: a rotated header cell does not stay at the top, and its
  height limit acted sideways on the vertical text); the top bar order Pull, Push, Changes, Versions, Traceability
  (test 5). The "1,315 columns … shown as a list" message was expected: without a filter the rows linked to 1,315
  different tests, too many for a grid in the window.
- **Fixes:** the gap mark is a solid dot in its own theme colour (`gap`, amber in Light and Dark); **← Back to
  Traceability** above the table after *Show the gaps in the table*; the matrix header stays at the top and is about
  140 px high (only the text runs upwards, cut to 130 px); the top bar order; the start screen no longer says
  "✓ Git … found" (the self-test checks Git; a missing Git is still warned about).
- **Owner (9 Nov 2026), SEC20-05:** yes — every Excel export marks a cell that starts like a formula (`=`, `+`, `-`,
  `@`) as text (Text format), so editing it in Excel later never turns it into a live formula.

## 0.20.0 — 9 Nov 2026 — theme 1b: traceability views
- **Owner (8 Nov 2026):** 1b next (the pilot can start after it); decisions T-01…T-08, all as recommended
  (`docs/reviews/2026-11-08-1b-traceability.md`); helper reviews as before (all six).
- **Coverage rules** in `schema.yaml` (`rules:` — shared through Git): a starter set in new projects, offered once to
  older ones; edited in the new **Rules** tab of the item-types window; warnings only, with a level stored for a later
  CI check. Obsolete items are counted on neither end; links count across documents.
- **Traceability** (top bar): **Coverage** per rule (x of y covered, gap list, show the gaps in the table) and
  **Matrix** (rows of one type following the filter, columns = linked items of another, list form when very wide,
  **Export Excel**).
- **Impact** tab in the editor (also from a change in Changes): everything that depends on the item, all levels down.
- **Coverage gaps**: a ◌ mark in rows, **Filters → Coverage gaps**, a group in Problems and a count in the status bar.
- **Helper review (`docs/reviews/agents/0.20.0-*.md`):** a big matrix no longer crashes the Excel export (very large
  ones are written as a list); saving rules keeps hand-written keys, comments and a rule with a typo; rules keep their
  IDs; the matrix follows the Incomplete filter; an item type a rule uses cannot be removed; at most 100 rules are read
  from schema.yaml; loose files work in Coverage; Arabic plurals and word order; matrix marks for direction with a
  legend and titles in the column headers.
- Self-test step 25; e2e `trace-0.20`. The e2e harness removes a passing scenario's temporary projects (a full disk
  broke a test run).

## 0.19.1 — 8 Nov 2026 — fix: empty space between rows after Show text off
- **Owner (8 Nov 2026), 0.19.1:** all 3 steps passed (self-test 24/24, 174.6 s).
- **Owner (8 Nov 2026), 0.19.0:** all 5 steps passed (self-test 24/24, 187.6 s while another 20-minute build ran).
  Test 2: with Show text off, opening levels left empty rows. Test 5: the privacy diagram passes but can have a better
  layout — revisit all diagrams at the final touches (reminder list added to `docs/design/roadmap.md`).
- **Fix:** the table remembered each row's measured height by its position; heights measured with the text shown stayed
  after Show text off, so one-line rows sat in tall slots once levels opened. Each mode now has its own measurements,
  and a switch forgets them all. Reproduced first by a new e2e scenario (`rows-0.19`: 1,500 generated items; gaps of up
  to 284 px before, none after).

## 0.19.0 — 8 Nov 2026 — reading the table, old versions, compare layout
- **Owner (8 Nov 2026), 0.18.0:** all 5 steps passed (self-test 24/24, 95.5 s). The update downloaded the full
  installer once (0.17.2 was installed by hand, so the small download could not be used — see PITFALLS). Points:
  the read-only version should open in the table itself; Compare wastes its right panel while the changes are crammed
  at the bottom; the privacy diagram needs a dark version and less empty space; the table should show the text like
  DOORS (decisions D-19a/b/c in `docs/design/decisions.md`).
- **Main column (D-19a):** the table reads like a document — a heading shows its title in bold, any other item its
  title in bold and its whole text below (formatted), each row as tall as needed. Toolbar button **Show text** (saved
  with the columns): off = one line per item with the **Text** column.
- **Old version in the table (D-19b):** **Versions → History → Open read-only** switches the whole table — tree,
  filters, search, columns, export — to that commit, under a coloured bar *Viewing … (read-only)* with **Back to now**.
  The commit's files are read from Git into a temporary index (deleted on Back to now); every write and Git action is
  refused meanwhile, the Git bar and New item are hidden and the editor shows the item as text. Replaces the floating
  read-only window of 0.18.0.
- **Compare layout (D-19c), every compare screen:** changed items on the left like the files of a GitHub pull request
  (title with the ID below), every change one after another on the right (more load as you scroll; a click on the left
  jumps there; the left list follows the scrolling). Export CSV / Markdown at the top next to **Close changes**; the
  side panel only for committing.
- **Privacy diagram:** a dark version, tighter, no overlapping boxes; Settings shows the one matching the theme. The
  diagram script no longer takes pictures of a drawing whose layout check failed.
- **Helper review (`docs/reviews/agents/0.19.0-*.md`):** the old-version bar no longer disappears when the window gets
  focus; field checks follow the shown version; a failed open keeps the version shown; Arabic: "النسخ المحفوظة" for
  Versions, one word each for version / app release / copy; the read-only editor looks read-only; the left list never
  cuts the ID; the search box keeps its room.

## 0.18.0 — 8 Nov 2026 — 1a structure part 2: baselines and the history list
- **Owner (8 Nov 2026), 0.17.2:** all 5 steps passed (self-test 23/23, 73.9 s; installed by hand because GitHub
  answered the update feed with 502 — later "Up to date"). Points: copied requirement files did not appear in the new
  document; a discarded new document stayed in the list; clearer privacy texts and a diagram; the update check
  should fall back to the API; incomplete items marked in the table; slimmer bars; Arabic "عنوان قسم"; the grey
  outline only on the Windows icon.
- **Baselines (S-06 a, S-08 a):** **Versions → New baseline…** (the top-bar button is called *Versions*; tell us if
  you prefer another word) — a name and a note mark the latest commit (with
  uncommitted changes: commit them first, or leave them out); listed as *not pushed yet* until the next **Push**
  sends it. Underneath it is the Git tag `baseline/<name>`.
- **History of the branch (S-09 a):** newest first, search by words or commit ID; per commit **Open read-only**
  (every item as it was), **Compare with now**, **Make baseline…**, **New branch here…** — the folder never moves to
  an old commit.
- **Copied files:** a requirement file copied by hand into another document shows at that document's top level;
  **Problems → Give the copy a new ID** gives it its own ID and file name.
- **Discard** removes the folders it leaves empty, so a discarded new document disappears.
- **Updates:** when GitHub's releases feed fails, the check asks GitHub's API instead.
- **Table:** a small **!** marks items with an empty required field; slimmer top bar and toolbar; a thin document bar when
  the project has one document.
- **Privacy page:** clearer words on the log (sign-ins in addresses become ***) and on the Git name and e-mail; an
  Archify diagram of what is read, kept and sent (click to enlarge; `docs/diagrams/privacy.html`).
- **Icon:** the grey outline stays on the desktop / Start menu / taskbar icon only; the light tile inside the app is
  plain again.
- **Helper review (code, QA, security, UI/UX, Arabic, performance — `docs/reviews/agents/0.18.0-*.md`):** a baseline
  name GitHub already has no longer blocks later pushes (it is marked *name taken on GitHub*); a deleted baseline tag
  is dropped from the waiting list; baselines are pushed one by one; names follow one clear rule (letters of any
  language, digits, `.`, `_`, `-`); Undo commit is refused when a baseline marks that commit; searching a commit ID
  finds exactly that commit; a copied parent and child keep their hierarchy when both get new IDs; a copy that cannot
  be told apart from the original is not guessed; an item whose parent is in another document shows only at its own
  document's top level; Discard of thousands of new folders takes seconds instead of half a minute.
- **Workflow:** the release and review skills, the helper rules and the hand-over notes were tightened (fewer tokens,
  no push after a red check, sturdier CI downloads).

## 0.17.2 — 8 Nov 2026 — Document groups, column drag, privacy page, guide pictures
- **Owner (8 Nov 2026):** 0.17.1 steps 0–4 passed (self-test 23/23, 55.5 s; the 10,005-item rename worked). 0.17.0
  steps 3–5 passed with points; 0.16.4 steps 2–5 passed (Shift+F10 needs Fn on his laptop keyboard — the keyboard's
  F-key setting, not the app; no extra shortcut wanted). Spaces in folder names are fine (the 0.17.0 failure was the
  time limit; the self-test and the CI run rename to names with spaces).
- **All documents:** every document is a collapsible group row with its name and item count, its tree inside.
- **Columns:** drag a column header in the table to move it (No. and Title stay first); the Columns menu's names are
  left-aligned (they looked like a tree) and Title is listed as always shown first.
- **Clear filters** stands out in orange while a filter hides items (one place, next to Filters).
- **Settings → Privacy and access:** what reqochet reads, keeps on the PC (and where), sends (only Git pull/push and
  the update check — no tracking), what it may change, and what to know for confidential projects.
- **User guide with pictures:** where requirements live (§2), suspect links (§6), the daily round (§8) — drawn to
  follow the window's colours. The engineering diagrams (`docs/diagrams`) are updated for reqochet and re-checked
  against the current code.
- **App icon:** the light tile with a grey outline is now the icon of the .exe, Start menu and desktop; while
  reqochet runs, the taskbar icon follows Windows (dark tile on a dark taskbar, light on a light one).
- **Fewer tokens:** the status history moved from `CLAUDE.md` (read at every session start and after every
  compaction) to `docs/STATUS.md` — CLAUDE.md is now 45 % of its size and changes only when a rule changes; helpers
  write their own reports and answer in three lines; reading and output rules in `docs/AGENT-WORKFLOW.md` → "Cost".

## 0.17.1 — 8 Nov 2026 — Renaming a big document safely
- **Owner (8 Nov 2026), 0.17.0:** test 1 passed (self-test 22/22, 64.5 s). Test 2 failed: renaming the sandbox's
  "items" folder (10,005 items) to "SandBox Req" stopped with "Git refused the commit: Command failed: git … add …";
  the folder stayed renamed, a second try said "items does not exist"; after moving the files by hand, **Discard all**
  failed with "spawn ENAMETOOLONG", and the loose-files offer said "More than 300 loose files". He had to repair the
  folder with Git by hand.
- **Cause:** Git was given 30 seconds to add the 10,005 renamed files; on Windows that took longer, Git was stopped,
  and putting the folder back failed silently. "Discard all" put all 10,000 paths on one command line, longer than
  Windows allows.
- **Fixed:** a document is renamed with `git mv` (renames on disk and in Git at once, without reading every file
  again), path lists go to Git through standard input or in parts, Git commands over many files may take up to 15
  minutes, a stopped Git now says "it timed out", and if anything fails the move is put back (retried while Windows
  still holds a file) and the window re-reads the folder so it shows what is really on disk. Discarding a rename
  restores the old name too. No more 300-file limit for loose files. The release self-test has a new step 23:
  rename a document with a space in its name.

## 0.17.0 — 8 Nov 2026 — 1a structure: documents, editable types, required fields
- **Owner (7 Nov 2026):** "if you can start the next step now without the manual testing, go on … we can do both tests
  together" — 0.16.4 was not tested yet; its steps 2–5 are tried on this version.
- **Documents (S-10):** every folder under `requirements/` is a document (a specification) with its own tree and its
  own numbers from 1; a document picker above the table (each document, or All documents), **New document…** and
  **Rename…** (a folder rename in one commit, so every item keeps its history). A new project starts with the document
  "Specification"; a project made before 0.17 is offered a real name for its folder "items"; item files lying directly
  in `requirements/` are offered a move into a document. A tree never spans documents.
- **Item and link types edited in the window (S-04):** Columns → **Edit types…** — add, rename, remove (only when no
  item or link uses the type; the window shows how many do), stored in `schema.yaml` with its comments kept.
- **Required fields (S-05):** per item type; an item without them is still saved but marked **incomplete**, and
  **Filters → Incomplete** lists those items (also in the export of the filtered table).
- **Columns menu:** drag and drop to reorder the columns (S-11); ↑ / ↓ stay for the keyboard.
- **Checked by the helpers:** code reviewer and QA tester (every finding fixed or decided — loose files never overwrite
  a file, Windows device names refused, a parent in another document warned and numbered at its own top level; QA tests
  taken in: `tests/qa-0.17.0-*`, plus `tests/review-0.17.0.test.ts`), then security, Arabic, UI/UX and performance
  (`docs/reviews/agents/0.17.0-*.md`). The release self-test now builds a project with a named document.
- **Found on the way:** with required fields set, the Incomplete filter took 3 s at 10,000 items (83 s at 50,000) —
  now 13 ms; document counts in one pass; Git now takes every path literally (an ID like `X[1]` could pull another
  item's unsaved edits into a commit); item files that are links or larger than 5 MB are not read; switching documents
  right after a save could show the previous document's rows (a late answer overwrote the tree).

## 0.16.4 — 7 Nov 2026 — Stabilisation 2: speed, Arabic, first run, keyboard
- **The owner's points on 0.16.3:** clicking into the Text box puts the cursor where you clicked (or at the end), not at
  the start; a `"` typed inside a multi-line CSV cell (a table, a bullet list) no longer cuts the rest — a quote ends a
  quoted cell only when a separator, a line end or the file end follows (and the row then has all its columns); a CSV
  row that still has too few cells is named in the import preview.
- **Where a new item goes** (the owner, 5 Nov): **below the selected item** by default; the new **Insert position** list
  chooses Inside the selected item or At the end.
- **First run:** an empty project shows what to do first — Add the first requirement, Import from Excel/CSV/ReqIF, Open
  the quick start (UX-W01).
- **Links column in words:** "2 out · 1 in · ⚠ 1 suspect", also read out by screen readers (UX-W02).
- **Keyboard:** Menu key / Shift+F10 / Delete open the row menu (now with Add a child item and Delete…), arrow keys move
  in it, Enter goes into the editor (UX-W03); listed on the Keyboard shortcuts page.
- **Changes counts requirements**, with "+ settings" when the settings changed — no more "8" for 5 items (UX-W05).
- **Speed:** Alt+Tab back to the window reloads only when files really changed (CR2-04); a big Compare no longer freezes
  the app (PQ-01). The "2.5 s extra on open" (PQ-02) was the measurement counting the start screen's animation; the
  real gap is about 0.2 s, and the log now shows the phases of every open.
- **Arabic:** correct counts for 0 and agreement for 1 and 2; one word per idea — parent أصل, child **عنصر فرعي**,
  siblings العناصر المجاورة, pull سحب, Git tag علامة إصدار, Defect خلل; IDs read left to right in the table; diff labels
  and checks of the core speak Arabic too (AR-01…13, CR1-08).
- **User guide:** new page **19. Coming from DOORS or Jama?**; the pages that no longer matched the screens corrected.

## 0.16.3 — 5 Nov 2026 — Stabilisation 1: data and safety (whole-project review)
- **Owner (5 Nov 2026):** self-test 22/22 (129.9 s, a large compile ran at the same time); steps 1, 3, 4 passed. Points
  for the next round (owner: change nothing before the usage limit resets, start when he says): (a) step 2 — clicking
  into the Text box puts the cursor at the start of the text, not where he clicked or at the end; (b) step 5 — a `"`
  inside a multi-line cell (table, bullet list) still cuts the rest of that cell; he suggests a rule for characters or
  a warning. Builder's note (I/R): Excel writes such a cell quoted and doubles its quotes; a bare `"` typed inside it in a
  text editor ends the quoted cell — read a quote inside a quoted cell as its end only when a separator, line end or
  file end follows (no character rule needed), and warn when a cell still looks cut.
- **Whole-project review (5 Nov 2026):** seven helper agents read the whole project one area at a time — 6 High, 41
  Medium, 101 Low findings (`docs/reviews/2026-11-05-project-review.md`); the owner confirmed the plan 0.16.3 → 0.16.4
  → 1a and answered the product questions. QA turned the findings into tests that failed; they now pass.
- **Never lose or split data:** a requirement brought back from a branch a second time is one requirement — only the
  differing parts are asked (CR1-01; replaces giving your copy a new ID); hand-written header content is kept on save
  (CR1-02); the Fields window keeps other settings and comments in `schema.yaml` (CR1-03); an import that fails halfway
  says how far it got (CR1-04); Push's automatic tidy-up never leaves files you did not change (CR1-05); a typed answer in
  the pull window is checked like a save (QA-WP-01); no "Undo last commit" for a pull's joining commit (CR1-12).
- **Screens:** the ✕ beside the project name asks Save / Discard / Keep editing and waits for a running pull or push
  (CR2-01); Push, Import and "Fix file name" ask the same question when an item has unsaved edits, then Push goes on
  with the usual "Pull first?" (CR2-03, the owner's flow); an open item deleted by a pull closes, or says so if you were
  typing (CR2-02); a list field such as Tags counts while you type, so Ctrl+S saves it (CR2-05).
- **Import and export:** ReqIF keeps IDs from other tools such as "DOORS 1" (no duplicate on re-import, CR3-01); a stray
  `"` in a CSV cell no longer swallows the file (CR3-02); Arabic and other scripts, ✓/✗ match choices and types
  (CR3-03); a workbook with macros (.xlsm) is never rewritten — "Save an updated copy" makes an .xlsx (CR3-04); backups
  are never overwritten (CR3-05); updating your own CSV leaves unchanged cells exactly as they were (CR3-06); search
  finds `_` and `%` (QA-WP-02).
- **Security:** an ID can no longer point outside the repository (SEC-01/06); passwords or tokens in a Git address are
  hidden in the log and problem reports (SEC-02); GitHub workflows give write rights only where needed and use fixed
  versions of their building blocks (SEC-03/04); the release checks privacy and secrets like every build (CR3-25); the
  one library without a licence is gone (SEC-05).

## 0.16.2 — 4 Nov 2026 — The Windows icon redrawn
- **Owner (4 Nov 2026):** all 3 steps passed (self-test 22/22, 69.6 s) → whole-project review → 0.16.3.
- **Owner (4 Nov 2026) on 0.16.1:** all 5 steps passed (self-test 22/22, 65.5 s). Asked: redraw the Windows icon with
  the brighter eyes and a thin lighter outline, so it shows on dark wallpapers.
- **Windows icon** (taskbar, Start menu, desktop, window): brighter red and green eyes and a thin grey-blue outline
  around the dark tile, all sizes 16–256 px. The same outline is on the face in the window (light mode), so the face
  keeps one look. The files are made by `tools/brand-icons.mjs` from the drawings.
- **Reviews folder tidied:** the rename, rename-impact and security-check files moved to `docs/reviews/done/`.

## 0.16.1 — 4 Nov 2026 — The owner's points on 0.16.0
- **Owner (4 Nov 2026):** all 5 steps passed → 0.16.2.
- **Owner (4 Nov 2026) on 0.16.0:** self-test 22/22 (86.1 s); steps 1, 2, 5 passed; points on 3 and 4. Answers: BR-02
  draw the two missing drawings now; BR-04 keep face + name as they are in Arabic; BR-06 the white tile in dark mode
  stays; a renamed field with a translation → warn.
- **Push / Pull questions were hidden behind the table** (step 4): the 0.16.0 top bar cut off everything that hangs
  below it, so "Pull first?" with "Push without pulling" could not be clicked. Cause: a rule that keeps long names
  from running past the window clipped downwards too; it now clips sideways only. An e2e check clicks the real button.
- **The face kept changing size in dark mode** (step 3): the moving eyes used the large drawing, the resting face the
  small cut. The small cut on the white tile now exists for idle and thinking (BR-02), and the moving eyes are as large
  as the resting ones.
- **Eyes on the dark tile (light mode) are lighter** — a brighter red and green, so they and their movement are seen.
  The white tile (dark mode) is unchanged. Recorded in `resources/brand/README.md`.
- **The loading animation plays at least one loop** (1.4 s) when the app starts, so it can be seen (not when Windows
  animations are off).
- **Fields window:** renaming a field that has a translated name, or removing a translated choice, shows a warning
  (the field is still saved).

## 0.16.0 — 4 Nov 2026 — The new name: reqochet (development tool reqochet-dev)
- **Owner (4 Nov 2026) on 0.15.2:** self-test 21/21 (60.0 s); all 3 steps passed. Requests: Changes / Pull / Push next to
  the branch button; the new name **reqochet** with the brand package (logo, icon, motion). Decisions
  (`docs/reviews/2026-11-04-rename-reqochet.md`): all lower case; the clean switch of 31 Oct; icon + name in the top
  bar, the logo on the start screen, the loading animation, the "eyes" shown now as the app's face; a brand helper
  agent; two tools — this repository builds **reqochet-dev**, the release repository will build **reqochet**; the
  project folder is `requirements/.reqochet` for both.
- **The switch from ReqMan:** the update installs reqochet-dev as a new app; its installer removes ReqMan (asking first
  if ReqMan is open and the installer was started by hand); the first start copies your settings, recent list, import
  memory and window settings from `%APPDATA%\ReqMan` and then removes that folder (only after everything was copied);
  each repository is indexed again once. "Go back to an earlier version" lists versions from 0.16.0 on.
- **Brand:** the face (q and o as eyes: they glance and blink, look busy while the app works, rest when the window is in
  the background) and the name logo in the top bar with a small DEV mark; the large face and name on the start screen;
  the bouncing-dots animation at start and while a repository opens; a small busy icon in the Git bar; the Windows icon.
- **Projects made with ReqMan** open as before and show **Rename folder**: one commit renames `.reqman` to `.reqochet`
  (items, links and history stay); you then push it. Refused while that folder has uncommitted changes.
- **Top bar:** Changes / Pull / Push right after the branch; names shrink with "…" so the bar never runs past the window;
  without a remote one **Publish to GitHub…** button.
- **Exports:** ReqIF and Excel carry the name reqochet; files exported by ReqMan still import exactly as before.
- **Also:** a GitHub server error is no longer reported as "Pull first"; the self-test has a 22nd step (a project made
  with ReqMan is renamed).
- **Owner (4 Nov 2026):** steps 1, 2, 5 passed; points on 3 and 4 → 0.16.1.
- **Checked before release** by the code reviewer, QA tester (53 tests taken in), UI/UX reviewer and the new brand
  helper (`docs/reviews/agents/0.16.0-*.md`); the Windows switch from 0.15.2 is tested by the CI acceptance run.

## 0.15.2 — 4 Nov 2026 — The owner's points on 0.15.1
- **Owner (4 Nov 2026) on 0.15.1:** self-test 21/21 (50.2 s); all 4 steps passed, with three touches. All here:
- **Self-test report folds** (step 1): after a passed test only the result line shows; **Show the 21 steps** opens the
  list. A failed step opens it by itself.
- **Link reviews are a row in the list** (step 3): "L — Link review only: 5 items" sits under the changed items like
  any other row; a click shows their IDs, each opens the item.
- **No more "links are now suspect" warning after you kept them** (step 3): the warning counted every link to the
  item; it now counts only links that still wait for a review.
- **Back sits on a bar of its own** (step 4): the entries scroll under the bar instead of showing around the button.
- **Also:** the table's Text column no longer shows a stray `*` when a text starts with bold (found by the acceptance
  run's screenshot of 0.15.1).
- **Owner (4 Nov 2026):** all 3 steps passed (self-test 21/21, 60.0 s) → 0.16.0.
- **After the release (in the next version):** a GitHub outage while pushing was reported as "Pull first"; it now says
  that GitHub had a problem and nothing was lost. The CI acceptance run of 0.15.1/0.15.2 had failed twice on it.

## 0.15.1 — 4 Nov 2026 — The owner's points on 0.15.0
- **Owner (4 Nov 2026) on 0.15.0:** self-test 21/21 (52.0 s); steps 2, 4 (with a point), 5 passed; step 1 and 3 with
  points. All fixed here:
- **Self-test kept while you look elsewhere** (step 1): leaving the Self-tests page lost the running test's display —
  the card kept its state only while shown. The state now lives for the whole window session; the test was in fact
  still running in the background.
- **Add link: the link type list closed the section** (step 3): moving from the search box to the list counted as
  "leaving the search", which closes it. Moving within the Add link form no longer does.
- **Link reviews in comparisons** (step 3): after Keep, the five linking items changed only by a new link
  confirmation. Changes listed them ("link review only") and the commit held all 6 files, but "the last commit"
  showed only the one real change, because a comparison between commits hides confirmation-only files. It now names
  them under the list ("+ 5 items changed only by a link review"), so the numbers match.
- **Back stays at the top of the Settings panel** when the panel scrolls (step 4).
- **Owner (4 Nov 2026):** all 4 steps passed (self-test 21/21, 50.2 s); three touches → 0.15.2.

## 0.15.0 — 4 Nov 2026 — UI polish (from the UI/UX review of 0.14.5)
- **Owner (3 Nov 2026):** a UI/UX helper agent reviewed 0.14.5 (36 findings, `docs/reviews/agents/0.14.5-ui-ux.md`);
  the owner accepted all recommendations — the 7 High findings, 15 quick wins, open questions 1–5 as recommended —
  and all remaining findings except UX-19 (filters → theme 2), UX-29 (fields dialog → 1a) and UX-33 (keep the
  GitHub-like difference view). Before release a code reviewer, a QA tester and a UI/UX re-check looked at the frozen
  build (`docs/reviews/agents/0.15.0-*.md`); their findings were fixed.
- **Table:** columns No., Title, Type, Status, Links, other fields, ID, Text (yours stays if you reordered; ID can
  now be moved too); short type names (SysReq), headings bold, no type shown for headings; outline numbers never cut;
  the Text column shows the text without Markdown markers (underscores inside words such as `SIG_BRAKE_REQ` kept —
  the old preview dropped them); the editor can be made wider by dragging (or ← → on the line).
- **Editor:** the text shows formatted (bold, lists, tables) until you click it; the Parent field is a button with
  **Change…** and **Show**; Owner suggests names already used; a dot marks unsaved changes; **Save and continue** in
  the unsaved-changes question; Tags takes a full row; "Saved ✓" for 2 seconds.
- **Links:** suspect links are checked with one button (Keep all / Unlink all… behind it); the "Check the links"
  window shows **what changed** in the item, a Keep | Unlink choice per link, the linking item's text on click.
- **Git:** a question (pull first? publish) opens as a small box under the buttons and closes with Esc; result notes
  never cover dialogs; Pull/Push show their counts and turn blue when there is something to do; **▾ → Commit and
  push**; **Author:** line with **Change…**; the name and e-mail are stored for the repository (and as your Git
  default only if you have none — your company repositories keep theirs); branch panel: "Bring in changes from…",
  "Other branches on this PC" / "Only on GitHub"; the pull decision shows both versions as cards to click.
- **Other screens:** grouped Problems panel with counts and a Close button; status bar shows chosen rows, the active
  filters (✕ clears them) and the time of your last pull; import with steps and a drop zone for files; history
  placeholder while Git reads; start screen with **Read the quick start** and a Git check; **Settings → Appearance**
  holds language and colours (the top bar of an open repository no longer does); keyboard shortcuts (Ctrl+S, Ctrl+F,
  Ctrl+N, Alt+↑/↓, Ctrl+Shift+C, Ctrl+/) with a new guide page **18. Keyboard shortcuts**.
- **Arabic:** English text reads correctly in the right-to-left window; new projects get Arabic names for types,
  fields, choices and link types (`labels:` / `optionLabels:` in `schema.yaml`; files keep the English values).
- **Colours:** darker green/amber in Light; a test checks the contrast of all text colours.
- **Tests:** 336 unit tests (QA added 87), 7 e2e scenarios.
- **Owner (4 Nov 2026):** self-test 21/21 (52.0 s); steps 2 and 5 passed; steps 1, 3, 4 with points → 0.15.1.

## 0.14.5 — 3 Nov 2026 — Visible "Check for updates", folding guide topics, UI review prompt
- **Owner (3 Nov 2026) on 0.14.4:** self-test 21/21 (53.0 s); steps 1, 3 passed; step 2: the Check for updates button
  is hard to see (make it blue) and the user-guide topics should fold under "User guide". Extra: a prompt for an AI
  UI/UX review. All here:
- **Check for updates** is a blue button.
- **User guide** in the Settings panel folds: ▸ User guide shows the topics when clicked (open while a guide page is shown).
- **`docs/guides/ui-review-prompt.md`:** a prompt that makes an AI agent review the screens as a senior product
  designer and write numbered findings (problem, proposal in theme tokens and English wording, severity, effort) into
  one Markdown file to hand back for applying.

## 0.14.4 — 3 Nov 2026 — No personal data in the tool's files; small Settings touches
- **Owner (3 Nov 2026):** steps 1, 3 passed; step 2: Check for updates hard to see, fold the guide topics → 0.14.5.
- **Owner (3 Nov 2026) on 0.14.3:** self-test 21/21 (53.9 s); steps 1, 2 passed; step 3 not needed. Decisions:
  - **Requirement repositories** (and the sandbox) may hold their authors' names and e-mails as usual — the privacy
    check no longer looks at the sandbox or at commit authors.
  - **The tool repository:** no personal data in any file — no names, account names, user names or e-mail
    addresses. Its history stays as it is: when the tool is published, a new repository starts from the files only.
- **Personal data removed from every file:** the owner's name → "the owner" everywhere; the account name is gone
  from documents (`<owner>/…`), workflows (`github.repository_owner`), `electron-builder.yml` (CI passes owner and
  repository; a local build reads them from the Git remote), the app (it reads the release feed from its own
  installed `app-update.yml`) and `tools/ci.mjs` (reads the Git remote). A fictional data name that matched was changed.
- **Privacy check now checks only the current files** of this repository (e-mail addresses and personal/account
  names, the latter stored only as hashes); gitleaks still scans for secrets.
- **Settings:** **Check for updates** moved next to the Updates line (Environment and versions); **← Back** is blue.

## 0.14.3 — 3 Nov 2026 — Settings and help as pages
- **Owner (3 Nov 2026):** steps 1, 2 passed (Back should be blue → 0.14.4); step 3 not needed (see 0.14.4).
- **Owner (3 Nov 2026) on 0.14.2:** steps 1, 3, 4 passed; step 2: one page per settings group and per guide section
  instead of one long scroll, Back on top of the left panel, the panel in its own shade; step 5 (global Git e-mail)
  not possible — it would change his commits to company repositories.
- **Settings pages:** Environment and versions · Report a problem and diagnostics · Features · Self-tests — each
  entry in the left panel opens its own page.
- **User guide pages:** "Introduction and contents" plus one page per section; links in the contents open the
  section's page.
- **Left panel:** **← Back** at its top; its own shade (darker in Light, lighter in Dark).
- **Private e-mail only for the sandbox** (instead of step 5): `git config user.email …` *inside* each sandbox clone
  (no `--global`), so company repositories keep the work address.

## 0.14.2 — 3 Nov 2026 — Settings and help with the user guide inside; privacy guard
- **Owner (3 Nov 2026):** steps 1, 3, 4 passed; step 2 → pages (0.14.3); step 5 not possible globally → per-repository command (0.14.3).
- **Owner (3 Nov 2026):** 0.14.1 self-test 21/21 (73.5 s); acceptance runs of 0.14.0 and 0.14.1 passed. 0.14.0 step 2
  and 3 worked with two remarks, 0.14.1 steps 2–3 passed; step 4: put the user guide into the app with a left panel;
  step 5: never again, and remove the work e-mail from the sandbox history (he re-clones). All here:
- **Settings and help:** a left panel with the settings (Environment, Versions, Report a problem, Diagnostics,
  Features, Release self-test, Data self-test) and the **user guide** with one entry per section; links inside the
  guide jump to their section. The guide is the same `docs/USER-GUIDE.md`, built into the app.
- **Report a problem:** the text box is emptied after the report is saved (0.14.0 step 3).
- **Branches turned off:** the branch button's tooltip now says so ("Changes, Pull and Push keep working on the
  current branch") — that is the intended behaviour he saw in 0.14.0 step 2.
- **Privacy:** the sandbox history was rewritten (approved by the owner) — the work e-mail on 17 commits is replaced by
  GitHub's private address; both branches force-pushed once. **Never again:** every build now checks the full history
  of this repository and the sandbox — commit e-mails must be GitHub private / no-reply addresses, files may contain
  only test addresses (`tools/check-privacy.mjs`) — and scans both for secrets (gitleaks).

## 0.14.1 — 3 Nov 2026 — User guide, going back to an earlier version, security check, calmer notes
- **Owner (3 Nov 2026):** self-test 21/21; steps 2, 3 passed; guide "looks great" → into the app (0.14.2); e-mail → removed (0.14.2).
- **Owner (3 Nov 2026):** the CTO approved a pilot with a complete team. Before the rename, four requests — all here:
- **User guide** `docs/USER-GUIDE.md`: a 15-minute quick start first, then every feature, team set-up, the file
  format, a feature specification, troubleshooting. Linked from the README.
- **Go back to an earlier version** — Settings → **Versions** → *Go back to an earlier version…* lists the published
  versions older than this one; *Install version X* downloads it, installs it and reopens ReqMan. Automatic updates
  then **pause** at that version (otherwise it would update itself straight back) until *Resume automatic updates*.
  Works for versions from 0.14.1 on (older ones do not know the pause).
- **Security check before sharing** (`docs/reviews/2026-11-03-security-check.md`): no secrets in either repository
  or their history (gitleaks); no stored tokens; 0 library problems in what ships. Two fixes: the window can no
  longer be navigated to a foreign page (a dropped link); the acceptance run's real push no longer runs for pull
  requests. One decision for the owner: a work e-mail in the sandbox's commit history.
- **Floating Git notes calmer** (the owner: "very glowy"): the background is the theme's own colour again, one shade
  darker in Light and lighter in Dark; the coloured frame and glow stay — green done, red problem, and now **blue for
  "nothing to do"** messages (Already up to date, Nothing to commit/push/discard), which also close by themselves.

## 0.14.0 — 2 Nov 2026 — Health tools and the automatic acceptance run (planning decisions P-40, P-41)
- **Owner (3 Nov 2026):** step 2 worked (asked whether a disabled branch button with Pull/Push still enabled is intended — yes; tooltip added in 0.14.2); step 3 worked (text stayed in the box → emptied in 0.14.2); step 4: acceptance summary seen, passed.
- **Planning (1–2 Nov 2026):** the release plan up to 0.24 is decided (`docs/reviews/2026-11-01-planning-discussion.md`).
  This version brings the tools that keep the project healthy as it grows (the owner's concern, P-40); the new name
  follows in its own version as soon as the owner has chosen it.
- **Feature switches** (P-40a): Settings → **Features** turns Branches, Import or Export off on this PC; a team can turn a
  feature off for one repository with `features: { branches: false }` in `schema.yaml`, and Settings then says so. New
  features will start here as "Preview". File-format changes are never behind a switch.
- **Report a problem** (P-40d): Settings → describe what happened → **Save report…** writes one text file (your
  description, the diagnostics, the last 400 log lines) and shows it in Explorer. Nothing is sent by itself.
- **Coverage floor** (P-40c): `npm run check` now measures how much of the core the tests exercise (88 % of statements
  today) and fails below 85 % statements / 72 % branches / 85 % functions / 88 % lines.
- **Automatic acceptance run** (P-41): on GitHub's Windows machine, for every build and before every release, with the
  *installed* app: install the previous release and let it update itself to the new build (from a local feed), run the
  release self-test, open the 10,000-item sandbox, push one real commit to a scratch branch `ci/acceptance-…` and delete
  it again. The job summary lists, numbered, everything the run did. The owner can now test in batches.
- New end-to-end scenario `health` (switches, team switch, report file); 6 scenarios in all.

## 0.13.1 — 31 Oct 2026 — the owner's points on 0.13.0
- **Owner (31 Oct 2026):** all 4 steps passed; self-test 21/21 in 66.8 s.
- **Owner (31 Oct 2026) on 0.13.0:** all 5 steps passed; self-test 21/21 in 63.6 s. Three points, all here:
  1. The floating Git note was hardly noticed → it is now tinted by its meaning (green success, red problem, blue
     question) with a coloured frame and glow, in Light and Dark; the text is centred in both languages.
  2. The branch delete icon was too small → a red **🗑 Delete** button next to each branch (fills red on hover).
  3. In Arabic, a sentence containing an English word ("ReqMan", "Git") sometimes showed its words in reverse
     order. Cause: tooltips and Windows dialogs guess the direction from the first letter and treated such sentences as
     left-to-right. Every Arabic text now starts with an invisible right-to-left mark, so they always read right to left
     (a unit test checks every text). The translation wording stays as it is for now (the owner).

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

## 0.12.1 — 31 Oct 2026 — The branch drop-down (the owner's points on 0.12.0)
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
  GitHub (the owner's decision 6), and **Compare** = what a branch would bring in, like a pull request on GitHub (merging
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
- **The owner's decisions (29 Oct 2026):** 1 switch with Commit / Discard / Take along (safe only when both branches
  have the same version); 2 merging branches only on GitHub, ReqMan shows the differences; 3 conflicts field by field;
  4 baselines (tags) delayed; 5 two-PC trial with two folders on his PC; 6 "Pull from branch" from any visible
  branch; 7 pull on the same branch resolves per requirement.

## 0.11.1 — 29 Oct 2026 — the owner's requests on 0.11.0
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
- **ReqIF** (DOORS, Jama, Polarion …, merged into this release — the owner, 29 Oct 2026): import through the same wizard
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
- **Fixes (the owner, 0.10.0):** the Changes view's red and green were hardly visible in dark mode (own theme colours
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
- **Column widths** (the owner's request on 0.9.0): drag the edge of a column header; double-click = automatic;
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
- The owner's decisions (28 Oct 2026): release plan 0.8.0 → 0.13.0 confirmed; export of chosen items added to M7;
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
- The owner's decisions (25 Oct 2026): CSV with commas; after M6 → Excel export/import (M7), then branches and
  per-requirement conflict resolution (M8).

## 0.6.0 — 25 Oct 2026 — M5 Compare
- **Compare** button in the Git bar: pulls first (the owner's decision), then shows by default **what the last pull
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
- The owner's decisions (25 Oct 2026): default = since the last pull; pull right before any comparison; exporting the
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
- The owner's decisions (25 Oct 2026): stop on conflicts (resolve per item later), show the branch only (no
  create/switch yet), commit only `requirements/`.
- Development continues in the cloud session; `docs/DEVELOPING.md` describes a local setup, including a
  Node.js option that needs no admin rights.

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
- The owner's 0.3.0 feedback fixed: Type shown in the editor (read-only); Text and Links columns; Columns menu lists
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
- Scrollbars at the right window edge, thumb only (the owner's request after 0.1.0).
- **Owner:** all tests passed except test 6 — could not select a top-level parent and could not move a sub-group
  (the picker only showed the first 8 items by ID). Requested: tree view inside the table (flat only while
  searching) and GUI control to show/hide fields → done in 0.3.0. Also asked for the test-data repository
  Claude_SandBox (10,000 items).

## 0.1.0 — 25 Oct 2026 — M1 Data layer
- Schema, item file format, repository store, SQLite index with full-text search, performance tests, data
  self-test in the app, automatic updates.
- **Owner:** self-test 10k: all queries < 15 ms; 50k: first index 18–73 s (Windows Defender), queries ≤ 105 ms.
  Auto-update tested and working. Asked to align scrollbars to the window's right edge and show only the thumb.
  Making the repository private broke auto-update (404) → the owner chose to keep it public.

## 0.0.4 — 25 Oct 2026
- Brighter light-mode success green (`#22c55e`) — the owner feedback on 0.0.3 test step 4.
- `%APPDATA%\ReqMan\theme.json` now starts as an override-only file (a full copy froze every value).
- Zipped installer in each release (Chrome blocked the .exe download for the owner).

## 0.0.3 — 25 Oct 2026
- Automatic updates from GitHub Releases; user theme file survives updates.

## 0.0.2 — 25 Oct 2026
- Log file with rotation, diagnostics panel (copy diagnostics, open log folder), first manual test checklist.

## 0.0.1 — 25 Oct 2026 — M0 Foundations
- Electron + TypeScript + React skeleton, module boundaries enforced by lint, composition root, theme file with
  light/dark/system, Git check, Windows installer (per-user NSIS) built by GitHub Actions.
