# reqochet (formerly ReqMan) — project memory for Claude

reqochet (called ReqMan until 0.15) is a small, serverless requirements-management desktop app (Windows 11 first). This
repository builds the **development tool reqochet-dev**; a release repository will build plain **reqochet** (owner, 4 Nov 2026). Requirements are plain
files in a `requirements/` folder of a project's own Git repository; reqochet is the GUI that understands them
(table, hierarchy, links, suspect links) and, from M4 on, does the Git work at requirement level.
Internal proof of concept first; likely a commercial product later.

**Claude writes all of the code, tests and docs.** The product owner decides the product, installs every
release on his Windows 11 PC and reports back. A team may take the code over later, so it must stay conventional,
tested and documented (NFR-10).

This file is the project memory and hand-over note: whoever continues (a cloud session, Claude Code in VS Code on
the owner's PC, or a future team) reads it fully first, then the documents it points to when a task touches them.
**Keep it current** when a rule or procedure changes; the status (versions, next step, the owner's reports) goes in
`docs/STATUS.md` with every release.

Where development happens: in a cloud session; a local Windows setup is described in `docs/DEVELOPING.md`.
Nothing lives outside this repository and `Claude_SandBox`.

## Where everything is

Map of all documents: **`docs/README.md`**. Starting a new chat or handing over: **`docs/HANDOVER.md`**.

| What | Where |
| --- | --- |
| Decisions (source of truth): product questions + answers, technical design, per-milestone decisions, the owner's small preferences | `docs/design/decisions.md` |
| Product definition, FR/NFR, scope | `docs/design/requirements.md` |
| What has been built, where each requirement stands, release plan, **final-touches reminder list** (read before planning the last polish) | `docs/design/roadmap.md` |
| The 5-tool domain study (frozen) | `docs/design/analysis.md` |
| **Planning discussion in progress** (open points P-xx with answers) and other analyses | `docs/reviews/` (index: its README); finished reviews in `docs/reviews/done/` |
| Module map, rules, data format, UI structure | `docs/ARCHITECTURE.md` |
| Onboarding for engineers (diagrams, first change end to end) | `docs/ONBOARDING.md`, diagrams in `docs/diagrams/` |
| Pitfalls already hit — read before changing an area | `docs/PITFALLS.md` |
| **Helper agents (code reviewer, QA tester, UI/UX reviewer) and how conflicts are avoided** | `docs/AGENT-WORKFLOW.md` |
| The owner's current checklist, log/data locations, bug reporting | `docs/TESTING.md` (older checklists: `docs/testing/past-checklists.md`) |
| What changed per version + the owner's reports | `CHANGELOG.md` |
| Theme · local setup · scripts and skills | `docs/THEMING.md` · `docs/DEVELOPING.md` · `tools/README.md` (skills in `.claude/skills/`: `release-to-owner` for every release, `owner-decision-walkthrough` for every question round, `whole-project-review`) |
| Test data (10,005 fictional items) | GitHub `<owner>/Claude_SandBox` — clone **next to** this repo |
| Releases (installers + auto-update feed) | GitHub Releases of `<owner>/Claude_WorkSpace` |

## How to work with the owner

- He tests each **release**, not branches: every change he should try ends with a version bump, a green CI release
  and a short checklist in `docs/TESTING.md` ("Manual test checklist — vX.Y.Z", numbered steps, expected results;
  move the previous one down as "Previous checklist"; only the current and the previous one stay — older ones go
  to `docs/testing/past-checklists.md`). He refers to checklist step numbers in feedback
  ("test 6 failed").
- Explain in plain language, short. He asks "explain this further" when he wants depth. No jargon without a
  one-line explanation.
- Product decisions are his (ask, with a recommended option first). Technical decisions are yours ("I leave the
  final decision to you"); explain them briefly. Facts / inferences / recommendations are kept distinct.
- When he reports a bug: reproduce it in a test first, fix, explain the cause in one or two sentences, release.
- Bundle small fixes he asks for into the next milestone release when he says so ("add this fix in the same
  version as M3").
- **No personal data in this repository's files** (owner, 3 Nov 2026): never write the owner's name, account name,
  user name or e-mail into any file — say "the owner"; `<owner>/Claude_SandBox` in docs; the privacy check fails the
  build otherwise. A public release repository will later start from the files without history.
- **Helper agents (owner, 3 Nov 2026):** for every theme version, after building and before releasing, run the code
  reviewer, QA tester and UI/UX reviewer on the frozen commit — rules in `docs/AGENT-WORKFLOW.md` (one writer; QA adds
  new test files only, in its own worktree; reports in `docs/reviews/agents/`).
- He asked to be asked before steps that affect his accounts/repos (e.g. repository visibility). Never change
  repo visibility, delete releases, rewrite history or force-push.
- Only free, open-source dependencies whose licences allow commercial use (NFR-07). No paid services.

## Non-negotiable rules (from the design; enforced by lint/tests where possible)

- **NFR-11 theme:** every colour, font, size, radius, spacing comes from `config/theme.json` via CSS variables
  `--rm-*`. No hex/rgb in renderer code (a test fails on it). User overrides live in `%APPDATA%\reqochet-dev\theme.json`.
- **NFR-12 modules:** each `src/modules/<name>/index.ts` is that module's only public entry (ESLint blocks deep
  imports); `src/main/composition.ts` is the single place that wires implementations. The renderer may use only
  `window.reqochet` (contract in `src/shared/api.ts`) and types from `src/shared/domain.ts` — no Node/Electron.
- **NFR-05 never lose data:** validate before writing; atomic writes; every write is conflict-checked against the
  file revision it was read at (`ConflictError`); unknown header keys are preserved (`extra`); never force-push.
- Offline first; no server; no user accounts — access = Git host permissions.
- Data format: one Markdown file per item, `requirements/<document>/<ID>.md` (0.17: every folder under requirements/ is a document — S-10; `items` is the document of projects made before 0.17; loose files = document ''), YAML header in fixed key order, links
  stored only on the source item, each with `confirmed:` (target fingerprint). Schema in
  `requirements/.reqochet/schema.yaml` (projects made with ReqMan: `.reqman`, read until the user takes the rename). IDs `REQ-XXXXXXX` (7 random Crockford base32, every type; older `PREFIX-XXXXXX` stay valid). `order:` is an order
  key (`src/modules/items/orderKey.ts`) compared **byte-wise** (`<`), never with `localeCompare`; outline numbers
  are calculated, never stored. Details: ARCHITECTURE.md.
- The SQLite index (`%APPDATA%\reqochet-dev\cache\<sha1(root)>.sqlite`) is only a cache. **If you change its tables,
  bump `FORMAT_VERSION` in `src/modules/index-cache/sqliteIndex.ts`** — the cache is then dropped and rebuilt
  (lesson of v0.4.1, see Pitfalls).
- **Texts (S-06):** every word on screen comes from `src/shared/text.ts` (`T.area.key`, functions for texts with
  values); core messages shown to the user too. `tests/ui-texts.test.ts` fails on literal words in `.tsx`.
  **Arabic (0.13.0):** every key also in `src/shared/text-ar.ts` (the compiler insists); never store a text in a
  module-level constant (the language switch swaps `T` in place — read it when rendering; memoised lists depend on
  `useLanguage()`); CSS uses logical properties only (the window is right-to-left in Arabic).
- **Window calls:** add a method to `ReqochetApi` + a `Channels` entry + a handler in `src/main/ipc.ts` (the compiler
  insists) that checks its inputs with `src/main/validate.ts`. The preload needs no change.
- **Writes and Git actions go through the workspace queue** (`q(...)` in `workspace.ts`) — never call one queued
  operation from inside another (it would wait for itself).

## Commands

```
npm ci                    # install exactly what package-lock.json says
npm run dev               # run the app with live reload
npm run check             # typecheck (both projects) + ESLint (incl. module rules) + unit tests — must be green
npm run build             # production build into out/ (needed before e2e)
npm run test:e2e          # e2e scenarios (e2e/scenarios/*.e2e.mjs, two at a time) drive the built app; `-- fixes` runs one; screenshots in e2e/out/
npm run test:perf         # 10k data-layer performance test (every build); test:perf:all adds 50k (releases)
npm run measure:ui -- <repo>   # tree-table timings on a big repo (e.g. the sandbox clone)
npm run gen:repo -- <folder> [count]        # uniform generated items (performance)
npm run gen:scenario -- <folder> [count]    # rich scenario data (what Claude_SandBox was made with)
npm run dist:win          # local Windows installer into dist/ (CI does this for releases)
npm run check:deps        # library security problems + updates; also runs before every build; warns only, never blocks
node tools/ci.mjs status  # GitHub runs; wait / failures (annotations) / release (start by hand) / released
node tools/diagrams.mjs   # rebuild the Archify diagrams + navigator index.html in docs/diagrams (Archify cloned next to the repo; --index = navigator only)
```

On Linux CI/containers e2e needs `xvfb-run -a`; on Windows it opens real windows briefly.

## Releasing

1. Bump `version` in `package.json` (semver: milestone = minor, fix = patch).
2. Update `docs/TESTING.md` checklist, `CHANGELOG.md`, README status table if a milestone finished, and the
   progress line and release-plan row in `docs/design/roadmap.md`.
3. `npm run check`, `npm run build`, `npm run test:e2e` locally.
4. Commit and push to `main`. Two workflows run on `windows-latest`:
   - `build.yml` (every push): check, perf tests, build, e2e, installer artifact.
   - `release.yml` (push that changes `package.json` or the workflow, or manual): skips if `v<version>` release
     exists; otherwise check, build, e2e, `electron-builder --publish never`, zips the installer, and
     `gh release create v<version>` with `reqochet-dev-Setup-<v>.exe`, `.blockmap`, `.zip`, `latest.yml`.
5. Installed copies auto-update from that feed (electron-updater, GitHub provider in `electron-builder.yml`).
   The repository **must stay public** for auto-update to work without a token (tested: private → 404).
6. Watch with `node tools/ci.mjs status | wait | failures | release | released` (REST only — works in the cloud
   session where `gh run …`/`gh workflow run` are refused). Tell the owner the version and the checklist location
   when it is green.

Commit messages: imperative summary with version, blank line, bullet details. End with
`Co-Authored-By: Claude <noreply@anthropic.com>`.

## Status — read `docs/STATUS.md` first

Current version, what each version brought, the owner's last report, test counts and the next step live in
**`docs/STATUS.md`** (updated every release; this file changes only when a rule or a procedure changes).
The latest version and the next step: `docs/STATUS.md` → "Next" (no version number here, so this file stays the same).

**Testing rule (the owner, 28 Oct 2026):** the manual checklist per version has **at most 5 steps**; everything else is
automated (unit tests, e2e in CI, the in-app release self-test, the CI acceptance run).

**Saving tokens (the owner, 8 Nov 2026):** read files in parts (`offset`/`limit`, `grep -n` first); filter command
output to the lines that matter (`grep -E "✗|Tests|Error"`); look at screenshots only for screens that changed; run
the helpers only as `docs/AGENT-WORKFLOW.md` → "Cost" says; keep this file stable.

## Pitfalls

`docs/PITFALLS.md` lists every mistake that already cost time (cache upgrades, byte-wise order keys, e2e label matching,
language switch, Windows runner quirks, cloud-session limits…). **Read the entries for the area you change.**
