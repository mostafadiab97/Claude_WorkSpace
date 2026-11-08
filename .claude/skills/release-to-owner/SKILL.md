---
name: "release-to-owner"
description: "Ship a version that a product owner installs and tests: version bump, short checklist, changelog with his feedback, green CI on GitHub, published release, short plain-language report."
---

# Release to the owner

Use when finished work must reach a product owner who tests **releases, not branches** (installer +
auto-update), typically an Electron app built and published by GitHub Actions.

## 1. Before the bump

- Every owner bug report is first reproduced in an automated test (unit or end-to-end), then fixed; the cause
  goes into the changelog in one sentence.
- Bundle small fixes into the next planned version when the owner says so; otherwise a patch version.
- Run locally: typecheck + lint + unit tests, production build, end-to-end scenarios (on Linux with
  `xvfb-run -a`). Fix flaky waits by waiting for what the user would see, not by sleeping.
- **Never push after a red check** — read the check's last lines before `git commit` (twice on 8 Nov 2026 a push went
  out with a lint error and CI failed for nothing). New files in `tools/` are linted too.
- Run the e2e suite twice when a scenario was changed or added: two scenarios run at a time, and timing problems
  show only under that load.

## 2. Documents (same commit as the bump)

- `package.json` version (milestone = minor, fix = patch).
- Testing doc: new section "Manual test checklist — vX.Y.Z" at the top, the previous one renamed
  "Previous checklist". **At most 5 numbered steps**: the update arrives; the in-app self-test passes; open the
  real test data; one real push only if Git code changed; the version's new feature. Each step: what to do,
  expected result. Everything else must be automated.
- Changelog: what changed in the owner's words (fixes, speed with measured numbers, inside changes, testing),
  plus his decisions with dates. When he reports results, add them under that version.
- Project status (`docs/STATUS.md`): status table, "next step", test counts; new pitfalls in `docs/PITFALLS.md`; CLAUDE.md only when a rule changes. Keep status only there and
  in the changelog; other docs link to them.
- Test-data repository: if its data or README must change, change it directly, keep IDs stable, push, and
  tell the owner to `git pull` there. If the push is rejected, fetch, rebase your local commit on his commits,
  never force.

## 3. Publish and watch

- Commit (imperative summary with the version, bullets, attribution lines), push to main.
- Watch both workflows (build and release). In cloud sessions `gh run …` / `gh workflow run` may be refused
  (GraphQL): use the REST API (`gh api repos/<o>/<r>/actions/runs`, `.../jobs`, `check-runs/<job>/annotations`)
  or the project's helper script (e.g. `node tools/ci.mjs status|wait|failures|release|released`).
- Logs and artifacts may not be downloadable: make test runners print failures as `::error title=…::…`
  annotations so they can be read through the API.
- A failure after the bump: fix, push, start the release workflow by hand (REST `workflow_dispatch`), verify
  the release exists with all installer files. Never delete releases, rewrite history or force-push.
- Windows runners are slow with Git and files (antivirus): generous test timeouts; never let two processes
  download/unpack the same tool at once.
- A red run that is not about the code (a download that timed out, a 502/504 from GitHub): read the job log
  (`gh api repos/<o>/<r>/actions/jobs/<id>/logs | grep -E "⨯|504|Error"`), rerun only the failed jobs
  (`gh api -X POST repos/<o>/<r>/actions/runs/<id>/rerun-failed-jobs`), and if it repeats, make the step sturdier
  (signed-in downloads with `gh` and the run's token, retries, checksums) instead of waiting — tell the owner
  plainly what failed and that it was not his account.
- A change that touches only `tools/` or docs starts no release run: start it by hand
  (`node tools/ci.mjs release`).

## 4. Report to the owner

Report in plain words, for someone with no CI background: name the failing step and the fix in one sentence each.

Short and plain: the version is out and the update will be offered; what changed for him (3–6 bullets, no
jargon); where the checklist is and that he reports by step number; anything he must do (e.g. `git pull` in the
test data); the next planned step. Mention problems that were fixed before publishing only in one line.