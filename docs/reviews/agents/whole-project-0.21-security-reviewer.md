# Security review — whole project 0.21 (frozen commit a8244a2)

Scope: second whole-project security check before the first release, from the pack
`docs/reviews/agents/whole-project-0.21-pack.md` (areas: main process and window calls, data and Git core,
import/export, build/CI/installer/updater). (A) Every finding of the earlier security reports in this folder
(`whole-project-security-reviewer.md`, `0.17.0`…`0.20.0`, `whole-project-0.20-security-reviewer.md`) that was not
marked Fixed, re-checked against this commit. (B) New findings, with the 0.20.2 changes looked at first (writeItem
`path` option, `GIT_CONFIG_ARGS`, push through `for-each-ref`, `closeForInstall`, `maskHome`, Excel row limit,
`npm ci --ignore-scripts`, release only from main, Electron 45.2.3). Evidence: the line, a command, or a small script
run against the real code with `npx tsx` (scratch under /tmp, removed). "F" = checked, "I" = inferred.

## Open items from earlier reports

| Earlier ID | Now | Evidence |
| --- | --- | --- |
| SEC-07 device paths with mixed slashes | **Still open** → SEC-WP3-05 | F: script against `importPath` — `\\./pipe/x.csv`, `//./pipe/x.csv`, `//?/C:/x.csv`, `\\?/C:/x.csv` accepted; only `\\.\pipe\x.csv` refused (validate.ts:34). |
| SEC-08 `showInFolder` any path | **Still open** → SEC-WP3-06 | F: ipc.ts:221-224 passes `v.optStr` straight to `shell.showItemInFolder`. |
| SEC-09 no import size limit | **Still open** → SEC-WP3-07 | F: importFiles.ts:31 reads the whole file, :37-40 unzips the `.reqif` entry without a size check. |
| SEC-10 `ELECTRON_RENDERER_URL` in the installed app | **Still open** → SEC-WP3-08 | F: index.ts:108 has no `!app.isPackaged`. |
| SEC-11 sender not checked | **Still open** → SEC-WP3-09 | F: ipc.ts:386-388 registers handlers with no `senderFrame` check. |
| SEC-12 web permissions | **Still open** → SEC-WP3-10 | F: search — no `setPermissionRequestHandler` / `setPermissionCheckHandler` in `src/`. |
| SEC-13 rollback installer not checked | **Still open** → SEC-WP3-11 | F: githubUpdater.ts:159-170 downloads and runs `/S` with no SHA-512 check; versions.ts:33 only needs `https://github.com/`. |
| SEC-14 bare `cmd`/`taskkill` in the installer | **Still open** → SEC-WP3-12 | F: build/installer.nsh:16, :25. |
| SEC-15 gitleaks without checksum | **Still open** → SEC-WP3-13 | F: build.yml:38-42, release.yml:40-44 — download and run, no pinned SHA-256. |
| SEC-16 no licence check | **Still open (part)** → SEC-WP3-14 | F: no "licen" in tools/check-deps.mjs; today's licences are fine (below). |
| SEC-17 no Electron fuses | **Still open** → SEC-WP3-15 | F: no `electronFuses` in electron-builder.yml or package.json. |
| SEC-18 `core.fsmonitor` from a received `.git` | **Still open** → SEC-WP3-16 | F: `GIT_CONFIG_ARGS` (systemGit.ts:60) has only `core.quotePath` and `core.longpaths`; no `core.fsmonitor=false`. |
| SEC-18-09 / SEC-19-04 blobs read before the size check | **Still open** → SEC-WP3-17 | F: versionView.ts:48 reads all blobs, size checked at :78/:84; compare.ts:135 and :307 have no size check. |
| SEC-WP2-01 Excel row 50,000,000 | **Fixed** (rows) — but see the new SEC-WP3-01 (columns) | F: xlsx.ts:120-126 no `includeEmpty` on rows, rows over 1,048,576 refused; the same file pattern in the column direction still crashes. |
| SEC-WP2-02 install scripts near the release token | **Fixed** (install scripts); a run-time remainder → SEC-WP3-03 | F: `npm ci --ignore-scripts` in build.yml and release.yml. |
| SEC-WP2-03 `gh api repos/*` permission | **Decided** (the owner, O-2, 10 Nov 2026: keep, report every GitHub change; CLAUDE.md) | .claude/settings.json:27 unchanged. |
| SEC-WP2-04 unlimited required-field types | **Still open** → SEC-WP3-18 | F: parse.ts:73 no limit on item types or `required`; sqliteIndex.ts:426 one SQL `OR` per type. |
| SEC-WP2-05 CSV export does not protect `-` | **Still open** → SEC-WP3-19 | F: csv.ts:2 `FORMULA_START = /^[=+@\t\r]/`. |
| SEC-WP2-06 IDs `NUL`, `CON`, `COM1` | **Still open** → SEC-WP3-20 | F: script — `v.id` accepts `NUL`, `CON`, `COM1`, `nul.txt`; `isSafeFileId` (fileStore.ts:37-44) has no reserved-name check. |
| SEC-WP2-07 ReqIF relations copied per relation | **Still open** → SEC-WP3-21 | F: reqif.ts:193 `m.set(source, [...(m.get(source) ?? []), target])`. |
| SEC-WP2-08 Compare reads working files without checks | **Still open** → SEC-WP3-22 | F: compare.ts:343-355 `readFile` with no `lstat` and no size limit. |
| SEC-WP2-09 Electron 45.0.0 | **Fixed** (45.2.3 installed, `node_modules/electron` 45.2.3); a newer patch is out → SEC-WP3-23 | F: `npm run check:deps`. |
| SEC-WP2-10 user name in problem reports | **Fixed** | F: report.ts:15-25 `maskHome` (home folder and any `X:\Users\<name>`), used for diagnostics and log lines; ipc.ts passes `app.getPath('home')`. |
| SEC-WP2-11 release from any branch | **Fixed** | F: release.yml:20 `if: github.ref == 'refs/heads/main'`. |
| SEC-WP2-12 editor preview formats the whole text | **Still open** → SEC-WP3-24 | F: ItemEditor.tsx:99 `renderItemText(previewText)` without `maxChars`. |

The other earlier findings (whole-project SEC-01…06, SEC-17-01…05, SEC-18-01…08, SEC-19-01…03/05…07, SEC20-01…07)
were already marked Fixed or decided and are not repeated.

## Findings

| ID | file:line | severity | what is wrong (F = checked, I = likely) | suggested fix |
| --- | --- | --- | --- | --- |
| SEC-WP3-01 | src/modules/import-export/xlsx.ts:127-131 (`sheetRows`, `row.eachCell({ includeEmpty: true })`); importFiles.ts:46 | Medium | **F** The W-06 fix closed the row direction only. A **14 KB** Excel file with 1,500 rows, each holding one cell in the last column (`XFD`, column 16,384), makes the real `readXlsx` run out of memory even with a 4 GB heap ("JavaScript heap out of memory", `npx tsx` script on this commit). ExcelJS loads the file in 130 ms; the cost is `includeEmpty` making one cell per empty column (300 such rows already used 1.27 GB). Import (and "Update the Excel file", which reads the source first) runs in the main process, so the app closes. | Do not use `includeEmpty`: walk `row.eachCell((cell, c) => …)` (existing cells only) and fill the gaps; also refuse a sheet whose rows × used columns exceed a cap (e.g. 20 million cells) with the `tooManyRows`-style message. Add the 1,500-row XFD file to the W-06 test. |
| SEC-WP3-02 | src/modules/repository-store/fileStore.ts:120-123 (`readAt`, new in 0.20.2), used by `readItem`, `readItemAt` and the conflict check of `writeItem` (:368-370) | Low | **F** (code) `readAt` reads with `readFile` — no `lstat`, no 5 MB limit — while the listing (`readItemFile`, :287-298) refuses links and files over 5 MB. **I** A file the listing refused (a committed link, a 2 GB `.md`) is still read whole or followed when an ID reaches `readItem` through the default path (`pathOf` falls back to `<document>/<id>.md` when the index does not know the ID). Same gap existed before 0.20.2; the refactor was the moment to close it. | Reuse the listing's checks in `readAt`: `lstat`, regular file only, size ≤ `MAX_ITEM_FILE_BYTES`, else the same "not read" error. |
| SEC-WP3-03 | .github/workflows/release.yml:101-117, build.yml:89-104; e2e/acceptance.mjs:74 | Low | **I** Remainder of SEC-WP2-02: install scripts no longer run, but the acceptance step still has the write token in its environment (`GH_TOKEN`), and `electron.launch` (no `env` option) passes it on to the installed app, the downloaded previous installer and every Git process they start. So bundled library code (exceljs, jszip, marked …) and `playwright-core` run with the release token readable in `process.env`. The step needs the token only inside the push URL. | Launch the app with `env: { ...process.env, GH_TOKEN: undefined }` (and the installers likewise); keep the token only in `--push-url`. Better: a credential helper for the push instead of the token in the URL. |
| SEC-WP3-04 | src/modules/git-adapter/systemGit.ts:434-445 (`push`) | Low | **I** The remote name for the new explicit push comes from `branch.<b>.pushRemote` / `remote.pushDefault` / `branch.<b>.remote` in `.git/config` and is put on the command line as a plain argument. A value starting with `-` (e.g. `--receive-pack=…`) would be read by Git as an option. Only someone who can edit `.git/config` can set it, and such a person can already set `core.fsmonitor` (SEC-WP3-16), so this is defence in depth. | Refuse a remote name that starts with `-` (or check it against `git remote` output) before pushing; same for `setUpstream.remote`. |
| SEC-WP3-05 | src/main/validate.ts:34 | Low | **F** (SEC-07, still open) Device paths with mixed slashes pass `importPath` (script output above). Reading a pipe can hang the core. | Turn `/` into `\` first, then refuse `^\\\\[.?]\\`; add the four cases to the tests. |
| SEC-WP3-06 | src/main/ipc.ts:221-224 | Low | **F** (SEC-08, still open) `showInFolder` passes any path from the window to `shell.showItemInFolder` (a UNC path makes Explorer contact that server, I). | Accept only paths the core handed out (last export, report, backup). |
| SEC-WP3-07 | src/main/importFiles.ts:31, :37-40 | Low | **F** (SEC-09, still open) No size limit for import files nor for the unpacked `.reqif` entry of a `.reqifz` (zip bomb). | Refuse files above e.g. 200 MB; check the entry's unpacked size (`_data.uncompressedSize`) and entry count before `async('string')`. |
| SEC-WP3-08 | src/main/index.ts:108-109 | Low | **F** (SEC-10, still open) The installed app loads `ELECTRON_RENDERER_URL` from the environment, with the full window API. | `if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL'])`. |
| SEC-WP3-09 | src/main/ipc.ts:386-388 | Low | **F** (SEC-11, still open) Handlers do not check the calling frame. | One check in the registration loop: refuse calls whose `e.senderFrame?.url` is not the app's own page. |
| SEC-WP3-10 | src/main/index.ts:55-66 | Low | **F** (SEC-12, still open) No permission handlers; Electron grants web permissions by default. | `session.defaultSession.setPermissionRequestHandler((_w, _p, cb) => cb(false))` and `setPermissionCheckHandler(() => false)`. |
| SEC-WP3-11 | src/modules/updater/githubUpdater.ts:159-170; versions.ts:33 | Low | **F** (SEC-13, still open) "Go back to version X" runs the downloaded installer silently without checking it against that release's `latest.yml` SHA-512; any `https://github.com/` address is accepted. | Fetch that release's `latest.yml`, compare SHA-512 before `spawn`; require the configured owner/repo in the address. |
| SEC-WP3-12 | build/installer.nsh:16, :25 | Low | **F** (SEC-14, still open) `cmd`, `tasklist`, `find`, `taskkill` by bare name (binary planting from the Downloads folder). | `"$SYSDIR\cmd.exe"`, `"$SYSDIR\taskkill.exe"`, `%SystemRoot%\System32\…` inside cmd. |
| SEC-WP3-13 | .github/workflows/build.yml:38-42; release.yml:40-44 | Low | **F** (SEC-15, still open) gitleaks is run without a pinned checksum. | Pin its SHA-256 in the workflow and compare before unzipping. |
| SEC-WP3-14 | tools/check-deps.mjs; package.json | Low | **F** (SEC-16, still open part) `check:deps` does not check licences; shipped libraries are listed under `devDependencies`, so `npm audit --omit=dev` (0 today) does not see them. | Add a licence allow-list to `check:deps` (warn on a missing or new licence). |
| SEC-WP3-15 | electron-builder.yml | Low | **F** (SEC-17, still open) No Electron fuses: the installed exe still works as a general Node runtime (`ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS`, `--inspect`). | `electronFuses`: `runAsNode: false`, `enableNodeOptionsEnvironmentVariable: false`, `enableNodeCliInspectArguments: false`, `onlyLoadAppFromAsar: true`. |
| SEC-WP3-16 | src/modules/git-adapter/systemGit.ts:60 (`GIT_CONFIG_ARGS`) | Low | **F** (SEC-18, still open) The new shared Git settings list is the natural place, but it still has no `core.fsmonitor=false`: a folder received with its own `.git/config` (e.g. a zip) runs the program named there on every `git status`. | Add `'-c', 'core.fsmonitor=false'` to `GIT_CONFIG_ARGS` (one line, every call gets it). |
| SEC-WP3-17 | src/modules/workspace/versionView.ts:48, :78; compare.ts:135, :307 | Low | **F** (SEC-18-09/SEC-19-04, still open) Blobs are read fully before the 5 MB check; Compare has no size check. | `git cat-file --batch-check` for sizes first; skip blobs over 5 MB in both places. |
| SEC-WP3-18 | src/modules/schema/parse.ts:73; sqliteIndex.ts:423-426 | Low | **F** (SEC-WP2-04, still open) No limit on item types / required fields in a pulled schema; the "incomplete" filter makes one SQL `OR` per type (1,000 types: "Expression tree is too large"). | Cap item types (e.g. 200) and `required` entries (e.g. 50) like `MAX_RULES`, listing the rest under Problems. |
| SEC-WP3-19 | src/modules/import-export/csv.ts:2 | Low | **F** (SEC-WP2-05, still open) CSV export does not protect cells starting with `-`; the Excel export does. | Add `-` to `FORMULA_START` (the owner chose protection for every export). |
| SEC-WP3-20 | src/main/validate.ts:25-28; src/modules/repository-store/fileStore.ts:37-44 | Low | **F** (SEC-WP2-06, still open) `NUL`, `CON`, `COM1`, `nul.txt` accepted as IDs (script). **I** Older Windows versions treat these as devices even with an extension. | Reuse `isDocumentName`'s reserved-name pattern in `isSafeFileId` and `v.id`. |
| SEC-WP3-21 | src/modules/import-export/reqif.ts:193 | Low | **F** (SEC-WP2-07, still open) Relations collected by copying the list for each relation (square growth; ~18 s for 160,000 relations from one object in 0.20's test). | `const l = m.get(source); if (l) l.push(target); else m.set(source, [target])`. |
| SEC-WP3-22 | src/modules/workspace/compare.ts:343-355 | Low | **F** (SEC-WP2-08, still open) Compare's working-folder side reads files with no `lstat` and no size limit. | Use the store's checked reader (see SEC-WP3-02). |
| SEC-WP3-23 | package.json:38 | Low | **F** `npm run check:deps`: Electron 45.3.1 is out (45.2.3 installed). **I** Electron patch releases usually carry Chromium/V8 security fixes. | Update to the newest 45.x before the first public release; run e2e and the acceptance run. |
| SEC-WP3-24 | src/renderer/src/workspace/ItemEditor.tsx:99 | Low | **F** (SEC-WP2-12, still open) The editor preview formats the whole text; one odd item (100,001 `_` took 82 s in 0.19's test) freezes the window when selected. | Format the first 3,000 characters like the table, with a "show all" button. |

Count: High 0, Medium 1, Low 23.

## Questions for the owner

1. **Signed installers** (asked in the 0.20 report, no answer recorded): installers and updates are still unsigned, so
   an update is trusted only because it comes from this repository's releases. (a) Keep unsigned for the internal pilot
   and sign before any sale or public release (recommended; free signing exists for open-source projects); (b) look
   for signing now.

## Checked, nothing found

- Secrets: `git grep` on a8244a2 and `git log -p` for GitHub tokens, AWS keys, private keys, Slack tokens — none; gitleaks runs in both workflows.
- Electron window: `contextIsolation`, `sandbox`, no `nodeIntegration`; `will-navigate` and `setWindowOpenHandler` only hand `https://` to the browser; CSP `default-src 'self'; script-src 'self'`; markdown renders HTML and images as escaped text, links only `https:`/`mailto:`.
- Preload: exposes only `invoke` on the `Channels` list plus three fixed calls; no raw `ipcRenderer`.
- Window calls: every handler in ipc.ts uses a `v.*` check or takes no input; branch names checked with `git check-ref-format --branch` and against existing refs; commit IDs 40 hex; compare refs resolved to a commit before use.
- 0.20.2 writeItem `path` option: only from the index (itemOps.ts:171-174), checked by `isSafeItemPath` (no absolute, `..`, empty part, `:` or NUL); atomic rename does not follow links.
- `GIT_CONFIG_ARGS` used by both `git()` and the `cat-file` spawn; all processes are started with argument arrays, never a shell string; repository passed with `-C`, no `cwd` into the project.
- Push via `for-each-ref`: names `HEAD:refs/heads/<branch>` without `+`, refuses an upstream of another name (no force push possible from user config).
- `closeForInstall`: only closes the calling window; quits after 20 s if no installer takes over; the "keep editing" path cancels the install.
- `maskHome` / `maskSecrets`: home folder (both slash styles, any case) and other `X:\Users\<name>` replaced; sign-in parts of URLs masked in every log line; Publish accepts only `https://`, `ssh://`, `file://`, `git@` addresses (Git refuses hosts starting with `-`; `ext::` is off by default).
- "Update the Excel file" target path comes from the app's own data folder (`userDir/imports/…json`), not from the repository.
- YAML: `yaml` 2.x with its default alias limit; `readStructure` (new fast header reader) is linear and hands anything unusual to the full parser.
- Workflows: actions pinned by commit; `persist-credentials: false`; `contents: read` by default; release only from main; `npm ci --ignore-scripts`; the npm cache cannot inject code (`npm ci` checks lockfile hashes); fork pull requests get a read-only token.
- Libraries: `npm audit` 15 moderate, all build/lint tools (minimatch via eslint, electron-builder); `npm audit --omit=dev` 0. Licences in the lockfile: MIT, ISC, BSD, Apache-2.0, 0BSD, BlueOak, Python-2.0, CC-BY-4.0, MPL-2.0 (lightningcss, build only), jszip (MIT chosen), WTFPL (build only) — all allow commercial use.
- Agent permissions: `.claude/settings.json` denies force-push, `reset --hard`, `clean`, `gh repo edit/delete`, `gh release delete`; the `gh api repos/*` allowance is the owner's decision.
