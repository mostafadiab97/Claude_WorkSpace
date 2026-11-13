# What is still open in the review documents — 13 Nov 2026 (state: v0.22.0)

The owner asked: "go through the review documents that aren't in the done folder, and tell me what is not complete yet in
these documents to complete it". Ten documents were read (everything directly in `docs/reviews/` except `README.md`,
`done/` and `agents/`) and every open point was checked against the code, `CHANGELOG.md`, `docs/STATUS.md` and
`docs/design/roadmap.md`. Nothing else was changed (no other file edited, nothing committed).

Classes: **DONE** = built, but the document does not say so · **OPEN** = still has to be built · **OWNER** = needs a
decision from the owner · **REF** = study or catalogue, nothing to do · **NO** = decided against or replaced.
Sizes: S = under half a day, M = up to 2 days, L = longer. Versions are suggestions (R), not decisions.

Two things stand out:

1. **Themes 2 to 5 are decided but not built.** The planning discussion (1–2 Nov) decided everything for daily comfort
   (bulk edit, duplicate, saved views, templates, wording hints, spell check), rich text and images, documents out
   (Word, PDF, HTML), review on GitHub (sign-in, comments, pull requests), verification (links to code, test results,
   command-line check), sharing and AI. None of it exists in the code yet (checked by searching the source), and the
   roadmap's version table no longer has a place for it: versions 0.14 to 0.22 were used for health, rename, structure,
   traceability, the two reviews and the visual polish. After 0.25 the roadmap only says "Word export, then 1.0".
2. **The public release repository has all its decisions (12–13 Nov) but nothing is built yet** — no `LICENSE`, no
   publish script, no public README, no public requirements folder. Its document, the README index and STATUS still say
   "open", "4 questions" or "licence to confirm".

---

## 1. Summary per document

| # | Document | What it is for | Suggestion | DONE | OPEN | OWNER | REF | NO |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `2026-10-31-feature-catalogue.md` | 163 features of ~190 tools, have / missing, how to build | **Keep as reference** (themes 2 to 5 still use it); add one line "state at 0.22.0" — its have / missing marks are from 31 Oct | 0 | 0 (tracked as P-xx in No. 3) | 0 | 163 features | 0 |
| 2 | `2026-10-31-rm-tools-market-list.md` | The 190 tools by kind (for the naming work) | **Move to `done/`** (naming finished; sources stay readable there) | 0 | 0 | 0 | 1 | 0 |
| 3 | `2026-11-01-planning-discussion.md` | 41 planning points P-01…P-41 and the release plan | **Keep open** until themes 2 to 5 are built or re-planned; update its release plan table (versions no longer match) | 9 | 26 | 1 (plan, see O-1) | 7 | 1 part (P-30 trace list) |
| 4 | `2026-11-02-requiem-analysis.md` | Study of a similar command-line tool, 5 ideas | **Move to `done/`** (3 of 5 ideas are P-12, P-32, P-33; 2 already built) | 2 | 3 (same as P-12, P-32, P-33, not counted again) | 0 | 1 | 0 |
| 5 | `2026-11-04-next-round.md` | 1a structure questions, review plan, helper agents | **Move to `done/`** (README already says "Done") | 20 | 0 | 1 (drawn commit graph, O-4) | 0 | 1 (S-01, replaced by S-10) |
| 6 | `2026-11-04-public-release-repo.md` | How files move to the public repository; licence; other systems | **Keep open** — it is the working list for the public repository; fix its stale status lines first | 3 stale marks | 9 | 1 | 0 | 2 (installers-only, moving history) |
| 7 | `2026-11-05-project-review.md` | Whole-project review 1 (0.16.2): 6 High, 41 Medium, 101 Low | **Move to `done/`** (README already says so; its leftover Lows were re-checked in review 2) | 17 (6 High + 11 owner questions) | 0 | 0 | 0 | 0 |
| 8 | `2026-11-08-1b-traceability.md` | Theme 1b details T-01…T-08 | **Move to `done/`** (built in 0.20.0, README says "Done") | 8 | 0 | 0 | 0 | 0 |
| 9 | `2026-11-10-project-review.md` | Whole-project review 2 prelude, 0.20.1: 6 High, 44 Medium, 86 Low | **Move to `done/`** — every open point is carried into the 12 Nov review | 41 (+ 8 owner answers) | 7 (carried to No. 10) | 0 | 0 | 1 (W-30, owner kept the permission) |
| 10 | `2026-11-12-project-review-2.md` | Review of 0.21.1; plan 0.21.2 to 0.21.4; leftovers in section F | **Keep open** — it holds the list of leftovers (Lows, speed at 50,000 items, screens) | 3 stale marks | 26 listed + 1 bundle of about 55 smaller hardening Lows (estimate) | 0 | 0 | 0 |

Counts for No. 3: DONE = P-04, P-06, P-07, P-08, P-09 (documents part), P-10, P-11, P-40, P-41. REF = P-01, P-02, P-03,
P-05, P-24, P-35, P-36 (information or plan structure). OPEN = P-09b (links across repositories), P-12…P-23,
P-25…P-34, P-37, P-38, P-39.

---

## 2. Every OPEN and OWNER item

### 2a. Needs the owner's decision

| ID | Document | In plain words | Size | Suggested version |
| --- | --- | --- | --- | --- |
| O-1 | Planning discussion (P-02), roadmap | **Where do themes 2 to 5 go in the plan?** They are decided, but the roadmap has no version for them. Today's list is Windows 10 (0.23), Linux (0.24), theme editor (0.25), Word export, then 1.0. Which of themes 2 to 5 (daily comfort, rich text, review on GitHub, verification) must come before 1.0, and which after the pilot's verdict? | decision | before 0.23 |
| O-2 | Planning (P-24 vs marketing D-1) | **Word export before rich text?** In the plan, rich text (3a) comes first because documents need it. The marketing decision D-1 says 1.0 waits for Word export. Do we ship Word export with today's plain Markdown text (tables and images later), or build rich text first? | decision | with O-1 |
| O-3 | Public repository | **Who creates the access key** that lets the release workflow push to the public repository (a key stored in GitHub settings)? It touches the owner's account, so he creates it; Claude explains the steps. Also confirm that the first copy is checked by him before anything is pushed. | S (owner) | when the public repository is made |
| O-4 | Next round (S-09) | **A drawn picture of the commit history** (the "graph" with lines for branches). 5 Nov: "a drawn graph later". Today the history is a list. No theme names it. Want it, and when? (A free library, CommitGraph, would be checked for its licence first.) | M | optional; after O-1 |
| O-5 | Public repository §7 | **Windows 10 and Linux:** the document says "the owner decides after the licence"; the roadmap already lists 0.23.0 Windows 10 and 0.24.0 Linux as planned and marketing D-1 makes Windows 10 a condition for 1.0. Confirm both are wanted in this order. | decision | 0.23.0 / 0.24.0 |

### 2b. Needs building

| ID | Document | In plain words | Size | Suggested version |
| --- | --- | --- | --- | --- |
| **Theme 2: daily comfort** | | | | |
| P-12 | Planning | Five time-savers: change a field on many chosen items at once, copy an item, saved views, templates per type, restore an older version of one item | L | 0.26.0 (theme 2) |
| P-13 | Planning | "Duplicate item": copies fields and text with new IDs, children only if ticked, links not copied | S | with P-12 |
| P-14 | Planning | Saved views (filter + columns + sort): personal on this PC, or shared with the team in a file in the project | M | with P-12 |
| P-15 | Planning | Writing help: sentence patterns (EARS, user story), yellow hints for vague words / missing "shall", spell check; never blocks saving | M | with P-12 |
| P-16 | Planning | References to things outside the project (a Jira ticket, a datasheet, a web page) | M | theme 5 |
| **Theme 3b: documents out** | | | | |
| P-17 | Planning | Export a whole document as Word, PDF, Markdown, CSV (Markdown and CSV exist for tables; Word and PDF do not) | L | before 1.0 (D-1) |
| P-18 | Planning | Company look in Word: a `.docx` template stored in the project, a plain built-in one when none is given | M | with P-17 |
| P-19 | Planning | What an exported document contains: title page (document name, baseline, commit, date), table of contents, items in outline order, optional traceability table | M | with P-17 |
| P-39 | Planning | One self-contained HTML file (search, clickable links, opens in any browser, can be e-mailed) as another export | M | with P-17 |
| **Theme 3a: rich text** | | | | |
| P-20 | Planning | Formatted preview and a Word-like editor (bold, lists, tables) that still stores plain Markdown | L | 0.27.0 |
| P-21 | Planning | Diagrams (Mermaid) kept as small files next to the item | M | with P-20 |
| P-22 | Planning | Equations in the text | M | with P-20 |
| P-23 | Planning | Images in requirements (files in the project), shown side by side in Compare, warning above 5 MB | M | with P-20 |
| **Theme 4: review on GitHub** | | | | |
| P-25 | Planning | "Sign in with GitHub" through the browser, key kept encrypted by Windows, all host calls behind one adapter so other hosts can follow | L | theme 4a |
| P-27 | Planning | Comments on a requirement, stored as files in the project (works offline, travels with branches) | L | theme 4a |
| P-28 | Planning | Optional rule: "Approved" only through a merged pull request (approver and date read from GitHub) | M | theme 4a |
| P-38 | Planning | Details of that rule: editing an Approved item moves it to Review when the edit is pushed | M | with P-28 |
| P-26 | Planning | Pull requests inside the app: list, create, approve, request changes, merge; a branch with its pull request shown as a change request | L | theme 4b |
| P-29 | Planning | Formal review sessions: each reviewer marks every item accepted / rejected / comment, summary per review | L | theme 4b |
| **Theme 5: verification, sharing, AI** | | | | |
| P-30 | Planning | Links from requirements to code: scan a code folder for IDs in comments, or read Doxygen output (the hand-made trace list was dropped) | L | theme 5a |
| P-31 | Planning | Test results (JUnit files, manual and hardware-in-the-loop runs) and a "Verification" column | L | theme 5a |
| P-32 | Planning, Requiem | Command-line check (broken or suspect links, missing fields, coverage gaps), run locally on a chosen branch when asked | M | theme 5a |
| P-33 | Planning, Requiem | Traceability graph picture, JSON export, include a requirement in other documents | L | theme 5b |
| P-34 | Planning | AI export of an item with everything linked, and a local MCP server for AI assistants (proposals only, never commits) | L | theme 6 |
| P-37 | Planning | `AI-GUIDE.md` in every requirements folder (format rules for any AI that edits the files) | S | theme 6 |
| P-09b | Planning | Links between repositories (short alias before the ID, declared in the schema) | L | later / commercial |
| **Public release repository** | | | | |
| PR-1 | Public repo §2, §3 | Publish script with an allow-list (`tools/public-files.txt`, `tools/publish-public.mjs`): copies the release commit's files into the public repository, runs the privacy check, builds, one commit per version. Neither file exists | M | before 1.0 |
| PR-2 | Public repo §2 | Files written for the public repository: README, `HOW-IT-WAS-BUILT.md`, `SECURITY.md`, a user-facing `CHANGELOG.md`; adapted workflows | M | with PR-1 |
| PR-3 | Public repo §6 | `LICENSE` with the PolyForm Shield 1.0.0 text (decided 13 Nov, L-2). `package.json` still says `UNLICENSED` | S | with PR-1 |
| PR-4 | Public repo §5 Q3 | reqochet's own public requirements as a reqochet project folder, published with every public version (the sample project and the living specification) | L | before 1.0 |
| PR-5 | Public repo §5 Q4 | Issues switched on with a template that asks for the problem report | S | with PR-1 |
| PR-6 | Public repo §4a | Public repository builds as `reqochet` (own name, app ID `com.reqochet.app`, own update feed) | M | with PR-1 |
| PR-7 | Public repo §6, STATUS | Website redesign by the `web-designer` helper (branch `website-design`) | M | before launch |
| PR-8 | Public repo §7 | Windows 10 support (checked by Claude only) | M | 0.23.0 |
| PR-9 | Public repo §7 | Linux build (AppImage + .deb, Linux CI job, paths, case-sensitive files) | L | 0.24.0 |
| **Review 2 leftovers (section F)** | | | | |
| UW-04 | Review 2 | Counts say "items" in one place and "files" in another | S | 0.22.1 |
| UW-07 | Review 2 / W-46 | Matrix column headers look alike | S | 0.22.1 |
| UW-08 | Review 2 | Read-only form (old version) looks like an editable one | S | 0.22.1 (re-check, 0.22.0 changed borders) |
| UW-09 | Review 2 / W-47 | A new project's Changes screen opens with a paragraph about the schema | S | 0.22.1 |
| UW-10 | Review 2 | Links and buttons are styled alike | S | 0.22.1 (re-check after 0.22.0) |
| UW-11 | Review 2 | Column order of the table in Arabic | S | 0.22.1 |
| UW-13 | Review 2 | The "parent" control in the item form | S | 0.22.1 |
| UW-14 | Review 2 | Document picker in the Traceability view | S | 0.22.1 |
| UW-19, UW-20 | Review 2 | Missing small items; notes should be announced to screen readers (`role="alert"`) | S | 0.22.1 |
| B-04, B-05, B-07, B-09, B-11 | Review 2 | Five small UI/UX points from the helper report (named in `agents/whole-project-0.21-ui-ux*.md`) | S each | 0.22.1 |
| B-03 (rest) | Review 2 | Tab rows need `tabpanel` ids for screen readers | S | 0.22.1 |
| PW-03 | Review 2 / W-24 | Coverage gap count is recomputed on every change (0.6 s at 50,000 items) | M | 0.22.2 (50k is a "should") |
| PW-05 | Review 2 / W-25 | "Expand all" sends 27 MB to the window at 50,000 items | L | 0.22.2 |
| PW-08 | Review 2 / W-26 | Big exports (ReqIF at 50,000) are held in memory (1.3 GB) | M | 0.22.2 |
| PW21-01 | Review 2 | Sort by number takes 1.7 s at 50,000 (0.2 s at 10,000; 0.21.3 says "kept as is") | M | 0.22.2 |
| B9, AR-09, AR-13 | Review 2 | Three Arabic wording points (named in `agents/whole-project-0.21-arabic*.md`) | S | 0.22.1 |
| N-15, N-16 | Review 2 | Two documentation Lows | S | 0.22.1 |
| LOWS | Reviews 1, 2 (W-15, W-16, CRA-22, CRA-23 …) | About 55 small hardening items (hand-edited or crafted files, messages, error paths that leave the table stale). The count is my estimate: the helper totals in the summary table minus the items §F lists as fixed. Needs one pass through the core, app and security helper reports to get the exact list; review 2 §A.5 promised "any left are listed at the end with a reason" and this list does not exist yet | M–L | 0.22.x, in batches |
| LANG-2 | Review 2 log, 0.22.0 | Chinese and Hindi (step 2 of the five languages) | M each | after 0.25 |
| THEME-ED | STATUS "Next" | Theme editor (Settings → Appearance, live preview, reset) — owner request 13 Nov | L | 0.25.0 |

---

## 3. DONE but not marked in the documents

| Where | What is stale | Evidence | Fix |
| --- | --- | --- | --- |
| `2026-11-04-public-release-repo.md` line 3 | "Status: open point … nothing is decided" | §4a, §5 (12 Nov) and §6 (13 Nov) record every decision | Change the status line to "decided; not built" and point to PR-1…PR-9 above |
| `docs/reviews/README.md`, row 4 Nov public repo | "Open — 4 questions in section 5" | All four were answered 12 Nov; licence 13 Nov | "Decided 12–13 Nov — build open" |
| `2026-11-04-public-release-repo.md` §7 | "Not planned yet — the owner decides after the licence" | Roadmap rows 0.23.0 Windows 10 and 0.24.0 Linux; marketing D-1 | Replace with "planned 0.23.0 / 0.24.0" |
| `docs/STATUS.md` "Next" and roadmap "Final touches" row | "licence to confirm (PolyForm Shield / Perimeter)" and "pick the exact text" | `2026-11-04-public-release-repo.md` §6: L-1 B and L-2 PolyForm Shield 1.0.0, decided 13 Nov | Write "PolyForm Shield 1.0.0 decided; add `LICENSE` when the public repository is made" |
| `2026-11-12-project-review-2.md` header | "findings merged; … fixes in progress" | CHANGELOG 0.21.2, 0.21.3, 0.21.4, 0.22.0; §F | "Fixes released in 0.21.2–0.22.0; leftovers in §F" |
| `2026-11-12-project-review-2.md` last log entry | Licence "to be confirmed by the owner before the public repository is made" | `2026-11-04-public-release-repo.md` §6, 13 Nov | Add a log line "13 Nov: L-1 B, L-2 PolyForm Shield" |
| `2026-11-12-project-review-2.md` §A | Plan names a 0.21.4 "screens and Arabic"; it was merged into 0.21.3, and 0.21.4 became the owner's report | CHANGELOG 0.21.3, 0.21.4 | One note under §A |
| `2026-11-12-project-review-2.md` §F "Still open" | UW-08, UW-10 may be partly changed by the 0.22.0 polish (clearer edges, one icon set) | CHANGELOG 0.22.0 | Re-check both before building |
| `2026-11-01-planning-discussion.md` release plan table | Versions 0.14…0.24 do not match what was built (0.14 = health, 0.15 = UI polish, 0.16 = rename, 0.17–0.18 = structure, 0.20 = traceability) | CHANGELOG, `docs/design/roadmap.md` | Add "(built differently, see roadmap)" and leave the themes as the list of what remains |
| `docs/design/roadmap.md` line 174 | Old release plan row 0.14…0.24 still shown as the plan | same | Point it to O-1 once decided |
| P-04, P-06, P-07, P-08, P-09 (documents), P-10, P-11, P-40, P-41 in the planning discussion | Decision column says "C …" but never "built" | Rename 0.16.0; types/required fields/documents 0.17.0; baselines 0.18.0; coverage rules, matrix, impact 0.20.0; Excel/ReqIF/CSV 0.11.0; health tools and acceptance run 0.14.0 | Add "built in 0.x.y" to each row |
| `2026-11-10-project-review.md` | W-01…W-12, W-13, W-14, W-20…W-23, W-27, W-31…W-34, W-40…W-45, W-48, W-50…W-54, W-60…W-63, CRC-24, CRA-18 have no "fixed in" mark | STATUS version table 0.20.2, 0.21.0, 0.21.1; CHANGELOG 0.21.2, 0.21.3 (W-10 core messages 0.21.3, W-13 as "Merge into…", W-14 "kept unusual titles") | Add one "Outcome" section listing versions |
| `2026-11-05-project-review.md` | Last log line "Remaining Lows: to be sorted into later versions" | They were re-checked in review 2 (its part A) | Add "carried to review 2" |
| `2026-11-04-next-round.md` | S-02, S-03, S-04, S-05, S-06, S-07, S-08, S-09, S-10, S-11, V-01, V-02, W-01, W-02, A-01…A-06 have no "built" mark | 0.17.0, 0.17.2, 0.18.0 (CHANGELOG lines 263–338); agent files in `.claude/agents/` | Add an outcome line |
| `2026-11-02-requiem-analysis.md` | Ideas "Confirm all suspect links" and "orphans / leaves" have no mark | "Keep all" in `src/shared/text.ts` (0.10.0); coverage rules 0.20.0 | Add "built" to both rows |
| `2026-10-31-feature-catalogue.md` | Summary table (36 have, 94 missing) is from 31 Oct. Built since: matrix, coverage, rules, impact chain (C5–C8), item and link types (A2, C4), several documents (B3), baselines (D5), required fields (F5), Excel and ReqIF, themes | CHANGELOG 0.11.0–0.20.0 | One line "state at 0.22.0" (full recount not needed for a reference) |
| `docs/STATUS.md` (not a review file, found on the way) | "Where we are right now (12 Nov) — read this first" says built up to 0.21.1; test count "734 (0.21.2)" | STATUS version table says 0.22.0 | Update at the next release |

---

## 4. Documents that can move to `done/` now

1. `2026-10-31-rm-tools-market-list.md` — a reference list; the naming work it served is finished.
2. `2026-11-02-requiem-analysis.md` — study finished; its ideas are tracked as P-12, P-32, P-33.
3. `2026-11-04-next-round.md` — all decided and built (0.17.0–0.18.0). Only the optional drawn commit graph (O-4) would
   remain; copy that one point into the planning discussion first.
4. `2026-11-05-project-review.md` — README already says "move with the next tidy-up".
5. `2026-11-08-1b-traceability.md` — built in 0.20.0.
6. `2026-11-10-project-review.md` — all open points are carried into review 2 (W-15, W-16, W-24, W-25, W-26, W-46, W-47 appear
   there as the LOWS bundle, PW-03, PW-05, PW-08, UW-07, UW-09).

Before moving 3 to 6, add the one-line outcomes from section 3 so the files in `done/` tell the truth. The README index
then lists them under "Done".

**Keep in this folder:** `2026-11-01-planning-discussion.md` (26 unbuilt points), `2026-11-04-public-release-repo.md`
(public repository work list), `2026-11-12-project-review-2.md` (leftover list), `2026-10-31-feature-catalogue.md`
(reference for themes 2 to 5).
