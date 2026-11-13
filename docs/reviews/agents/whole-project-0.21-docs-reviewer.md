# Docs review — whole-project-0.21

Scope: (A) every item DOC-01…DOC-26 of `whole-project-0.20-docs-reviewer.md`; (B) every planning or review file in
`docs/reviews/` (not `done/`, not `agents/`) for points without a decision; (C) documents against the code after
0.20.2–0.21.1: CHANGELOG, STATUS, USER-GUIDE (read as a new user), ARCHITECTURE, ONBOARDING, TESTING, PITFALLS,
AGENT-WORKFLOW, HANDOVER, CLAUDE.md, skills, tools/README, roadmap, reviews index.
Package version is 0.21.1. The pack names commit `4c819c1`, the task `a8244a2`; the folder is not a Git checkout in this
session, so I could not tell which one is frozen (see N-15). Method: grep of `text.ts`, `package.json`,
`sqliteIndex.ts`, file tree; a script that checks every backticked path in the main documents (runtime files such as
`schema.yaml`, `latest.yml`, `app-update.yml` are not in the repository and are fine). F = checked, I = likely.
Not checked in depth: `decisions.md`, `analysis.md`, the Archify diagrams, older helper reports.

## (A) State of the earlier items

| DOC | State | Evidence |
| --- | --- | --- |
| 01 | Fixed in part, new problem | The 2 Nov block is gone; the new block (STATUS.md:58) is dated 10 Nov and is stale — see N-01 |
| 02 | Fixed | README.md:10-23 lists documents, baselines, traceability, Excel, Arabic |
| 03 | Fixed in part | README.md no longer points to CLAUDE.md for status; `roadmap.md:7` still says "`CLAUDE.md` →" (N-14) |
| 04 | Fixed | USER-GUIDE.md:3 "Matches reqochet-dev 0.21" |
| 05 | Fixed | USER-GUIDE.md §16 has coverage, matrix, impact, baselines, old versions; "Planned" shortened |
| 06 | Still open | TESTING.md:6 and 18 say "about 690"; STATUS.md says 617; my count of `it(`/`test(` calls is 628 (N-05). The e2e list in TESTING.md:18-21 still names 5 of 14 scenarios |
| 07 | Fixed | No "ReqMan" left in TESTING.md; installer name `reqochet-dev-Setup-….exe` |
| 08 | Still open | TESTING.md:109 "(v0.0.3 – v0.12.1)"; `past-checklists.md` says v0.0.3 – v0.20.2 |
| 09 | Fixed | ARCHITECTURE.md:55 and 105 say format 5 (matches `FORMAT_VERSION = '5'`) |
| 10 | Fixed | ARCHITECTURE.md:60 |
| 11 | Still open (Low) | ARCHITECTURE.md:113 still lacks "(now `.reqochet`)" |
| 12 | Fixed in part | Traceability, rules, impact, types, document bar, history, versions are named. Still missing in ARCHITECTURE: `DiagnosticsCard`, `FeaturesCard`, `ProblemReportCard`, `compareRange.ts`, `queue.ts` (0 hits) |
| 13 | Still open (Low) | ONBOARDING.md:140 "the status in `CLAUDE.md`"; line 137 lists 4 of 14 e2e scenarios |
| 14 | Not checked (Low) | Glossary entries; left for later |
| 15 | Fixed | tools/README.md names all 16 scripts and `review-pack`; title says reqochet |
| 16 | Still open (Low) | CLAUDE.md:38 names three skills; `review-pack` missing |
| 17 | Still open (Low) | AGENT-WORKFLOW.md:84 "Seven helpers" (eight in `.claude/agents/`); line 23 `<version>-<role>.md`; `reviews/agents/README.md:3` names `-code-review/-qa/-ui-ux` |
| 18 | Fixed in part | The 1b file is in the index and the states say Done. But five Done/Decided files still sit in the "Open" table, and the 11-05 file says "move to `done/` with the next tidy-up" (N-09) |
| 19 | Fixed in part | FR-12, FR-16 rows in roadmap.md:53, 57 are right. Still open: `requirements.md:57` FR-20 "Later" (ReqIF export done 0.11.0); `roadmap.md:166` release plan still numbers 0.14 → 0.16 as "1b" |
| 20 | Fixed in part | PITFALLS.md:87 fixed; line 41 "two ReqMan processes" not rechecked (N-12) |
| 21 | Still open (Low) | PITFALLS.md:113, 121 and STATUS.md:18, 20, 21, 25 still use `renderer/lib/…` |
| 22 | Still open (Low) | owner-decision-walkthrough SKILL.md:42 (not re-read; builder said Lows wait) |
| 23 | Still open (Low) | `package.json:7` `"author": "ReqMan"` |
| 24 | Replaced | New pack names `4c819c1`, task `a8244a2` (N-15) |
| 25 | Still open (Low) | ARCHITECTURE toolbar row has no **Show text** (grep: 0 hits) |
| 26 | Still open (Low) | DEVELOPING.md:26 "about a minute" for e2e |

Count: fixed 11 (02, 04, 05, 07, 09, 10, 15 and the fixed halves of 01, 03, 12, 18, 19, 20 not counted twice),
open 10, unchecked 1. All 3 High items and all Medium items except 06, 12 (part), 18 (part), 19 (part) are fixed.

## (B) Open points in planning and review files (the owner wants to close them)

| ID | file:line | What is open | Suggested way to close |
| --- | --- | --- | --- |
| B-01 | docs/reviews/2026-11-04-public-release-repo.md:3, 87-93 | Header says "nothing is decided" although 4a (line ~79) decides two tools and two feeds. Section 5: questions 1 (source + docs public or installers only), 3 (licence), 4 (is `requirements.md` and the sandbox public), 5 (issues on or off) have no answer. Question 2 is struck out. Also section 4 (about line 66) still says "decide before the rename version ships" — the rename shipped in 0.16.0 | Ask the four questions in one round (owner-decision-walkthrough); fix the header and section 4; then move the file to `done/` |
| B-02 | docs/reviews/done/2026-11-10-project-review.md:64, 155 | W-25 "Expand all sends 27 MB" and W-24 "coverage gap count 577 ms at 50k": decided "later" (O-3), not scheduled | Give them a version or write "not before the pilot asks" in the roadmap |
| B-03 | docs/reviews/done/2026-11-10-project-review.md:50-53, 65, 84, 137 | "Later, low" group: W-13 (the offered "keep one name" button — only the message was built in 0.21.1; STATUS "Next" says so), W-14, W-15, W-16, W-26, W-34 and about 80 other Low items "picked up when their area is touched" — no list says which are done | Make a short list "Low items still open" (ID + area) in the file or the roadmap's final-touches list, so they can be closed one by one |
| B-04 | docs/reviews/done/2026-11-10-project-review.md:88 | Tests marked `it.fails` for W-07 (x2) and W-13: W-07 is fixed (0.20.2), W-13 is not — check the `it.fails` marks are updated | Builder to confirm in `tests/qa-whole-0.20-journeys.test.ts` |
| B-05 | docs/reviews/done/2026-11-05-project-review.md:66 | "Remaining Lows: to be sorted into later versions" — never sorted | Fold into B-03's list, then move the file to `done/` |
| B-06 | docs/reviews/done/2026-11-04-next-round.md:79, 89 | (1) Commit-graph library licence "to be confirmed from its licence file before use" — the graph is "later (theme 2)". (2) Arabic logo name «ريكوشيه» "proposed for later" — no decision recorded | Close both as "decide when theme 2 / the brand round starts", or answer now |
| B-07 | docs/reviews/README.md:7-16 | The table "Open (this folder)" holds six Done/Decided files (11-10, 11-08, 11-05, 11-04-next-round, 11-01 and the reference files). Only B-01 is open. README's own rule (docs/README.md "Keeping it tidy") says move a file once every point is decided | Move 11-08, 11-05, 11-04-next-round to `done/`; keep 11-10 until B-03 is settled; rename the table "Open and reference" |
| B-08 | docs/reviews/2026-11-01-planning-discussion.md:8, 62, 121 | No P-xx row is without an answer (P-05 is information only). But the release-plan table (line 62) still numbers 0.15 = 1a, and the log (line 121) ends with "Name: still open" — history, but easy to misread. Detail questions for themes 2-6 are "settled when each starts" | Add one line at the top: "Decided; plan numbers shifted — see roadmap". Not an open point |
| B-09 | docs/reviews/2026-10-31-feature-catalogue.md, 2026-11-02-requiem-analysis.md, 2026-10-31-rm-tools-market-list.md | Reference only; no questions | Nothing |
| B-10 | docs/reviews/agents/whole-project-0.20-* (not in scope) | Owner questions in the 0.20 helper reports (for example the question in my own DOC report, 2 and 3) were answered by the builder's work but not written down: the `package.json` author string (DOC-23) is still undecided | Ask: author string for the installer |

## (C) New findings

| ID | file:line | Severity | What is wrong | Suggested fix |
| --- | --- | --- | --- | --- |
| N-01 | docs/STATUS.md:58-64 ("Where we are right now (10 Nov 2026) — read this first") | High | F: Says "everything up to **0.20.1**", "all owner questions answered (O-1…O-7)", "Order: 0.20.2 → 0.21.0 → …" as future. Now 0.21.1 is released and accepted, and O-8 exists. HANDOVER.md:30, 41 sends every session to this block ("names the last version … and the next open point"). It does not name the next open point; that is in the table row "Next" 20 lines above | Rewrite as four lines: last version 0.21.1 accepted (12 Nov); review plan done; the next open point (pilot, Fable trials, public-release questions); pointer to "Next". Or delete and make HANDOVER point to the "Status" heading |
| N-02 | docs/CHANGELOG.md:6, 38, 62, 98 | Medium | F: Order is 0.20.2, 0.21.1, 0.21.0, 0.20.1 — the 0.20.2 entry sits above the two newer ones. A reader of the top of the file sees 0.20.2 as the latest | Put 0.21.1 first, then 0.21.0, then 0.20.2 |
| N-03 | docs/design/roadmap.md:165 vs docs/STATUS.md (row "Documents from the review") and docs/reviews/README.md:9 | Medium | F: Three documents give three versions for the same documents batch: roadmap "0.21.2 (next) — Documents", reviews README "documents in 0.21.2", STATUS "no version: nothing the owner tests". `package.json` is 0.21.1 | Decide once (the STATUS wording is the rule in CLAUDE.md for non-testable changes) and change the other two |
| N-04 | docs/STATUS.md:44 vs docs/TESTING.md:6, 18 | Medium | F: Unit-test count: STATUS "617", TESTING "about 690 … in 77 files". File count 77 is right; the counts differ by 70. TESTING itself says the last release's count is in STATUS | Remove the number from TESTING ("more than 600; the exact count is in STATUS") |
| N-05 | docs/USER-GUIDE.md:483-500 (section 18) | Medium | F: Shortcut table lacks the 0.21.1 keys: ←/→/Home/End between tabs in the six tab rows (CHANGELOG 0.21.1 W-43; `tests/ui/keys-0.21.1.test.ts`). The page is the built-in shortcut page (Ctrl+/) | Add a row "← / → / Home / End (on a tab) — previous / next / first / last tab; in Arabic the arrows follow the reading direction" |
| N-06 | docs/USER-GUIDE.md:42-43, 51-53 (section 1.1, 1.2) | Medium | F, new user: (a) "reqochet works without Git, but cannot share…" — the first-run need is not said: a Git repository must exist; the guide says "cloned to your PC (or an empty one)" but not how to clone (no step, no word "clone" explained). (b) Step 2 tells the reader to download `reqochet-Setup-<version>.exe`; the release tool does not exist yet (CLAUDE.md: a release repository will build it) — a pilot user would look for a file that is not published. (c) the Git link here is `…/download/win`, README uses `…/downloads/win` | (a) one sentence: "Clone = copy a repository from GitHub to your PC: GitHub Desktop or `git clone <address>`". (b) Say which name the pilot team gets, or mark `reqochet-Setup` as "once the release tool is published". (c) one URL |
| N-07 | docs/USER-GUIDE.md §1.6 / §8 | Low | I: New user sees "Changes" and the button "Changes + settings" (0.21.1 tooltip explains settings). The guide does not explain what "+ settings" means or "No file problems" vs the amber coverage-gaps chip (O-4, O-5, `text.ts:977`). Section 12 not re-read | Two sentences in §8 and §12 |
| N-08 | docs/TESTING.md:18-22 | Low | F: e2e list still names `language`, `branches`, `journey`, `fixes` only; there are 14 scenarios (see DOC-06). Also "0.8.0 measurements" paragraph is two years of numbers in one block, hard to read | Replace the list with "see `e2e/scenarios/`"; move old measurements to `docs/design/roadmap.md` or past checklists |
| N-09 | docs/ONBOARDING.md:55 | Low | F: Names `documents.ts` as a workspace file. It does not exist (`ls src/modules/workspace`: documents are in `structure.ts`) | Replace by `structure.ts` |
| N-10 | docs/ARCHITECTURE.md (workspace row, line 56), docs/ONBOARDING.md | Low | F: `src/main/closeForInstall.ts` (0.20.2, W-09) and the workspace speed test (0.21.0, `PERF_WS50=1`, 10,000 in CI) appear in CHANGELOG/PITFALLS but not in the module map or TESTING "Automated checks". `closeForInstall` is the only main-process file not in the map (grep: 0 hits in ARCHITECTURE) | One row each |
| N-11 | docs/PITFALLS.md:239-265 | Low | Checked: new entries "Git output, push and CI install (0.20.2)" and "Toolbar wraps (0.21.1)" exist. Missing: the two CI lessons of the 0.21.1 release (CHANGELOG 0.21.1 "Release": a 3,000-file rename test needed more than 120 s, the 50k workspace test took over 15 min on the Windows runner) — the exact kind of thing the file says it keeps | Add "CI time limits: speed tests at 10,000 in CI, 50,000 only by hand" |
| N-12 | docs/PITFALLS.md:41 | Low | I: "two ReqMan processes" (named in DOC-20, not re-read this time) | "two reqochet-dev processes" |
| N-13 | docs/AGENT-WORKFLOW.md:62-70 | Low | F: Model rules (10 Nov) say Fable only when the owner says so; STATUS "Next" suggests Fable trials "before 17 Nov". Consistent, but the 17 Nov date appears only in STATUS | Fine; add the date to AGENT-WORKFLOW "Cost" if the rule is time-limited |
| N-14 | docs/design/roadmap.md:7 | Low | F: "The current version and next step: `CLAUDE.md` →" — CLAUDE.md points to STATUS since 8 Nov (DOC-03 second half) | "`docs/STATUS.md`" |
| N-15 | docs/reviews/agents/whole-project-0.21-pack.md:3 | Low | F: Pack says commit `4c819c1`; the task names `a8244a2` (the owner-report commit). Probably later commit added only STATUS/CHANGELOG, but I cannot check | Regenerate or note "pack made at 4c819c1, frozen at a8244a2" |
| N-16 | docs/reviews/README.md:9 | Low | F: Says "eight helpers on 0.20.1: 6 High / 44 Medium / 86 Low" while STATUS/N-01 say "136 findings (6 High)"; 6+44+86 = 136, consistent. But the file says "documents in 0.21.2" (N-03) | See N-03 |
| N-17 | docs/AGENT-WORKFLOW.md:84, `.claude/agents/` | Low | F: Eight helpers but the list names seven; STATUS line "Models (10 Nov)" does not list arabic/brand/performance models | Same fix as DOC-17 |

Totals (C): High 1 (N-01), Medium 5 (N-02, N-03, N-04, N-05, N-06), Low 11. Items still open from (A): 10 (one Medium
part: DOC-06, 12, 18, 19). (B): 1 real open file (B-01) and 5 groups of postponed work (B-02, B-03, B-05, B-06, B-10).

## Questions for the owner

1. The four open questions of the public release repository (B-01, section 5): source and docs public or installers only;
   licence; are `requirements.md` and the sandbox data public; issues on or off? These are the only undecided points
   in `docs/reviews/`.
2. The "keep one name" button for two PCs that renamed the same document (O-6, B-03): build it, or leave the message?
3. W-24/W-25 (coverage count 577 ms, Expand all 27 MB at 50k): give them a version, or decide "only if the pilot
   complains"?
4. `package.json` author string (DOC-23): what should the installer show?
5. The commit-graph library and the Arabic logo name (B-06): decide now or when those themes start?
6. The documents batch: no version (STATUS) or 0.21.2 (roadmap, reviews index)? (N-03)

## Checked, nothing found

- CLAUDE.md: rules, commands, release steps, the "report every GitHub change" rule match; only the skills row (DOC-16).
- README.md: what-it-does list, install steps, document pointers fine.
- docs/README.md: every listed file exists; link and path check clean.
- docs/HANDOVER.md: steps and table match the repository; depends on the stale STATUS block (N-01).
- docs/DEVELOPING.md: Node, Dependabot, line endings fine; only "about a minute" (DOC-26).
- docs/THEMING.md: unchanged since last review; nothing found.
- CHANGELOG 0.21.1, 0.21.0, 0.20.2: match STATUS table, package version and the code names I grepped; only the order (N-02).
- docs/TESTING.md checklist 0.21.1 and 0.21.0: five steps each; labels ("No file problems", Self-tests, Versions) match `text.ts`.
- tools/README.md: complete now.
- Skills `release-to-owner`, `review-pack`, `whole-project-review`: consistent with the pack tool; `owner-decision-walkthrough` line 42 not re-read.
- Privacy: no name or e-mail found in the documents I read; I did not run `tools/check-privacy.mjs`.
- docs/reviews done/ index rows: all six files exist.
