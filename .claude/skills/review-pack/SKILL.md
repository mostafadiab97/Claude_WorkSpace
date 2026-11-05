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
   and performance with `isolation: "worktree"` because they add files). Task line, e.g.:
   "Review pack: docs/reviews/agents/0.17.0-pack.md. Label: 0.17.0. Write your report as described in your rules."
   For the whole-project review give each helper its **areas** from the pack so two helpers do not read the same code
   (code reviewer split in two or three by area when the pack is large).
4. **While they run**, do not read the code they read. When each finishes, read **its findings table only**.
5. **Sort** every finding: fix now / later version / question for the owner / not a defect (say why). Check each
   High/Medium finding against the code before acting (helpers can be wrong).
6. Take in QA's new test files from its worktree (copy, do not merge its branch blindly); run everything again.
7. Append "Outcome (builder, <date>)" to each report; product questions go to the owner with the
   `owner-decision-walkthrough` skill.
