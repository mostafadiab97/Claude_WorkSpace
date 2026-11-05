# Next round: 1a structure, a whole-project review, the helper agents (opened 4 Nov 2026)

The owner, 4 Nov 2026 (after 0.16.2 passed): start the 1a question round; plan a whole-project review like
`done/2026-10-25-project-review.md`; add the remaining helper agents; make the agent workflow faster and cheaper in
usage. Method: `owner-decision-walkthrough`. F = fact, I = inference, R = recommendation, C = the owner's decision.

## A. 1a structure (plan: documents, editable item/link types, required fields, baselines)

| ID | Point | Options (recommended first) | Decision |
| --- | --- | --- | --- |
| S-01 | How an item belongs to a document | a) a document is a top-level heading of type "Document"; everything under it belongs to it, outline numbers restart per document; moving between documents = moving in the tree; **no new field in the item files** · b) a `document:` field in every item · c) one folder per document | **C 5 Nov: a** |
| S-02 | How documents appear in the window | a) a document picker above the tree (one document at a time, plus "All documents") · b) all documents as top branches of one tree | **C 5 Nov: a** |
| S-03 | Existing repositories | a) nothing changes until a second document is added; then the existing tree becomes the first document (one commit) · b) convert at once on opening | explained again 5 Nov; new option c (recommended): no file ever changes — items outside any Document heading form the unnamed first document |
| S-04 | Editing item/link types in the window | a) add, rename, change the short name (prefix) and "is a heading"; remove only when no item/link uses it (the window shows the count) · b) also remove a used type by moving its items to another type | explained again 5 Nov |
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
| V-02 | Who | a) split by area over parallel helper agents (each reads only its area), the builder merges and checks every finding against the code · b) the builder alone (slower, one long context) | question 5 Nov: how much usage each way (answered in the reply) |

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
| S-08 | Which commit a baseline marks | a) the latest commit of the current branch; with uncommitted changes the window offers "commit first" or "baseline without them"; also "baseline at this commit" from the history list · b) only the latest commit | |
| S-09 | Old commits (F: today the app can only switch branches, not go to a commit) | a) a history list per branch (newest first, search by commit ID or message): open a commit **read-only**, compare it with now, make it a baseline, or start a new branch from it — never "stand" on an old commit (Git's "detached HEAD": edits there belong to no branch and are easily lost); a drawn graph later (theme 2) · b) the drawn graph already in 1a · c) type a commit ID in the branch switcher and work there | |
| A-06 | Helpers as project agent definitions | a) one file per helper in `.claude/agents/` (its brief, tools, model) + a `review-pack` skill + an Arabic glossary — briefs are written once, every run is the same and cheaper to start · b) keep writing each brief by hand | |

## Discussion log

- 4 Nov 2026 — opened; all points asked.
- 5 Nov 2026 — S-01 a, S-02 a, S-05 a, S-07 a, V-01 a, W-01 a without the cap on findings, W-02 a (+ A-06); S-03, S-04, S-06, V-02 explained again; S-08, S-09, A-06 asked.
