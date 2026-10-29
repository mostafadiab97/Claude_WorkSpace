# ReqMan — project memory for Claude

ReqMan is a small, serverless requirements-management desktop app (Windows 11 first). Requirements are plain
files in a `requirements/` folder of a project's own Git repository; ReqMan is the GUI that understands them
(table, hierarchy, links, suspect links) and, from M4 on, does the Git work at requirement level.
Internal proof of concept first; likely a commercial product later.

**Claude writes all of the code, tests and docs.** The product owner (Mostafa) decides the product, installs every
release on his Windows 11 PC and reports back. A team may take the code over later, so it must stay conventional,
tested and documented (NFR-10).

This file is the project memory and hand-over note: whoever continues (a cloud session, Claude Code in VS Code on
the owner's PC, or a future team) reads it fully first, then the documents it points to when a task touches them.
**Keep it current with every release** (status, next step, decisions, pitfalls).

Where development happens: planned to move to Claude Code in VS Code on the owner's PC (25 Oct 2026), but he could
not install Node.js (no admin rights; the no-admin zip route is in `docs/DEVELOPING.md`), so work continued in the
cloud session from v0.5.0. Nothing lives outside this repository and `Claude_SandBox`.

## Where everything is

| What | Where |
| --- | --- |
| **Onboarding for new engineers** (system diagrams, module roles, data flow, first change end to end) | `docs/ONBOARDING.md` (diagrams: navigator `docs/diagrams/index.html`; Archify sources `docs/diagrams/archify/*.json`, interactive `docs/diagrams/*.html`, pictures `docs/images/`; regenerate with `node tools/diagrams.mjs`, see `docs/diagrams/README.md`) |
| Project reviews (defects, structure, performance, risks — proposals awaiting the owner's decision) | `docs/reviews/2026-10-25-project-review.md` |
| Domain analysis of 5 RM tools, every product question with the owner's answer, product definition, FR/NFR list, journey, scope by stage, architecture, technology choices, milestone plan | `docs/design/DESIGN.md` (**source of truth for decisions**; tags C = confirmed by owner, R = recommendation, I = inference) |
| Module map, rules, data format, UI structure, decisions changed during build | `docs/ARCHITECTURE.md` |
| Manual test checklist per version (the owner tests with it), log/data locations, bug reporting | `docs/TESTING.md` |
| Theme file and customisation | `docs/THEMING.md` |
| What changed in each version and what the owner reported | `CHANGELOG.md` |
| Local development setup (Windows) | `docs/DEVELOPING.md` |
| Import/export formats (Excel, CSV, ReqIF) and the import plan | `docs/ARCHITECTURE.md` (import-export, importing.ts, Import wizard) |
| Every script in `tools/` and the working procedures (skills) | `tools/README.md`; skills in `.claude/skills/` (`release-to-owner` — use it for every release, `whole-project-review`, `owner-decision-walkthrough`) |
| Test data repository (10,005 fictional items) | GitHub `mostafadiab97/Claude_SandBox` — clone it **next to** this repo, never inside |
| Releases (installers + auto-update feed) | GitHub Releases of `mostafadiab97/Claude_WorkSpace` |

## How to work with the owner

- He tests each **release**, not branches: every change he should try ends with a version bump, a green CI release
  and a short checklist in `docs/TESTING.md` ("Manual test checklist — vX.Y.Z", numbered steps, expected results;
  move the previous one down as "Previous checklist"). He refers to checklist step numbers in feedback
  ("test 6 failed").
- Explain in plain language, short. He asks "explain this further" when he wants depth. No jargon without a
  one-line explanation.
- Product decisions are his (ask, with a recommended option first). Technical decisions are yours ("I leave the
  final decision to you"); explain them briefly. Facts / inferences / recommendations are kept distinct.
- When he reports a bug: reproduce it in a test first, fix, explain the cause in one or two sentences, release.
- Bundle small fixes he asks for into the next milestone release when he says so ("add this fix in the same
  version as M3").
- He asked to be asked before steps that affect his accounts/repos (e.g. repository visibility). Never change
  repo visibility, delete releases, rewrite history or force-push.
- Only free, open-source dependencies whose licences allow commercial use (NFR-07). No paid services.

## Non-negotiable rules (from the design; enforced by lint/tests where possible)

- **NFR-11 theme:** every colour, font, size, radius, spacing comes from `config/theme.json` via CSS variables
  `--rm-*`. No hex/rgb in renderer code (a test fails on it). User overrides live in `%APPDATA%\ReqMan\theme.json`.
- **NFR-12 modules:** each `src/modules/<name>/index.ts` is that module's only public entry (ESLint blocks deep
  imports); `src/main/composition.ts` is the single place that wires implementations. The renderer may use only
  `window.reqman` (contract in `src/shared/api.ts`) and types from `src/shared/domain.ts` — no Node/Electron.
- **NFR-05 never lose data:** validate before writing; atomic writes; every write is conflict-checked against the
  file revision it was read at (`ConflictError`); unknown header keys are preserved (`extra`); never force-push.
- Offline first; no server; no user accounts — access = Git host permissions.
- Data format: one Markdown file per item, `requirements/items/<ID>.md`, YAML header in fixed key order, links
  stored only on the source item, each with `confirmed:` (target fingerprint). Schema in
  `requirements/.reqman/schema.yaml`. IDs `REQ-XXXXXXX` (7 random Crockford base32, every type; older `PREFIX-XXXXXX` stay valid). `order:` is an order
  key (`src/modules/items/orderKey.ts`) compared **byte-wise** (`<`), never with `localeCompare`; outline numbers
  are calculated, never stored. Details: ARCHITECTURE.md.
- The SQLite index (`%APPDATA%\ReqMan\cache\<sha1(root)>.sqlite`) is only a cache. **If you change its tables,
  bump `FORMAT_VERSION` in `src/modules/index-cache/sqliteIndex.ts`** — the cache is then dropped and rebuilt
  (lesson of v0.4.1, see Pitfalls).
- **Texts (S-06):** every word on screen comes from `src/shared/text.ts` (`T.area.key`, functions for texts with
  values); core messages shown to the user too. `tests/ui-texts.test.ts` fails on literal words in `.tsx`.
- **Window calls:** add a method to `ReqManApi` + a `Channels` entry + a handler in `src/main/ipc.ts` (the compiler
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
   progress line in `docs/design/DESIGN.md` (section "Prototype implementation plan").
3. `npm run check`, `npm run build`, `npm run test:e2e` locally.
4. Commit and push to `main`. Two workflows run on `windows-latest`:
   - `build.yml` (every push): check, perf tests, build, e2e, installer artifact.
   - `release.yml` (push that changes `package.json` or the workflow, or manual): skips if `v<version>` release
     exists; otherwise check, build, e2e, `electron-builder --publish never`, zips the installer, and
     `gh release create v<version>` with `ReqMan-Setup-<v>.exe`, `.blockmap`, `.zip`, `latest.yml`.
5. Installed copies auto-update from that feed (electron-updater, GitHub provider in `electron-builder.yml`).
   The repository **must stay public** for auto-update to work without a token (tested: private → 404).
6. Watch with `node tools/ci.mjs status | wait | failures | release | released` (REST only — works in the cloud
   session where `gh run …`/`gh workflow run` are refused). Tell the owner the version and the checklist location
   when it is green.

Commit messages: imperative summary with version, blank line, bullet details. End with
`Co-Authored-By: Claude <noreply@anthropic.com>`.

## Status (v0.11.1, 29 Oct 2026) — prototype complete; Changes view; Excel + ReqIF exchange

| Milestone | State |
| --- | --- |
| M0 Foundations — skeleton, modules, theme, installer, logs, diagnostics | Done (v0.0.1–0.0.4) |
| M1 Data layer — schema, item files, store, SQLite index, perf, auto-update, data self-test | Done (v0.1.0) |
| M2 Core UI — open/create folder, table, hierarchy, editor; then owner feedback: tree inside the table, drag & drop, parent picker, fields dialog, columns menu | Done (v0.2.0, v0.3.0) |
| M3 Links — add/remove both directions, suspect links + confirm, Text/Links columns, link filters, built-in fields protected, column order | Done (v0.4.0, fix v0.4.1) |
| M4 Git — Git bar, per-item changes, commit (requirements/ only), pull that stops safely on items changed on both sides, push (never forced), discard, undo unpushed commit, name/e-mail form, per-item history with field-level comparison | Done (v0.5.0) |
| M5 Compare — pulls first; default "what the last pull brought in" (reflog); uncommitted / last commit / any two versions; per item (added/changed/moved/deleted + summary + suspect-impact warning) and per link; schema changes; fast via `cat-file --batch` by blob ID | Done (v0.6.0) |
| M6 Export and hardening — table and Compare export to CSV (comma, UTF-8 BOM) and Markdown; error boundary; old-Git warning; CI smoke test with 10k generated items; combined checklist + two-PC trial script | Done (v0.7.0) |
| 0.8.0 clean page — all review fixes (D-01–D-08, D-10, P-01/02/04/05, S-01/02/03/06, X-01, T-01–05), release self-test, 5-step checklist | Done (v0.8.0) |
| 0.9.0 new data format — `REQ-` + 7 chars, type editable, order keys (S-04), outline numbers, sandbox converted | Done (v0.9.0) |
| 0.10.0 Changes view — one view for uncommitted + compare, split difference with ↶ per part, Keep/Unlink window, no automatic pulls, column widths | Done (v0.10.0) |
| 0.11.0 M7 Excel + ReqIF — import wizard (xlsx/csv/reqif), Excel + ReqIF export, chosen items, update the Excel file, new project from a file, publish to GitHub | Done (v0.11.0) |
| 0.11.1 owner's requests — non-empty folder asks again, move several chosen items, auto-scroll while dragging, discard chosen/all in Changes, one export entry in the row menu, ReqIF validated against the official schema in tests | Done (v0.11.1) |
| **0.12.0 M8 branches** (create/switch, tags as baselines, per-requirement merge S-05, D-09, D-05) | **Next** |

Owner's last report (29 Oct 2026): 0.11.0 all 5 steps passed, self-test 20/20; five requests → 0.11.1. He has no
DOORS/Jama to try ReqIF: exports are validated against the official schema in `tests/reqif.test.ts`
(`tests/fixtures/reqif-schema/`, xmllint-wasm). Two-PC trial postponed (needed for 0.12.0).

Automated tests: 170 unit tests (+2 perf skipped by default) including real-Git tests with a bare "GitHub"
repository and two clones ("PC A", "PC B"), the release self-test itself, the sandbox's chapter-9 promises
(`tests/sandbox-expectations.test.ts`) and window logic (`tests/ui/`); e2e scenarios: `excel` (new project from the sample file, chosen-items export, update the file, ReqIF round trip,
publish), `journey` (~75 checks, the
whole user story, incl. the Changes view, ↶, Keep/Unlink window, push offer) and `fixes` (renamed file, lazy Expand all,
column width drag, Changes view layout + split difference, second start, release self-test in the window).
0.8.0 measurements (10k scenario repo, Linux): refresh after a save 0.37 → 0.09 s; Expand all first screen 0.26 s.
Compare on the sandbox: 9,118 changed files (confirmations only) 0.4 s; 3,000 real edits 1.8 s (engine).
Export of all 10,005 sandbox items: CSV 0.46 s (3.1 MB), Markdown 0.43 s. CI runs `measure:ui` on a generated 10k repo.
Measured on the sandbox (10,005 items, Linux container): open incl. first indexing 5–8 s, expand all 0.4–0.6 s,
scroll to bottom 65 ms, suspect filter 0.3 s. Owner's PC: 10k queries < 15 ms; 50k first index 18–73 s (Defender).

## M4 decisions (owner, 25 Oct 2026) — already built

- Pull that finds items changed on both sides **stops without changing anything** and lists them; per-item
  resolution is FR-13 (MVP). Until then: Undo last commit (if unpushed) + Discard = take their version.
- Branch is **shown only**; creating/switching branches is FR-12 (MVP).
- ReqMan commits **only `requirements/`** (`git add --all -- requirements` + `git commit --only -- requirements`).
- Implementation notes: `src/modules/workspace/gitOps.ts` (rules + messages), `src/modules/git-adapter/systemGit.ts`
  (commands). In-memory conflict check = `git merge-tree --write-tree` (Git ≥ 2.38; owner has 2.47); if it is
  unavailable the merge runs and is aborted on conflicts (safety net). Sign-in only via Git Credential Manager
  (`GIT_TERMINAL_PROMPT=0` so nothing hangs on an invisible prompt).

## M5 decisions (owner, 25 Oct 2026) — already built

- Default comparison = "since my last pull" = what the last pull brought in (HEAD before → after the newest
  `pull…`/`merge <remote>/<branch>…` step in the reflog; pulls outside ReqMan count too).
- ~~ReqMan pulls right before any comparison~~ — **replaced 27 Oct 2026 (O-06): no automatic pulls; ReqMan offers to
  pull before remote-related actions.** Built in 0.10.0 (last-pull view and Push offer "Pull first").
- Exporting the comparison list → M6.
- Implementation: `src/modules/workspace/compare.ts`; `git diff --raw -z -M` gives blob IDs; contents come from
  `readBlobs()` (one `git cat-file --batch`). Naming objects `<rev>:<path>` instead was 40× slower with 10k files in
  one folder (tree lookups). Files that differ only in `confirmed:` lines are skipped before parsing.

## Where we are right now (28 Oct 2026) — read this first

The owner's tests of 0.5.0–0.7.0 all passed (27 Oct). His requests O-01–O-07 and the whole project review
(`docs/reviews/2026-10-25-project-review.md`, section H = every answer) have been discussed and decided. The
**release plan is confirmed** (DESIGN.md → "Release plan"):

0.8.0 clean page (all review fixes, refactors S-01–S-03, central GUI text file S-06, tests T-01–T-05, in-app
**release self-test**, checklist ≤ 5 steps) → 0.9.0 new data format (`REQ-` + 7 chars, order keys, outline numbers,
sandbox converted) → 0.10.0 Changes view (O-04/O-05/O-06) → 0.11.0 M7 Excel + ReqIF (ReqIF merged in, owner 29 Oct
2026) → 0.12.0 M8 branches.

**0.11.1 released (29 Oct 2026)** — waiting for the owner's 5-step checklist. **Next: 0.12.0 M8 branches** (DESIGN.md
"Release plan"): create/switch branches, tags as baselines, per-requirement 3-way merge on pull (S-05, FR-13),
duplicate-ID repair (D-09), D-05. Walk the owner through the open M8 questions first (owner-decision-walkthrough) and
plan the two-PC trial with him (it is the real test of merging).
The owner is a C developer new to this field: explain from first principles, short, C analogies where useful.
Record decisions in the review file / DESIGN.md.

**Testing rule from 0.8.0 (owner, 28 Oct 2026):** the manual checklist per version has **at most 5 steps** (update
arrives, release self-test, open the sandbox, one real push only when Git changed, the version's new feature).
Everything else must be automated (unit tests, e2e in CI, the in-app release self-test).

## M6 decisions (owner, 25 Oct 2026) — already built

- CSV separator: **comma** (his Excel). Files: UTF-8 with BOM, CRLF; cells starting with `= + @` get a leading `'`.
- Next milestones in this order: **M7 Excel export + import**, then **M8 branches + per-requirement conflict
  resolution**.
- Export lives in `src/modules/import-export` (pure); `workspace.exportItems/exportCompare` build the content;
  `main/ipc.ts` shows the save dialog (last folder in `%APPDATA%\ReqMan\export-settings.json`). E2E mocks
  `dialog.showSaveDialog` (`saveAs()` helper in the journey).

## M7 notes (0.11.0) — built

- Excel export with ExcelJS (MIT; check size); import wizard (file → sheet → header row → column mapping guessed →
  type per row → preview with problems) writing uncommitted changes; update existing items by ID; read links; foreign
  IDs kept as `source-id`; outline numbers rebuild the hierarchy. Round trip test with the sandbox and
  `samples/sample-requirements.xlsx` (59 items).
- Plus "New project from a file", "Update the Excel file", "Publish to GitHub" and **export of chosen items**
  (Ctrl/Shift+click multi-select, right-click "Export this item and everything below it", tick box "Include the items
  below" ticked by default, overlaps once, document order, full outline numbers).

## Small things the owner has asked for or accepted along the way

- Light-mode success green `#22c55e` (brighter than first proposal).
- Scrollbars: at the right edge of their area, thumb only, no track.
- `theme.json` in `%APPDATA%` starts as an override-only file with a `_help` key (a full copy froze values).
- Table = tree when not searching/filtering; flat list (best match first) when searching or filtering.
- Header sort: ascending → descending → back to document order.
- Column widths: drag the header edge (double-click = automatic); personal like hidden/ordered columns (0.10.0).
- Hidden/ordered columns are personal (per repo, per PC, localStorage) — not shared through Git; field
  definitions are shared (schema.yaml).
- Type is editable in the editor since 0.9.0 (IDs no longer contain the type).
- Link edits are saved immediately and locked while the item has unsaved edits.
- Delete offers to remove incoming links (ticked by default).

## Pitfalls already hit (don't repeat)

- **Cache upgrade:** `CREATE TABLE IF NOT EXISTS` kept old columns → "table items has no column named fp" for
  every user who had opened a repo with 0.3.x. E2E runs start with a fresh profile and cannot see this — add a unit
  test with an old cache file whenever the layout changes (see `tests/index-cache.test.ts`).
- Build output is CommonJS (no `"type": "module"`); configs are `.mts`/`.mjs`; preload is sandboxed CJS.
- Windows temp paths can be short names (`RUNNER~1`) — compare with `realpathSync.native`.
- React lint (`react-hooks`): no synchronous `setState` inside effects; no ref writes during render. Use keyed
  components or derived values.
- E2E: Playwright `getByLabel` is a substring match and finds `aria-label`s too — keep labels unique (e.g.
  "Type filter" vs editor "Type"), use `getByRole('checkbox', { name })` or `{ exact: true }`.
- E2E must exit with `app.exit(0)`; closing normally can hang on the "unsaved changes" dialog.
- The sandbox's `RSK-RENAMD.md` is deliberately renamed — scripts that rewrite items must not write it under its
  ID (would create a duplicate).
- Changing sandbox data: keep IDs stable (migrate in place, like `tools/confirm-sandbox-links.mts`), update its
  README, tell the owner to `git pull` / `git reset --hard origin/main` there.
- Release via tag push is not used; the version change in `package.json` triggers the release.
- `electron-builder --publish always` failed in CI before; publishing uses `gh release create` instead.
- The Changes view (0.10.0) replaces the table and the editor column, but both stay **mounted** (hidden) so unsaved
  edits and the tree's open levels survive; opening any item closes the view. In e2e, open it only if it is not
  visible (the button toggles) — see `openChanges()` in the journey.
- E2E `save()` closes the "Check the links to this item" window (Decide later) when a save opens it; pass
  `{ review: 'check' }` where the window itself is tested. `getByLabel('Show')` also matched the chip group
  ("Show only…") — use `{ exact: true }`.
- Real-Git tests are slow on the Windows runner (antivirus): give those `describe` blocks a long timeout. The runner
  has `core.autocrlf=true`, so files Git checks out may have CRLF — compare with line endings normalised (item files
  in real repositories are protected by `requirements/.gitattributes`).
- If a release run fails after the version bump, fix, push, then start it by hand: `gh workflow run release.yml`
  (a push without a `package.json` change does not trigger it).
- Git tests that need "no identity" must isolate `HOME` and `GIT_CONFIG_GLOBAL` (see `tests/workspace-git.test.ts`).
- A clone of an empty remote has an upstream configured but no remote branch: treat that as "no upstream" (status
  has no `branch.ab` line) so the first push publishes with `-u`.
- **Folder watch timing (P-01):** the OS reports file changes a few ms after they happen; `refresh()` waits 60 ms
  before taking the watcher's list. Code that changes files and refreshes right away (tests, the self-test) must
  not assume the change is seen without that wait.
- **Window logic tests** live in `tests/ui/` and are type-checked with `tsconfig.web.json` (DOM types); the node
  project excludes that folder. Tests may import modules only through their `index.ts` (ESLint).
- **Single-instance lock:** two ReqMan processes with the same `--user-data-dir` cannot run; e2e scenarios each use
  their own profile (`launch()` in `e2e/harness.mjs`), so they can run side by side.
- **From this cloud session:** `gh workflow run` and other GraphQL calls are refused (403) — start a release with
  `gh api -X POST repos/mostafadiab97/Claude_WorkSpace/actions/workflows/release.yml/dispatches -f ref=main`.
  Run logs and artifacts cannot be downloaded either; failed e2e scenarios are therefore written as GitHub
  annotations (`gh api repos/.../check-runs/<job id>/annotations`).
- **Order keys are compared byte-wise.** `localeCompare` sorts `a0` / `aA` / `aa` differently from SQLite and
  `keyBetween` → wrong order (hit in the sandbox conversion). Use `<`/`>` (see `cmp` in the conversion tool).
- **IDs that change** (conversion): Compare pairs items by `former-id`; code that maps "before" items must look them
  up by the old ID (`beforeId` map in `compare.ts`).
- **ExcelJS 4.4 and absolute part paths:** files written by openpyxl (e.g. `samples/sample-requirements.xlsx`) point
  to tables with "/xl/tables/…"; ExcelJS crashes ("reading 'name'"). `loadWorkbook()` in `import-export/xlsx.ts`
  rewrites them first — always read through `readXlsx`/`updateXlsx`, never `new Workbook().xlsx.load` directly.
- **XML attribute values lose line breaks** unless written as `&#10;` (`escAttr` in `reqif.ts`).
- **Import round trips:** a column that is mapped must not get the field's default for new items (an empty cell
  = no value), the text cell is taken exactly (trailing spaces are data), lists compare as sets, and references the
  file cannot hold (missing parents/targets, values outside an enum) stay as they were. The sandbox test of both
  round trips (10,005 unchanged) is the check — `previewImport` only returns the first 300 rows.
- **E2E drag to a row off screen:** Playwright's `dragTo` scrolls the table between pressing and moving; the
  virtual table reuses row elements, so the drag starts on another item. Drag to a row that is on screen.
- **Electron downloads its program on first use:** two scenarios starting at once failed on Windows ("file in
  use") — `e2e/run.mjs` imports `electron` once before starting them.
