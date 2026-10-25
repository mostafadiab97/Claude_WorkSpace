# Testing ReqMan

Two kinds of checks protect each build:

1. **Automated checks** run on a Windows machine on GitHub for every push: type checking, lint rules
   (including the module-boundary rules) and unit tests. A build that fails any of them produces no installer.
   To see them: repository → **Actions** → latest **Build** run → **windows** → expand **Run npm run check**.
2. **Manual checks** below — done by a person on a real Windows 11 PC, because things like installation,
   Windows dark mode and Explorer integration can only be judged by hand.

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

## Manual test checklist — v0.4.0 (milestone M3: links)

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
