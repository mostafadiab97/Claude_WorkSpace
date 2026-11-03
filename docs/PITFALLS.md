# Pitfalls already hit — don't repeat them

> Moved here from `CLAUDE.md` on 1 Nov 2026 (content unchanged). Every entry is a mistake that cost time once: read the
> ones that touch the area you change. Add a new entry whenever a bug or a failed release teaches something.

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
  `gh api -X POST repos/<owner>/Claude_WorkSpace/actions/workflows/release.yml/dispatches -f ref=main`.
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
- **E2E role names are substring matches:** a branch button labelled "…pull from other branches" made
  `getByRole('button', { name: 'Pull' })` find two buttons. Keep labels of new buttons free of other buttons' words.
- **Drop-down panels inside the Git bar:** anchor them to `.gitbar--anchor` (the bar row), not the whole region — the
  notices below the bar would push them down. Close on Esc and on a click outside (BranchMenu shows how).
- **Language switch:** a module-level `const X = [{ label: T.… }]` keeps the old language forever (hit in
  ThemeToggle, FieldsPanel, columns) — build such lists inside the component/function. Arabic plural forms: use the
  `pl()` helper in `text-ar.ts`. Test new screens once in Arabic (e2e `language`).
- **Arabic texts carry a leading U+200F (RLM)** (0.13.1, added by `marked()` in `text-ar.ts`): e2e lookups of Arabic
  names must allow it (`/^\u200F?حفظ$/`, or substring matches); never strip it when building Arabic strings.
- **E2E after 0.13.0:** filters are in a pop-up — use the journey's `filters()` helper; the Git region lives inside
  the top bar; success notices close themselves after 9 s (wait for them right after the action).
- **Git bar state lags a save by ~250 ms:** panels that decide on `state.changes` right after a save (branch switch
  question) must ask `getGitState()` again (BranchMenu does).
- **Dependabot:** read each proposal before merging (CI must be green; see the ignore list in `.github/dependabot.yml`).
  TypeScript majors wait for typescript-eslint support (PR #5: `npm ci` ERESOLVE); `@types/node` follows the Node.js
  inside Electron (Electron 45 = Node 24, so `^24`; PR #6). Merging/closing PRs needs the owner's yes (his repo).
- **Electron downloads its program on first use:** two scenarios starting at once failed on Windows ("file in
  use") — `e2e/run.mjs` imports `electron` once before starting them.

## Cold Windows runner: the first two e2e scenarios time out on the start screen (0.14.0)
The release run of 0.14.0 lost `branches` and `excel` (the first pair) waiting 30 s for "Open repository…", while the
Build run of the same commit passed. A freshly unpacked Electron is scanned by Windows Defender, so the first windows
load slowly. `launch()` in `e2e/harness.mjs` now waits up to 120 s for the page and the splash before any step. If it
happens again, re-run the release (`node tools/ci.mjs release`) before suspecting the code.

## Acceptance run (P-41) — how it reaches the installed app
`e2e/acceptance.mjs` drives `%LOCALAPPDATA%\Programs\ReqMan\ReqMan.exe` with Playwright (works because the packaged app
keeps Electron's default fuses). The update test overwrites the installed `resources\app-update.yml` with a generic
feed on `http://127.0.0.1:8765/` serving `dist/` — never change `publish:` for this. The push uses
`x-access-token:${GITHUB_TOKEN}` (workflow permission `contents: write`) and always deletes `ci/acceptance-*` in a
`finally`; messages are scrubbed of the URL before they are printed.

## Personal data in commit history (3 Nov 2026)
Early sandbox commits carried a work e-mail; removing it needed a history rewrite and a force-push (with the owner's
explicit approval). Prevention: `tools/check-privacy.mjs` in build.yml fails on any commit e-mail that is not a GitHub
private / no-reply address and on real e-mail addresses in files; gitleaks scans for secrets. Test data must use
`example.com` / `.test` / `.invalid` addresses only.

## Always run the full e2e suite before a release (0.14.2)
0.14.2's first release run failed: `journey` measured `locator('.page')`, and the new Settings layout had two `.page`
elements (strict-mode violation). Only `health` had been run locally after changing Settings. Run `npm run test:e2e`
(all scenarios) before every version bump; the settings scroll area is `.settings-main`, the page wrapper `.page`.
