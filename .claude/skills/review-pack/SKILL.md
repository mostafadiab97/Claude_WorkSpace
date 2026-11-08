---
name: review-pack
description: Run reqochet's helper agents on a frozen commit cheaply — make the review pack, start only the helpers it names (in parallel, from .claude/agents), then sort their findings. Use before every theme release and for the whole-project review.
---

# Review pack and helper runs

Rules: `docs/AGENT-WORKFLOW.md`. Helpers are defined once in `.claude/agents/` (brief, tools, model) — do not rewrite
their instructions; give each only its task line.

1. **Freeze:** commit; `npm run check`, `npm run build`, `xvfb-run -a npm run test:e2e` green (the e2e run makes the
   screenshots in `e2e/out/`).
2. **Pack:** `node tools/review-pack.mjs <previous release tag> <version>` (theme version) or
   `node tools/review-pack.mjs --all whole-project` (whole-project review). It writes
   `docs/reviews/agents/<label>-pack.md` with the changed files by area and **the helpers those areas need**.
3. **Start only those helpers, in parallel, in the background** (Agent tool, `subagent_type` = the helper's name; QA
   and performance with `isolation: "worktree"` because they add files; if the worktree cannot be made, e.g. no
   `origin/main` ref in the clone, start them without it and tell them to write only their report and keep scratch
   files under `/tmp`). Task line, e.g.:
   "Review pack: docs/reviews/agents/0.17.0-pack.md. Label: 0.17.0. Write your report as described in your rules.
   Earlier reports for this label: docs/reviews/agents/0.17.0-*.md (do not repeat their findings)."
   For the whole-project review give each helper its **areas** from the pack so two helpers do not read the same code
   (code reviewer split in two or three by area when the pack is large).
4. **While they run**, do not read the code they read; do the release paperwork instead (checklist, changelog,
   status). Each helper writes its own report and answers in three lines (path, counts per severity, top finding):
   read **only the findings table** from the file (`grep -n "^| " <report>`), not the whole report.
5. **Sort** every finding: fix now / later version / question for the owner / not a defect (say why). Check each
   High/Medium finding against the code before acting (helpers can be wrong).
6. Take in QA's new test files from its worktree (copy, do not merge its branch blindly); run everything again.
   QA tests marked `it.fails` become normal tests when the defect is fixed; a test that states a behaviour the owner
   decided differently is rewritten to state the decision (say so in the report's outcome).
   **Second round** (after fixes): only the helpers whose areas the fixes touched, with the first reports named in the
   task line.
7. Append "Outcome (builder, <date>)" to each report; product questions go to the owner with the
   `owner-decision-walkthrough` skill.
