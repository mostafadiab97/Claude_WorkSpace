# ReqMan — project memory for Claude

ReqMan is a small, serverless requirements-management desktop app (Windows 11 first). Requirements are plain
files in a `requirements/` folder of a project's own Git repository; ReqMan is the GUI that understands them
(table, hierarchy, links, suspect links) and, from M4 on, does the Git work at requirement level.
Internal proof of concept first; likely a commercial product later.

**Claude writes all of the code, tests and docs.** The product owner (Mostafa) decides the product, installs every
release on his Windows 11 PC and reports back. A team may take the code over later, so it must stay conventional,
tested and documented (NFR-10).

This file is the hand-over from the cloud phase (24–25 Oct 2026, releases v0.0.1–v0.4.1) to local work in
VS Code. Read it fully before starting; then read the documents it points to when a task touches them.

## Where everything is

| What | Where |
| --- | --- |
| Domain analysis of 5 RM tools, every product question with the owner's answer, product definition, FR/NFR list, journey, scope by stage, architecture, technology choices, milestone plan | `docs/design/DESIGN.md` (**source of truth for decisions**; tags C = confirmed by owner, R = recommendation, I = inference) |
| Module map, rules, data format, UI structure, decisions changed during build | `docs/ARCHITECTURE.md` |
| Manual test checklist per version (the owner tests with it), log/data locations, bug reporting | `docs/TESTING.md` |
| Theme file and customisation | `docs/THEMING.md` |
| What changed in each version and what the owner reported | `CHANGELOG.md` |
| Local development setup (Windows) | `docs/DEVELOPING.md` |
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
  `requirements/.reqman/schema.yaml`. IDs `PREFIX-XXXXXX` (6 random Crockford base32). Details: ARCHITECTURE.md.
- The SQLite index (`%APPDATA%\ReqMan\cache\<sha1(root)>.sqlite`) is only a cache. **If you change its tables,
  bump `FORMAT_VERSION` in `src/modules/index-cache/sqliteIndex.ts`** — the cache is then dropped and rebuilt
  (lesson of v0.4.1, see Pitfalls).

## Commands

```
npm ci                    # install exactly what package-lock.json says
npm run dev               # run the app with live reload
npm run check             # typecheck (both projects) + ESLint (incl. module rules) + unit tests — must be green
npm run build             # production build into out/ (needed before e2e)
npm run test:e2e          # drives the built app through the whole journey (Playwright + Electron), screenshots in e2e/out/
npm run test:perf         # 10k and 50k item data-layer performance tests (~1–2 min)
npm run measure:ui -- <repo>   # tree-table timings on a big repo (e.g. the sandbox clone)
npm run gen:repo -- <folder> [count]        # uniform generated items (performance)
npm run gen:scenario -- <folder> [count]    # rich scenario data (what Claude_SandBox was made with)
npm run dist:win          # local Windows installer into dist/ (CI does this for releases)
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
6. Watch: `gh run list --limit 3`, `gh run watch <id> --exit-status`. Tell the owner the version and the
   checklist location when it is green.

Commit messages: imperative summary with version, blank line, bullet details. End with
`Co-Authored-By: Claude <noreply@anthropic.com>`.

## Status at hand-over (v0.4.1)

| Milestone | State |
| --- | --- |
| M0 Foundations — skeleton, modules, theme, installer, logs, diagnostics | Done (v0.0.1–0.0.4) |
| M1 Data layer — schema, item files, store, SQLite index, perf, auto-update, data self-test | Done (v0.1.0) |
| M2 Core UI — open/create folder, table, hierarchy, editor; then owner feedback: tree inside the table, drag & drop, parent picker, fields dialog, columns menu | Done (v0.2.0, v0.3.0) |
| M3 Links — add/remove both directions, suspect links + confirm, Text/Links columns, link filters, built-in fields protected, column order | Done (v0.4.0, fix v0.4.1) |
| **M4 Git** — status of changed items, commit, pull, push, per-item history | **Next** |
| M5 Compare — two refs, per-item and per-link differences | Planned |
| M6 Export (CSV) and hardening; full journey on two PCs | Planned |

Owner's last report (25 Oct 2026): "all works fine" on v0.4.1.

Automated tests at hand-over: 71 unit tests (+2 perf skipped by default), e2e journey with ~55 checks.
Measured on the sandbox (10,005 items, Linux container): open incl. first indexing 5–8 s, expand all 0.4–0.6 s,
scroll to bottom 65 ms, suspect filter 0.3 s. Owner's PC: 10k queries < 15 ms; 50k first index 18–73 s (Defender).

## Next step: M4 Git (draft plan — confirm the open questions with the owner first)

Goal (journey steps 4, 5, 7): commit and push from ReqMan; the other engineer pulls; per-item history.

Proposed scope:
1. **git-adapter** grows: `status(root)`, `commit(paths, message)`, `pull()`, `push()`, `log(path)`,
   `show(ref, path)`, `currentBranch()`, `aheadBehind()` — all via the installed `git` (no libgit2), argument
   arrays only (no shell), timeouts, clear errors. Authentication = the user's Git (Git Credential Manager ships
   with Git for Windows); ReqMan stores no tokens.
2. **Changes panel:** items changed vs HEAD (added / modified / deleted / renamed), per item, from
   `git status --porcelain=v2 -- requirements/`; schema changes listed separately; "discard changes" per item
   (with confirmation).
3. **Commit:** message box; commits only `requirements/` paths (never other project files); refuses with unsaved
   editor changes; shows author from `git config` and asks to set name/email if missing.
4. **Pull / Push:** pull = fetch + fast-forward when possible; push never forces; rejected push → explain "pull
   first". Ahead/behind counter in the top bar with the branch name. After pull: index sync (already fast).
5. **Per-item history:** `git log --follow` on the item file → list (author, date, message); selecting an entry
   shows that version's fields/text/links side by side with the current one (field-level, not line diff) —
   reuse the item parser on `git show <commit>:<path>`.
6. **Tests:** a bare repo as "remote" + two clones in temp folders ("PC A" and "PC B") in unit and e2e tests:
   A commits & pushes, B pulls, edits, pushes, A pulls, history shows both authors.

Open questions for the owner (ask before building):
- When a pull hits a conflict (both changed the same item): in M4 just stop safely and list the conflicting
  items (recommended; resolution per item is FR-13, MVP), or already resolve per item (mine / theirs)?
- Branch switching/creation in M4 too, or only show the current branch (FR-12 is MVP)?
- Commit scope: only `requirements/` (recommended) — confirm.

Later milestones and backlog are in DESIGN.md ("Scope by stage") — notable MVP items: schema editor for item and
link types (fields part done), branches and tags, per-requirement merge, Word/PDF/Excel/Markdown export,
Excel/CSV import (`samples/sample-requirements.xlsx` is the test file), coverage rules (open question:
report-only by default), GitHub PR view.

## Small things the owner has asked for or accepted along the way

- Light-mode success green `#22c55e` (brighter than first proposal).
- Scrollbars: at the right edge of their area, thumb only, no track.
- `theme.json` in `%APPDATA%` starts as an override-only file with a `_help` key (a full copy froze values).
- Table = tree when not searching/filtering; flat list (best match first) when searching or filtering.
- Header sort: ascending → descending → back to document order.
- Hidden/ordered columns are personal (per repo, per PC, localStorage) — not shared through Git; field
  definitions are shared (schema.yaml).
- Type is read-only in the editor (it decides the ID prefix).
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
