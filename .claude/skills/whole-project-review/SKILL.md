---
name: "whole-project-review"
description: "Review a whole codebase and write a findings report (defects, performance, structure, security, tests) with evidence, severity and effort, without changing code until the owner decides."
---

# Whole-project review

Use when asked to "go through the entire project" and report what could fail, slow it down or make future
work harder. **Change no code** during the review; every finding is a proposal until the owner confirms.

## Method

1. Read the project memory and design docs first (rules, decisions, known pitfalls), then the code by module:
   entry points, data format, storage, external tools (Git, databases), IPC/API boundary, UI state, tests, CI.
2. Prove what you can: run the test suite, time the slow paths on realistic data (e.g. 10,000 items), grep for
   patterns (unchecked inputs, non-atomic writes, per-item process spawning, missing single-instance lock,
   missing retries on Windows file locks, hard-coded texts, duplicated status in docs).
3. Check the test data's promises (e.g. a README that says "opens normally") against the code — untested
   promises hide confirmed defects.

## Report (one Markdown file, e.g. `docs/reviews/<date>-project-review.md`)

- Header: scope (lines of code, tests), the tags **F** fact (checked or measured), **I** inference, **R**
  recommendation; severity High/Medium/Low; effort S/M/L.
- Summary: overall state in 3–4 sentences, what to do before the next milestones.
- One table of all findings: ID (D- defects, P- performance, S- structure, X- security, T- tests/process),
  finding, severity, effort, when.
- Sections A–E with each finding: evidence (file, function, measurement), when it happens, effect,
  recommendation with effort.
- "What works well — keep it" (so good patterns survive refactors).
- "Proposed order" and "Owner decisions needed" (product-level questions only).
- Later: a "Discussion log" section where each answer is recorded, and a "Done in vX.Y.Z" line per release.

## Then

Walk the owner through the findings in groups (defects, speed, structure, process), recommendation first,
record each answer, and turn the result into a release plan. When fixing, add a test per finding (e.g.
`tests/review-fixes.test.ts`) named after its ID.