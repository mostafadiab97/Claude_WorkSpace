# Complete feature catalogue — every feature found in requirements tools, and where ReqMan stands (31 Oct 2026)

**Asked by the owner (31 Oct 2026):** after reading the market list of about 190 tools
(`2026-10-31-rm-tools-market-list.md`), a *complete* list of the features that exist in requirements tools: what each
one is, how it works, what it adds, whether ReqMan has it, how we would add it, and when. This is the input for the
long planning discussion; **nothing here is decided** — the "When" column is a proposal (R).

Replaces the shorter `2026-10-31-feature-gap-analysis.md` (23 features), which stays as the first summary.

## How to read it

- **Who has it** — groups from the market list: **ENT** enterprise suites (DOORS Next, Jama, Polarion, codebeamer,
  Visure, Perforce ALM, Dimensions RM, Cradle, Reqtify…), **MID** mid-market tools (ReqView, reqSuite, Modern
  Requirements, Spira, Innoslate, Flow, SysGit, Accompa…), **MED** regulated/medical (Matrix Req, Aligned Elements,
  Orcanos, Ketryx…), **MBSE** modelling tools (Capella, Cameo, GENESYS, Enterprise Architect…), **JIRA** Jira/Confluence
  add-ons (R4J, RTM, Requirement Yogi…), **WM/PM** work and product management tools (Jira, Azure DevOps, Aha!…),
  **TEST** test tools with coverage, **AIQ** quality/AI analysers (QVscribe, IBM RQA, ScopeMaster…), **DAC**
  docs-as-code and Git tools (Doorstop, StrictDoc, sphinx-needs, TRLC, OpenFastTrace, Reqord…).
- **Us** — ✅ have it · ◐ partly · ✗ missing · ⊘ deliberately not (with the decision).
- **Size** — S (days), M (one to two weeks), L (several weeks), XL (a product area of its own).
- **When (R)** — **N** = next versions (0.13–0.16 as proposed), **M** = MVP later in 2027, **C** = commercial stage,
  **D** = only on customer demand, **—** = out of scope for this product.
- Evidence: the tool features come from `docs/design/DESIGN.md` (sources there), the ReqView/Reqord comparisons of
  29–30 Oct (sources in `2026-10-31-feature-gap-analysis.md`) and established product knowledge of the listed tools
  (K). Vendor details change often; treat individual cells as indicative.

## Summary

| Area | Features | ✅ | ◐ | ✗ | ⊘ |
| --- | --- | --- | --- | --- | --- |
| A. Writing requirements | 16 | 2 | 4 | 10 | 0 |
| B. Structure and finding things | 13 | 7 | 1 | 5 | 0 |
| C. Traceability | 15 | 3 | 2 | 10 | 0 |
| D. Versions and change | 13 | 7 | 1 | 3 | 2 |
| E. Working together and review | 12 | 3 | 1 | 7 | 1 |
| F. Process and permissions | 8 | 2 | 2 | 3 | 1 |
| G. Quality and analysis | 9 | 0 | 1 | 8 | 0 |
| H. Verification and test | 7 | 1 | 1 | 5 | 0 |
| I. Safety, risk and compliance | 8 | 0 | 1 | 7 | 0 |
| J. Files in and out | 12 | 4 | 0 | 8 | 0 |
| K. Connections to other tools | 12 | 1 | 1 | 10 | 0 |
| L. AI | 10 | 0 | 1 | 9 | 0 |
| M. Platform and product | 14 | 5 | 3 | 4 | 2 |
| N. Planning and product management | 9 | 1 | 0 | 3 | 5 |
| O. Models and diagrams | 5 | 0 | 0 | 2 | 3 |
| **Total** | **163** | **36** | **19** | **94** | **14** |

**The short version.** ReqMan is already strong where requirements meet Git: branches, per-requirement merge, history,
compare, suspect links, Excel/ReqIF exchange, safety of data. The biggest gaps against every serious tool are the
*traceability views* (matrix, coverage, impact chain), *documents out* (Word/PDF/HTML), *review* (comments, approval
status) and *baselines*. Those are the candidates for the next versions; the large areas (AI, safety packs, integrations,
web version) belong to later stages.

---

## A. Writing requirements

| # | Feature | Who has it | Us | How it works · what it adds | How we would add it | Size · When |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | Structured items with custom fields | All | ✅ | Each requirement has typed fields (text, list, enum, number, date) defined per project. Lets teams record status, priority, owner, safety level… and filter by them. | Done: `schema.yaml` + Fields window. | — |
| A2 | Item types (requirement, test, risk, heading…) | All | ◐ | Each item has a type with its own meaning and allowed fields. Separates needs, requirements, tests, risks. | Types exist and can be changed per item; **editing the list of types in the window is missing** → a Types tab in the Fields window. | S · N |
| A3 | Headings / information items | All document tools | ✅ | Items that structure a document (chapters, notes) but are not requirements — excluded from coverage. | Done (`requirement: false` types). | — |
| A4 | Rich text: bold, italic, lists, links | ENT, MID, JIRA | ◐ | Formatted text instead of plain text. Readers expect documents to look like documents. | Text is Markdown already, so formatting is *stored*; missing: a **preview** and a toolbar editor (decided 27 Oct 2026 as a later version). Markdown preview first, then a Word-like editor writing Markdown. | M · N (preview), M (editor) |
| A5 | Tables inside the text | ENT, MID | ✗ | Tables of values (limits, modes) inside a requirement. Common in hardware and interface specs. | Markdown tables for simple grids; complex tables (merged cells) as HTML in the Markdown. Editor support with A4. Owner left this for a future decision (28 Oct). | M · M |
| A6 | Images and attachments | ENT, MID, MED | ✗ | Pictures, drawings, PDFs attached to an item. Needed for interface drawings, screenshots, datasheets. | Files in `requirements/attachments/<ID>/` (decided 27 Oct), referenced from the Markdown; Git LFS for large files later. Shown in preview and exports. | M · M |
| A7 | Equations | ENT (Polarion, DOORS), ReqView | ✗ | Formulas (MathML/LaTeX) in the text. Used in control and signal requirements. | LaTeX in Markdown (`$…$`) rendered with KaTeX (MIT). Comes almost free with the preview. | S · M |
| A8 | Item templates per type | ENT, MID, ReqView | ✗ | A new item of a type starts with prepared text ("The system shall…", acceptance criteria section). Consistent writing, faster authoring. | `template:` per type in `schema.yaml`; the editor fills it into new items. | S · N |
| A9 | Requirement formats (EARS, user story, "shall" patterns) | MID (reqSuite, Reqord), AIQ, Visure | ✗ | Guided sentence patterns: EARS ("When <trigger>, the <system> shall <response>"), user stories ("As a… I want… so that…"). Improves clarity and testability. | A pattern picker in the editor that inserts the skeleton; with G1 the quality check recognises the pattern. Stored as plain text (no lock-in). | S · N |
| A10 | Glossary / defined terms | ENT (Visure, Polarion), AIQ | ✗ | A list of defined terms; terms in requirements are highlighted and linked to their definition. Removes ambiguity ("user" vs "operator"). | Glossary items (a "term" type) + highlighting in the preview; quality check flags undefined capitalised terms. | M · M |
| A11 | Spell check | Most | ◐ | Underlines misspelled words. | Electron has the Chromium spell checker; switch it on in the editor (with Arabic and English dictionaries). | S · N |
| A12 | Undo / redo of edits | Most (missing in ReqView — reviewers complain) | ◐ | Take back the last edits. | Inside the editor the text field undoes; across saves, the Changes view ↶ takes back parts of uncommitted changes. Missing: a global "undo last action" (move, delete, link). → an action log in the workspace queue with inverse operations. | M · M |
| A13 | Duplicate / copy an item (with or without children) | All | ✗ | Make a new item from an existing one. Saves time for similar requirements. | "Duplicate" in the row menu: new IDs, same fields/text, optionally the subtree, links copied or not. | S · N |
| A14 | Bulk edit | All | ✗ | Choose many items → set status/owner/priority/tags at once. Daily need after reviews. | Multi-select exists (0.11.0); add "Set field for the N chosen items…" in the row menu; one write per file through the queue, one undoable change. | S · N |
| A15 | Find and replace across items | ENT, ReqView | ✗ | Replace a term in all texts (e.g. a renamed component). | Search exists; add a replace preview (list of items and the changed words) → write as uncommitted changes the user reviews in Changes. | S · M |
| A16 | Computed fields | codebeamer, Jama | ✗ | Fields calculated from others (e.g. risk = severity × probability, coverage %). | A small formula language in `schema.yaml` evaluated on read (never stored), shown in table/exports. | M · D |

## B. Structure and finding things

| # | Feature | Who has it | Us | How it works · what it adds | How we would add it | Size · When |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | Hierarchy / document tree | All | ✅ | Items in chapters and sub-chapters, like a specification document. | Done: parent + order keys, drag & drop, multi-move. | — |
| B2 | Automatic outline numbers (1.2.3) | All document tools | ✅ | Numbers follow the position and update after moves. | Done (calculated, never stored — no renumbering conflicts). | — |
| B3 | Several documents / modules per project | ENT (DOORS modules, Polarion LiveDocs), ReqView | ✗ | One project holds several specifications (customer spec, system spec, test spec), each with its own tree. | Owner decided one requirement set per repository (S-07, 27 Oct). Within it, **top-level headings act as documents**; a "document" filter + export per top-level chapter would give most of the benefit. | S · N (filter), ⊘ separate sets |
| B4 | One requirement in several documents (reuse by reference) | DOORS Next (base artifacts), Visure | ✗ | The same item appears in two documents without copying. | Would need references instead of one parent; conflicts with the simple file model. Only on demand. | L · D |
| B5 | Full-text search | All | ✅ | Find items by words in ID, title, text. | Done (SQLite full text, best match first). | — |
| B6 | Filters by type, field, links | All | ✅ | Narrow the table to what matters. | Done. | — |
| B7 | Saved views | All, ReqView | ✗ | Name a combination of filter, columns, sort ("Open safety requirements") and come back to it; share it with the team. | Personal views in local storage, shared views in `requirements/.reqman/views.yaml` (reviewed through Git). A "Views" drop-down. | S · N |
| B8 | Query language | ENT (cbQL, DOORS filters, Polarion Lucene) | ✗ | Typed queries: `type:SYS status:Draft links:none text:"brake"`. Power users find anything in one line. | Parse the search box: `field:value` words become filters; the rest stays full text. | S · M |
| B9 | Sorting by any column | All | ✅ | Click a header to sort. | Done (asc → desc → document order). | — |
| B10 | Column chooser, order, widths | All | ✅ | Show the fields that matter, in your order. | Done (personal, per repository). | — |
| B11 | Tags / labels | Most | ✅ | Free labels for grouping across the tree. | Done (list field "Tags"). | — |
| B12 | Collections / baselines of a subset ("release scope") | DOORS (collections), Jama (sets) | ◐ | A named set of items regardless of their place (e.g. "Release 2 scope"). | Today: a list field + saved view does this. A dedicated "Sets" panel is not needed unless asked. | S · D |
| B13 | Recently changed / my items / favourites | ENT, WM | ✗ | Quick lists: what changed this week, what I own, what I starred. | "Changed since…" uses Git (Changes view already compares); "my items" = owner field = Git user name; favourites in local storage. | S · M |

## C. Traceability

| # | Feature | Who has it | Us | How it works · what it adds | How we would add it | Size · When |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | Typed links between items | All | ✅ | "TC-1 verifies SYS-1", "SYS-1 refines STK-1"; read from both sides. The core of traceability. | Done (stored once on the source). | — |
| C2 | Suspect links | ENT, ReqView, Doorstop | ✅ | When a linked item changes, the link is marked for review. Shows what may be outdated. | Done (fingerprints, Keep/Unlink window). | — |
| C3 | Items without links (orphans) | All | ✅ | Find requirements nobody refines or tests. | Done (filter "without links"). | — |
| C4 | Link types editable in the window | All | ◐ | Add/rename link types and their reverse names without editing files. | Link types live in `schema.yaml`; add a Link types tab in the Fields window. | S · N |
| C5 | **Traceability matrix** | All ENT/MID, StrictDoc, sphinx-needs | ✗ | A grid: rows = items of one type, columns = items of another, a mark where a link exists. Reviewers and auditors read coverage at a glance. | A Matrix view: choose row type, column type, link type; virtual grid (10k × 10k safe by showing only linked/filtered items); export to Excel. | M · N |
| C6 | **Coverage analysis** | All ENT/MID, TEST, DAC | ✗ | "Which system requirements have no verifying test?", "% of needs refined". The first question in every review and audit. | Coverage rules per type in `schema.yaml` (e.g. system-requirement must be *verified by* test-case); a Coverage panel with % and the list of gaps; a filter "not covered". | M · N |
| C7 | Traceability rules / information model + score | Jama (TIM, trace score), Polarion | ✗ | The allowed links are declared (needs → requirements → tests); violations and a "trace score" are shown live. Makes traceability checkable, not a manual review. | Same rules as C6 plus "allowed link types between types"; warnings in the Problems list; a score in the status bar. | M · N |
| C8 | **Impact analysis across levels** | ENT, Reqord | ◐ | "If I change this requirement, what is affected?" — follows links several levels down/up. | Suspect links cover one level; add an "Impact" tab in the editor that lists the whole chain with depth, and an export. | S · N |
| C9 | Traceability graph | Reqord, sphinx-needs (needflow), Jama, MBSE | ✗ | A picture of items and their links (needs → requirements → tests). Helps explain and spot gaps. | Graph of the selected item's chain (a few hundred nodes) with a layout library (e.g. elkjs, EPL/MIT-compatible — to check); click a node to open it. | M · N |
| C10 | Links to source code | DAC (StrictDoc, OpenFastTrace, mantra, duvet), Reqtify | ✗ | Code comments or test names mention requirement IDs (`// REQ-K7Q3XMB`); the tool shows which requirements are implemented where. **Natural for a Git tool** — the code is in the same repository. | Scan the repository (outside `requirements/`) for IDs with `git grep`; show "Implemented in: file:line" per item; coverage rule "implemented". Optional, per project. | M · N |
| C11 | Links to test results | DAC, TEST, ENT | ✗ | Test reports (JUnit XML…) are read; each requirement shows passed/failed/not run. Closes the V-model loop. | Read JUnit XML files from a folder or a CI artifact; match test names/IDs to requirement IDs; "Verification status" column. | M · M |
| C12 | Links to external items (URLs, issues) | Most | ✗ | A link to a Jira issue, a GitHub issue, a document URL. | A `references:` list in the item (URL + title), clickable; no syncing. | S · N |
| C13 | Cross-project / cross-repository links | ENT, ReqView (linked projects) | ✗ | A requirement in project A traces to one in project B (system → subsystem specs). | Owner decided no cross-repo links for now (C). Later: `repo:` prefix in targets, read-only resolution through a second clone. | L · C |
| C14 | Cross-tool links (OSLC) | DOORS Next, Polarion, codebeamer | ✗ | Links to items in other tools without copying them, via the OSLC standard. | Only with a server; not for a serverless desktop tool. | XL · — |
| C15 | Link attributes / rationale | DOORS, Jama | ✗ | A note on a link ("why this test verifies this requirement"). | Optional `note:` per link in the file; shown in the Links section. | S · M |

## D. Versions and change

| # | Feature | Who has it | Us | How it works · what it adds | How we would add it | Size · When |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | History per item | All | ✅ | Every change with who/when/what. | Done (Git log + field-level comparison). | — |
| D2 | Compare any two versions | All | ✅ | What changed between two points, per requirement. | Done (Changes view). | — |
| D3 | Requirement-level difference view | ENT, ReqView | ✅ | Field and text differences, not file lines. | Done (split view, words marked). | — |
| D4 | Take back part of a change | Few (we are ahead) | ✅ | Undo one field/text/link of an uncommitted change. | Done (↶). | — |
| D5 | **Baselines (named frozen versions)** | All ENT/MID, ReqView, StrictDoc | ✗ | "Release 1.0" = the exact state of all requirements at a moment; compare today against it; deliver it. Every audit asks "which baseline?". | Git tags (`baseline/1.0`) created and listed in ReqMan; Compare offers "since baseline…"; export of a baseline. **Delayed by the owner (29 Oct).** | S · M |
| D6 | Branches / streams | DOORS Next, codebeamer, Polarion | ✅ | Parallel versions (a variant, a change in progress). | Done (0.12.0). | — |
| D7 | Merge per requirement | DOORS Next, codebeamer | ✅ | Combining branches item by item with conflict decisions. | Done (field-level 3-way merge). | — |
| D8 | Restore an old version of an item | Most | ◐ | Bring back an item as it was in an older version. | History shows old versions; add "Restore this version" (writes it as an uncommitted change). | S · N |
| D9 | Audit trail | All (MED strictly) | ✅ | Who changed what when, tamper-evident. | Git history; strict tamper-evidence comes with signed commits (D11). | — |
| D10 | Change requests | ENT, MED | ✗ | A formal request that groups proposed changes, with impact and approval, before the requirements change. | In a Git tool, a **branch + pull request** *is* a change request; ReqMan could show branches as change requests with their impact (C8) and approval (E5). | M · M |
| D11 | Signed changes | MED, compliance | ✗ | Each change cryptographically signed by its author. | Git supports signed commits (SSH/GPG); ReqMan shows "verified" and can require it. | S · C |
| D12 | Variants / product lines | codebeamer (+pure::variants), DOORS | ⊘ | One requirement set for many product variants with features switched on/off. | Branches cover simple variants; feature models only on demand. | XL · D |
| D13 | Lock an item while editing | ReqView (documents), DOORS Classic | ⊘ | Prevents parallel edits. | **Deliberately not**: parallel editing + merge is ReqMan's main difference. | — |

## E. Working together and review

| # | Feature | Who has it | Us | How it works · what it adds | How we would add it | Size · When |
| --- | --- | --- | --- | --- | --- | --- |
| E1 | Share work through a central place | All | ✅ | Everyone sees the same requirements. | Done (Git remote / GitHub). | — |
| E2 | Several people editing at the same time | ENT web tools, us | ✅ | No waiting for locks. | Done (files + merge). | — |
| E3 | **Comments / discussion threads per item** | ENT, MID, JIRA | ✗ | Questions and answers attached to a requirement, resolved when done. Keeps the "why" next to the item. | Two designs to decide: (a) comments as files `requirements/comments/<ID>.md` (offline, versioned, reviewed through Git), or (b) GitHub PR/issue comments shown in ReqMan (needs sign-in). Recommendation: (a) first. | M · N |
| E4 | @mentions and notifications | ENT, WM | ✗ | Tell a colleague; they get notified. | With E3(a): mentions highlighted, a "Mentions of me" list after a pull; e-mail/Teams needs a server → later. | S · M (list), C (push notifications) |
| E5 | **Approval status / sign-off** | All ENT, Reqord (PR-based) | ◐ | A requirement is "approved" only after the right people agree; who/when is recorded. | Status field exists; add PR-based approval (owner's decision: approval happens on GitHub): show per item "approved in PR #12 by X on date"; optional rule "Approved only via merged PR". | M · N |
| E6 | Formal review sessions | Jama Review Center, Polarion, DOORS | ✗ | A review package (a set of items) sent to reviewers who mark each item accepted/rejected/commented, with a summary. | A review = a branch + PR; ReqMan shows the PR's items with per-item verdicts stored as comments (E3). | L · M |
| E7 | Cheap reviewer access (no full licence) | Jama, Polarion | ✗ | Reviewers read and comment without being authors. | Free tool already; HTML publishing (J7) lets non-users read. | — |
| E8 | Owner / assignee per item | All | ✅ | Who is responsible. | Done (Owner field). | — |
| E9 | Tasks / to-dos on items | WM, ENT | ✗ | Action items attached to requirements. | Out of scope; link to GitHub issues instead (C12). | — · D |
| E10 | Real-time co-editing of one item | Web suites | ✗ | Two people type in the same text at once. | Needs a server; merge-on-pull covers the need offline. | XL · — |
| E11 | Presence ("Alice is editing SYS-12") | Web suites | ✗ | See who works on what right now. | Needs a server. Branch names and recent commits give a weak version. | — · — |
| E12 | Exclusive check-out | DOORS Classic, ReqView | ⊘ | See D13. | Deliberately not. | — |

## F. Process and permissions

| # | Feature | Who has it | Us | How it works · what it adds | How we would add it | Size · When |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | Status field | All | ✅ | Draft → Review → Approved → Obsolete. | Done (enum field). | — |
| F2 | Workflow engine (allowed transitions, guards) | ENT, MED | ⊘ | Status may only change along defined paths, sometimes with conditions (e.g. "Approved needs a reviewer"). | Decided: status stays a field (no engine). A light version: allowed transitions per type in `schema.yaml`, checked on save. | S · D |
| F3 | Who may change what (roles) | ENT, MED | ◐ | Read/write rights per project, type or field. | Git host rights already decide who can push; branch protection + CODEOWNERS decide who approves. Field-level rights would need a server. | — |
| F4 | Field permissions by role and state | codebeamer | ✗ | E.g. only QA may set "Verified". | CODEOWNERS on file paths can't express fields; a pre-push check (CLI, K10) can enforce rules in CI. | M · C |
| F5 | Required fields / validation rules | All | ◐ | A requirement can't be saved/approved without priority, owner… | Enum and type checks exist; add `required: true` per field and per status. | S · N |
| F6 | Mandatory review before merge | GitHub, ENT | ✅ | Changes reach main only after approval. | GitHub branch protection (owner's decision M8-2). | — |
| F7 | Process templates (ASPICE, ISO 26262, DO-178C) | codebeamer, Visure, StrictDoc | ✗ | Ready types, links, fields and rules for a standard. | Schema templates offered at "New project" (see I-area). | M · M |
| F8 | Electronic signatures (21 CFR Part 11) | MED, ENT | ✗ | Legally binding approvals with re-authentication. | Commercial; signed commits + approval records are the base. | L · C |

## G. Quality and analysis

| # | Feature | Who has it | Us | How it works · what it adds | How we would add it | Size · When |
| --- | --- | --- | --- | --- | --- | --- |
| G1 | **Wording quality checks** | AIQ (QVscribe, IBM RQA, RQA), Visure, ReqView, Reqord | ✗ | Flags vague words ("fast", "user-friendly", "etc."), passive voice, missing "shall", several requirements in one sentence, unbounded terms; often against INCOSE rules or EARS. Catches problems before review — cheap and visible. | Rule-based, no AI: word lists (English + Arabic later), sentence checks; a "Quality hints" column, a filter, hints in the editor. | S · N |
| G2 | Quality score (SMART) | Reqord, AIQ | ✗ | A number per requirement for specific/measurable/achievable/relevant/time-bound. | Derived from G1 hits; shown as a badge. | S · M |
| G3 | Duplicate / similar requirement detection | AIQ, AI tools | ✗ | Finds near-identical requirements. | Text similarity (shingles/MinHash) over the index, no AI needed; a "Similar items" list in the editor. | M · M |
| G4 | Completeness checks | ENT | ◐ | Missing fields, missing links, unresolved TBDs. | Problems list exists (broken files, bad values); add rules: required fields (F5), coverage (C6), "TBD" in text. | S · N |
| G5 | Consistency rules | ENT, TRLC | ✗ | Cross-item checks (a child's priority not higher than its parent's, units consistent). | Rules in `schema.yaml` evaluated in the index; shown as problems. | M · D |
| G6 | Dashboards / metrics | ENT, Reqord, WM | ✗ | Counts by status/type, coverage %, changes over time. | A small overview page fed by the index and Git log; export as image/PDF. | M · M |
| G7 | Health score | Reqord, Jama (trace score) | ✗ | One number for the project's state. | From G4 + C6 + G1. | S · M |
| G8 | Reports (custom, scheduled) | ENT | ✗ | Configurable reports (lists, matrices, charts) for management. | Through exports (Word/PDF/Excel with templates, J-area). | M · M |
| G9 | Change statistics | ENT, Git tools | ✗ | Who changed how much, churn per chapter — finds unstable requirements. | From `git log` per file; a column "changes in last 30 days". | S · M |

## H. Verification and test

| # | Feature | Who has it | Us | How it works · what it adds | How we would add it | Size · When |
| --- | --- | --- | --- | --- | --- | --- |
| H1 | Test cases as items, linked to requirements | All | ✅ | Tests are items; "verifies" links connect them. | Done (test-case type, links). | — |
| H2 | Test steps (structured) | TEST, ENT, Spira | ✗ | Test cases with numbered steps and expected results. | A Markdown convention (numbered list / table) with an editor helper; no separate module. | S · M |
| H3 | Test runs and results | TEST, ENT | ✗ | Record pass/fail per test per run; history of results. | Results files per run (`requirements/results/<run>.yaml`) or imported JUnit XML (C11). | M · M |
| H4 | Verification status per requirement | ENT, TEST, DAC | ◐ | Requirement shows verified/failed/not verified from its tests' results. | Coverage (C6) + results (H3/C11) → a computed column. | S · M |
| H5 | Test management integration | ENT, JIRA (Xray…) | ✗ | Sync with TestRail, Xray, qTest. | Through result files first; direct connectors commercial. | M · C |
| H6 | Requirements-based test generation | AI tools, Tricentis, Agile Designer | ✗ | Proposes test cases from requirement text. | With AI (L-area). | M · C |
| H7 | Validation (stakeholder acceptance) | ENT | ✗ | Separate from verification: needs accepted by customers. | A link type "validated by" + coverage rule; no new module. | S · N (as schema) |

## I. Safety, risk and compliance

| # | Feature | Who has it | Us | How it works · what it adds | How we would add it | Size · When |
| --- | --- | --- | --- | --- | --- | --- |
| I1 | Risk items and risk matrix | ENT, MED | ◐ | Risks with severity/probability, a matrix view, mitigations linked. | Risk type exists; add severity/probability fields, computed risk level (A16), matrix view. | M · D |
| I2 | FMEA tables | codebeamer, Jama, MED | ✗ | Failure modes with effects, causes, RPN; linked to requirements. | An FMEA item type + table view; only for safety customers. | L · D |
| I3 | Hazard analysis (ISO 14971, ISO 26262 HARA) | MED, ENT | ✗ | Hazards → harms → risk controls → requirements. | Schema template + matrix/coverage. | M · D |
| I4 | Standards templates (ISO 26262, DO-178C, IEC 62304, ASPICE) | codebeamer, Visure, StrictDoc, MED | ✗ | Ready schemas, rules and document templates for a standard. | Schema templates (F7) + export templates (J5). | M · C |
| I5 | Compliance matrix | MED, ENT | ✗ | Clauses of a standard mapped to the requirements that satisfy them. | Standard clauses as items of a "clause" type + matrix (C5). | S · M (with C5) |
| I6 | Design history file / technical file | MED | ✗ | The collected documents an auditor needs, generated. | A document bundle export (J5) of a baseline (D5). | M · C |
| I7 | Tool qualification kit | ENT (for DO-178C/ISO 26262) | ✗ | Evidence that the tool itself is reliable. | Our automated tests + self-test are the base; a qualification report is commercial work. | L · C |
| I8 | Safety levels (ASIL, DAL, SIL) | ENT, MED | ✗ | A field with allowed values and rules (decomposition). | A field already possible; rules with G5. | S · D |

## J. Files in and out

| # | Feature | Who has it | Us | How it works · what it adds | How we would add it | Size · When |
| --- | --- | --- | --- | --- | --- | --- |
| J1 | Excel import/export (round trip) | All | ✅ | Exchange with people who work in Excel. | Done, incl. writing back into the original file. | — |
| J2 | CSV | All | ✅ | Simple exchange. | Done. | — |
| J3 | ReqIF | ENT, ReqView | ✅ | Standard exchange with DOORS, Jama, Polarion. | Done (validated against the OMG schema). | — |
| J4 | Markdown export | DAC | ✅ | For AI tools and Git reviews. | Done. | — |
| J5 | **Word export with templates** | All except DAC/Reqord | ✗ | A real specification document (cover, headings with numbers, tables of attributes, links), from a company template. The deliverable customers and auditors expect. | docx library (`docx`, MIT) with a template system (styles from a .dotx); scope = all / chosen / baseline. | M · N |
| J6 | **PDF export** | All | ✗ | A fixed document for sign-off and printing. | Render the same document HTML with Chromium's print-to-PDF (built into Electron). | S · N |
| J7 | **HTML publishing** | DAC (StrictDoc, sphinx-needs, Doorstop), Reqord | ✗ | A static website of the specification (search, links clickable) for people without the app — e.g. on GitHub Pages or an intranet. | Same document renderer → folder of HTML files; optionally a GitHub Action that publishes on every merge. | M · N |
| J8 | Word import | ENT, MID (ReqView, AI import) | ✗ | Turn an existing Word specification into items (headings → hierarchy, paragraphs → requirements). | mammoth (BSD) → HTML → rules (heading levels, "shall" sentences) → the import wizard's preview. | M · M |
| J9 | PDF import | ReqView (AI), MID | ✗ | Extract requirements from PDFs. | Text extraction + rules; good results need AI. | M · C |
| J10 | JSON / API export | DAC, ENT | ✗ | Machine-readable dump for scripts. | `requirements.json` export (all items + links); the CLI (K10) prints it. | S · N |
| J11 | Print view | Most | ✗ | Print what is on screen. | Comes with J6. | S · N |
| J12 | Diagram/image export of views | ENT | ✗ | Save the matrix/graph as an image. | With C5/C9. | S · N |

## K. Connections to other tools

| # | Feature | Who has it | Us | How it works · what it adds | How we would add it | Size · When |
| --- | --- | --- | --- | --- | --- | --- |
| K1 | GitHub (repositories, pull requests) | DAC, Reqord, SysGit | ✅ | Hosting, review, approval. | Done for Git; PR view/approval is E5. | — |
| K2 | GitLab / Bitbucket / Azure Repos | DAC, SysGit | ◐ | Same as GitHub on other hosts. | Plain Git already works with any host; host-specific PR features need adapters. | M · C |
| K3 | Jira | All ENT/MID, JIRA | ✗ | Requirements linked to Jira issues; status synced. | First C12 (links), then a read-only status fetch with a token; two-way sync commercial. | M · C |
| K4 | Azure DevOps Boards | Modern Requirements, ENT | ✗ | Same for Azure DevOps. | As K3. | M · C |
| K5 | GitHub Issues | Reqord | ✗ | Create issues from requirements; show their state. | Through `gh`/REST with the user's sign-in; read-only first. | M · M |
| K6 | Modelling tools (Enterprise Architect, Cameo, Capella) | ENT, MBSE, ReqView | ✗ | Requirements shown in models and back. | ReqIF is the common bridge (done); direct plug-ins commercial. | L · C |
| K7 | Simulink / MATLAB | Polarion, DOORS, Reqtify | ✗ | Requirements linked to model blocks. | Via ReqIF / Simulink Requirements import; on demand. | L · D |
| K8 | Test tools | TEST, ENT | ✗ | See H5. | Result files first. | M · C |
| K9 | Chat (Teams, Slack) notifications | WM, ENT | ✗ | Messages when items change. | Needs a server or a GitHub Action posting on merge — the Action is possible without our server. | S · M (Action) |
| K10 | **Command line / CI check** | DAC, Reqord, ReqView | ✗ | `reqman check` in a GitHub Action: broken links, missing fields, coverage rules, quality hints — on every pull request. Makes "reviewed like code" real and enforces rules without a server. | Package the core modules as a CLI (they are already separate from the window); a ready GitHub Action file. | M · N |
| K11 | REST API / plug-in API | ENT | ✗ | Other programs read/write requirements. | The files *are* the API (documented format); a local API only if needed. | — · D |
| K12 | Webhooks | ENT, WM | ✗ | Call other systems on changes. | GitHub webhooks already fire on push. | — |

## L. AI (all enterprise tools added this in 2025–26)

| # | Feature | Who has it | Us | How it works · what it adds | How we would add it | Size · When |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | Write / improve a requirement | ENT, reqSuite, Copilot4DevOps, AIQ | ✗ | Suggests clearer wording, EARS form, splits compound requirements. | Optional AI provider set by the user (own API key or local model); suggestions shown as a difference the user accepts. Governed: nothing leaves the PC without consent. | M · C |
| L2 | Generate requirements from documents | ENT, MID | ✗ | Drafts items from meeting notes, specs, PDFs. | Through J8/J9 + L1. | M · C |
| L3 | Test generation | ENT, TEST | ✗ | H6. | — | M · C |
| L4 | Trace suggestions | ENT, research tools | ✗ | Proposes missing links by meaning. | Embeddings (local model possible) over item texts. | M · C |
| L5 | Change summaries | ENT, AI tools | ✗ | "What changed in this pull" in plain words. | Feed the Changes view's data to the model. | S · C |
| L6 | Chat with the specification | ENT, AI tools | ✗ | Ask questions about the requirements. | With an AI provider; or through an AI coding tool reading the Markdown files (works today). | M · C |
| L7 | AI-ready export / context | Reqord | ◐ | A compact export of an item and everything linked, for AI tools. | Markdown export exists; add "export with linked items" (follows C8). | S · N |
| L8 | MCP server | Jama, Visure, jama-cli, community servers | ✗ | AI agents (Claude, Copilot) read and edit requirements through a standard protocol. | A small local MCP server on the core modules (read, search, trace, propose changes as uncommitted edits). Fits our file model well. | M · M |
| L9 | Quality analysis with AI | AIQ, ENT | ✗ | G1 with language understanding. | After the rule-based G1. | M · C |
| L10 | Similarity with AI | AIQ | ✗ | G3 with meaning instead of words. | After G3. | M · C |

## M. Platform and product

| # | Feature | Who has it | Us | How it works · what it adds | How we would add it | Size · When |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | Works offline, no server | DAC, ReqView, us | ✅ | Everything local; sync when online. | Done. | — |
| M2 | Windows app | Most desktop tools | ✅ | — | Done (Windows 11; Windows 10 build asked for commercially). | — |
| M3 | macOS / Linux | ReqView, DAC, MBSE | ✗ | Teams with Macs and Linux PCs. | Electron builds both; needs signing (macOS) and a test round. | M · M |
| M4 | Web / browser version | ENT SaaS, MID SaaS | ✗ | Use without installing; managers and customers. | HTML publishing (J7) covers reading; a full web editor needs a server — a different product. | XL · — |
| M5 | Multi-user server / SaaS | ENT, MID | ⊘ | Central server with accounts. | Deliberately not (offline-first, access = Git host). | — |
| M6 | Single sign-on, accounts | ENT | ⊘ | Company login. | Git host sign-in (Credential Manager) does it. | — |
| M7 | Themes, dark mode, custom look | Some | ✅ | Comfort and branding. | Done (theme file). | — |
| M8 | **Several languages (UI)** | ENT (DE/FR/JA/ZH), reqSuite (DE) | ◐ | The window in the user's language. | **In progress (0.13.0): Arabic + English switch, right-to-left.** More languages = one copy of `text.ts` each. | M · N |
| M9 | Accessibility (keyboard, screen readers) | ENT | ◐ | Usable without a mouse, with screen readers. | Roles/labels exist (tests use them); add a keyboard-shortcut list and full keyboard navigation in the table. | M · M |
| M10 | Automatic updates | Desktop tools | ✅ | — | Done. | — |
| M11 | Scale (100k+ items) | ENT | ◐ | Large programmes. | Tested to 50k; 100k needs faster first indexing (see Rust evaluation, TypeScript wins). | M · M |
| M12 | Licensing / trial | All commercial | ✗ | Sell the product. | Commercial stage (S-08). | M · C |
| M13 | Code signing of the installer | Commercial | ✗ | No browser/SmartScreen warnings. | Certificate (paid) — commercial stage (X-02). | S · C |
| M14 | In-app self-test / diagnostics | Rare | ✅ | The user checks the installation. | Done (release self-test). | — |

## N. Planning and product management (mostly other tools' territory)

| # | Feature | Who has it | Us | How it works · what it adds | How we would add it | Size · When |
| --- | --- | --- | --- | --- | --- | --- |
| N1 | Priority | All | ✅ | — | Done. | — |
| N2 | Estimates (hours, complexity) | Reqord, WM | ✗ | Effort per requirement. | A number field (possible today); totals per chapter in the status bar. | S · D |
| N3 | Releases / roadmap assignment | PM (Aha!, Jama), Spira | ✗ | Which requirements go into which release. | A "Release" field + saved views; baselines (D5) freeze them. | S · M |
| N4 | Gantt / critical path | Reqord, WM | ⊘ | Schedule view. | Project-management territory; out of scope. | — |
| N5 | Kanban boards | WM | ⊘ | Cards by status. | Out of scope (status filter + views suffice). | — |
| N6 | Stakeholder management | ENT, MID (Accompa) | ⊘ | Who asked for what; stakeholder lists. | A "source/stakeholder" field covers it. | — |
| N7 | Elicitation: interviews, surveys, voting, feedback portals | PM, Accompa, Olive | ⊘ | Collect needs from customers. | Out of scope (import their results via Excel). | — |
| N8 | Use-case / user-story mapping | CaseComplete, PM | ⊘ | Story maps, use-case flows. | Out of scope; user-story format (A9) covers writing. | — |
| N9 | Feedback loop from implementation | Reqord | ✗ | Issues raised during implementation flow back to requirements. | With K5 (GitHub issues) + C12. | S · M |

## O. Models and diagrams

| # | Feature | Who has it | Us | How it works · what it adds | How we would add it | Size · When |
| --- | --- | --- | --- | --- | --- | --- |
| O1 | Diagrams inside requirements | ENT, MID | ✗ | Flowcharts, state machines drawn in the text. | Mermaid in Markdown (MIT), rendered in the preview and exports — text-based, diffable in Git. | S · M |
| O2 | SysML requirement diagrams | MBSE | ⊘ | Requirements as model elements. | Modelling-tool territory; ReqIF bridge. | — |
| O3 | Model ↔ requirement sync | MBSE, ENT | ⊘ | Requirements live in the model. | Out of scope. | — |
| O4 | Prototypes / mock-ups linked to requirements | iRise | ⊘ | Clickable UI mock-ups. | Out of scope (attachments A6 hold images). | — |
| O5 | Context/architecture diagrams generated from links | MBSE, sphinx-needs | ✗ | Pictures of system structure from items. | With the graph view (C9). | S · M |

---

## Proposed order for the planning discussion (R)

The discussion should decide the order; this is a starting point, grouped so each version gives the owner something
testable in five steps.

1. **Traceability you can see** — C5 matrix, C6 coverage, C7 rules, C8 impact chain, C4 link types and A2 item types in
   the window, F5 required fields, G4 completeness. *Why first:* every competitor has it, our data already supports it,
   and it is what reviews and audits ask for.
2. **Daily comfort** — A14 bulk edit, A13 duplicate, B7 saved views, A8 templates, A9 EARS patterns, G1 quality hints,
   D8 restore a version, A11 spell check, C12 external references.
3. **Documents out** — J5 Word with templates, J6 PDF, J7 HTML publishing, A4 Markdown preview, A7 equations, O1 Mermaid
   diagrams, J10 JSON.
4. **Review on GitHub** — E5 approval status from pull requests, E3 comments (design choice a/b), D10 change requests as
   branches, D5 baselines (when un-delayed).
5. **Engineering traceability** — C10 links to code, C11/H3/H4 test results and verification status, K10 command line +
   GitHub Action, C9 graph, L7/L8 AI-ready export and MCP server.
6. **Later / commercial** — A5/A6 tables and attachments with the rich editor, J8 Word import, M3 macOS/Linux, G6
   dashboards, I-area safety packs, K-area connectors, L-area AI assistance, D11/F8 signatures, M12/M13 licensing and
   signing.
