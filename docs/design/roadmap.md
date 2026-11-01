# Roadmap and release plan

> Part of the design documents (split from `DESIGN.md` on 1 Nov 2026; content unchanged). Tags: **C** = confirmed by the
> product owner, **R** = recommendation, **I** = inference, **F/K** = evidence (see `analysis.md` → Sources).

**What this is:** how the prototype was built (M0–M6), where every requirement stands, the release plan with every
version so far and the confirmed plan frame for the next ones. The current version and next step: `CLAUDE.md` →
"Status" and `CHANGELOG.md`.

## Prototype implementation plan

The prototype is built in seven milestones, each ending with a Windows build you can install and try. Every milestone adds one testable slice of the 8-step journey, so problems surface early rather than at the end.

| Milestone | Delivers | Done when |
| --- | --- | --- |
| M0 Foundations | Project skeleton (Electron, TypeScript, React); module folders each with one interface file; lint rule blocking cross-module internals; composition file; theme file with light and dark mode; automated build producing a Windows installer; Git-installed check | You install the empty app on Windows 11 and switch light/dark |
| M1 Data layer | Default schema template; item file read/write (Markdown + YAML); ID generator; validation; repository store; SQLite index cache; generators for 1k and 50k-item test repos; automatic updates via GitHub Releases (moved from M6); user theme overrides kept in %APPDATA%\\ReqMan so updates never overwrite them | Unit tests pass; a 50k-item repo indexes and filters within target; an installed build updates itself to the next release |
| M2 Core UI | Open a repo, initialise `requirements/`; item table with filter, sort and search; item editor; hierarchy tree | Journey steps 1–3 work (without links) |
| M3 Links | Create and remove typed links; item detail with outgoing and incoming links | Journey step 2 complete, including links |
| M4 Git | Status of changed items; commit, pull, push; per-item history | Journey steps 4, 5 and 7 work between two PCs |
| M5 Compare | Pick two commits/branches/tags; per-item and per-link difference view | Journey step 6 works |
| M6 Export and hardening | CSV export; end-to-end tests of the whole journey; bug fixes from your trials | The full 8-step journey passes on two Windows PCs; success measures met |

**Progress:** M0–M6 are complete (v0.7.0) — the prototype scope FR-01 to FR-10 is built; 0.8.0 (review fixes), 0.9.0 (new data format), 0.10.0 (Changes view), 0.11.0 (Excel + ReqIF), 0.12.0 (M8 branches, per-requirement pull), 0.12.1 (branch drop-down) and 0.13.0 (Arabic, fewer bars, delete branch) are released. The current version and next step are kept in `CLAUDE.md` ("Status") and `CHANGELOG.md` only (review T-04); the plan for the next versions is "Release plan" below.

**How we work:** I write the code, tests and architecture notes in a Git repository; after each milestone you install the build, try it and comment here or in chat. Specs and decisions stay in this document and the repo, so work continues across sessions.

**What I need from you to start:**

- [x] An empty GitHub repository for the tool's code (private is fine), connected to this chat so I can push to it
- [x] Optionally, an anonymised sample of a current requirements Excel sheet, for realistic test data and later import work
- [x] A working name for the tool (can change later)

  Working name: **ReqMan**. Sample data: a fictional smart-thermostat requirements sheet (59 items: needs, system/software/hardware requirements, tests, risks, change requests) is in the repo at `samples/sample-requirements.xlsx`.

## Roadmap after the prototype (release plan confirmed 28 Oct 2026)

The prototype scope (FR-01 to FR-10) is built (v0.7.0). This section plans the next versions: where each
requirement stands, what is still missing compared with the five analysed products, the preferred new features, and
a proposed version sequence. Everything here is a recommendation (R) unless marked C; the owner decides the order
after his test round and the project review (`docs/reviews/done/2026-10-25-project-review.md`).

### Where each requirement stands

| ID | Requirement | Status (v0.12.1, 31 Oct 2026) |
| --- | --- | --- |
| FR-01 – FR-06 | Open repo, default schema, items with stable IDs, hierarchy, typed links, table/filter/search | Done |
| FR-07 | Item history from Git | Done (History tab with field-level comparison) |
| FR-08 | Commit, pull, push | Done (only `requirements/`, never forced; since 0.12.0 a pull combines items field by field) |
| FR-09 | Compare two versions per requirement and link | Done (Changes view, 0.10.0; no automatic pulls) |
| FR-10 | Export to CSV | Done (+ Markdown, Excel, ReqIF; Compare export) |
| FR-11 | Schema editor | Partly — fields done; item types and link types still in `schema.yaml` |
| FR-12 | Branches and tag baselines | Branches done (0.12.0); tag baselines delayed by the owner (29 Oct 2026) |
| FR-13 | Merge and resolve conflicts per requirement | Done (0.12.0): field-level 3-way merge, decision window, duplicate-ID repair |
| FR-14 | Word, PDF, Excel and Markdown export | Markdown, Excel (and ReqIF) done; Word/PDF → proposed (planning discussion) |
| FR-15 | Excel/CSV import with column mapping | Done (0.11.0, also ReqIF) |
| FR-16 | Coverage view and rule warnings | Not started → proposed (planning discussion) |
| FR-17 | Suspect links | Done (v0.4.0) |
| FR-18 | GitHub pull-request view per requirement (stage 1) | Local PR review done (Compare a branch, 0.12.0); PR status/approval → proposed (planning discussion) |
| FR-19, FR-20 | PR create/approve/merge in the tool; Word import, ReqIF | ReqIF done (0.11.0); the rest later |

### What is still missing compared with the analysed tools

> **Superseded 31 Oct 2026** by the ranked analysis of ten tools in
> `docs/reviews/done/2026-10-31-feature-gap-analysis.md` (kept below for the record).

| Feature (from "B. Common features") | In ReqMan today | Proposal |
| --- | --- | --- |
| Word and Excel import/export, round trip | CSV + Markdown export | **M7**: Excel export + import (update existing items by ID, read links — C, 25 Oct 2026); Word/PDF export M10 |
| Baselines | Any commit can be compared | Later (delayed by the owner 29 Oct 2026): tags as named baselines ("Release 1.0") |
| Branches / parallel versions | Shown only | **M8**: create, switch, compare branches |
| Merge and conflict resolution per requirement | Pull stops and lists clashes | **M8**: field-level 3-way merge, choose mine/theirs/edit only for real conflicts |
| Traceability matrix and coverage views | Link filters ("without links", "suspect") | **M9**: coverage view (e.g. which system requirements have no verifying test) and a matrix (rows × columns by link type) |
| Configurable types and workflows | Fields editable in the GUI | **M9**: item types and link types editable in the GUI; status stays a field (no workflow engine) |
| Query language / advanced filters | Search + type/field/link filters | **M9**: saved filters ("views"); later a small query syntax (`status:Draft type:SYS`) |
| Rich text with tables and images | Markdown text, plain editor | **M10**: Markdown preview in the editor; later images as attachments |
| Formal review with sign-off | GitHub pull requests outside the tool | **M11**: PR stage 1 (view a PR's changes per requirement) |
| Dashboards and reports | Export only | **M10**: one printable report (PDF) of a filtered set; later a simple project overview |
| Reuse across projects | Copy by hand (C: no cross-repo links) | Later: "copy from another repository" with a `copied-from` note |
| Jira / Azure DevOps, REST API, MCP server, AI checks | Not planned now (C) | Commercial stage |
| Risk management (FMEA) | Risk item type | Later, only if a safety-critical customer needs it |

### Preferred new features (candidate backlog)

**Must (MVP):** Excel export + import with preview and update by ID (M7) · branches, tags as baselines, per-requirement
merge (M8) · item types and link types in the GUI, coverage view, saved views (M9) · Word/PDF export, Markdown
preview (M10) · PR stage 1 (M11).

**Should:** bulk edit (select several items → set status/owner/tags, move, delete) · item templates per type
(pre-filled text, e.g. "The system shall…", acceptance-criteria section) · "find items linking to …" impact view (all
items affected by a change, following links several levels) · keyboard shortcuts list · recent changes panel ("what
changed this week") · Windows 10 build (commercial need, C) · single-instance app and other fixes from the review.

**Could:** traceability graph view · copy items to another repository with provenance · duplicate-ID repair ·
requirement quality hints without AI (vague words like "fast", "user-friendly", missing "shall") · Linux build ·
English/Arabic UI (if wanted; see review S-06) · several requirement sets per repository (review S-07).

**Future, no milestone yet:** tables inside the item text (plain grid tables, or complex tables with joined cells /
lists in cells stored as HTML) — decided 28 Oct 2026 to leave for a future decision.

**Rich text editor (later version, C 27 Oct 2026):** Markdown stays the stored format; a Word-like editor with bold,
italic, underline, highlight, bullet/numbered lists, hyperlinks, images (in `requirements/attachments/<ID>/`) and `@`
references to other items (references only — not traceability links).

**Later / commercial:** PR create/approve/merge in the tool and comments per requirement (FR-19), Word import,
ReqIF, GitLab/Bitbucket/Azure DevOps adapters, compliance features (signatures, tamper-proof audit, standards
templates), AI features and governed AI access, licensing, private update channel and code signing (review S-08,
X-02).

### File formats — support status (27 Oct 2026)

| Format | Export | Import | Notes |
| --- | --- | --- | --- |
| CSV (opens in Excel) | **Supported** (v0.7.0) | Planned — M7 | Comma, UTF-8; table and Compare lists |
| Excel (.xlsx) | Planned — M7 | Planned — M7 | Import wizard with column mapping, update by ID, links, numbers → hierarchy; "New project from a file"; "Update the Excel file" writes back into the original file |
| Markdown (.md) | **Supported** (v0.7.0) | Not planned | Export for AI tools and reports; import only if a need appears (ReqMan's own Markdown would be easy) |
| ReqIF (.reqif / .reqifz) | Planned — after M7 | Planned — after M7 | The standard exchange format of DOORS, Jama, Polarion, Codebeamer, Visure; two-way exchange; tested with DOORS and Jama |
| Word (.docx) | Planned — M10 | Later: ReqMan-generated files (round trip); other Word files only by rules (e.g. headings → items) | No general editing of foreign Word files |
| PDF | Planned — M10 | Not planned | Printable document |

### Release plan (C, confirmed by the owner 28 Oct 2026)

| Version | Name | Contents |
| --- | --- | --- |
| **0.8.0** | Clean page | All review fixes D-01 – D-08, D-10, P-01, P-02, P-04, P-05, X-01; restructuring S-01 – S-03; all GUI texts in one central file (S-06); tests T-01 – T-05; **release self-test** inside ReqMan (runs the main actions on a temporary practice repository with a fake "GitHub" folder on the owner's PC, pass/fail per step, copy report); the owner's checklist shrinks to **at most 5 steps per version** from now on |
| **0.9.0** | New data format | IDs `REQ-` + 7 random characters (O-01, O-02), type editable; fractional order keys (S-04; at push, groups the user changed whose values are longer than 4 characters are re-spaced); calculated outline numbers (O-03) in table ("No."), editor, picker, Compare and every export; sandbox converted directly in its repository |
| **0.10.0** | Changes view | One Changes view instead of Changes + Compare (O-06), no automatic pulls ("Pull first" offer); GitHub-style split difference with highlighted words and revert arrows (O-05); Keep/Unlink window for suspect links (O-04) |
| **0.11.0** | **M7 Excel + ReqIF** (ReqIF merged in, owner 29 Oct 2026) | ReqIF import/export (DOORS, Jama, Polarion) through the same wizard; Excel export (ExcelJS); import wizard for Excel/CSV (update by ID with preview, links, outline numbers → hierarchy); "New project from a file", "Update the Excel file", "Publish to GitHub"; **export of chosen items**: Ctrl/Shift+click to select several rows, right-click "Export this item and everything below it", export window choice "Selected items and everything below them" (all levels; tick box "Include the items below", ticked by default; overlaps exported once; document order; full outline numbers) |
| **0.12.0** | **M8 Branches** | Create/switch branches (commit / discard / take changes along), compare two branches per requirement (local PR review), "Pull from branch" (any visible branch) and pull with per-requirement (field-level 3-way) merge (S-05), automatic duplicate-ID repair (D-09), D-05. Tag baselines delayed (owner, 29 Oct 2026) |
| ~~0.13.0~~ | ~~ReqIF~~ | merged into 0.11.0 (owner, 29 Oct 2026: fewer test rounds; same wizard and export pipeline) |
| **0.12.1** | Owner's points on 0.12.0 | Branch drop-down: compact, anchored under the button, click a name to switch, Pull from… / Compare with… on the current branch, search and scrolling for tens of branches |
| **0.13.0** | Owner's points on 0.12.1 + Arabic | Pull from another branch arrives as uncommitted changes; delete a branch; Git controls in the top bar and a one-row toolbar (filters in a pop-up); **Arabic / English switch** with right-to-left layout |
| **Baselines and formats (C, 1 Nov 2026)** | — | Baselines un-delayed: Git tags with a note, Baselines list, compare with a baseline, open one read-only — in the theme 1 version. **No Word import** (replaces the 27 Oct plan for rule-based Word import). Import: Excel, ReqIF, CSV, ReqMan repositories. Export: Excel, ReqIF, CSV, ReqMan repositories, Markdown, Word, PDF |
| **Documents (C, 1 Nov 2026)** | — | Several documents (specifications, like DOORS modules) in one repository, each with its own tree and outline numbers, links across them — built with theme 1. Replaces "one tree per repository". Cross-repository links later, with a repository alias before the ID |
| **Plan frame (C, 1 Nov 2026)** | — | Next phase = **a pilot team uses ReqMan** (P-01); the rename gets its own version before the pilot (P-04); themes in this order, one per minor version, fixes as patches (P-02, P-03) — details per theme in `docs/reviews/2026-11-01-planning-discussion.md` |
| *Proposal A (R)* | *New name + traceability* | *Proposed 31 Oct 2026; order to be settled in the planning discussion (owner, 31 Oct):* the rename (`docs/reviews/2026-10-31-rename-impact.md`) once the name is chosen; traceability matrix and coverage; item and link types in the GUI; saved views; bulk edit |
| *Proposal B (R)* | *Documents out* | Word and PDF export, HTML publishing, Markdown preview |
| *Proposal C (R)* | *Review and quality* | PR approval status and PR view per requirement, comments (design choice first), requirement quality hints |
| *Proposal D (R)* | *Engineering traceability* | Links to code and tests in the same repository, impact chain and graph, command line / GitHub Action check |
| later | — | Tag baselines (delayed), rich text editor with images and tables, templates, macOS/Linux, dashboard, integrations / MCP / AI, compliance; Windows 10 build. **No milestone yet:** tables in text, code signing (X-02), private update channel (S-08). Ranked list: `docs/reviews/done/2026-10-31-feature-gap-analysis.md` |

Settled owner decisions on the review (27–28 Oct 2026): UI texts in one central file (S-06, yes); one requirement
set per repository (S-07, discarded); private update channel and code signing later (S-08, X-02).
