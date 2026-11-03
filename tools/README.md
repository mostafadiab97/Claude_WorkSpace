# Tools

Scripts for developing and releasing ReqMan. Each file's header explains its options in full.

| Script | What it is for | How to run |
| --- | --- | --- |
| `ci.mjs` | GitHub Actions without GraphQL: latest runs, wait for one, read failures (annotations), start the release by hand, check a release has all installer files | `node tools/ci.mjs status \| wait [id] \| failures [id] \| release \| released [version]` |
| `check-deps.mjs` | Library security problems and updates; runs before every build; only warns | `npm run check:deps` |
| `diagrams.mjs` | Rebuilds the Archify diagrams (`docs/diagrams/*.html`, `docs/images/*.png`) and the navigator `docs/diagrams/index.html` | `node tools/diagrams.mjs [name …]` · `--index` = navigator only |
| `generate-test-repo.mts` | Uniform generated items, for performance tests | `npm run gen:repo -- <folder> [count]` |
| `generate-scenario-repo.mts` | Rich fictional data covering every case (what `Claude_SandBox` was made with) | `npm run gen:scenario -- <folder> [count]` |
| `make_sample_xlsx.py` | The sample spreadsheet `samples/sample-requirements.xlsx` (for the Excel import, M7) | `python tools/make_sample_xlsx.py <file>` |
| `confirm-sandbox-links.mts` | **Done once (v0.4.0):** gave every sandbox link a confirmation | record only |
| `convert-sandbox-0.9.mts` | **Done once (v0.9.0):** converted the sandbox to `REQ-` IDs, order keys, no typed numbers | record only |

The end-to-end runner and the tree-table measurement live in `e2e/` (`npm run test:e2e`, `npm run measure:ui`).

## Skills for Claude

`.claude/skills/` holds the working procedures used on this project, as Claude Code skills (Claude Code in VS Code
loads them automatically from this folder; a person can read them as checklists):

| Skill | Use it when |
| --- | --- |
| `release-to-owner` | shipping a version: bump, ≤ 5-step checklist, changelog, CI, release, short report |
| `whole-project-review` | reviewing the whole codebase and writing a findings report without changing code |
| `owner-decision-walkthrough` | discussing open questions or findings with the owner one point at a time, recording each answer |
