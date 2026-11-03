# Product and design decisions

> Part of the design documents (split from `DESIGN.md` on 1 Nov 2026; content unchanged). Tags: **C** = confirmed by the
> product owner, **R** = recommendation, **I** = inference, **F/K** = evidence (see `analysis.md` → Sources).

**What this is:** every question that defined the product with the owner's answer, the technical design chosen at the
start, the decisions taken per milestone, and the small preferences the owner gave along the way. Newer decisions from
the planning discussion are in `docs/reviews/2026-11-01-planning-discussion.md` and summarised in `roadmap.md`.

## Questions to define your product

The five questions marked ★ shape the architecture most; the rest refine scope. Short answers are fine, and "don't know yet" is a valid answer — it becomes an open question rather than an assumption.

**Answers recorded so far (24 Oct 2026)**

| Type | Statement |
| --- | --- |
| Confirmed requirement | Branching / parallel versions are needed, implemented as ordinary Git branches: the tool works on whichever branch is checked out and compares or merges branches at requirement level. This covers parallel releases, drafts reviewed by pull request and simple variants. Carrying one change into many long-lived variant branches would use Git cherry-pick, not a dedicated feature like Codebeamer's Delta Merge. |
| Confirmed requirement | Core thesis: a simpler, much smaller tool — not an enterprise ALM suite. |
| Confirmed requirement | Purpose: one structured, central place to manage project requirements and their changes, replacing scattered Word documents and Excel sheets. |
| Confirmed requirement | No dedicated requirements server: requirements are stored as files in a folder of the project's existing Git repository, hosted wherever the code already is (GitHub or similar). The product is a client GUI for viewing, editing, linking and visualising those files. |
| Confirmed requirement | Branching, history and baselines can be delegated to Git (branches, commits, tags) and reviews to pull requests. Confirmed: Git is the product's version control and data store; there is no separate database. Data Git cannot express (e.g. suspect-link state) is stored in the repository files themselves; any local index is a rebuildable cache. |
| Open question | Confirmed: all users know Git/GitHub. Confirmed: the tool includes Git actions (commit, pull, push, branch) and shows differences and merge conflicts at the requirement level (e.g. "REQ-42 text changed on both branches", "link added here, deleted there") rather than as raw file lines. This requirement-aware diff and merge is a likely differentiator. Still open: whether conflict resolution and full Git actions belong in the prototype or a later stage. |
| Confirmed requirement | Internal tool first; likely to become a commercial product if it proves reliable. Implication (I): no licensing, billing or multi-tenant features now, but keep company-specific choices (requirement types, ID formats, templates) configurable and use only dependencies whose licences allow commercial distribution. |
| Confirmed scope decision | Regulatory-compliance features — version-bound approvals/signatures, tamper-proof audit trail, enforced coverage reporting, formally frozen baselines — are deferred to later commercial releases. Recommendation (R): keep the file format able to hold approval and link-confirmation data later, so adding them needs no data migration. Support for specific standards (ISO 26262, IEC 62304, DO-178C, ASPICE, 21 CFR Part 11) is also deferred to the commercial version. Target industry still to be named. |
| Confirmed context | Organisation of 200–300 people (mid-size; around the EU's 250-employee line between medium and large), teams of 7–15. So roughly 7–15 people work on one repository's requirements at once — comfortably within what Git handles. Confirmed: traceability stays inside one repository. A requirement needed in another repo is copied there as a new, independent item (no cross-repo links or sync). Recommendation (R): optionally record a "copied from" note (source repo + ID) so the origin can be found later at near-zero cost. |
| Confirmed requirement | Access control is delegated to the Git host: whoever can read/write the repository can read/write its requirements. The tool has no user accounts or permission system of its own in the first version. Inference (I): finer control is still possible with the host's own features (protected branches, required pull-request reviews, CODEOWNERS per folder); people without repo access receive exported documents. |
| Confirmed non-functional requirement | Project size is unknown and varies; scalability should not be a hard limit. Proposed design target: smooth performance up to 10,000 requirements per repository, usable up to about 50,000, with no design choice that caps growth beyond that (e.g. one file per requirement, a local rebuildable index instead of loading everything into memory). Confirmed 24 Oct 2026: the target is accepted for now, and the design must allow raising it on demand without changing the file format. |
| Confirmed requirement | Item-centric: the primary experience is a database of requirement items to filter, sort and link (closest to Jama/Codebeamer, not Polarion's LiveDoc). Inference (I): this fits one file per item well; any document is a generated view/export. Confirmed: export to Word, PDF, Excel and CSV is required (printable versions and data for other tools), plus Markdown for sharing with AI tools and ReqIF as optional. No live connection to other tools and no direct AI-tool access in the first version. Confirmed: import from existing Word and Excel/CSV files is also required. Inference (I): Excel/CSV import is simple (map columns to fields); Word import is harder and needs rules (e.g. by heading style or ID pattern), as Polarion's rule-based import shows — a candidate for a later stage than Excel import. |
| Confirmed requirement | Requirement types, fields and link types are fully configurable per repository. Recommendation (R): store this schema as a configuration file in the same repo, so it is versioned and branched with the data; ship a sensible default template; the tool validates items against the schema and flags items left invalid by a schema change. Confirmed: anyone with write access may change the schema (teams can still restrict it later with CODEOWNERS). |
| Confirmed requirement | Compare any two Git references (branches, commits or tags used as baselines), shown per requirement: added, deleted and changed items, with differences in text, fields and links — the requirement-level equivalent of comparing two branches in Git. |
| Confirmed requirement | No links to external tools in the first version (revisit for the commercial product); all traced artifacts live inside the tool. Common artifact types are available from day one, and users can add custom types as easily as adding an Excel column. Default set (accepted 24 Oct 2026, refined from the default templates of the analysed tools, evidence K): Stakeholder Need, System Requirement, Software Requirement, Hardware Requirement, Interface Requirement, Use Case, Design Element, Test Case, Defect, Risk, Change Request, plus a non-requirement Heading/Information item for structure and explanatory text. Default link types: refines/derives from, satisfies, implements, verifies, mitigates, relates to. |
| Open question (with proposed default) | Enforce or only report traceability rules — undecided. Proposed default (R): rules such as "every System Requirement must be verified by a Test Case" are declared in the repo's schema file and shown as warnings and coverage gaps, never blocking saves or commits. Blocking enforcement can be switched on later without changing the data, so this decision does not hold up the architecture. |
| Confirmed requirement | Approval = the GitHub pull-request flow: open PR → review → requested changes → approval → merge to the main branch. No separate workflow engine in the tool. Inference (I): GitHub's PR page will show raw file diffs, which you noted it cannot present well, so reviewers need the tool's requirement-level view of the PR's changes. Decision (user, 24 Oct 2026): handle the PR process in the tool if feasible. Assessment (I/R): feasible in stages, since GitHub's API supports creating PRs, reviews (approve / request changes), comments and merges. Stage 1 — view changes in the tool, approve on GitHub (no risk). Stage 2 — create, approve and merge PRs from the tool (moderate effort). Stage 3 — review comments anchored to individual requirements and synced with GitHub (hardest, because comments must map to file lines). Requires a GitHub sign-in token; other hosts (GitLab, Bitbucket, Azure DevOps) have different APIs, so this should sit behind a host adapter. Confirmed: all three stages are in scope; the tool is the central place for every requirements action, including PRs. Which stage lands in the prototype vs. MVP is decided at scoping. |
| Confirmed requirement | Audit trail for v1 = normal Git history (author, time, message, change per commit), shown per requirement in the tool. Teams wanting stricter control can enable branch protection and signed commits in GitHub; tamper-proof audit is part of the deferred compliance features. |
| Confirmed scope decision (25 Oct 2026) | M4 Git: when a pull finds items changed on both sides, ReqMan stops without changing anything and lists them (choosing per item comes with FR-13); M4 shows the current branch only (creating/switching branches stays FR-12, MVP); ReqMan commits only the `requirements/` folder, never other project files. |
| Confirmed scope decision (25 Oct 2026) | M5 Compare: the default comparison is "since my last pull" (what the last pull brought in); ReqMan pulls right before any comparison; exporting the comparison list comes with the M6 exports. |
| Confirmed decision (25 Oct 2026) | CSV exports use a comma separator (the owner's Excel setting). After the prototype (M6), the order is: Excel export and import (M7), then branches and per-requirement conflict resolution (M8); Word/PDF export, PR view and coverage rules later. |
| Confirmed decision (25 Oct 2026) | M7 import: rows whose ID already exists **update** those items (with a preview of what changes); links are **read too** (from a Links column like the export writes). |
| Confirmed decision (27 Oct 2026) | Item IDs are independent of the item type: one prefix `REQ-` for all items + random part; the type can change without changing the ID. Existing sandbox data is converted directly in the sandbox repository (no conversion feature in the tool). |
| Confirmed decision (27 Oct 2026) | No ID pool: IDs use 7 random characters (`REQ-K7Q3XMB`); duplicate IDs created on different branches are repaired automatically at pull/merge (the local, unshared item is renamed with its links). |
| Confirmed decision (27 Oct 2026) | Every item has an outline number (1, 1.2, 2.3.1 …) calculated from the hierarchy when displayed — not stored — so moves renumber instantly and change only the moved item's file. |
| Confirmed decision (27 Oct 2026) | The outline number appears in all exports ("No." column; headings in Markdown/Word), using the full document's numbers also for filtered exports. |
| Confirmed decision (27 Oct 2026) | Suspect links are decided when saving: a window lists the affected links with Keep/Unlink per link and Keep all / Unlink all / Apply / Decide later; pulled changes only mark links ⚠ for later review. |
| Confirmed decision (27 Oct 2026) | GitHub-style difference view: Fields / Text / Links blocks stacked, each split old (red, left) vs new (green, right) with word highlights; per-part revert for uncommitted changes only; split view only. |
| Confirmed decision (27 Oct 2026) | One "Changes" view (default: uncommitted changes) replaces the Changes panel and Compare. No automatic pulls: before remote-related actions ReqMan offers to pull first. Replaces the M5 rule "pull right before any comparison". |
| Confirmed decision (27 Oct 2026) | Exchange with other tools in phases: Excel/CSV import + Excel export (M7) → ReqIF import/export → later Excel "work on this file" mode and Word round-trip for ReqMan's own documents. Test against DOORS and Jama (used in the company before). |
| Confirmed decision (27 Oct 2026) | "New project from a file": ReqMan creates the folder and a local Git repository itself, imports the Excel/CSV file, and can later write changes back into that Excel file ("Update the Excel file") or publish the project to GitHub. |
| Confirmed decision (27 Oct 2026) | All GUI texts are kept in one central text file (ready for other languages and easy label changes). One requirement set per repository (no multiple sets). Private update channel / commercial distribution: later. |
| Confirmed requirement | Collaboration works like GitHub: no real-time co-editing. Each person edits in their own local copy/branch, shares by push/pull, and conflicts are resolved per requirement in the tool; formal review happens through pull requests. Inference (I): this removes the need for any collaboration server, consistent with the no-server requirement. |
| Confirmed scope decision | No AI features in the first version (no quality checks, drafting, test generation or agent access); possibly in a later version. Markdown export covers manual use of external AI tools. |
| Confirmed requirement | Deployment: the tool runs locally on each user's PC; data lives in a Git repository hosted like any other repo (GitHub or similar). Confirmed: the tool must work fully offline (all viewing, editing, linking, comparing, exporting and local commits); only push, pull and PR actions need a connection. How the local tool is built (desktop app, locally served web UI, etc.) is a product-form decision for the architecture stage, not yet decided. Confirmed: Windows is the primary OS; some teams use Linux. Inference (I): this argues for cross-platform technology and against Windows-only UI frameworks, unless Linux support is explicitly postponed. Confirmed: Windows only for the first releases; Linux later. Recommendation (R): treat "Linux possible without a rewrite" as a selection criterion in the technology stage. |
| Confirmed constraint | The first version is a proof of concept developed by Claude; technology choices are delegated to Claude. Only free, open-source dependencies whose licences also permit later commercial use. Inference (I): favour mainstream, well-documented technologies with strong automated testing, a repo that holds the specs and decisions so work continues across sessions, and a person on your side who builds and tries each release on Windows. Confirmed: you will run the trial builds; if the proof of concept proves valuable, a full team takes over. Recommendation (R): therefore keep the code readable and conventional, with tests and architecture notes, in a language a typical hiring team knows. |
| User hypothesis (decision delegated to Claude) | Product form: user suggested an HTML file opened in a browser that manages files in its folder (for UI/UX and ease of development). Decision criteria set by user: functionality first, then installation, updating, environment setup, UI/UX, performance and reliability. Preliminary inference (I), to be confirmed in the product-form evaluation: a browser UI is a good idea, but a plain HTML file is sandboxed — it cannot run Git, use the user's Git credentials/SSH keys, or freely read and write the repo folder (file access works only in Chromium browsers, with permission prompts). The likely fit is the same HTML/JavaScript UI packaged in a lightweight desktop shell, which adds full file and Git access, an installer and auto-updates. |

**Effect on the analysis (I):** this places the product in the docs-as-code group from section D (sphinx-needs, StrictDoc, Doorstop), which become the closest reference products alongside the five enterprise tools. It also makes the file format a core design decision: it must be text-based, diff- and merge-friendly, and give each requirement a stable ID that does not collide when two branches add requirements at the same time.

**1. Vision and market**

1. ★ What is the core thesis — why would someone choose your product over Jama, Polarion or a Jira plug-in? (e.g. simplicity for small teams, AI-native authoring, docs-as-code/Git, a specific industry, price, open source)
2. Is this a commercial product, an internal tool for your organisation, or open source?
3. Which industries do you target, and are they regulated (medical, automotive, aerospace, rail, none)?
4. What size of organisation: start-ups and small teams, mid-size engineering companies, or large enterprises?

**2. Users and scale**

1. Who authors requirements, who reviews them, and who only reads them? Are external parties (customers, suppliers, auditors) involved?
2. Expected users per organisation and concurrent users (roughly: 5, 50, 500, 5,000)?
3. ★ Expected size of a project: about 1,000, 10,000 or 100,000+ requirements?

**3. Requirement model**

1. ★ Document-centric or item-centric: do users think mainly in specifications to write and sign, or in a database of items to filter?
2. Must one requirement be able to appear in several documents or products without copying?
3. Fixed requirement types (e.g. stakeholder / system / software / test) or fully configurable types, fields and link types?

**4. Versioning and variants**

1. ★ Is linear history plus baselines enough, or do you need parallel versions (branches) for product variants or concurrent releases?
2. Do you need to compare any two baselines or revisions and see differences in text and links?
3. *(Follow-up — branching confirmed.)* Which branching do you need: (a) product variants that live in parallel for years, (b) parallel releases (maintain v1 while writing v2), (c) private drafts / change sets merged after review, or several of these? Must an approved change be propagated across branches, and must merge conflicts in requirement text be resolved in the tool? Answered: same model as GitHub — any branch can serve any purpose (release, draft, variant), merges happen through pull requests or merges, a change is carried to other branches by merge or cherry-pick, and conflicts are shown and resolved per requirement in the tool.

**5. Traceability and scope**

1. Which artifacts should live *inside* your product (requirements only, plus tests, risks, design elements) and which should be linked from other tools?
2. Should the product enforce traceability rules (e.g. "every system requirement must be verified by a test") or only report on them?

**6. Process and compliance**

1. Which standards must be supported, if any (ISO 26262, IEC 62304, DO-178C, FDA 21 CFR Part 11, ASPICE)?
2. Do approvals require electronic signatures, multi-step workflows, or is a simple status change enough?
3. How strict must the audit trail be (everything immutable vs. normal history)?

**7. Collaboration**

1. Do several people need to edit the same specification at the same time (real-time co-editing)?
2. Do you want a formal review process (invite reviewers, collect comments, sign off) in the first version?

**8. Integration and AI**

1. Which existing tools must it connect to (Jira, Azure DevOps, GitHub/GitLab, Word, Excel, ReqIF, modelling tools)?
2. What role should AI play: quality checking, drafting, test generation, giving AI coding agents governed access, or none initially?

**9. Deployment and constraints**

1. ★ Where must it run: vendor-hosted cloud, customer-hosted on-premises, air-gapped networks, or all of these? Any data-residency rules?
2. Must it work offline?
3. What are your team size, skills, timeline and budget for the first version?
4. Do you already have assumptions about the solution — e.g. desktop vs web, a language such as C# or Python, mobile? Please list them; I will record them as **hypotheses** to evaluate later, not as requirements.

## Architecture

**Recommendation (R): a modular monolith — one desktop application split into clearly separated modules with narrow interfaces.** There is no server, so microservices, event buses or client–server splits would add cost without benefit. Modules keep the code understandable for a future team and let parts (e.g. the Git host adapter) be swapped later.

The app has two processes, as all desktop-shell apps do: a **UI process** (the screens) and a **core process** (files, Git, indexing). The UI never touches the disk or Git directly; it calls a small, typed API exposed by the core. This is also the main security boundary.

| Module | Responsibility | Talks to |
| --- | --- | --- |
| UI | Table, item editor, links, compare/merge views, schema editor, Git panel | Core API only |
| Domain core | Items, links, hierarchy, schema validation, coverage rules, suspect-link logic — pure logic, no I/O | Repository store, Diff/merge |
| Repository store | Reads and writes item files and the schema file in the repo folder; atomic writes | File system |
| Diff / merge engine | Compares two versions of the requirement set per item and link; builds and applies merge resolutions | Repository store, Git adapter |
| Git adapter | Commit, pull, push, branch, tag, log, read file at any revision — by calling the installed Git | System Git |
| Index cache | Local, rebuildable search/filter index for speed at 10k–50k items; never the source of truth | Repository store |
| Import / export | CSV, Excel, Word, PDF, Markdown (ReqIF later) | Domain core |
| Git host adapter | Pull requests via the GitHub API; an interface so GitLab etc. can be added later | GitHub API (online only) |
| App services | Settings, auto-update, logging, crash reports kept locally | — |

API/service boundaries: the only external boundary is the Git host API (optional, online). Everything else is in-process.

**Design rules for replaceability and configurability (C, from your review):**

1. **One theme file.** A `theme` configuration defines design tokens — logo, fonts, colours, corner radii, spacing, light and dark palettes. Components use token names (e.g. `color.primary`), never literal values, so restyling or rebranding is a one-file change.
2. **One public interface per module.** Each module has a single entry file that declares its API (typed interface + short README). Other modules may import only that file; reaching into a module's internals is blocked by an automated lint rule on every build.
3. **Wiring in one place.** All modules are connected in a single composition file at start-up. Replacing a module (e.g. the Git adapter or the index cache) means writing a new implementation of the same interface and changing one line there.
4. **Settings over code.** Behaviour that teams may want to change — default schema, export templates, keyboard shortcuts, theme — lives in configuration files, not in code.
5. **Module map in the repo.** An architecture note lists every module, its interface and who uses it, kept up to date with each change.

## Data architecture

**Recommendation (R): one Markdown file per item with a YAML header, plus one schema file, all inside a `requirements/` folder of the project repo.** Git sees small, line-based text files, so diffs and merges stay clean; GitHub even renders each item readably, and nothing is locked into the tool.

```
requirements/
  .reqtool/schema.yaml     types, fields, link types, coverage rules (copied from the tool's default template)
  items/SYS-K7Q3XM.md      one file per item
  items/TC-9F2D4A.md
```

```markdown
---
id: SYS-K7Q3XM
type: system-requirement
title: Brake pedal response time
status: draft
priority: high
owner: m.hassan
parent: STK-2B8R1C
order: 30
tags: [braking]
links:
  - type: refines
    target: STK-2B8R1C
    confirmed: 4e1a9c
---
The system shall begin braking within 150 ms of pedal input.
```

| Decision | Choice (R) | Why / trade-off |
| --- | --- | --- |
| IDs | Type prefix + 6 random characters (e.g. SYS-K7Q3XM), assigned once and never reused | Sequential numbers (REQ-0042) collide when two branches create items at once; random IDs never do. Trade-off: less tidy than sequential numbers |
| File per item | Yes, named by ID | Two people editing different items never conflict; renaming a title never moves a file |
| Field layout | Fixed field order, one value per line | Keeps diffs and merges line-clean and predictable |
| Links | Stored only in the source item; reverse links computed by the index | No double bookkeeping, no half-updated link pairs |
| Suspect links | Each link stores a short fingerprint of the target's content when last confirmed; a mismatch marks it suspect | Works offline and survives branching, with no server |
| Hierarchy and order | `parent` field plus a numeric `order` with gaps (10, 20, 30) | Inserting an item rarely touches its siblings |
| History and baselines | Git log per file; baselines are Git tags | Nothing to build; consistent with the Git-first decision |
| Index cache | Local database file outside the repo, rebuilt from files when missing or stale | Fast filtering at 50k items without a second source of truth |
| Future compliance data | Optional header fields (e.g. approvals) can be added later; unknown fields are preserved | Satisfies NFR-09 without migration |

## Technology choices

**Recommended stack (R): Electron + TypeScript throughout, React for the UI, the installed Git for version control, SQLite as a local cache, packaged with electron-builder and auto-updated from GitHub Releases.** All parts are free and permissively licensed (MIT, ISC, Apache-2.0, BSD), which allows later commercial sale. Criteria, in your order: functionality and reliability; easy install and update; one language for a future team; Linux later; mainstream, well-documented tools. Library facts are **K**; picks are **R**.

| Decision | Realistic alternatives | Pick | Why |
| --- | --- | --- | --- |
| Desktop shell | Electron · Tauri 2 · Wails | **Electron** | Most mature, same Chromium engine on Windows and Linux, built-in PDF printing, everything in one language. Tauri is much smaller but needs Rust in the core and uses a different web engine on Linux — the strongest alternative if download size becomes important |
| Language | TypeScript · JavaScript · Rust/Go (with Tauri/Wails) | **TypeScript** | One typed language for UI and core; easiest for a future team to hire for and maintain |
| Git integration | Call the installed Git (via `simple-git`) · isomorphic-git (pure JS) · libgit2 bindings | **Installed Git** | Exactly the Git your team already uses, including their credentials and SSH keys, full merge support. isomorphic-git lacks SSH and full merging; libgit2 bindings for Node are poorly maintained. Requires Git for Windows on each PC — normal for GitHub users |
| UI framework | React · Vue · Svelte | **React** | Largest ecosystem for data-heavy tables and editors; most widely known |
| Table / large lists | TanStack Table + Virtual · AG Grid Community | **TanStack** | Fully MIT; virtual scrolling keeps 50k rows responsive |
| File parsing | `yaml` + `gray-matter` | as listed | Standard Markdown-with-YAML handling; preserves unknown fields |
| Index / search | SQLite (`better-sqlite3`, full-text search) · in-memory (MiniSearch) | **SQLite** | Handles 50k items with fast filtering and full-text search; rebuildable cache file |
| Exports | `docx` (Word), ExcelJS (Excel/CSV), Electron print-to-PDF, plain Markdown | as listed | All free; PDF reuses the app's own rendering |
| Imports | ExcelJS (MVP); `mammoth` for Word (Later) | as listed | Excel first, Word later as planned |
| GitHub API (MVP+) | Octokit · hand-written calls | **Octokit** | Official GitHub client library |
| Install / update | electron-builder (NSIS, per-user) + electron-updater via GitHub Releases · MSIX/Store | **electron-builder** | One-click per-user install without admin rights; free automatic updates |
| Testing | Vitest (logic) + Playwright (end-to-end UI) | as listed | Covers the reliability requirement; runs on every build |

What you need on each PC: Windows 11 and Git for Windows. Nothing else.

## Trade-offs, postponed decisions and risks

The main trade-off is accepting a larger app download (Electron, roughly 100+ MB) in exchange for one language, mature tooling and reliable behaviour. The main risk is merge quality on structured files, which is why requirement-level compare is in the prototype.

| Type | Item | Handling |
| --- | --- | --- |
| Trade-off | Random IDs (SYS-K7Q3XM) instead of tidy sequential numbers | Avoids branch collisions; can add an optional display number later |
| Trade-off | Depends on Git for Windows being installed | The tool checks at start-up and links to the installer |
| Trade-off | Links stored one-way in the source item | Reverse view always computed; nothing to keep in sync |
| Postponed | Git host adapters beyond GitHub; rich text with images and tables; ReqIF; compliance features; Linux and Windows 10 builds | Kept possible by the module boundaries and the extensible file format |
| Risk | Users editing item files by hand in ways the tool cannot read | Validate on load, show clear errors, never overwrite unreadable files |
| Risk | Large merges with many conflicts become confusing | Per-item conflict list with "mine / theirs / edit" choices; test with realistic data early |
| Risk | Performance at 50k items | Index cache plus virtual scrolling; a 50k-item test repo in the test suite |
| Risk | Continuity across Claude sessions | Specs, decisions (this document) and architecture notes live in the repo; every feature has tests |

**Status of conclusions:** product form, architecture, data format and stack were approved by you on 24 Oct 2026, with the configurability and modularity rules added (formerly recommendations, **R**). Next step: the implementation plan for the prototype (repository setup, milestones, test data), then building.

## Decisions and notes per milestone (moved from `CLAUDE.md`, 1 Nov 2026)

### M4 decisions (the owner, 25 Oct 2026) — already built

- ~~Pull that finds items changed on both sides stops~~ — replaced in 0.12.0 by per-requirement decisions (M8-7).
- ~~Branch is shown only~~ — create/switch since 0.12.0.
- ReqMan commits **only `requirements/`** (`git add --all -- requirements` + `git commit --only -- requirements`).
- Implementation notes: `src/modules/workspace/gitOps.ts` (rules + messages), `src/modules/git-adapter/systemGit.ts`
  (commands). In-memory conflict check = `git merge-tree --write-tree` (Git ≥ 2.38; the owner has 2.47); if it is
  unavailable the merge runs and is aborted on conflicts (safety net). Sign-in only via Git Credential Manager
  (`GIT_TERMINAL_PROMPT=0` so nothing hangs on an invisible prompt).

### M5 decisions (the owner, 25 Oct 2026) — already built

- Default comparison = "since my last pull" = what the last pull brought in (HEAD before → after the newest
  `pull…`/`merge <remote>/<branch>…` step in the reflog; pulls outside ReqMan count too).
- ~~ReqMan pulls right before any comparison~~ — **replaced 27 Oct 2026 (O-06): no automatic pulls; ReqMan offers to
  pull before remote-related actions.** Built in 0.10.0 (last-pull view and Push offer "Pull first").
- Exporting the comparison list → M6.
- Implementation: `src/modules/workspace/compare.ts`; `git diff --raw -z -M` gives blob IDs; contents come from
  `readBlobs()` (one `git cat-file --batch`). Naming objects `<rev>:<path>` instead was 40× slower with 10k files in
  one folder (tree lookups). Files that differ only in `confirmed:` lines are skipped before parsing.

### M6 decisions (the owner, 25 Oct 2026) — already built

- CSV separator: **comma**. Files: UTF-8 with BOM, CRLF; cells starting with `= + @` get a leading `'`.
- Next milestones in this order: **M7 Excel export + import**, then **M8 branches + per-requirement conflict
  resolution**.
- Export lives in `src/modules/import-export` (pure); `workspace.exportItems/exportCompare` build the content;
  `main/ipc.ts` shows the save dialog (last folder in `%APPDATA%\ReqMan\export-settings.json`). E2E mocks
  `dialog.showSaveDialog` (`saveAs()` helper in the journey).

### M7 notes (0.11.0) — built

- Excel export with ExcelJS (MIT; check size); import wizard (file → sheet → header row → column mapping guessed →
  type per row → preview with problems) writing uncommitted changes; update existing items by ID; read links; foreign
  IDs kept as `source-id`; outline numbers rebuild the hierarchy. Round trip test with the sandbox and
  `samples/sample-requirements.xlsx` (59 items).
- Plus "New project from a file", "Update the Excel file", "Publish to GitHub" and **export of chosen items**
  (Ctrl/Shift+click multi-select, right-click "Export this item and everything below it", tick box "Include the items
  below" ticked by default, overlaps once, document order, full outline numbers).

### M8 notes (0.12.0) — built

- `items/merge.ts` = pure 3-way merge per item; `workspace/merging.ts` = pull / pullFrom / finishPull / branches.
  `pull()` returns `{ ok:false, plan }` when questions remain; `finishPull(plan, answers)` re-analyses with the
  planned commit hashes (refuses if HEAD moved). Merge commit built with `commitTree` (temporary `GIT_INDEX_FILE`),
  then `merge --ff-only <commit>` with `GIT_REFLOG_ACTION="pull <source>"` (so lastPull finds it).
- The old "pull stops on a clash" path and its texts are gone; Undo last commit + Discard still exist.
- Skills: use `release-to-owner` for every release and `owner-decision-walkthrough` for every question round
  (the owner asked 29 Oct how much the skills helped: honest answer — they were not loaded before; CLAUDE.md duplicated them).

## Small things the owner has asked for or accepted along the way

- Light-mode success green `#22c55e` (brighter than first proposal).
- Scrollbars: at the right edge of their area, thumb only, no track.
- `theme.json` in `%APPDATA%` starts as an override-only file with a `_help` key (a full copy froze values).
- Table = tree when not searching/filtering; flat list (best match first) when searching or filtering.
- Header sort: ascending → descending → back to document order.
- Column widths: drag the header edge (double-click = automatic); personal like hidden/ordered columns (0.10.0).
- Hidden/ordered columns are personal (per repo, per PC, localStorage) — not shared through Git; field
  definitions are shared (schema.yaml).
- Type is editable in the editor since 0.9.0 (IDs no longer contain the type).
- Link edits are saved immediately and locked while the item has unsaved edits.
- Delete offers to remove incoming links (ticked by default).
