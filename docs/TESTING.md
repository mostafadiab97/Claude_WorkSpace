# Testing reqochet-dev

Three kinds of checks protect each version:

1. **Automated checks** run on a Windows machine on GitHub for every push: type checking, lint rules
   (including the module-boundary rules), about 400 unit tests (real Git with a fake "GitHub", the sandbox's
   broken files, …), performance tests, and end-to-end scenarios that click through the real app. A build that
   fails any of them produces no installer. To see them: repository → **Actions** → latest **Build** run.
2. **The release self-test** (from 0.8.0) — on *your* PC, inside reqochet-dev: **⚙ Settings & diagnostics → Run
   release self-test**. It does the main actions on a practice repository in a temporary folder (never your
   data) and shows ✓/✗ per step. It checks what only your PC has: your Git, Windows Defender, your disk.
3. **A short manual checklist** — at most 5 steps per version (the owner's rule, 28 Oct 2026): the update
   arrives, the self-test passes, the sandbox opens, one real push when the Git parts changed, and a quick look
   at what is new.

## Automated checks in detail (moved from `CLAUDE.md`, 1 Nov 2026)

Automated tests: 192 unit tests (+2 perf skipped by default) including real-Git tests with a bare "GitHub"
repository and two clones ("PC A", "PC B"), the release self-test itself, the sandbox's chapter-9 promises
(`tests/sandbox-expectations.test.ts`) and window logic (`tests/ui/`); e2e scenarios: `language` (Arabic switch, right-to-left, unsaved edit kept, restart), `branches` (create, switch by clicking the name, pull from a branch → uncommitted, delete, Compare with… / Pull from…, the uncommitted-changes question, 41 branches: panel size, search, Esc), `excel` (new project from the sample file, chosen-items export, update the file, ReqIF round trip,
publish), `journey` (~75 checks, the
whole user story, incl. the Changes view, ↶, Keep/Unlink window, push offer) and `fixes` (renamed file, lazy Expand all,
column width drag, Changes view layout + split difference, second start, release self-test in the window).
0.8.0 measurements (10k scenario repo, Linux): refresh after a save 0.37 → 0.09 s; Expand all first screen 0.26 s.
Compare on the sandbox: 9,118 changed files (confirmations only) 0.4 s; 3,000 real edits 1.8 s (engine).
Export of all 10,005 sandbox items: CSV 0.46 s (3.1 MB), Markdown 0.43 s. CI runs `measure:ui` on a generated 10k repo.
Measured on the sandbox (10,005 items, Linux container): open incl. first indexing 5–8 s, expand all 0.4–0.6 s,
scroll to bottom 65 ms, suspect filter 0.3 s. The owner's PC: 10k queries < 15 ms; 50k first index 18–73 s (Defender).

## Where things are on Windows

| What | Location |
| --- | --- |
| Installed app | `%LOCALAPPDATA%\Programs\reqochet-dev\` |
| Your theme file (survives updates) | `%APPDATA%\reqochet-dev\theme.json` — created by **Edit my theme…** |
| App's built-in theme (replaced by updates — don't edit) | `%LOCALAPPDATA%\Programs\reqochet-dev\resources\config\theme.json` |
| Log file | `%APPDATA%\reqochet-dev\logs\reqochet.log` (older entries in `reqochet.old.log`) |

Paste a location into the Explorer address bar to open it. The app's **Diagnostics** panel also shows
the paths and has buttons to open them.

## Reporting a problem

From 0.14.0: **⚙ → Report a problem** — describe what happened and click **Save report…**; send the saved text file
(it holds your description, the diagnostics and the end of the log). Before 0.14.0: **Copy diagnostics**, attach
`reqochet.log` (**Open log folder**) and describe what you did, expected and saw.

## Getting a version to test

Each tested version is published on the repository's **Releases** page
(`https://github.com/<owner>/Claude_WorkSpace/releases`). Download `reqochet-dev-Setup-<version>.exe` from
the release's **Assets** and run it — there is no zip and no GitHub sign-in needed. From v0.0.3 onwards,
an installed ReqMan also finds newer releases by itself and offers **Restart and update**.

### If the browser blocks the download

ReqMan is not yet code-signed (signing certificates cost money and are planned for the commercial version),
so browsers treat the installer as unknown:

- **Chrome:** press **Ctrl+J** to open Downloads, find `ReqMan-Setup-….exe`, click **Download suspicious file**
  (or **⋮ → Keep**), then **Download anyway**.
- **Edge:** open Downloads (**Ctrl+J**), hover the file, **⋯ → Keep**, then **Show more → Keep anyway**.
- From v0.0.4, each release also has a **.zip** of the installer, which browsers block less often:
  download it, right-click → **Extract All**, run the `.exe`.
- If there is no "keep" option at all, your company manages the browser: ask IT to allow downloads from
  `github.com/<owner>/Claude_WorkSpace/releases`.

After the download, Windows SmartScreen may also warn when you run it: **More info → Run anyway**.

## Manual test checklist — v0.18.0 (baselines and the history list)

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.18.0** (or install it from the Releases page), then **⚙ → Self-tests → Run release self-test**. | **All 24 steps passed** (new: "Baseline: make one, read the old version, push it"). |
| 2 | In the sandbox: **Versions → New baseline…**, name `SRS-0.1`, a note, **Make baseline**; then **Push**. | The baseline is listed with *not pushed yet* and Push is highlighted; after the push the label is gone (on GitHub it shows under Tags as `baseline/SRS-0.1`). |
| 3 | **Versions → History** tab: search a word of an older commit message; on that commit try **Open read-only**, then **Compare with now**. | The old version shows the items as they were (nothing can be changed); Compare opens Changes with that version against now. |
| 4 | Copy one requirement file by hand into another document folder; switch to that document; **Problems → Give the copy a new ID**. Then make a test document, add an item and **Changes → Discard all**. | The copy shows at the top of its document and gets a new ID; after Discard all the test document is gone from the list. |
| 5 | Look at the top bars, the privacy page (**⚙ → Privacy and access**, click the diagram) and the icons. | Slimmer bars; the diagram (GitHub on top, Git on the right) opens full size; the top-bar logo has no grey outline, the desktop/taskbar icon has it. |

## Previous checklist — v0.17.2 (document groups, column drag, privacy page, guide pictures)

Owner 8 Nov: all 5 passed (with points → 0.18.0).

First discard your 0.17.0 test changes in the sandbox (**Changes → Discard all**), as agreed.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.17.2**, then **⚙ → Self-tests → Run release self-test**. Look at the taskbar and the desktop icon. | **All 23 steps passed**. Desktop/Start icon: light tile with a grey outline (Windows may show the old one until a restart — its icon cache). Taskbar: follows Windows (dark taskbar → dark tile). |
| 2 | In the sandbox make a second document (**New document…**), add an item, then choose **All documents**; click a group row. | One group row per document with its item count; a click folds and unfolds it. |
| 3 | Drag a column header (e.g. **Status**) onto another; then open **Columns**. | The column moves where the line showed; the menu shows the same order, names left-aligned, Title listed first. |
| 4 | Turn on a filter. | An orange **Clear filters** button appears next to Filters; it shows all items again. |
| 5 | **⚙ → Privacy and access**, then **User guide → 2. Ideas you need to know** (and 6, 8). | The privacy page lists what is read, kept, sent and changed; the guide pages show pictures in the window's colours (try Dark too). |

## Two-PC trial (prototype journey, with a colleague)

The prototype's goal: two engineers replace an Excel sheet with ReqMan and find the comparison better than GitHub's
diffs. Use a real project repository (or a new one on GitHub) that both of you can push to.

1. **You:** open the cloned repository in ReqMan → **Create requirements folder**.
2. **You:** create a few stakeholder needs, system requirements and test cases; arrange them (drag rows), link them
   (refines, verifies).
3. **You:** filter (e.g. System Requirement + Status Draft); open an item and look at its links.
4. **You:** **Changes → Commit**, then **Push**.
5. **Colleague:** clones the repository, opens it in ReqMan, edits two requirements, adds a link, commits, pushes.
6. **You:** **Compare** (it pulls first) — it lists "<ID> Text…", "1 link added" rather than file lines.
7. **You:** open one of the changed requirements → **History**: who changed it and when.
8. **You:** **Export…** → CSV, open it in Excel and send it to someone outside the repository.

Tell me: did each step work without help? Was Compare clearer than GitHub's diff of the same commit?

## Older checklists

Every earlier checklist (v0.0.3 – v0.12.1) is kept in `docs/testing/past-checklists.md`.
