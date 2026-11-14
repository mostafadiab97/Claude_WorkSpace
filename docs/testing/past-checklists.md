# Past manual checklists (v0.0.3 – v0.23.0)

> Moved from `docs/TESTING.md` on 1 Nov 2026 (content unchanged). The current checklist and the one before it stay in
> `TESTING.md`; when a new version comes, move the oldest one there down into this file (newest first).

## v0.23.0 (the bar above the table)

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.23.0** and run the release self-test. | All steps passed. |
| 2 | Open the sandbox. Click the **document button** (name + count + arrow), switch documents, then try **Rename** (or F2) and Esc. | The menu lists the documents and the actions; Delete is red and last. |
| 3 | Select a row, click **+ New item**, choose a type and **Inside the selected item**, Create. | The editor opens with the new item as a child of the selected one. |
| 4 | Try the **outline** button, **Filters**, **View** (Rows: one line per item) and **More** (Import… / Export…). | The line that would do nothing is greyed out; everything else works as before. |
| 5 | Make the window narrow with the editor open; then press Tab once and use ← →. | The bar stays one row; Tab lands on the bar once and the arrows move along it. |

## v0.22.0 (new look, Ember, five languages)

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.22.0** and run the release self-test. | All steps passed. |
| 2 | On the start screen, pick each language in the new drop-down, then each colour icon (sun, moon, flame, screen). | Texts change at once; in Arabic the name «ريكوشيه» shows; the flame gives Ember with the orange logo. |
| 3 | In **Ember**, open the sandbox, change an item, open **Changes**, then Pull or Push. | Warm dark colours, serif headings, orange buttons with a soft glow, titles on shaded bars, a calm note. |
| 4 | Import your Excel file twice into the same document. | The second time: a yellow warning explains why nothing is imported; no "No problems found". |
| 5 | Settings → Environment → **Go back to an earlier version…** (don't install). | The Versions list opens below; Cancel closes it. |

## v0.21.4 (the owner's 0.21.3 report)

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.21.4**, run the release self-test, then click **Copy report** and paste it somewhere. | All 25 steps passed; the pasted text is the report. |
| 2 | Make a new empty document and import your Excel file into it. | The rows appear at once, without switching windows. |
| 3 | Import the same file again into another document. | The check step says "Nothing to import: every row matches an item that is already in this project…"; Import stays off. |
| 4 | Pick the document from step 2 and click **Delete…** → **Delete document**. | The question names the number of items; afterwards the document is gone (Discard in Changes would bring back what was committed). |

## v0.21.3 (speed, screens, Arabic, Merge into…)

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.21.3**, then **⚙ → Self-tests → Run release self-test**. | **All 25 steps passed.** |
| 2 | In the sandbox, **Versions** → open an old commit you have not opened before; while it loads, move the window or hover a button. | The window keeps reacting while the message "Opening the old version…" shows. |
| 3 | Make two documents (e.g. *Merge A* and *Merge B*), add an item to *Merge A*, copy its file by hand into *Merge B*'s folder, then pick *Merge A* and click **Merge into…** → *Merge B* → **Merge**. | "*Merge A* was merged into *Merge B*"; the item is once in *Merge B*, *Merge A* is gone. (Delete *Merge B* afterwards if you like.) |
| 4 | Open an item, click its **Details** tab, press **Tab** and **Shift+Tab**. | Tab jumps from the tab row to the next control in one step; the arrows still move between tabs. |
| 5 | Switch to **Arabic**: open **Traceability → Matrix**. | Arrows in the cells point the Arabic way (← for "the row links to it"), matching the legend. |

## v0.21.2 (data and import safety)

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.21.2**, then **⚙ → Self-tests → Run release self-test**. | **All 25 steps passed.** |
| 2 | In the sandbox folder, copy one item file (`REQ-….md`) by hand into another document's folder, then click reqochet's window. Select the item and try **Delete**. | Delete is refused with "… is in 2 files … Give the copy a new ID"; the original file is still there. Then **Problems → Give the copy a new ID** fixes it (delete the copy afterwards if you like). |
| 3 | Import `samples/sample-requirements.xlsx` (or any of your Excel sheets) as before. | Works as before. |

## v0.21.1 (screens and Arabic)

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.21.1**, then **⚙ → Self-tests → Run release self-test**. | **All 25 steps passed.** |
| 2 | Open the sandbox, click an item so the editor opens, and make the window narrower. | The toolbar wraps to a second row; **+ New item** stays fully visible. |
| 3 | Hover the status bar's coverage-gaps label; change a field in **Fields** (no rename) and hover **Changes … + settings**. | The gaps tooltip explains "missing links … not an error in the files"; the status bar says "No file problems"; the Changes tooltip explains "+ settings". No "choices ar are gone" warning in Fields. |
| 4 | In the editor, click the **Details** tab and press → and ←; do the same in Traceability (Coverage / Matrix). | The arrows move between the tabs. |
| 5 | Switch to **Arabic**. In the table tree press ← on a closed heading, → on an open one; open **Changes → Compare**. | ← opens, → closes; closed headings show ◂; the compare choices say «اختيار نسختين…». |

## v0.21.0 (speed)

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.21.0**, then **⚙ → Self-tests → Run release self-test**. | **All 25 steps passed**, total time back near 0.20.1's (about 90 s, not 120 s). |
| 2 | Open the sandbox. **Changes → Compare → Choose two versions…**: pick an old commit and the newest. | The list appears in about a second (it took several seconds before). |
| 3 | Sort the table by **#** (outline number), then click the header again (descending). | Each sort takes well under a second; the order follows the outline numbers. |
| 4 | Edit an item's text and save it a few times. | Each save is instant; the item keeps its number. |
| 5 | **Versions** → open an old baseline or commit for the first time. | The message "Opening the old version… The first time…" shows, the window stays usable, and the version opens within a few seconds. |

## v0.20.2 (data safety)

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.20.2**, then **⚙ → Self-tests → Run release self-test**. | **All 25 steps passed.** |
| 2 | Open the sandbox. Make a new document with an Arabic name (e.g. *متطلبات تجربة*), add one item, **Commit**, then **Push**. Open the item's **History** tab. | Push succeeds; History lists your commit. |
| 3 | Delete one item of that document and add a different one, Commit; **Changes → Compare → The last commit that changed requirements**. | One item listed as *Deleted* and one as *Added* — not one item "changed into" the other. (Delete the test document afterwards if you like — it is only in the sandbox.) |
| 4 | **⚙ → Report a problem and diagnostics → Save report…**; open the saved file. | No Windows user name in it; paths start with `%USERPROFILE%`. |

## v0.20.1 (the owner's points on 0.20.0)

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.20.1**, then **⚙ → Self-tests → Run release self-test**. | **All 25 steps passed.** |
| 2 | Look at the coverage-gap marks in the table, in Light and in Dark. | A solid amber dot right after the title, easy to see in both. |
| 3 | **Traceability → Coverage → Show the gaps in the table**, then **← Back to Traceability** above the table. | The Traceability view opens again. |
| 4 | **Traceability → Matrix** with a filter that gives a grid (e.g. Type = Software Requirement); scroll down; then **Export Excel** and edit a cell that starts with = in Excel. | The column titles stay at the top and the header row is short, so many rows show; in Excel the edited cell stays text. |
| 5 | Look at the top bar. | Pull, Push, Changes, Versions, Traceability. |

## v0.20.0 (traceability views)

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.20.0**, then **⚙ → Self-tests → Run release self-test**. | **All 25 steps passed** (new: "Traceability: coverage rules, gaps, matrix and impact"). |
| 2 | Open the sandbox. Above the table: *Start with the usual coverage rules?* → **Add the rules**. | The question goes away; items without the needed links get a small **◌** next to their title, and the status bar shows *N coverage gaps*. (schema.yaml changed — commit it when you like.) |
| 3 | Top bar **Traceability** → **Coverage**: open the gaps of one rule, click one; then **Show the gaps in the table** on another rule. | Each rule shows *x of y covered* with a bar; the item opens in the table; the table then lists only that rule's gaps (Filters → Coverage gaps). |
| 4 | **Traceability → Matrix**: rows *System Requirement*, columns *Test Case*; then **Export Excel**. | A grid with a dot where they are linked, rows without a test marked; the Excel file has the whole grid. |
| 5 | Open a stakeholder need → editor tab **Impact**. Then **Edit rules…** (in Traceability), change *At least* of one rule to 2, **Save**. | Impact lists everything that depends on the need, level by level. After the rule change the coverage numbers and ◌ marks follow it. |

## v0.19.1 (no empty rows after Show text off)

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.19.1**, then **⚙ → Self-tests → Run release self-test**. | **All 24 steps passed.** |
| 2 | In the sandbox with **Show text** on: **⊞ Expand all** and scroll down a few screens. Then switch **Show text** off, **⊟ Collapse all**, **⊞ Expand all** and scroll again. | With Show text off every row is one line high, with no empty space between rows anywhere. |
| 3 | Switch **Show text** on again and scroll. | Titles with their text again; no rows drawn on top of each other. |

## v0.19.0 (main column, old version in the table, compare layout)

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.19.0**, then **⚙ → Self-tests → Run release self-test**. | **All 24 steps passed** (step 22 now: "Baseline: make one, show the old version, push it"). |
| 2 | Open the sandbox. The new toolbar button **Show text** is on. Scroll quickly through the whole table, open and close a few levels; then switch **Show text** off and on. | On: headings show their bold title only; other items their bold title with the whole text below, rows as tall as needed; scrolling stays smooth. Off: one line per item and the **Text** column is back. |
| 3 | **Versions → History**: on an older commit choose **Open read-only**. Use the tree, a filter and the search; open an item; then **Back to now**. | The whole table shows that version under a coloured bar *Viewing … (read-only)*; no Git buttons, no New item; the item opens greyed out; **Back to now** brings today's items back. |
| 4 | **Versions → History → Compare with now** on an older commit (or **Changes → Compare two versions**). Click an item in the left list; scroll the right side; try **Export CSV**. | Changed items on the left, every change one after another on the right using the full width; a click jumps to that change and the left list follows your scrolling; the exports sit at the top next to **Close changes**. |
| 5 | **⚙ → Privacy and access** in Light, then Dark (**⚙ → Theme**). | The diagram matches the theme, no boxes overlap, the arrows are short. |

## v0.18.0 (baselines and the history list)

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.18.0** (or install it from the Releases page), then **⚙ → Self-tests → Run release self-test**. | **All 24 steps passed** (new: "Baseline: make one, read the old version, push it"). |
| 2 | In the sandbox: **Versions → New baseline…**, name `SRS-0.1`, a note, **Make baseline**; then **Push**. | The baseline is listed with *not pushed yet* and Push is highlighted; after the push the label is gone (on GitHub it shows under Tags as `baseline/SRS-0.1`). |
| 3 | **Versions → History** tab: search a word of an older commit message; on that commit try **Open read-only**, then **Compare with now**. | The old version shows the items as they were (nothing can be changed); Compare opens Changes with that version against now. |
| 4 | Copy one requirement file by hand into another document folder; switch to that document; **Problems → Give the copy a new ID**. Then make a test document, add an item and **Changes → Discard all**. | The copy shows at the top of its document and gets a new ID; after Discard all the test document is gone from the list. |
| 5 | Look at the top bars, the privacy page (**⚙ → Privacy and access**, click the diagram) and the icons. | Slimmer bars; the diagram (GitHub on top, Git on the right) opens full size; the top-bar logo has no grey outline, the desktop/taskbar icon has it. |

## v0.17.2 (document groups, column drag, privacy page, guide pictures)

Owner 8 Nov: all 5 passed (with points → 0.18.0).

First discard your 0.17.0 test changes in the sandbox (**Changes → Discard all**), as agreed.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.17.2**, then **⚙ → Self-tests → Run release self-test**. Look at the taskbar and the desktop icon. | **All 23 steps passed**. Desktop/Start icon: light tile with a grey outline (Windows may show the old one until a restart — its icon cache). Taskbar: follows Windows (dark taskbar → dark tile). |
| 2 | In the sandbox make a second document (**New document…**), add an item, then choose **All documents**; click a group row. | One group row per document with its item count; a click folds and unfolds it. |
| 3 | Drag a column header (e.g. **Status**) onto another; then open **Columns**. | The column moves where the line showed; the menu shows the same order, names left-aligned, Title listed first. |
| 4 | Turn on a filter. | An orange **Clear filters** button appears next to Filters; it shows all items again. |
| 5 | **⚙ → Privacy and access**, then **User guide → 2. Ideas you need to know** (and 6, 8). | The privacy page lists what is read, kept, sent and changed; the guide pages show pictures in the window's colours (try Dark too). |

## Previous checklist — v0.17.1 (renaming a big document safely)

Owner 8 Nov: all passed (steps 0–4).

First make the sandbox clean again (step 0). Then steps 3–5 of 0.17.0 and steps 2–5 of 0.16.4 continue on this version.

| # | Do this | Expected result |
| --- | --- | --- |
| 0 | Close reqochet-dev. In the sandbox folder run `git status`. If it lists `.md` files directly in `requirements/` or a leftover document folder, run `git clean -nd -- requirements` (it only lists), check that it lists only those copies, then `git clean -fd -- requirements`. | `git status` says "nothing to commit, working tree clean"; `requirements/items/` holds the 10,005 files. |
| 1 | Let reqochet-dev update to **0.17.1**, then **⚙ → Self-tests → Run release self-test**. | Version 0.17.1; **all 23 steps passed** (new step 23: rename a document with a space). |
| 2 | Open the sandbox; in the document bar give "items" a real name **with a space** (e.g. "SandBox Req"). It may take a minute. | One commit "Rename document…"; 10,005 items under the new name; **Changes** shows nothing. Item → History still shows its older changes. |
| 3 | **Push**. | The push goes through. |
| 4 | Optional, to try the safety net: in Git Bash make a test branch, move a few item files out of the document folder by hand, then **Changes → Discard all**. | The files are back where they were; no error. |

## Previous checklist — v0.17.0 (1a structure: documents, editable types, required fields)

Owner 8 Nov: step 1 passed; step 2 failed (rename of the 10,005-item folder) → 0.17.1. Steps 3–5 continue on 0.17.1.

Try this together with steps 2–5 of the 0.16.4 checklist below. Report by version and step ("0.17.0 test 3").

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.17.0**, then **⚙ → Self-tests → Run release self-test**. | Version 0.17.0; **all 22 steps passed**. |
| 2 | Open the sandbox. Above the table, the document bar offers to give the folder **items** a real name: rename it (e.g. "System"), then **Push**. | One commit "Rename document…" is pushed; every item is still there, with its history (Item → History). |
| 3 | In the document picker choose **New document…**, call it "Software", add two items, then switch between **System**, **Software** and **All documents**. | Each document has its own tree and starts its numbering at 1; All documents shows both, one after the other. |
| 4 | **Columns → Edit types…**: add an item type, rename one, try to remove a type that is in use; give one type a **required** field. | The new type can be chosen for new items; a used type cannot be removed (it says how many items use it). Items of that type without the field show under **Filters → Incomplete**. |
| 5 | Open **Columns** and drag a column to another place in the list. | The table's columns follow the new order (↑/↓ still work too). |

## Previous checklist — v0.16.4 (stabilisation 2: speed, Arabic, first run, keyboard)

Not tested yet: try steps 2–5 **on 0.17.0** together with the new checklist (the owner, 7 Nov: "we can do both tests
together"); step 1 is replaced by step 1 of 0.17.0.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.16.4**, then **⚙ → Self-tests → Run release self-test**. | Version 0.16.4; **all 22 steps passed**. |
| 2 | Open an item with text, click in the middle of its text. Then select an item and press **New item** (Insert position: Below the selected item). | The cursor is where you clicked (or at the end), not at the start. The new item appears right below the selected one. |
| 3 | Export some items to CSV, put `12"` inside a table or bullet list in one Text cell, save, **Import** the file. | The whole text arrives, including what follows the `"`. |
| 4 | In the table press **Shift+F10** (or the Menu key) on a row; then look at the **Links** column and the **Changes** button. | The row menu opens (Open, Add a child item, Delete…, Export); Links reads like "1 out · ⚠ 1 suspect"; Changes counts items. |
| 5 | Switch to **العربية** and look at the table, the Changes button and a Compare. | IDs read left to right; counts read correctly ("عنصران", "3 عناصر"); "عنصر فرعي" for children; nothing in English except names. |

## Previous checklist — v0.16.3 (stabilisation 1: data and safety)

Most fixes of this version are checked automatically (30 QA tests from the review, a new e2e scenario, the acceptance
run). Report by step number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.16.3**, then **⚙ → Self-tests → Run release self-test**. | Version 0.16.3; **all 22 steps passed**. |
| 2 | In the sandbox, open an item, change its title, then click the **✕** beside the project name. | "Save / Discard / Keep editing" appears; Keep editing keeps your text; Save closes the project with the change saved. |
| 3 | Change an item without saving, then press **Push**. | The same question first; after Save comes the usual "Pull first? / Push without pulling" (if GitHub has newer commits) or the push. |
| 4 | Type a value into **Tags** and press **Ctrl+S** without clicking elsewhere. | The tags are saved (the item is not marked unsaved afterwards). |
| 5 | Optional: Import a CSV that has a cell like `12" display` and an Arabic choice value. | Every row arrives; the Arabic value is the one you typed. |

## Previous checklist — v0.16.2 (the Windows icon redrawn)

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.16.2**, then **⚙ → Self-tests → Run release self-test**. | Version 0.16.2; **all 22 steps passed**. |
| 2 | Look at reqochet-dev in the taskbar, Start menu and on the desktop, on a dark wallpaper. (If Windows still shows the old icon, it is its icon cache — it refreshes after a restart.) | Brighter red and green eyes; a thin light outline around the dark tile. |
| 3 | Light mode: look at the face in the top bar. | The same thin outline; the face keeps its size while the eyes move and rest. |

## Previous checklist — v0.16.1 (the owner's points on 0.16.0)

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let reqochet-dev update to **0.16.1**, then **⚙ → Self-tests → Run release self-test**. | Version 0.16.1; **all 22 steps passed**. |
| 2 | Close and start reqochet-dev. | The bouncing dots play for at least one full bounce before the window appears. |
| 3 | Dark mode: watch the top-bar face, then click another window and come back. | The face keeps the same size and weight while the eyes glance, blink and rest. |
| 4 | Light mode: look at the top-bar face and the start screen. | The red and green eyes are clearly visible on the dark tile, and you can see them move. |
| 5 | In the sandbox, change an item, press **Push** while GitHub has newer commits (or use your second clone to push first). | "Pull first?" opens **on top of** the table; both buttons can be clicked. |

## Previous checklist — v0.16.0 (the new name: reqochet-dev)

The acceptance run on GitHub installed 0.15.2 (ReqMan), updated it to reqochet-dev, checked that ReqMan was removed and
the settings moved, then ran the self-test, the sandbox and a real push (Actions → Release → Summary). Report by step
number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Let ReqMan update to **0.16.0** (Restart and update). | **reqochet-dev** opens by itself; ReqMan is gone from the Start menu and from Windows' installed apps; your colour mode, language and recent repositories are still there. |
| 2 | **⚙ → Self-tests → Run release self-test**. | **All steps passed**, now **22** (new: a project made with ReqMan is renamed). |
| 3 | Open the sandbox. Look at the top bar and the start screen; hover the window, then click another window. | Face (eyes) + reqochet + **DEV**; the eyes glance and blink, rest when the window is in the background, look busy during Pull. Changes / Pull / Push sit right after the branch. The start screen shows the large face and name; while the sandbox opens only the bouncing dots move. |
| 4 | The sandbox shows "This project was made with ReqMan…": click **Rename folder**, then **Push**. | A green note "Folder renamed and committed"; on GitHub the commit shows `.reqman → .reqochet` as a rename; the sandbox still opens with all items. (Afterwards `git pull` in your second sandbox clone.) |
| 5 | Switch to **Dark** and **العربية** (⚙ → Appearance); look at the top bar and the start screen. | The light logo files in Dark; nothing mirrored in Arabic (the logo reads "reqochet"). |

## Previous checklist — v0.15.2 (the owner's points on 0.15.1)

The acceptance run on GitHub did the update, self-test, sandbox and a real push (Actions → Build → Summary).
Report by step number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Update to **0.15.2**, then **⚙ → Self-tests → Run release self-test**. | **All steps passed** (21); the step list is folded — **Show the 21 steps** opens it. |
| 2 | **Changes → Show: the last commit that changed requirements** (your test commit from 0.15.0/0.15.1). | Under your changed item a row **L — Link review only: 5 items**; a click shows the IDs. No "links are now suspect" warning on the changed item (you kept them). |
| 3 | **⚙**, open **▸ User guide**, scroll the left panel. | **← Back** sits on its own bar; the entries scroll under it. |

## Previous checklist — v0.15.1 (the owner's points on 0.15.0)

The acceptance run on GitHub did the update, self-test, sandbox and a real push (Actions → Build → Summary).
Report by step number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Update to **0.15.1**. **⚙ → Self-tests → Run release self-test**, go to another page (e.g. Features) and back while it runs. | The test is still running when you come back and ends with **All steps passed**, 21 ✓. |
| 2 | In the sandbox open an item, **+ Add link**, click the **link type** list and choose a type. | The Add link section stays open; you can then search and pick the item. |
| 3 | **Changes → Show: the last commit that changed requirements** (your 0.15.0 commit). | Your text change is listed; under the list: **+ 5 items changed only by a link review** (click it for their IDs). |
| 4 | **⚙**, open **▸ User guide** in the left panel and scroll the panel down. | **← Back** stays at the top. |

## Previous checklist — v0.15.0 (UI polish from the UI/UX review)

The acceptance run on GitHub did the update, self-test, sandbox and a real push (Actions → Build → Summary).
Report by step number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Update to **0.15.0**, then **⚙ → Self-tests → Run release self-test**. | App shows 0.15.0; **All steps passed**, 21 ✓. |
| 2 | Open the sandbox. Look at the table and click a requirement with formatted text. Drag the line between table and editor. | Columns: **No., Title, Type, Status, Links, … ID**; the type is short (SysReq), headings are bold. The text shows formatted (bold, lists); a click on it opens the plain text. The editor gets wider and stays so. |
| 3 | Change one item's text and save (an item others link to). Then click **Changes**, write a message and use **▾ → Commit and push**. | The "Check the links" window shows **what changed**; each link has Keep / Unlink. After Commit and push the change is on GitHub (a real push). **Author:** shows your name; your other repositories' Git name and e-mail are untouched. |
| 4 | Press **Ctrl+/**, then **← Back**; press **Ctrl+F**, **Ctrl+N** (Esc), **Ctrl+Shift+C**. | Ctrl+/ opens the new **Keyboard shortcuts** page; Ctrl+F goes to search; Ctrl+N opens the type list; Ctrl+Shift+C opens Changes. |
| 5 | **⚙ → Appearance**: switch to **العربية** and back; try Dark. On the start screen click **Read the quick start**. | Language and colours now live here (and on the start screen), not in the top bar of an open repository. English titles read correctly in the Arabic window. The quick-start link opens the guide page. (The sandbox's own field names stay English — only new projects get Arabic field names.) |

## Previous checklist — v0.14.5 (visible Check for updates, folding guide topics)

The acceptance run on GitHub did the update, self-test, sandbox and a real push (Actions → Build → Summary).
Report by step number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Update to **0.14.5**, then **⚙ → Self-tests → Run release self-test**. | App shows 0.14.5; **All steps passed**, 21 ✓. |
| 2 | **⚙ → Environment and versions**; then in the panel click **▸ User guide**, open a topic, go back to a settings page. | **Check for updates** is a blue button on the Updates line. The guide topics are hidden until you click ▸ User guide; they stay open while a guide page is shown. |

## Previous checklist — v0.14.4 (no personal data in the files; Settings touches)

The acceptance run on GitHub did the update, self-test, sandbox and a real push (Actions → Build → Summary).
Re-clone the sandbox first if you have not yet (its history was rewritten in 0.14.2). Report by step number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Update to **0.14.4**, then **⚙ → Self-tests → Run release self-test**. | App shows 0.14.4; **All steps passed**, 21 ✓. |
| 2 | **⚙ → Environment and versions**: next to "Updates", click **Check for updates**. Look at **← Back**. | The button sits on the Updates line and checks; Back is blue like the other main buttons. |
| 3 | **⚙ → Environment and versions → Go back to an earlier version…** | It lists **0.14.3, 0.14.2, 0.14.1** (going back works from 0.14.1 on). Don't install one now — unless you want to try it: install 0.14.3, check that updates say "paused", then **Resume automatic updates** to come back to 0.14.4. |

## Previous checklist — v0.14.3 (Settings and help as pages)

The acceptance run on GitHub did the update, self-test, sandbox and a real push (Actions → Build → Summary).
Report by step number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Update to **0.14.3**, then **⚙ → Self-tests → Run release self-test**. | App shows 0.14.3; **All steps passed**, 21 ✓. |
| 2 | **⚙**: click each entry in the left panel (the four settings pages, then a few guide sections, then a link on "Introduction and contents"). | Each entry opens its own page — no long scroll; a contents link opens that section's page. **← Back** sits at the top of the panel; the panel has its own shade in Light and Dark. |
| 3 | Optional, instead of last version's step 5 — only inside your sandbox clones, so company repositories are not affected: open a terminal **in each sandbox folder** and run `git config user.email <id>+<username>@users.noreply.github.com` (no `--global`). | New commits in the sandbox show the private address; your other repositories keep the work address. |

## Previous checklist — v0.14.2 (Settings and help with the guide inside)

The acceptance run on GitHub did the update, self-test, sandbox and a real push (Actions → Build → Summary).
**First re-clone the sandbox** (its history was rewritten): delete your `Claude_SandBox` and `Claude_SandBox_B`
folders and clone them again (Open in GitHub Desktop or `git clone`). Report by step number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Update to **0.14.2**, then **⚙ → Run release self-test**. | App shows 0.14.2; **All steps passed**, 21 ✓. |
| 2 | **⚙**: look at the left panel; click a few entries (Versions, Features, then **User guide → 1. Quick start**, then a link in the guide's contents). | Settings entries jump to their card; the guide opens at the section; links inside the guide jump to their section. Arabic: the panel is in Arabic, the guide stays in English with a note. |
| 3 | **⚙ → Report a problem**: type a sentence, **Save report…**. | The file is saved and the text box is empty again. |
| 4 | On GitHub open **Claude_SandBox → Commits**. | Your commits show **<owner>** with no work e-mail. |
| 5 | Set your own Git to GitHub's private address so new commits stay private — in a terminal: `git config --global user.email <id>+<username>@users.noreply.github.com` | Next commits from your PC show that address (the build checks it from now on). |

## Previous checklist — v0.14.1 (user guide, going back, calmer notes)

The acceptance run on GitHub already did the update, self-test, sandbox and a real push (Actions → Build → Summary).
Report by step number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Update to **0.14.1**, then **⚙ → Run release self-test**. | App shows 0.14.1; **All steps passed**, 21 ✓. |
| 2 | In your sandbox folder click **Push** with nothing to push (or **Pull** when up to date), in **Light** and **Dark**. | The floating note has the theme's colour (a shade darker in Light, lighter in Dark) with a **blue** frame and soft glow; it closes by itself. Errors still have a red frame, successes green. |
| 3 | **⚙ → Versions → Go back to an earlier version…** | It says there is no earlier version to go back to yet (going back works from 0.14.1 on — the first real test comes with the next version). |
| 4 | Open `docs/USER-GUIDE.md` on GitHub and skim the quick start. | Tell me anything unclear or missing before the pilot team gets it. |
| 5 | Read `docs/reviews/2026-11-03-security-check.md` → "Decision for the owner". | Answer: leave the work e-mail in the sandbox history, rewrite it, or make the sandbox private. |

## Previous checklist — v0.14.0 (health tools; acceptance run)

The automatic acceptance run already did the update, the self-test, the sandbox and a real push on GitHub's Windows
machine — see the run's summary (Actions → Build → the run → Summary). These steps are for your eyes. Report by step number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Update to **0.14.0**, then **⚙ → Run release self-test**. | App shows 0.14.0; **All steps passed**, 21 ✓. |
| 2 | **⚙ → Features**: untick **Export**, click **← Back**. Then tick it again. | The **Export…** button disappears from the toolbar (also from the right-click menu of a row) and comes back when ticked. Import and the branch button stay. |
| 3 | **⚙ → Report a problem**: type a sentence, **Save report…**, save it anywhere. | Explorer opens with the file selected; it holds your sentence, the diagnostics and the end of the log. |
| 4 | Optional: open the latest **Build** run on GitHub (Actions) → **Summary**. | "Acceptance run — ReqMan 0.14.0 — Result: passed" with a numbered list of what it did (installed, updated, self-test, sandbox, push to `ci/acceptance-…`, deleted). |

## Previous checklist — v0.13.1 (your three points on 0.13.0)

Report by step number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Update to **0.13.1**, then **⚙ → Run release self-test**. | App shows 0.13.1; **All steps passed**, 21 ✓. |
| 2 | In folder **B**, do something that gives a Git message (e.g. ⎇ → create a branch `note-test`), in **Light** and in **Dark**. | The floating note is easy to see: **green tint, green frame and glow** for success (red for a problem, blue for a question such as "Pull first?"); the text is **centred** in English and in Arabic. |
| 3 | Open **⎇**. | Every branch on this PC has a red **🗑 Delete** button next to it (fills red when you point at it). Delete `note-test` (switch back to `main` first). |
| 4 | Switch to **العربية** and point at buttons whose tooltip mixes Arabic with an English word (e.g. the branch button, Push, Pull, Changes, the release self-test). | Arabic sentences that contain "ReqMan", "Git", "GitHub", "Excel"… keep their word order everywhere — in the window, in tooltips and in Windows dialogs. |

## Previous checklist — v0.13.0 (Arabic, fewer bars, pull from a branch for review, delete a branch)

Your points on 0.12.1 and the Arabic switch. Use folder **B** (branches `main` and `trial-one`). Report by step number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Update to **0.13.0**, then **⚙ → Run release self-test**. | App shows 0.13.0; **All steps passed**, 21 ✓ (step 13 now also deletes a branch). |
| 2 | Open folder **B** and look at the top of the window. | **Two bars less:** the branch button, Changes, Pull and Push sit in the top bar next to the repository name; one toolbar row: search, **Filters** (opens a small panel with Type / Status / Priority / Links; the button shows how many are active), Columns, Import, Export, ⊞ / ⊟ (expand / collapse all), New item. Git messages appear as a floating note under the top bar and success notes disappear by themselves. |
| 3 | On `main`: **⎇ → Pull from… → trial-one** (after changing something on `trial-one` first, or use any branch with a difference). | **Nothing is committed** — Push keeps its old number. Changes opens on **Uncommitted changes** with what the branch brought: keep it (Commit) or take it back (Discard / ↶). |
| 4 | **⎇**, hover a branch you no longer need (e.g. make one: **New branch** `test-delete`, then switch back) → 🗑 → **Delete**. | It asks first ("…on this PC — the branch on GitHub is not touched") and the branch disappears. The current branch has no 🗑. A branch with work found nowhere else asks a second time ("Delete anyway?"). |
| 5 | Click **العربية** (next to Light / Dark). Look around: table, editor, Changes, a Git message. Then **English**. | The whole window turns **right-to-left in Arabic** (logo on the right, menus mirrored); an edit you had not saved is still there; after a restart it is still Arabic; English switches everything back. Data (titles, field names from your schema) stays as written. Report any word still in English or any Arabic that reads wrongly. |

## Previous checklist — v0.12.1 (the branch drop-down you asked for)

Your four points on the branch panel. Use folder **B** from the 0.12.0 trial (it has `main` and `trial-one`).
Report by step number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Update to **0.12.1**, then **⚙ → Run release self-test**. | App shows 0.12.1; **All steps passed**, 21 ✓. |
| 2 | Click the branch button **⎇ … ▾**. | A small panel opens **right under the button** (not across the window): the current branch on top with **Pull from…** and **Compare with…** next to it, the other branches below, "New branch" at the bottom. |
| 3 | Click the **name** of the other branch. | It switches (no separate Switch button); with uncommitted changes the Commit first / Take it along / Discard question comes first. |
| 4 | Open the panel again → **Compare with…** → click a branch. Then **Pull from…** → click a branch. | Each button turns the list into "Compare … with which branch?" / "Pull into … from which branch?"; the click opens Changes on what that branch would bring in, or pulls it. **Esc** goes back; a click outside the panel closes it. |
| 5 | (Many branches) In PowerShell in folder B: `1..30 | % { git branch test-$_ }`, then open the panel. Afterwards remove them: `1..30 | % { git branch -D test-$_ }`. | The panel keeps its size and **scrolls inside**; a **Find a branch** box appears and narrows the list as you type. |

## Previous checklist — v0.12.0 (branches, pull with decisions — the two-folder trial)

0.12.0 brings branches and a pull that decides **per requirement** instead of stopping. Steps 2–5 are the two-PC
trial you chose, with two folders on your PC: **A** = your sandbox clone, **B** = a second clone. Make B once:
in a terminal in the folder above your sandbox, `git clone https://github.com/<owner>/Claude_SandBox.git Claude_SandBox_B`.
Report by step number.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Update to **0.12.0**, then **⚙ → Run release self-test**. | App shows 0.12.0; **All steps passed**, **21** ✓ (new: the pull asks per requirement; branches). |
| 2 | In **A**: change the **title** of one requirement, Save, commit, **Push**. **Close repository**, open **B**: change the **title** of the same requirement differently **and** its **Status**, Save, commit, **Pull**. | A window **"Pull from origin/main: your decision"** asks only about the **Title** (yours and theirs side by side); the Status change needs no question. Nothing changes until you finish — try **Cancel** once, then Pull again. |
| 3 | In the window: **Write it myself** (combine both titles) → **Finish the pull**, then **Push** (without pulling). | Notice "Pulled: 1 item changed, 1 decided by you"; the table shows your combined title **and** your Status. Push works (one real push). |
| 4 | In **B**: click the branch button **⎇ main ▾** → type `trial/one` → **Create and switch**. Change one item, Save, commit, **Push** (publishes the branch). Open **A**, **Pull**, click **⎇ main ▾**: at **origin/trial/one** click **Compare**, then (⎇ again) **Pull into main**. | Compare opens Changes on "What a branch would bring in" with exactly that one item. **Pull into main** brings it: "Pulled: 1 item changed". (Merging into main is normally done on GitHub as a pull request — this is the local view of it.) |
| 5 | In **A**: change any item, Save (don't commit). **⎇ → Switch** at **trial/one**. Choose **Take it along**. | First a question with **Commit first / Take it along / Discard it / Cancel**. It switches to `trial/one` with your change still there (or lists the item if `trial/one` has another version of it — then choose Discard or Commit first). |

## Previous checklist — v0.11.1 (your requests on 0.11.0)

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
https://github.com/<owner>/Claude_WorkSpace/raw/main/samples/sample-requirements.xlsx (or use an Excel file of
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
