# ReqMan — User Guide

Version 0.14.3 · November 2026 · *ReqMan is a working name; the product gets its final name in the next version.*

ReqMan is a Windows desktop application for writing, structuring and tracing requirements. Every requirement is a
small text file in your project's own Git repository, so requirements get the same history, branches, reviews and
backups as your code. ReqMan shows those files the way a requirements tool should: a numbered tree, attributes,
traceability links, suspect links, and requirement-by-requirement change control. No server, no database, no user
accounts — who may read or change requirements is decided by your GitHub repository's permissions.

---

## Contents

1. [Quick start (15 minutes)](#1-quick-start-15-minutes)
2. [Ideas you need to know](#2-ideas-you-need-to-know)
3. [The window](#3-the-window)
4. [Writing and structuring requirements](#4-writing-and-structuring-requirements)
5. [Finding: search, filters, columns](#5-finding-search-filters-columns)
6. [Traceability: links and suspect links](#6-traceability-links-and-suspect-links)
7. [Fields and item types](#7-fields-and-item-types)
8. [Sharing your work: changes, commit, push, pull](#8-sharing-your-work-changes-commit-push-pull)
9. [History and comparing versions](#9-history-and-comparing-versions)
10. [Branches](#10-branches)
11. [Import and export (Excel, ReqIF, CSV, Markdown)](#11-import-and-export)
12. [Problems panel](#12-problems-panel)
13. [Settings](#13-settings)
14. [Setting up a team](#14-setting-up-a-team)
15. [File format reference](#15-file-format-reference)
16. [What ReqMan can do — specification](#16-what-reqman-can-do--specification)
17. [Troubleshooting and questions](#17-troubleshooting-and-questions)

---

## 1. Quick start (15 minutes)

### 1.1 What you need

- A Windows 10 or 11 PC. No administrator rights are needed.
- **Git for Windows** (free): <https://git-scm.com/download/win>. ReqMan works without Git, but cannot share,
  branch or keep history.
- A GitHub repository for your project, cloned to your PC (or an empty one — see 1.3).

### 1.2 Install

1. Open the ReqMan **releases page** — your team lead gives you the link; in an installed ReqMan it is under
   **⚙ → Environment and versions → Releases page**.
2. Under the newest version → **Assets**, download `ReqMan-Setup-<version>.exe` (or the `.zip` if your browser blocks
   `.exe` files — extract it, then run the `.exe`).
3. Run it. Windows may say *"Windows protected your PC"* because the installer is not yet code-signed: click
   **More info → Run anyway**. ReqMan installs for your user and opens.
4. ReqMan updates itself: when a newer version is published it downloads it in the background and offers
   **Restart and update**.

### 1.3 Open your project

On the start screen:

- **Open repository…** — choose the folder of your project's Git clone. If it has no requirements yet, ReqMan
  offers **Create requirements folder**: it creates `requirements/` with default item types (system, software,
  hardware, interface requirement, test case, …), fields (Status, Priority, Owner, Tags) and link types (refines,
  verifies, satisfies, …). You can change all of them later.
- **New project from a file…** — start from an Excel, CSV or ReqIF file (for example an export from DOORS or Jama):
  ReqMan creates the folder and the Git repository and imports the file as the first commit (see 11).

### 1.4 Write your first requirements

1. **+ New item** (top right) → choose a type, e.g. *Heading / Information* for a chapter, then *System Requirement*.
2. Type a **Title** and the **Text** ("The system shall…") in the editor on the right, then **Save**.
3. To put an item under another one: select the parent, then **+ Child…** at the bottom of the editor — or drag a row
   onto another row.
4. Outline numbers (1, 1.1, 1.2.3) are calculated by themselves.

### 1.5 Link two requirements

1. Select a test case (or a software requirement).
2. In the editor → **Links** → **+ Add link** → choose the link type (e.g. *verifies*) and the target requirement.
3. The table's **Links** column shows → for outgoing and ← for incoming links.

### 1.6 Share: commit and push

1. Click **Changes** in the top bar: every requirement you changed is listed, field by field, old and new side by side.
2. Write a commit message on the right ("Add door lock requirements") and click **Commit**.
3. Click **Push**: your colleagues get the change with **Pull**.

### 1.7 If something goes wrong

**⚙ (Settings) → Report a problem**: describe what happened and click **Save report…**; send the saved file to the
person who supports ReqMan in your team. Nothing is sent by itself.

---

## 2. Ideas you need to know

| Idea | What it means in ReqMan |
| --- | --- |
| **Repository** | Your project's Git folder. ReqMan works inside its `requirements/` folder and never touches your code. |
| **Item** | One requirement, heading, test case, risk… — one file `requirements/items/<ID>.md`. |
| **ID** | `REQ-K7Q3XMB`: random, so two people (or two branches) never create the same ID. IDs never change. |
| **Item type** | What kind of item it is (system requirement, test case, heading…). Headings / information are not counted as requirements. |
| **Fields** | Attributes such as Status, Priority, Owner, Tags — defined by the team (see 7). |
| **Tree and outline numbers** | Every item has a parent and a position; numbers like 2.3.1 are calculated, never stored. |
| **Link** | A typed relation from one item to another (*verifies*, *refines*…). Stored on the source item only. |
| **Suspect link** | A link whose target changed meaning (type, title or text) since the link was last confirmed. Someone should check it still holds. |
| **Uncommitted change** | Saved on your PC, not yet recorded in Git. Only you see it. |
| **Commit / Push / Pull** | Record your changes in Git / send them to GitHub / get your colleagues' changes. |
| **Branch** | A separate line of work (e.g. a change request) that can later be brought into `main`. |

Saving and committing are different on purpose: **Save** writes the file; **Commit** records a set of saved changes
with a message; **Push** shares them.

---

## 3. The window

| Area | What is there |
| --- | --- |
| **Top bar** | Repository name and ✕ (close), branch button ⎇ with ↑ (commits to push) and ↓ (commits to pull), **Changes**, **Pull**, **Push**, English / العربية, Light / Dark / System, ⚙ Settings. |
| **Toolbar** | Search box, ⊞ expand all, ⊟ collapse all, **Filters**, **Columns**, **Import…**, **Export…**, **+ New item**. |
| **Table** | One row per item, in document order; ▸ opens a branch of the tree; numbers in the title show how many children. |
| **Editor (right)** | Details (title, type, fields, parent, text, links) and **History**; Save, ↑ ↓ (move), + Child…, Delete. |
| **Status bar** | Number of items, problems found (click to see them), hints. |
| **Floating messages** | Results of Git actions under the top bar: green frame = done, red = problem, blue = nothing to do / a question. Success messages close by themselves. |

---

## 4. Writing and structuring requirements

- **Create:** **+ New item** adds at the top level (or next to the selected item); **+ Child…** adds under the
  selected item.
- **Edit:** select a row, change anything in the editor, **Save**. Leaving an item with unsaved changes asks first.
  If a colleague's newer version arrived meanwhile, ReqMan refuses to overwrite it and tells you.
- **Move:** drag a row onto another row (it becomes the last child, with everything below it) or into the space between
  rows; or use ↑ ↓ in the editor. Choose several rows (Ctrl/Shift + click) to move them together — they keep their
  order.
- **Delete:** **Delete** in the editor. Links to the deleted item are shown and removed with it.
- **Right-click a row:** open it, or export it (and the items below it); with several rows chosen, export all of them.
- **Expand / collapse:** ⊞ / ⊟ in the toolbar; ▸ on a row.

---

## 5. Finding: search, filters, columns

- **Search:** type words, an ID or part of a title in the search box — best matches first, across IDs, titles and
  text. While searching, the list is flat; clear the search to see the tree again.
- **Filters** (button shows how many are active): type, status, priority and other choice fields, and **Links** (items
  without links, items with suspect links). **Clear filters** resets them.
- **Columns:** show, hide and reorder columns, drag a column edge to change its width. Remembered on your PC.

---

## 6. Traceability: links and suspect links

- **Add a link:** editor → Links → **+ Add link** → type and target. The link is stored in the source item's file.
- **Both directions:** the target shows the reverse name (*verified by*, *refined by*…).
- **Suspect links:** when you save a change to an item's type, title or text, ReqMan lists every item that links to it:
  **Keep** (still holds), **Unlink**, or **Decide later** (the link stays marked ⚠ in the table and editor until
  someone confirms it). Changes to status, owner, order or links do not make links suspect.
- **Find them:** Filters → Links → *suspect* lists every item with a suspect link.
- **Broken links** (target missing, e.g. deleted on another branch) appear in the problems panel (12).

Coming next (theme 1): coverage view, impact chain, traceability matrix with Excel export.

---

## 7. Fields and item types

- **Columns → Edit fields…** opens the team's fields: add a field (text, choice with options, list), rename it,
  reorder, set a default, remove it. Saving changes `requirements/.reqman/schema.yaml`, which travels to the whole team
  with the next push. Removing a field never deletes values already in the files.
- **Item types and link types** are defined in the same `schema.yaml` (editing them in the window comes in theme 1).

---

## 8. Sharing your work: changes, commit, push, pull

### Changes view

**Changes** shows your **uncommitted changes**, one row per requirement (added, changed, moved, deleted), and for the
selected one exactly what changed: fields before → after, text side by side with the changed words marked, links
added/removed, and which links became suspect.

- Take back one part with **↶** (a field, the text, one link), one item with **Discard this item's changes**, chosen
  items with **Discard N chosen**, or everything with **Discard all changes**.
- **Commit:** message on the right → **Commit N changes**. Only the `requirements/` folder is committed — never your
  code.

### Push

**Push** sends your commits to GitHub. If colleagues pushed first, ReqMan offers to pull first.

### Pull — with decisions per requirement

**Pull** brings your colleagues' commits. ReqMan combines both sides **field by field**: if you changed the priority and
a colleague changed the text of the same requirement, both are kept automatically. Only when you both changed the
**same field** of the same requirement, a window shows both versions side by side: click the one to keep (it gets a
frame and a ✓), or choose **Write it myself**. Nothing changes until you click **Finish the pull**.

---

## 9. History and comparing versions

- **History tab** of an item: every commit that changed it — who, when, message — and what changed.
- **Changes → Show:** uncommitted changes; *what the last pull brought in*; *what a branch would bring in*; or any two
  versions. Each can be exported as CSV or Markdown for a review record.

---

## 10. Branches

Click the branch button **⎇ main ▾**:

- **Click a branch name** to switch to it. With uncommitted changes, ReqMan asks: **Commit it first**, **Move it to** *(the branch)*,
  or **Discard it**.
- **Create and switch:** type a name at the bottom (e.g. `cr/door-lock-timeout`).
- **Compare with…** a branch: see what it would change, requirement by requirement, before taking it — like a pull
  request.
- **Bring in changes from…** a branch: its changes arrive in your current branch as **uncommitted changes** to review, keep
  (Commit) or discard. Nothing is committed for you.
- **🗑 Delete** a branch on this PC (never on GitHub). A branch whose work exists nowhere else asks twice.
- Many branches: a search box appears; the list scrolls.

---

## 11. Import and export

### Import (Excel, CSV, ReqIF)

**Import…** (or **New project from a file…** on the start screen):

1. **File** — choose an `.xlsx`, `.csv` or `.reqif`/`.reqifz` file (ReqIF = the exchange format of DOORS, Jama,
   Polarion and other tools).
2. **Columns** — ReqMan maps columns to fields by their names (ID, Type, Title, Description, Status, Parent, Verified
   By…); change any mapping. Rows without a type get the type you choose.
3. **Check and import** — new / updated / unchanged rows and any problems are listed before anything is written.

Imported items appear as **uncommitted changes** to check in Changes before you commit (a new project gets them as its
first commit). Importing the same file again later updates the items imported from it. Word files are not imported
(decided: their structure cannot be read reliably).

### Export

**Export…** (or right-click rows): all items or only the current search/filter result, in document order, with the
columns of the table plus hierarchy, full text and links if ticked. Formats:

| Format | For |
| --- | --- |
| Excel (.xlsx) | people; rows grouped by the hierarchy, titles indented |
| ReqIF (.reqif) | DOORS, Jama, Polarion and other RM tools — hierarchy, all fields, links (validated against the official ReqIF schema) |
| CSV | any tool; opens in Excel (comma-separated, UTF-8) |
| Markdown | one readable document, e.g. to give to an AI tool |

Coming (theme 3b): Word from your company's own template, PDF, and one self-contained HTML file.

---

## 12. Problems panel

The status bar shows **N problems** when ReqMan finds something it cannot fully understand — a file edited by hand with
a mistake, a link to an item that does not exist, two items with the same ID after a merge, a file whose name does not
match its ID. Click it for the list; click a problem to open the item; many have a one-click fix (e.g. **Fix file
name**). ReqMan never guesses silently and never deletes data to "fix" something.

---

## 13. Settings

Open with **⚙** (top right). The left panel switches between pages: **Environment and versions**, **Report a problem and
diagnostics**, **Features**, **Self-tests**, and this **User guide** (one page per section). **← Back** at the top of the
panel returns to your repository.

| Card | What it does |
| --- | --- |
| **Environment** | Git version, theme in use, update state with **Check for updates**, app version. |
| **Versions** | Go back to an earlier version if a new one causes trouble: **Go back to an earlier version…** → choose → **Install version X**. ReqMan downloads it, installs it and opens again; automatic updates then **pause** until you click **Resume automatic updates**. Works for versions from 0.14.1 on. Files changed by a newer version may need that newer version — going back is meant for a few days, until a fix arrives. |
| **Report a problem** | Saves one text file with your description, the diagnostics and the end of the log. |
| **Diagnostics** | Log file and theme file locations, **Open log folder**, **Edit my theme…**, **Copy diagnostics**. |
| **Features** | Turn off a feature on this PC (Branches, Import, Export) if it causes trouble; the rest keeps working. If the team turned one off for the repository, it says so. |
| **Release self-test** | Runs the main actions (create, edit, move, link, commit, push, a colleague's change, a pull with decisions, branches, compare, history, export, import) on a practice repository in a temporary folder, then deletes it — about a minute; your data is not touched. |
| **Data self-test** | Measures speed on this PC with generated requirements in a temporary folder. |

**Language:** English / العربية in the top bar — the whole window turns right-to-left in Arabic; your data stays as
written. **Colours:** Light / Dark / System; a company can change colours, fonts and logo in a theme file
(`docs/THEMING.md`).

---

## 14. Setting up a team

1. **One GitHub repository per project** (code and requirements together, or requirements alone). Give the team write
   access; protect `main` in GitHub (Settings → Branches) if reviews must happen through pull requests.
2. **One person creates the requirements folder** (or imports the existing DOORS/Jama export via ReqIF), adapts the
   item types, fields and link types in `requirements/.reqman/schema.yaml`, commits and pushes.
3. **Everyone clones the repository**, installs ReqMan and opens the clone.
4. **Daily work:** Pull in the morning → edit → Changes → Commit → Push. Pull before a big edit session.
5. **Bigger changes** (a change request, a review package): a branch per change; compare it with `main`; bring it in
   with a pull request on GitHub or **Bring in changes from…**.
6. **Team-wide feature switches:** add to `schema.yaml`, e.g.

   ```yaml
   features:
     branches: false
   ```

7. **Support:** one person collects reports (Settings → Report a problem) and passes them on.

---

## 15. File format reference

```
<your repository>/
  requirements/
    .reqman/
      schema.yaml          item types, fields, link types, feature switches
    items/
      REQ-K7Q3XMB.md       one file per item
```

An item file:

```markdown
---
id: REQ-K7Q3XMB
type: system-requirement
title: Door lock
status: Approved
priority: High
owner: A. Hassan
tags:
  - safety
parent: REQ-4NAPSHQ
order: b1G
links:
  - type: verifies
    target: REQ-RHE5XZX
    confirmed: 9183eb0e79f7
---
The door shall lock automatically within 2 s after the vehicle starts moving.
```

- The header keys always appear in this order; unknown keys are kept as they are.
- `order:` is a sort key among siblings; `confirmed:` is the fingerprint of the link target when the link was last
  confirmed (suspect-link detection). Do not edit these two by hand.
- The text below the header is Markdown.
- The files can be read and edited with any text editor; ReqMan checks them when it opens the repository and lists
  anything it cannot understand in the problems panel.

---

## 16. What ReqMan can do — specification

**Authoring and structure** — items of team-defined types in a tree with calculated outline numbers; team-defined fields
(text, choice, list) with defaults; random collision-free IDs; drag-and-drop moves of one or many items; protection
against lost edits and against overwriting a colleague's newer version.

**Finding** — full-text search with ranking; filters by type, fields, missing links and suspect links; configurable, resizable columns.

**Traceability** — typed links in both directions; suspect-link detection on meaning changes with keep / unlink /
decide later; broken-link and duplicate-ID detection with guided fixes.

**Change control (Git, per requirement)** — uncommitted changes per requirement and per field with side-by-side text
differences; take back any part; commit only the requirements folder; push with pull-first offer; pull with automatic
field-level merging and a decision window for real clashes; history per item; compare any two versions, the last pull
or a branch; export comparisons.

**Branches** — create, switch (commit first / take along / discard), compare like a pull request, pull from another
branch as reviewable uncommitted changes, delete safely, search among many branches.

**Exchange** — import from Excel, CSV and ReqIF with column mapping, a check step and repeatable updates; export to
Excel, ReqIF (schema-validated), CSV and Markdown, all or filtered, in document order.

**Usability** — English and Arabic (full right-to-left), light / dark / system themes, company theme file.

**Reliability** — atomic, validated, conflict-checked writes; nothing ever force-pushed; built-in release self-test and
data self-test; feature switches per PC and per team; problem reports; going back to an earlier version with updates
paused; automatic updates.

**Platform and data** — Windows 10/11 desktop, per-user install; offline first; no server, no database, no accounts;
plain Markdown files in your own Git repository; tested with 10,000 and 50,000 requirements.

**Planned** (decided release plan) — editable types and required fields, coverage view, impact chain, traceability
matrix, several specifications per repository, baselines; bulk edit, templates, saved views, wording hints; rich text
with tables, images and diagrams; Word / PDF / HTML documents; approvals, comments and pull requests in the app; links to
code and test results; AI access.

---

## 17. Troubleshooting and questions

| Question | Answer |
| --- | --- |
| Windows or the browser blocks the installer | It is not code-signed yet. Browser: keep the download (Ctrl+J → Keep). Windows: More info → Run anyway. Or use the `.zip`. If nothing works, IT must allow the releases page (⚙ → Environment and versions shows its address). |
| "Git is not installed" | Install Git for Windows, restart ReqMan. Settings → Environment shows the version found. |
| Push is refused | Someone pushed first: Pull, then Push again. ReqMan offers this itself. |
| A pull asks about fields | You and a colleague changed the same field of the same requirement: choose per field, then **Finish the pull**. |
| "N problems" in the status bar | Click it — each problem says what is wrong and opens the item; many have a one-click fix. |
| A new version misbehaves | Settings → Features (turn the feature off) or Settings → Versions (go back). Then Settings → Report a problem. |
| Where is the log? | `%APPDATA%\ReqMan\logs\reqman.log` — or Settings → Diagnostics → Open log folder. |
| Can I edit the files by hand or with a script? | Yes — they are plain text. Keep the header format; ReqMan checks everything when it opens and lists what it cannot read. |
| Does ReqMan send data anywhere? | No. It talks only to your Git remote (GitHub) and checks GitHub Releases for updates. |
