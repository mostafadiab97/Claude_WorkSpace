# Testing ReqMan

Three kinds of checks protect each version:

1. **Automated checks** run on a Windows machine on GitHub for every push: type checking, lint rules
   (including the module-boundary rules), about 130 unit tests (real Git with a fake "GitHub", the sandbox's
   broken files, …), performance tests, and end-to-end scenarios that click through the real app. A build that
   fails any of them produces no installer. To see them: repository → **Actions** → latest **Build** run.
2. **The release self-test** (from 0.8.0) — on *your* PC, inside ReqMan: **⚙ Settings & diagnostics → Run
   release self-test**. It does the main actions on a practice repository in a temporary folder (never your
   data) and shows ✓/✗ per step. It checks what only your PC has: your Git, Windows Defender, your disk.
3. **A short manual checklist** — at most 5 steps per version (owner's rule, 28 Oct 2026): the update
   arrives, the self-test passes, the sandbox opens, one real push when the Git parts changed, and a quick look
   at what is new.

## Where things are on Windows

| What | Location |
| --- | --- |
| Installed app | `%LOCALAPPDATA%\Programs\ReqMan\` |
| Your theme file (survives updates) | `%APPDATA%\ReqMan\theme.json` — created by **Edit my theme…** |
| App's built-in theme (replaced by updates — don't edit) | `%LOCALAPPDATA%\Programs\ReqMan\resources\config\theme.json` |
| Log file | `%APPDATA%\ReqMan\logs\reqman.log` (older entries in `reqman.old.log`) |

Paste a location into the Explorer address bar to open it. The app's **Diagnostics** panel also shows
the paths and has buttons to open them.

## Reporting a problem

1. In ReqMan, click **Copy diagnostics** and paste the text into your report.
2. Click **Open log folder** and attach `reqman.log`.
3. Describe what you did, what you expected and what happened (a screenshot helps).

## Getting a version to test

Each tested version is published on the repository's **Releases** page
(`https://github.com/mostafadiab97/Claude_WorkSpace/releases`). Download `ReqMan-Setup-<version>.exe` from
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
  `github.com/mostafadiab97/Claude_WorkSpace/releases`.

After the download, Windows SmartScreen may also warn when you run it: **More info → Run anyway**.

## Manual test checklist — v0.11.1 (your requests on 0.11.0)

Small release with the five things you asked for after 0.11.0. Report by step number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Update to **0.11.1**, then **⚙ → Run release self-test**. | App shows 0.11.1; **All steps passed**, 20 ✓. |
| 2 | **Close repository → New project from a file…**, choose the sample file, then on purpose a folder that **has files** in it. | A message "This folder is not empty" with **Choose another folder…** — the folder dialog opens again; pick an empty one and the wizard continues as before (Cancel there stops). |
| 3 | In the sandbox (**Expand all**): **Ctrl+click** three requirements of different sections, then drag **one of them** onto another chapter. While dragging, move the pointer to the bottom edge of the table. | The table scrolls while the pointer is near its bottom (or top) edge. After the drop **all three** sit under that chapter, in their old order, each with its children; they stay chosen. |
| 4 | Right-click one of the chosen items, then right-click an item that is **not** chosen. | Chosen item: one entry, **Export the 3 chosen items and everything below them…**. Other item: one entry, **Export this item and everything below it…**. |
| 5 | Open **Changes**: tick two items → **Discard 2 chosen** (confirm). Then **Discard all changes** (confirm). | First only the two ticked items go back, then everything; the list says "No uncommitted changes". |

## Previous checklist — v0.11.0 (Excel and ReqIF)

0.11.0 brings Excel and ReqIF: import with a wizard, export of everything or of chosen items, writing changes
back into the Excel file you imported, starting a project from a file, and publishing to GitHub. It also fixes the
two things you found in 0.10.0. For steps 3–5 download the sample file:
https://github.com/mostafadiab97/Claude_WorkSpace/raw/main/samples/sample-requirements.xlsx (or use an Excel file of
your own). Report by step number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Update to **0.11.0**. Switch to **Dark**, open the sandbox, change one word of a requirement's text, **Save**, open **Changes**. Then keep one suspect link (any item with ⚠: **Keep**) and look at **Changes (n)** again. | Old text clearly red, new clearly green. The number on the Changes button always matches the list — a kept link shows as "Link review only". Discard both afterwards. |
| 2 | **⚙ → Run release self-test**. | **All steps passed**, now **20** ✓ (new: Excel export of a chosen chapter, Import from Excel, ReqIF export and import). |
| 3 | **Close repository** → **New project from a file…** → choose the sample file → choose (or create) an **empty** folder. Click through the three steps (Next, Next) and **Import 59 items and commit**. | The wizard guesses every column (ID, Type, Title, Description → Text, Status …, "Verified By" → *verified by* links). The table shows 59 items with the hierarchy; the Git bar shows one commit and offers **Publish to GitHub…**. |
| 4 | In that project: **Ctrl+click** two items, **right-click** one → **Export the 2 chosen items…** → Excel → Export. Open the file in Excel. Then **Export… → ReqIF** once. | The Excel file has both items with everything below them, the **No.** column, titles indented, and +/− buttons on the left to fold the hierarchy. The .reqif file is written (DOORS / Jama can read it). |
| 5 | Change the **Status** of one item, **Save**. **Export…** → **Update sample-requirements.xlsx**. Open the Excel file. Then **Import…** the same file again (Next). | Only that one cell changed in the file; the formatting is as before, and a copy "sample-requirements (before ReqMan update …).xlsx" lies next to it. The import shows **59 unchanged**. |

## Previous checklist — v0.10.0 (Changes view)

0.10.0 joins **Changes** and **Compare** into one **Changes** view with a GitHub-style side-by-side difference,
asks about links when you change an item others link to, never pulls by itself, and lets you drag column widths.
Report by step number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Start ReqMan (0.9.0). Wait for **Restart and update**, click it. | ⚙ → Environment → App shows **0.10.0**. |
| 2 | **⚙ Settings & diagnostics → Run release self-test**. | **All steps passed**, now **18** ✓ (new: "Changes view: take back one part of a change"). If anything shows ✗: **Copy report**. |
| 3 | Open the sandbox. Drag the right edge of the **No.** column header to the right, then double-click it. | The column gets wider while you drag and stays so (also after restarting ReqMan); double-click returns it to the automatic width. |
| 4 | Open a requirement that others link to (Links column shows ←), change one word of its **Text** and a **Status**, **Save**. In the window that opens, press **Keep** on one row, **Apply my 1 choice**. Then click **Changes** in the Git bar. | The window lists the items linking to it. After applying, the kept link has no ⚠, the others still do. Changes opens on **Uncommitted changes** in the middle; below the list the item shows old (red, left) and new (green, right) with the changed word marked. Click **↶** next to Status: only Status goes back. Then **Discard this item's changes**. |
| 5 | In Changes choose **Show → What the last pull brought in**. Answer **Pull first**. Later click **Push** in the Git bar. | ReqMan asks before pulling (no pull happens by itself). Push asks "Pull first, then push" / "Push without pulling" — choose **Pull first, then push**: both run (or say there is nothing to push). |

## Previous checklist — v0.9.0 (new data format)

0.9.0 changes how items are stored: every ID is now `REQ-` + 7 characters, the type can be changed, and the
outline number (1, 1.2, 2.3.1 …) is calculated by ReqMan instead of typed into titles. The `Claude_SandBox`
repository has been converted to the new format — **update ReqMan first, then pull the sandbox.** Report by step
number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Start ReqMan (0.8.0). Wait for **Restart and update**, click it. Then in your `Claude_SandBox` clone run `git pull` (if it refuses because of your test edits: `git reset --hard origin/main`). | App shows **0.9.0** (⚙ → Environment → App). The pull brings in two commits "Convert to ReqMan 0.9.0 (1/2)" and "(2/2)". |
| 2 | **⚙ Settings & diagnostics → Run release self-test**. | **All steps passed**, 17 ✓. If anything shows ✗: **Copy report** and paste it into your message. |
| 3 | Open the sandbox. Look at the table, then open any requirement. Change its **Type** in the editor and **Save**. | A **No.** column next to ID shows 1, 1.1, 2.3.1 …; heading titles no longer start with a typed number. Every ID starts with `REQ-`. The editor header shows the number before the ID. After the type change the ID stays the same. |
| 4 | Drag a requirement under another chapter (or use the parent picker). Then **Compare** → *Uncommitted changes*. | Its number changes at once (e.g. 3.2.4 → 5.1), and so do the numbers of the items after its old place. Compare lists the item as **moved** with "3.2.4 → 5.1". Only **one** file is changed (Changes panel). |
| 5 | Commit the move, **Push**. Then **Compare** → *since my last pull*. | The push works. Compare after the step-1 pull shows the items as **changed** (not deleted + added) and the numbers before and after are equal. |

## Previous checklist — v0.8.0 (clean-up release)

Almost nothing new to see: 0.8.0 fixes everything the project review found and makes ReqMan faster and
sturdier. Report by step number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Start ReqMan (0.7.0). Wait for **Restart and update**, click it. Then **⚙** → Environment → App. | ReqMan restarts; App shows **0.8.0**. |
| 2 | **⚙ Settings & diagnostics → Run release self-test**. Wait about a minute. | **All steps passed** and a list of 17 steps, each with ✓. If anything shows ✗: **Copy report** and paste it into your message. |
| 3 | Open your `Claude_SandBox` clone. Click **… problems ▸** in the status bar. Find the line *"RSK-…: The file items/RSK-RENAMD.md holds RSK-…"*. Click the line, then **Fix file name**. Then open **Changes** and **Discard** both lines it shows (the old and the new file name). | Clicking the line opens the risk normally (before 0.8.0 it said "could not be read"). **Fix file name** makes the problem disappear. Discard puts the sandbox back as it was. |
| 4 | Speed: in the sandbox, **Expand all**, then drag the scrollbar to the bottom. Edit any item's title, **Save**. Switch to another program and back (Alt+Tab). | Expand all is instant; while scrolling, a few rows briefly say "Loading…". Saving and coming back to the window cause no noticeable pause. |
| 5 | While ReqMan is open, start it again from the Start menu. | No second ReqMan opens; the open window comes to the front. |

## Previous checklist — v0.7.0 (covers everything since 0.4.1: Git, Compare, Export)

One pass tests versions 0.5.0, 0.6.0 and 0.7.0 together. Use your `Claude_SandBox` clone (`git pull` there first) and
GitHub's website as "the colleague" (open a file under `requirements/items/` → pencil icon → **Commit changes**).
Report by step number.

**Git (0.5.0)**

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Update to 0.7.0, open the sandbox clone | Git bar above the table: `⎇ main  ↑0 ↓0` and **Compare**, **Changes**, **Pull**, **Push** |
| 2 | Edit an item's title, Save, click **Changes** | The panel lists the item with **M**; "As <your name> <e-mail>" (if Git doesn't know you, a form asks once) |
| 3 | Put a file `test.txt` in the sandbox folder. Write a message → **Commit 1 change** | "Committed 1 change."; `↑1`. `test.txt` is not committed (`git status` still lists it) |
| 4 | **Push** | "Pushed."; on GitHub the commit shows your message and only `requirements/` files |
| 5 | As the colleague: change the text of another item on GitHub. In ReqMan **Pull** | "Pulled: 1 item changed."; the table shows the new text |
| 6 | Open that item → **History** tab | The colleague's commit first (name, date, message); **What changed** shows the text before (struck) / after |
| 7 | Edit any item, Save → History | First entry "Not committed yet" with your change |
| 8 | **Changes → Discard → Undo change** | Back to the committed version in table and editor |
| 9 | Conflict: change the same item on GitHub and in ReqMan, commit in ReqMan, **Pull** | Red "Pull stopped — nothing was changed…" naming the item (clickable); your folder unchanged |
| 10 | **Push** | "…Pull first…" — never forced |
| 11 | **Changes → Undo last commit → Undo commit**, then **Discard → Undo change** on the item, then **Pull** | "Took back…", "Discarded…", "Pulled: 1 item changed." — the colleague's version is there |
| 12 | Type in an item without saving | **Pull** disabled ("Save or discard your edit first") |
| 13 | Wi-Fi off → **Pull** | "The remote repository could not be reached…"; everything else works |

**Compare (0.6.0)**

| # | Do this | Expected result |
| --- | --- | --- |
| 14 | As the colleague: change the text of one item and the status of another on GitHub. Click **Compare** | "Pulled first: 2 items changed." and **What the last pull brought in** lists exactly those two ("Text", "Status") |
| 15 | Click one | Right side: field table (before struck, after bold), text before/after; a warning if other items link to it |
| 16 | **Open the item** | Compare closes, the item is open, the table as you left it |
| 17 | **Compare** again (nothing new on GitHub) | "Pulled first: Already up to date."; the list still shows what the *last* pull brought in |
| 18 | Edit + save an item, drag another to a new parent; **Compare → Uncommitted changes** | Your edit as **Changed**, the dragged one as **Moved** ("Parent, Position") |
| 19 | **Choose two versions…**: From "Add fictional 10,005-item requirements set…", To "Record link confirmations…" | Finishes within a few seconds; only items with visible changes (re-confirmed links alone don't count) |
| 20 | Chips (**Changed**, …) and the filter box; **Links** tab | Filters the list; the Links tab lists links added/removed |

**Export (0.7.0)**

| # | Do this | Expected result |
| --- | --- | --- |
| 21 | **Export…** (table toolbar) → All items, CSV → **Export…** → save | "Exported 10,005 items to … — Show in folder". Double-click the file: Excel opens it in columns (comma), Arabic text and `°`/`±` look right, multi-line texts stay in one cell |
| 22 | In Excel: columns ID, Level, Title, the table's visible columns, Parent, Text, Links, Linked from; rows in document order (chapter, then its children) | — |
| 23 | Hide a column (**Columns**), set a filter (e.g. Status = Approved), **Export…** → "Only the … items of the current search / filters" | The file has only those rows and not the hidden column |
| 24 | **Export…** → Markdown | A readable document: one heading per item (levels follow the hierarchy), fields, text, links |
| 25 | In **Compare**: **Export CSV** and **Export Markdown** | CSV: one row per changed item plus one per change (field, before, after); Markdown: a report with tables and quoted texts |
| 26 | Export while the CSV is open in Excel (same file name) | "The file is open in another program (e.g. Excel)…" — nothing crashes |

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

## Previous checklist — v0.6.0 (milestone M5: Compare)

Same setup as for v0.5.0: your `Claude_SandBox` clone, and GitHub's website (or a second clone) as "the colleague".

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Update to 0.6.0, open the sandbox clone | The Git bar has a new **Compare** button |
| 2 | As the colleague: change the text of one item and the status of another on GitHub | — |
| 3 | Click **Compare** | ReqMan **pulls first** ("Pulled first: 2 items changed."), then shows **What the last pull brought in** with exactly those two items, e.g. "SYS-… Text" and "SW-… Status" |
| 4 | Click one of them | On the right: what changed — the field table (before struck through, after in bold) and the text before/after. A warning if other items link to it (those links became suspect) |
| 5 | **Open the item** | Compare closes; the item is open in the editor, the table as you left it |
| 6 | Click **Compare** again without new changes on GitHub | "Pulled first: Already up to date." — the list still shows what the *last* pull brought in |
| 7 | Edit and save an item (don't commit), **Compare** → choose **Uncommitted changes** | Lists your saved change. (Pull is skipped while the editor has unsaved typing — it says so) |
| 8 | Choose **Choose two versions…**: From = an older commit (the list shows message, author and date), To = **Your working folder** | All items changed since then, with counts: Added / Changed / Moved / Deleted, and Links +/− |
| 9 | Click the **Changed** chip, then type part of an ID in the filter | Only changed items, then only the matching ones |
| 10 | **Links** tab | Links added/removed in that range, e.g. "+ TC-… verifies SYS-… — added"; clicking the ID opens its change |
| 11 | In the editor, drag an item to another parent, save; compare uncommitted changes | It appears as **Moved** ("Parent, Position") |
| 12 | Change a field in **Columns → Edit fields…**, compare uncommitted changes | "Schema changed" chip and a line saying which fields were added/removed |
| 13 | **Choose two versions…**: From = "Add fictional 10,005-item requirements set…", To = "Record link confirmations…" (9,118 changed files) | Finishes in a few seconds; only items with visible changes are listed (re-confirming links alone is not a change) |
| 14 | **Pull and refresh** inside Compare after another change on GitHub | Pulls and shows the new "last pull" result |

## Previous checklist — v0.5.0 (milestone M4: Git)

You need a repository on GitHub you may push to — the sandbox is ideal: your `Claude_SandBox` clone (run
`git pull` there first). To play "the colleague", either edit a file on GitHub's website (open
`requirements/items/<ID>.md` → pencil icon → Commit changes) or make a second clone in another folder and open it in
ReqMan with **Close repository → Open repository…**.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Update to 0.5.0 and open the sandbox clone | A Git bar above the table: `⎇ main  ↑0 ↓0`, buttons **Changes**, **Pull**, **Push** |
| 2 | Edit an item's title, Save | **Changes (1)** |
| 3 | Click **Changes** | The panel (in place of the editor) lists the item with **M** (changed). "As <your name> <e-mail>" — if Git doesn't know you yet, a small form asks once for name and e-mail |
| 4 | Write a commit message → **Commit 1 change** | "Committed 1 change." Changes is empty; the bar shows `↑1` |
| 5 | Put any file outside `requirements/` into the repository folder (e.g. `test.txt`), change an item, commit | Only the item is committed — `git status` still shows `test.txt` as untracked |
| 6 | **Push** | "Pushed." `↑0`. On GitHub the commit shows up with your message and only `requirements/` files |
| 7 | As the colleague: change the **text** of another item on GitHub (or in the second clone + Push) | — |
| 8 | **Pull** in ReqMan | "Pulled: 1 item changed." The table shows the new text without reopening anything |
| 9 | Open that item → **History** tab | The colleague's commit first (name, date, message), then older ones. Selecting it shows **What changed**: a field table and the text before (struck through) / after |
| 10 | Edit the item, Save, look at History again | A first entry "Not committed yet" comparing your saved version with the last commit |
| 11 | **Changes → Discard → Undo change** on that item | Back to the last committed version, in the table and editor |
| 12 | Conflict: change the **same** item on GitHub and in ReqMan; commit in ReqMan; **Pull** | Red message "Pull stopped — nothing was changed…" naming the item (click opens it). Nothing in your folder changed |
| 13 | **Push** now | "The remote has changes you do not have yet. Pull first…" — never forced |
| 14 | Take the colleague's version: **Changes → Undo last commit → Undo commit**, then **Discard → Undo change** on the item, then **Pull** | "Took back…", "Discarded…", then "Pulled: 1 item changed."; the item shows the colleague's version |
| 15 | Start typing in an item without saving | **Pull** is disabled ("Save or discard your edit first") |
| 16 | Unplug the network / Wi-Fi off, click **Pull** | "The remote repository could not be reached…" — everything else keeps working |
| 17 | Open a folder that is not a Git repository | The Git bar says it is not a Git repository; nothing else changes |

## Previous checklist — v0.4.0 (milestone M3: links)

Use the sandbox data again: `git pull` in your `Claude_SandBox` clone (or `git reset --hard origin/main`). The update
adds a confirmation to every link and makes 175 of them *suspect*, so there is something to review.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Open any item | The editor shows its **Type** (greyed: it is fixed once the item exists) |
| 2 | Look at the table; open **Columns ▾** | **Links** and **Text** columns (Links like `→2 ←3`, Text = first line of the text). The menu lists Type, Links, every field and Text, each marked built in or not; ↑/↓ change the column order; **Reset** restores the default |
| 3 | **Columns ▾ → Edit fields…**: if you added fields called "Text" or "Links" in 0.3.0, they are marked as built in — remove them, Save | The note "is a built-in field of every item" disappears; adding a field named Text/Links/Type/Title/Parent/ID is refused |
| 4 | Open a test case → **+ Add link** → *verifies* → search for a requirement → pick it | The link appears under "verifies"; the test case file gets `- type: verifies / target: … / confirmed: …` |
| 5 | Click the linked requirement's ID in the list | The requirement opens and shows "verified by" the test case. Its Links column shows `←1` (or more) |
| 6 | In the requirement, **+ Add link** → *refined by* (under "This item is…") → pick another item | The link shows as "refined by …"; it is stored in the **other** item's file (`refines`) — check with `git diff` |
| 7 | Change the requirement's text, Save | The test case's link becomes suspect: in the test case "⚠ changed" + **Confirm**; in the requirement "⚠ this item changed" |
| 8 | **Links: With suspect links** filter | Lists the items whose links need review (the sandbox has 175 such links; the "Hub requirement" in chapter 8 has 12) |
| 9 | Click **Confirm** on a suspect link (or **Confirm all N suspect**) | The ⚠ disappears; the item drops out of the suspect filter; only `confirmed:` changed in its file |
| 10 | Change only the requirement's Status, Save | Links do **not** become suspect (only type, title and text count) |
| 11 | Remove a link with **✕** (try one in each direction) | It disappears from both items; the file that stored it no longer has it |
| 12 | Edit an item without saving | **+ Add link**, ✕ and Confirm are locked: "Save or discard your changes before changing links." New unsaved items: "Save the item first" |
| 13 | Delete an item that other items link to | The confirmation offers "Also remove the N link(s) other items have to it" (ticked). Afterwards the status bar shows no new broken-link problems |
| 14 | **Links: Without any links** | Items with no links in or out — e.g. requirements nobody verifies yet |
| 15 | Sort by the **Links** header | Most-linked items first (descending) |

## Previous checklist — v0.3.0 (M2 feedback)

Best tried on the sandbox data (`Claude_SandBox`, 10,005 items): `git pull` or `git reset --hard origin/main` there
first, so you start from the original data.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let ReqMan update itself to 0.3.0, open the sandbox repository | No side tree any more: the table itself shows the hierarchy — the chapters at the top level, ▸ to open one; a small number next to a closed item tells how many children it has |
| 2 | Open a chapter, then a system requirement inside it (▸ or → key); ← closes / goes to the parent | Children appear indented under their parent, in document order |
| 3 | **Expand all**, scroll to the bottom; **Collapse all** | All 10,005 rows within a second or so; scrolling stays smooth; Collapse all shows only the chapters |
| 4 | Type in **Search** (e.g. "encrypt") or pick a filter | Flat list of matches, best matches first, with a line "Search results — …" above the table. **Clear filters** brings the hierarchy back, opened down to the item you had selected |
| 5 | Click the **Title** header three times | Sorted A→Z within each parent, then Z→A, then back to document order |
| 6 | *(Test 6 again)* Open any item, click **Parent** without typing | The top-level items (chapters) are listed — pick one, Save: the item (with everything below it) is now directly under that chapter |
| 7 | In the parent picker type part of a heading's title, e.g. "verification" | Headings whose title matches come first; the item itself and its own children are greyed out (choosing them would create a loop) |
| 8 | Drag a row that has children onto another row (the row gets a blue outline) | It moves under that row, with all its children; the file of the dragged item gets the new `parent:`, the children's files are unchanged |
| 9 | Drag a row onto the upper or lower edge of another row (blue line) | It is placed before / after that row, at that row's level |
| 10 | Drag a row onto the empty space below the last row (collapse all first) | It becomes a top-level item, placed last |
| 11 | Hover a dragged row over a closed parent for a moment | The parent opens, so you can drop deeper |
| 12 | Edit a title without saving, then try to drag that same item | Refused with "Save or discard your changes … before moving it" |
| 13 | **Columns ▾** → untick Owner and Tags | Those columns disappear; still hidden after closing and reopening the repository (remembered on this PC only) |
| 14 | **Columns ▾ → Edit fields… → + Add field**: name "Safety level", kind *Choice*, options `QM, A, B, C, D`, default QM → **Save fields** | A Safety level column and filter appear; the editor shows the field; new items get QM. `requirements/.reqman/schema.yaml` has the new field and its comments are still there |
| 15 | Edit fields again: rename Owner to "Responsible", move it up, remove Tags → Save | Column header renamed and moved; Tags gone, a note says the values stay in the files. `git diff` shows only schema.yaml changed |
| 16 | Re-add a field named "Tags" (kind List) | The old tag values show again (same key `tags`) |

## Previous checklist — v0.2.0 (milestone M2)

You need a Git repository to try it in: any project clone, or a new empty folder where you run
`git init`. ReqMan only adds a `requirements` folder; nothing else in the repository is touched.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let ReqMan update itself to 0.2.0 (or install it from Releases) | Start screen with **Open repository…** and **Recent repositories**; diagnostics moved behind the **⚙** button (top right) |
| 2 | **Open repository…** → choose your test repository (or a sub-folder of it) | "No requirements folder yet" with the repository's top folder shown → **Create requirements folder**. A `requirements` folder appears in the repository |
| 3 | **+ New item… → Stakeholder Need**, type a title and text, **Save** (or Ctrl+S) | ID like `STK-K7Q3XM` appears; the item shows in the tree and the table; a file `requirements/items/STK-….md` exists |
| 4 | Select the stakeholder need, **+ Child… → System Requirement**, fill in, set Priority, Save. Add a second child | Both appear under the parent in the tree (▸ to expand), in creation order |
| 5 | Select the second child, click **↑** | It moves above the first one in the tree |
| 6 | In a child, click **Parent**, search for another item, pick it, Save | The item moves under the new parent in the tree. Choosing the item's own child as parent is refused with a message |
| 7 | Type in **Search**; pick a **Type**, **Status** or **Priority** filter; click column headers | The table narrows as you type; "N of M items" in the status bar; clicking a header sorts (again = reverse) |
| 8 | Change a title without saving, then click another row | "You have unsaved changes. Discard them?" — **Keep editing** returns to your edit |
| 9 | With unsaved changes, close the ReqMan window | Windows asks "You have unsaved changes" before closing |
| 10 | Open one item file in Notepad, change its title, save; switch back to ReqMan | The table and tree show the new title |
| 11 | Open an item in ReqMan, change it in Notepad as well, then Save in ReqMan | ReqMan refuses: "…was changed outside ReqMan…", with a link to reload the current version. Your Notepad change is kept |
| 12 | Delete a test item (**Delete** → **Delete**) | It disappears. Deleting an item that still has children is refused |
| 13 | Close the repository and reopen it from **Recent repositories** | Opens straight away with everything as you left it |
| 14 | Resize / maximise the window; open **⚙ Settings** in a maximised window | Scrollbars sit at the right edge of their area, thumb only; the table header scrolls with the rows; the ID column stays visible when the table scrolls sideways |
| 15 | Switch Light / Dark | Everything readable in both, including selected rows and scrollbars |
| 16 | *(Optional)* `git status` in the repository | Only files under `requirements/` are new or changed |

Links between items are shown but cannot be created yet — that is M3 (v0.4.0).

## Previous checklist — v0.1.0 (milestone M1)

M1 is the data layer underneath the coming screens, so it is mostly covered by automated tests
(58 on every build, plus 10,000- and 50,000-item performance tests on Windows). What a person checks:

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | With v0.0.4 installed, open ReqMan (or click **Check for updates**) | The bar offers ReqMan 0.1.0; **Restart and update** installs it; App row shows 0.1.0 |
| 2 | Look at the start screen | Everything from M0 still works (theme toggle, Diagnostics); a new **Data self-test** panel is shown |
| 3 | Data self-test: choose **1,000**, click **Run self-test** | Finishes in a few seconds; a table of timings appears; every query is well under 100 ms |
| 4 | Run it with **10,000** | Finishes in under a minute; queries under 150 ms; "Re-opening" a few seconds at most |
| 5 | *(Optional)* Run it with **50,000** | May take several minutes (first indexing is the slow part); queries still under 300 ms |
| 6 | **Copy diagnostics** after the tests, paste into your report together with a screenshot of the timings | The log also contains a "Data self-test" line per run |

Windows Defender scanning new files can make "Writing" and "First indexing" slower than on the build
machine; that is expected. Please report your numbers — they set the baseline for M2.

## Previous checklist — v0.0.3 / v0.0.4 (milestone M0)

Tick each step; any "No" is a bug to report.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | From **Releases → v0.0.3 → Assets**, download and run `ReqMan-Setup-0.0.3.exe` (over an older install is fine) | Windows may show "Windows protected your PC" (the proof of concept is not code-signed): click **More info → Run anyway**. Installs without admin rights; ReqMan opens |
| 2 | Look at the Start menu and desktop | A **ReqMan** shortcut exists |
| 3 | Look at the start screen | Logo and "ReqMan" in the top bar; Environment: Git ● green with a version, Theme ● green "App theme", Updates "Up to date" |
| 4 | Click **Dark**, then **Light** | The whole window switches colours instantly; text stays readable in both |
| 5 | Choose **Dark**, close ReqMan, reopen it | It reopens in Dark |
| 6 | Choose **System**; in Windows Settings → Personalisation → Colours, switch app mode Light ↔ Dark | ReqMan follows Windows without restarting |
| 7 | Click **Open log folder** | Explorer opens `%APPDATA%\ReqMan\logs` containing `reqman.log` |
| 8 | Open `reqman.log` in Notepad | Lines for "starting", "Git check: installed", "Theme loaded", "Update status" with times |
| 9 | Click **Copy diagnostics**, paste into Notepad | Version, Windows version, Git version, theme, update status and log path |
| 10 | Click **Edit my theme…** | Explorer opens `%APPDATA%\ReqMan` with a new `theme.json` selected |
| 11 | Close ReqMan. In that `theme.json`, change `"primary"` under `"light"` to `"#d32f2f"`, save, reopen in Light | The primary button turns red; Theme shows "Your theme.json" |
| 12 | Close ReqMan. Break your `theme.json` on purpose (delete a `}`), save, reopen | ReqMan opens with the normal look; Theme ● shows a warning (also in the log). Undo afterwards |
| 13 | Resize the window small and large; maximise it | Layout stays usable; nothing overlaps |
| 14 | **Update test** — tell Claude you have v0.0.3 installed; Claude publishes v0.0.4. Open ReqMan (or click **Check for updates**) | A bar shows "Downloading ReqMan 0.0.4…", then "ReqMan 0.0.4 is ready to install" with **Restart and update**. Click it: ReqMan closes, updates and reopens showing 0.0.4 — and your red theme from step 11 is still there |
| 15 | Disconnect from the network, click **Check for updates** | Updates shows "Could not check for updates…"; nothing else breaks |
| 16 | *(Optional)* Test on a PC without Git | Git ● red with a "Download Git for Windows" link that opens the browser |
| 17 | Windows Settings → Apps → Installed apps → ReqMan → Uninstall | Uninstalls without admin rights |

Not yet testable: opening a repository, requirements, links, Git actions (arrive with M1–M6).
