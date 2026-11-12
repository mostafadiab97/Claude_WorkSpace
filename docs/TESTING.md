# Testing reqochet-dev

Three kinds of checks protect each version:

1. **Automated checks** run on a Windows machine on GitHub for every push: type checking, lint rules
   (including the module-boundary rules), about 690 unit tests (real Git with a fake "GitHub", the sandbox's
   broken files, …), performance tests, and end-to-end scenarios that click through the real app. A build that
   fails any of them produces no installer. To see them: repository → **Actions** → latest **Build** run.
2. **The release self-test** (from 0.8.0) — on *your* PC, inside reqochet-dev: **⚙ Settings & diagnostics → Run
   release self-test**. It does the main actions on a practice repository in a temporary folder (never your
   data) and shows ✓/✗ per step. It checks what only your PC has: your Git, Windows Defender, your disk.
3. **A short manual checklist** — at most 5 steps per version (the owner's rule, 28 Oct 2026): the update
   arrives, the self-test passes, the sandbox opens, one real push when the Git parts changed, and a quick look
   at what is new.

## Automated checks in detail (moved from `CLAUDE.md`, 1 Nov 2026)

Automated tests: about 690 unit tests in 77 files (the speed tests are skipped by default; the count of the last release is in `docs/STATUS.md`) including real-Git tests with a bare "GitHub"
repository and two clones ("PC A", "PC B"), the release self-test itself, the sandbox's chapter-9 promises
(`tests/sandbox-expectations.test.ts`) and window logic (`tests/ui/`); 14 e2e scenarios (`e2e/scenarios/*.e2e.mjs`), among them `language` (Arabic switch, right-to-left, unsaved edit kept, restart), `branches` (create, switch by clicking the name, pull from a branch → uncommitted, delete, Compare with… / Pull from…, the uncommitted-changes question, 41 branches: panel size, search, Esc), `excel` (new project from the sample file, chosen-items export, update the file, ReqIF round trip,
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
an installed reqochet-dev also finds newer releases by itself and offers **Restart and update**.

### If the browser blocks the download

reqochet-dev is not yet code-signed (signing certificates cost money and are planned for the commercial version),
so browsers treat the installer as unknown:

- **Chrome:** press **Ctrl+J** to open Downloads, find `reqochet-dev-Setup-….exe`, click **Download suspicious file**
  (or **⋮ → Keep**), then **Download anyway**.
- **Edge:** open Downloads (**Ctrl+J**), hover the file, **⋯ → Keep**, then **Show more → Keep anyway**.
- From v0.0.4, each release also has a **.zip** of the installer, which browsers block less often:
  download it, right-click → **Extract All**, run the `.exe`.
- If there is no "keep" option at all, your company manages the browser: ask IT to allow downloads from
  `github.com/<owner>/Claude_WorkSpace/releases`.

After the download, Windows SmartScreen may also warn when you run it: **More info → Run anyway**.

## Manual test checklist — v0.21.3 (speed, screens, Arabic, Merge into…)

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.21.3**, then **⚙ → Self-tests → Run release self-test**. | **All 25 steps passed.** |
| 2 | In the sandbox, **Versions** → open an old commit you have not opened before; while it loads, move the window or hover a button. | The window keeps reacting while the message "Opening the old version…" shows. |
| 3 | Make two documents (e.g. *Merge A* and *Merge B*), add an item to *Merge A*, copy its file by hand into *Merge B*'s folder, then pick *Merge A* and click **Merge into…** → *Merge B* → **Merge**. | "*Merge A* was merged into *Merge B*"; the item is once in *Merge B*, *Merge A* is gone. (Delete *Merge B* afterwards if you like.) |
| 4 | Open an item, click its **Details** tab, press **Tab** and **Shift+Tab**. | Tab jumps from the tab row to the next control in one step; the arrows still move between tabs. |
| 5 | Switch to **Arabic**: open **Traceability → Matrix**. | Arrows in the cells point the Arabic way (← for "the row links to it"), matching the legend. |

## Previous checklist — v0.21.2 (data and import safety)

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.21.2**, then **⚙ → Self-tests → Run release self-test**. | **All 25 steps passed.** |
| 2 | In the sandbox folder, copy one item file (`REQ-….md`) by hand into another document's folder, then click reqochet's window. Select the item and try **Delete**. | Delete is refused with "… is in 2 files … Give the copy a new ID"; the original file is still there. Then **Problems → Give the copy a new ID** fixes it (delete the copy afterwards if you like). |
| 3 | Import `samples/sample-requirements.xlsx` (or any of your Excel sheets) as before. | Works as before. |

## Two-PC trial (prototype journey, with a colleague)

The prototype's goal: two engineers replace an Excel sheet with reqochet and find the comparison better than GitHub's
diffs. Use a real project repository (or a new one on GitHub) that both of you can push to.

1. **You:** open the cloned repository in reqochet → **Create requirements folder**.
2. **You:** create a few stakeholder needs, system requirements and test cases; arrange them (drag rows), link them
   (refines, verifies).
3. **You:** filter (e.g. System Requirement + Status Draft); open an item and look at its links.
4. **You:** **Changes → Commit**, then **Push**.
5. **Colleague:** clones the repository, opens it in reqochet, edits two requirements, adds a link, commits, pushes.
6. **You:** **Compare** (it pulls first) — it lists "<ID> Text…", "1 link added" rather than file lines.
7. **You:** open one of the changed requirements → **History**: who changed it and when.
8. **You:** **Export…** → CSV, open it in Excel and send it to someone outside the repository.

Tell me: did each step work without help? Was Compare clearer than GitHub's diff of the same commit?

## Older checklists

Every earlier checklist (v0.0.3 – v0.12.1) is kept in `docs/testing/past-checklists.md`.
