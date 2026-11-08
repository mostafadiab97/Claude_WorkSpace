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

## electron-builder: `-c` means a config FILE (0.14.4)
`-c.publish.owner=x` was read as "config file `.publish.owner=x`" and the release build failed. Use the long form
`--config.publish.owner=… --config.publish.repo=…` (checked locally: the installed `app-update.yml` then holds them).

## 0.15.0 UI polish

- **CSS class names are global.** A new `.segmented` rule for the suspect dialog silently restyled the existing
  language/theme switches. Grep `styles.css` for a class before adding one (`.choice-pair` now).
- **The table's Text column comes from the index**, not from the window: `preview()` in
  `src/modules/index-cache/sqliteIndex.ts` builds it for brief queries. A fix only in `renderer/lib/markdown.ts`
  did not reach the table (underscores were still dropped) — the QA e2e caught it.
- **React compiler lint:** a component whose props contain refs gets "Cannot access refs during render" on every
  `props.x` — destructure the refs out of the props (`Toolbar({ searchRef, newRef, ...props })`); never assign
  to a prop object (`onSaveReady` callback instead of a `saveRef` prop).
- **Git identity:** written per repository, globally only when no global identity exists — the owner's company
  repositories use his global one (0.14.2 step 5).
- **Cards that run long actions lose their state when the page changes** (Settings pages unmount). Keep such state in
  `renderer/lib/sessionState.ts` (0.15.1, self-test).
- **A search box that closes on blur** closes when the user moves to a sibling control (the link type list). Mark the
  form with `data-keeps-search`; `ItemSearch` ignores blurs into it (0.15.1).
- **A GitHub outage looked like "Pull first"** (0.15.2): `! [remote rejected] main -> main (Internal Server Error)`
  matched `/rejected/`. `explainGitError` now checks server errors first (`T.gitMsg.serverError`); the acceptance run
  pushes once more after 30 s when the app reports one.

## `overflow: hidden` on the top bar hides its pop-overs (0.16.0 → 0.16.1)

The Git questions and notes hang below the top bar (`position: absolute; top: 100%`). `overflow: hidden` on `.topbar`
(added to stop long names running past the window) clipped them: "Pull first?" was visible only as a glow. Clip
sideways only (`overflow-x: clip; overflow-y: visible` — `clip`, unlike `hidden`, allows the other axis to stay
visible). `journey.e2e.mjs` hit-tests the real button (`elementFromPoint`), because Playwright's `waitFor` passes on a
clipped element.

## Vitest's transform cache keeps an old `import.meta.glob` list (0.16.1)

`node_modules/.vitest-cache` keys a transformed test file on its own content; a glob inside it (e.g. the brand QA test's
`resources/brand/**/*.svg`) is not refreshed when files are added. Symptom: a new SVG shows as `unknown:data:…` only
under `npm run check` (coverage). Fix: delete `node_modules/.vitest-cache`. CI starts clean, so it never sees this.

## A library override can pull in optional requires the bundler cannot find (0.16.3)

`overrides: { unzipper: 0.12.3 }` (SEC-05) made `npm run build` fail: unzipper 0.12 `require`s `@aws-sdk/client-s3`
inside a function for reading zips from S3. Vitest and e2e still passed because e2e ran the *previous* `out/` build.
Fix: `external: ['@aws-sdk/client-s3']` in the main build of `electron.vite.config.mts`. Always run `npm run build`
and check it printed "built in" before trusting an e2e run.

## Late answers overwrite a newer tree (0.17.0)

Every async table load that merges into the tree must check that the sort/document it asked for is still the current
one (`sortKeyRef` + `merge(next, asked)` in `table/rows.ts`). `reveal()` after a save answered for the old document
after the user had switched to "All documents" and replaced its top level — seen only when the e2e ran under load.
Git: paths passed to Git are literal (`GIT_LITERAL_PATHSPECS=1` in `systemGit.ts`); never rely on wildcards there.
SQLite: a correlated `NOT EXISTS` on `item_fields` may pick the `(field, value, rid)` index and walk every row of the
field per item — keep `INDEXED BY item_fields_rid` (Incomplete went from 83 s to milliseconds at 50k).

## Git over thousands of files on Windows (0.17.1)

The owner's rename of a 10,005-item folder failed: `git add` took longer than the 30 s limit on Windows, Git was
stopped, and the put-back failed silently. "Discard all" of 10,000 paths failed with `spawn ENAMETOOLONG` (Windows
command lines end at ~32,000 characters). Rules: move tracked files with `git.move` (`git mv`, no re-hashing); pass
long path lists through standard input (`--pathspec-from-file=- --pathspec-file-nul`) or in parts
(`PATHS_PER_COMMAND`); give bulk commands `BULK_TIMEOUT`; every multi-step file operation must put back what it did
and re-read the folder when it fails. Tests: `tests/rename-big-0.17.1.test.ts` (a runner that records command length).

## GitHub downloads from the Windows runners (0.17.2, 8 Nov 2026)

For hours, GitHub answered **anonymous** downloads of release files (Electron, gitleaks) from the Windows runners with
`504 Gateway Time-out` or a page that was not a zip — no incident on its status page — while **signed-in** downloads
with `gh` (`GH_TOKEN: ${{ github.token }}`) worked. CI now gets Electron with `tools/ci-electron.mjs` (gh, checksum
from `SHASUMS256.txt`, unpacked with Windows' own `tar.exe` — Git Bash's tar reads `D:` as a host) and builds the
installer with `--config.electronDist=node_modules/electron/dist`; gitleaks also comes through `gh`. Run `npm run
check` before pushing a new tools/ script too (ESLint covers tools/).

## Removing emptied folders (0.18.0, PERF-01)
Listing the parent folder after every `rmdir` made Discard of 10,000 new folders take 34 s. Use `rmdir` alone (it
refuses a folder that still holds anything) and go **level by level, deepest first** — sorting folder names by length
tries a parent before a shorter-named child is gone, and the parent then stays.

## e2e and per-row button names (0.18.0)
A UI/UX fix gave each history row's buttons their own accessible name ("Open 1a2b3c4 read-only"), so `getByRole('button',
{ name: 'Open read-only' })` no longer matched. When a label gains the row's name, match with a regular expression.

## A correlated subquery per row in the tree query (0.18.0)
"Top level = no parent, or the parent is in another document" written as `NOT EXISTS (SELECT … p.id = i.parent AND
<document of p> = <document of i>)` ran once per item: 492 ms at 50,000 items on the Windows runner (limit 300), so
the release run failed although the build run passed (it runs only 10k). The index now stores `doc` and `top` per
item (`top` recomputed for changed items and their children), with indexes on `(doc, top, ord)` and `(top, ord)`.
Run `npm run test:perf:all` before a release whenever a query's WHERE changes.

## A slow update after a hand install (owner, 0.17.2 → 0.18.0)
Updates normally download only the changed parts (about 3 MB of the 121 MB installer). That needs the updater's saved
copy of the *previous* installer. 0.17.2 was installed by hand (the feed answered 502 that day), so the saved copy
belonged to an older version: the partial download failed its checksum (log: "sha512 checksum mismatch after
differential download") and electron-updater fell back to the full 121 MB, about 3–4 minutes at 0.5 MB/s. Harmless and
one-time: the next update is small again. Not a defect to fix; tell the owner if he asks.

## Old version in the table (0.19.0)
- `openVersion` opens a second index. A test workspace whose `openIndex` ignores its argument (`() => …index.sqlite`)
  would open the **live** index file again and wipe it: key test indexes by root (`cacheFileName(r)`) or pass
  `openIndexAt`. With `openIndexAt` the file is in `cache/versions/` (emptied at start); without it, in `cache/`.
- Every queued write is refused while a version is shown. The refusal must fit every result type the window reads
  (`state` for GitResult, `reason` for SaveResult) — a bare `{ ok, message }` made `setState(undefined)` (CR19-03).
- `refresh` runs on every window focus: it must return the shown version's info, or the version bar disappears while
  reads still come from the old commit (QA19-03).

## Formatting item text in every table row (0.19.0)
`marked` throws "Maximum call stack size exceeded" on a 2,000-level quote and takes seconds on some long texts
(100,000 `_`). Since the main column formats every visible row, one such item would break or freeze the table:
`renderItemText` catches and falls back to plain text, and the table formats at most 3,000 characters (`textUpTo`).

## Measured row heights and the Show text switch (0.19.1)
`@tanstack/react-virtual` keeps measured sizes by item key (the row index by default) across option changes. Heights
measured with the text shown stayed after Show text off, so one-line rows sat in tall slots once levels opened (the
owner, 0.19.0 test 2). Each mode now has its own keys (`getItemKey`) and a switch calls `virtualizer.measure()`. A
4-item e2e did **not** show it: reproduce virtual-list bugs with a large generated project (`rows-0.19`: 1,500 items).

## A rare test failure under full-suite load (open, 0.19.x)
`tests/qa-0.17.0-types.test.ts` → "incomplete combined with document, type, …" failed in 2 of about 11 full `npm run check`
runs (never alone, fails in ~85 ms, so not a timeout). Since 0.19.1 every check prints the query and the index content;
when it fails again (here or in CI), read that message before changing code. If CI fails on it, re-run the job once.
