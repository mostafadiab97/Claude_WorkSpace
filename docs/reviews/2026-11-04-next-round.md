# Next round: 1a structure, a whole-project review, the helper agents (opened 4 Nov 2026)

The owner, 4 Nov 2026 (after 0.16.2 passed): start the 1a question round; plan a whole-project review like
`done/2026-10-25-project-review.md`; add the remaining helper agents; make the agent workflow faster and cheaper in
usage. Method: `owner-decision-walkthrough`. F = fact, I = inference, R = recommendation, C = the owner's decision.

## A. 1a structure (plan: documents, editable item/link types, required fields, baselines)

| ID | Point | Options (recommended first) | Decision |
| --- | --- | --- | --- |
| S-01 | How an item belongs to a document | a) a document is a top-level heading of type "Document"; everything under it belongs to it, outline numbers restart per document; moving between documents = moving in the tree; **no new field in the item files** · b) a `document:` field in every item · c) one folder per document | ~~C 5 Nov: a~~ → **replaced 5 Nov by S-10 (one folder per document)** |
| S-02 | How documents appear in the window | a) a document picker above the tree (one document at a time, plus "All documents") · b) all documents as top branches of one tree | **C 5 Nov: a** |
| S-03 | Existing repositories | a) nothing changes until a second document is added; then the existing tree becomes the first document (one commit) · b) convert at once on opening | **C 5 Nov → S-10**: the requirements folder holds only document folders; loose items → the app offers to move them into a named document (one commit) |
| S-04 | Editing item/link types in the window | a) add, rename, change the short name (prefix) and "is a heading"; remove only when no item/link uses it (the window shows the count) · b) also remove a used type by moving its items to another type | **C 5 Nov: a**; plus "columns movable like rows" → S-11 |
| S-05 | Required fields | a) per item type; an item missing one is saved but marked **incomplete** (warning, filter "incomplete") · b) per item type, saving is refused · c) for all types | **C 5 Nov: a** |
| S-06 | Baselines | a) a Git tag `baseline/<name>` with a note, sent with the next Push; list, compare with now, open read-only · b) the same, pushed at once on creation | questions 5 Nov: which commit becomes the baseline; switching to a commit; a commit graph → S-08, S-09 |
| S-07 | Size of 1a | a) 0.17.0 documents + types + required fields; 0.17.x/0.18.0 baselines (two smaller checklists) · b) everything in 0.17.0 | **C 5 Nov: a** (two versions) |

## B. Whole-project review (like 25 Oct)

F: the code grew from ≈ 8,400 lines (25 Oct) to several times that, 411 unit tests, 8 e2e scenarios, a CI acceptance
run; the last full review was before branches, Excel/ReqIF, Arabic, health tools and the rename.

R — plan: read-only (no code changed), report `docs/reviews/<date>-project-review.md` with the same parts — A defects,
B performance and scale (10k/50k), C structure (what slows future work, before the data-format change of 1a), D
security, E tests and process — plus new parts: F Arabic/right-to-left and accessibility, G documentation and
hand-over (can a team take over?), H libraries and licences (NFR-07), I CI time and cost. Each finding: evidence,
severity, effort. Then a walkthrough with the owner and the agreed fixes in one stabilisation version.

| ID | Point | Options (recommended first) | Decision |
| --- | --- | --- | --- |
| V-01 | When | a) **now, before 1a** — 1a changes the data format and the tree; fixing the base first is cheaper, and the pilot gets a reviewed tool · b) after 1a + 1b, just before the pilot | **C 5 Nov: a — now, before 1a** |
| V-02 | Who | a) split by area over parallel helper agents (each reads only its area), the builder merges and checks every finding against the code · b) the builder alone (slower, one long context) | **C 5 Nov: a — several helpers** |

## C. More helper agents

F: today four — code reviewer, QA tester, UI/UX reviewer, brand (logo changes only). Candidates:

| ID | Helper | What it would catch | R |
| --- | --- | --- | --- |
| A-01 | Security reviewer | secrets, unsafe file paths, Electron settings, Git command injection, supply chain | yes — once per theme version, on the diff |
| A-02 | Arabic / right-to-left reviewer | wrong or unnatural Arabic texts, mirrored layouts, mixed-direction text | yes — when texts or layout change |
| A-03 | Performance tester | slow screens on 10k/50k items, memory growth, start time | yes — at the whole-project review and when lists/index change |
| A-04 | Documentation / hand-over checker | docs that no longer match the code, missing guide pages | yes — merged with the code reviewer (one more question in its brief), not a separate run |
| A-05 | Accessibility (keyboard, screen reader, contrast) | unreachable buttons, missing labels | merged with UI/UX (its brief already covers it) |

## D. Faster and cheaper helper runs (I/R)

1. **A review pack** made by a script (`tools/review-pack.mjs`): the changed files, the diff summary, the rules that
   apply to them and the screenshots of the changed screens — each helper starts from this instead of reading the
   whole project. (R: largest saving.)
2. **Only the helpers a version needs:** a table "changed area → helpers" (texts → Arabic; logo → brand; Git → QA +
   security; screens → UI/UX). Patches: none, or the code reviewer on the diff when data or Git code changed.
3. **A lighter model for some helpers:** QA, Arabic and documentation checks run on a smaller, cheaper model; the code
   and security reviewers stay on the strongest.
4. **Short reports in a fixed table** (ID, file:line, severity, fix, ≤ 15 findings, "nothing found" allowed); the
   builder reads the table, not long text.
5. **UI/UX and brand in one visual run** when both are needed.

| ID | Point | Options (recommended first) | Decision |
| --- | --- | --- | --- |
| W-01 | Adopt D1–D5 | a) all five · b) only D1, D2, D4 (keep every helper on the strongest model) | **C 5 Nov: a, except D4's limit** — fixed table, but no cap on findings (a cap would let defects through) |
| W-02 | New helpers | a) A-01, A-02, A-03 as separate helpers; A-04, A-05 merged · b) choose per helper | **C 5 Nov: a**; also check new or updated skills/agent definitions for the helpers → A-06 |

## Added 5 Nov 2026

| ID | Point | Options (recommended first) | Decision |
| --- | --- | --- | --- |
| S-08 | Which commit a baseline marks | a) the latest commit of the current branch; with uncommitted changes the window offers "commit first" or "baseline without them"; also "baseline at this commit" from the history list · b) only the latest commit | **C 5 Nov: a** |
| S-09 | Old commits (F: today the app can only switch branches, not go to a commit) | a) a history list per branch (newest first, search by commit ID or message): open a commit **read-only**, compare it with now, make it a baseline, or start a new branch from it — never "stand" on an old commit (Git's "detached HEAD": edits there belong to no branch and are easily lost); a drawn graph later (theme 2) · b) the drawn graph already in 1a · c) type a commit ID in the branch switcher and work there | **C 5 Nov: a**; check a free graph library → findings below |
| A-06 | Helpers as project agent definitions | a) one file per helper in `.claude/agents/` (its brief, tools, model) + a `review-pack` skill + an Arabic glossary — briefs are written once, every run is the same and cheaper to start · b) keep writing each brief by hand | **C 5 Nov: a** |

| S-10 | Documents as folders (the owner, 5 Nov) | `requirements/<document>/` holds that document's item files; `requirements/` holds only document folders and `.reqochet/` (types and fields shared by all documents); an item moves between documents by moving its file (Git keeps its history); IDs stay unique in the whole repository; links across documents work as today; a new project starts with one document; a repository with loose items (today `requirements/items/`) gets an offer "Move into a document" with a name — one commit, like the folder rename in 0.16 | **C 5 Nov** (replaces S-01 a) |
| S-11 | "Columns movable like rows" | the owner, 5 Nov: in the **Columns menu** the order is changed with arrows — make its rows drag-and-drop like items | **C 5 Nov** → 1a (with the Types window) |

**Graph library check (S-09, 5 Nov):** F: gitgraph.js (MIT) is archived and unmaintained since 2019; its author points to
Mermaid, which draws small scripted diagrams, not a real history of thousands of commits. F: `commit-graph`
(CommitGraph, a React component for commit-log graphs with paging) was updated in March 2026; npm says MIT, the
repository says Apache-2.0 — both allow commercial use, to be confirmed from its licence file before use. R: try it when
the history list is built; if it cannot take our data, a lane layout of our own is a few hundred lines.

## Discussion log

- 4 Nov 2026 — opened; all points asked.
- 5 Nov 2026 — S-01 a, S-02 a, S-05 a, S-07 a, V-01 a, W-01 a without the cap on findings, W-02 a (+ A-06); S-03, S-04, S-06, V-02 explained again; S-08, S-09, A-06 asked.
- 5 Nov 2026 — S-10 documents as folders (replaces S-01 a; covers S-03); S-04 a; S-08 a; S-09 a (+ library check); V-02 a; A-06 a; S-11 asked.
- 5 Nov 2026 — S-11 clarified (drag and drop in the Columns menu). Step 1 done: seven helpers in `.claude/agents/`, `tools/review-pack.mjs`, `review-pack` skill, `docs/guides/arabic-glossary.md`. Next: the whole-project review.
- 5 Nov 2026 — whole-project review, run one helper area at a time (the owner): security (`agents/whole-project-security-reviewer.md`, 0 High / 5 Medium / 13 Low) and Arabic (`agents/whole-project-arabic-reviewer.md`, 0 High / 5 Medium / 8 Low) done; findings not yet sorted or fixed. Next helpers: code reviewer, QA, performance, UI/UX.
- 5 Nov 2026 — the owner on the review questions: SEC-05 a (remove the unlicensed library now); SEC-07 a (network shares allowed, device paths refused); Arabic guide a (English guide + Arabic note, translation later); AR-04 b — parent "أصل", child "فرع" (may change later; note: "فرع" is also Git's branch in the glossary — asked). Arabic logo name "ريكوشيه" proposed for later (BR-12). Code review part 1 (core modules) started.
- 5 Nov 2026 — code review done in three parts: `agents/whole-project-code-reviewer-1.md` (core: 1 High / 6 Medium / 19 Low), `-2.md` (screens: 1 / 4 / 14), `-3.md` (main, import/export, tests: 0 / 8 / 26). Owner questions collected in the reply. Left: QA, performance, UI/UX.
- 5 Nov 2026 — QA done (`agents/whole-project-qa-tester.md`): 30 new tests in `tests/qa-whole-project-*.test.ts` — 26 reproduce reported findings and fail today (`it.fails`, they turn green when fixed), 4 pass; new: 1 Medium (QA-WP-01 typed merge answer not checked against the schema), 3 Low. Left: performance, UI/UX.
