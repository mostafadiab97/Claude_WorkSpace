# Performance tester — whole project 0.21 (commit a8244a2)

Scope: (A) every item still open in the earlier performance reports (0.17.0 to 0.20.0 and whole-project 0.20, PW-01 to PW-09) re-measured or confirmed, and (B) one table of the main user actions at 10,005 and 50,004 generated scenario items (`gen:scenario`, one base Git commit, then three more commits made during the run). The data layer is the real `createWorkspace`, called in-process, so it is the code the window calls without the IPC bridge (add about 50 to 300 ms for large results). Machine: 2-core Linux container with an SSD, so Windows with a virus scanner will be slower. Push goes to a local bare repository (no network time). `npm run test:perf` (10k) passed (4 passed, 2 skipped; the 50k cases need `PERF=all`, not run). I did not run `measure:ui` or the 50k `PERF_WS50` test (no window; 50k build is slow). "Event loop blocked" is the longest gap seen by a 20 ms timer: while it lasts the main process answers nothing. One repository existed at a time; all repositories and temporary folders are deleted. No project file was edited. My scripts are in the scratchpad folder, not in `tools/`.

## (B) Main user actions (median of 3 to 5 runs unless noted)

| Action | 10,005 items | 50,004 items | Target / note |
| --- | --- | --- | --- |
| Open first time (index build) | 4.5 s | 26.4 s | OK (first index under 60 s / 240 s) |
| Open, cached | 0.25 s | 1.05 s | OK |
| Refresh on window focus, nothing changed | 0.18 s | 0.90 s | linear, OK |
| Top-level page (200 rows) | 0 ms | 0 ms | OK |
| Expand all (all rows, brief, data only) | 0.33 s, 5.3 MB | 3.07 s, 26.9 MB | **over 3 s at 50k** (PW-05) |
| Page of 10,000 rows with text up to 3,001 characters | 0.24 s, 5.7 MB | 0.28 s, 5.3 MB | OK with this data (short texts, PW-06) |
| Search, one word / two words | 3 / 3 ms | 10 / 8 ms | OK |
| Filter type / field / no links | 3 / 10 / 5 ms | 9 / 30 / 22 ms | OK |
| Filter suspect links | 42 ms | 238 ms | OK |
| Filter incomplete | 0 ms | 0 ms | worst case not measured (data has no incomplete items) |
| Filter coverage gaps (page of 100) | 101 ms | 622 ms | OK at 10k; slow-ish at 50k (PW-03) |
| Gaps count (`limit 0`, runs on every data change) | 45 ms | 259 ms | better than 0.20 (577 ms) |
| Sort by title, offset 5000 | 62 ms | 143 ms | OK |
| Sort by outline number | 238 ms | **1.73 s** (max 1.96 s) | **over 1 s at 50k** (PW-04 only half fixed, PW21-01) |
| Open one item (20 calls) | 18 ms | 41 ms | OK |
| Save one item (median of 20) | 5 ms (max 28) | 5 ms (max 30) | fixed (0.20: 64 ms / 592 ms) |
| Git status (20 edits / 500 uncommitted) | 45 / 71 ms | 102 / 112 ms | OK |
| Compare options | 73 ms | 97 ms | OK |
| Commit, 1 / 20 / 500 changed files | 0.48 / 0.46 / 0.88 s | 0.89 / 0.87 / 0.90 s | OK |
| Push, first (all objects) / one new commit | 0.62 / 0.36 s | 1.37 / 0.63 s | OK (local remote; a real network adds transfer time) |
| Refresh after 500 files changed outside | 0.95 s | 1.73 s | OK |
| Compare two commits, 1 changed item | 0.11 s (max 0.58 cold), blocked 60 ms | 0.08 s (max 1.47 cold), blocked 108 ms | fixed (0.20: 2.4 s / 10.5 s) |
| Compare two commits, about 520 changed | 0.52 s (max 1.2 s cold), blocked 223 ms | 0.37 s (max 3.1 s cold), blocked 237 ms | fixed (0.20: 6.1 s / 23.6 s); the first cold call at 50k is 3.1 s |
| Compare HEAD with working folder, 20 / 500 edits | 0.20 / 0.43 s | 0.31 / 0.60 s | fixed (0.20: 3.2 s / 20.4 s at 500) |
| Coverage report, all documents | 150 ms (370 KB) | 602 ms (428 KB) | 50k over the old 300 ms limit (PW-03) |
| Matrix, system-requirement by test-case | 117 ms | 352 ms (2,000 of 8,230 rows) | OK |
| Impact (40 top headings, 40 calls) | 2.75 s total, 1,447 nodes max | 3.5 s total, hit the 5,000 cap | about 70 to 90 ms per call, OK |
| Old version, first open | 2.8 s, **blocked 2.5 s** | 15.4 s (12.9 s in a second run), **blocked 5.9 s** | **over target, still freezes** (PW-07, PW21-02) |
| Old version, same again | 0.30 s | 1.54 s | OK |
| Close old version / first query after | 47 ms / 35 ms | 901 ms / 247 ms | close is 4 times slower than 0.20 (231 ms), one sample, Low |
| Export all items: CSV | 0.38 s (2.7 MB) | 3.2 s (14.1 MB) | OK |
| Export all items: Excel | 2.2 s | 7.9 s | OK |
| Export all items: ReqIF | 4.1 s (28.6 MB) | 20.1 s (146 MB) | linear in time; memory high (PW-08) |
| Export matrix, Excel | 0.58 s | 1.23 s | OK |
| Export compare, Excel (about 515 changes) | 0.52 s | 0.58 s | fixed (0.20: 5.1 s / 22.2 s) |
| Memory (whole process) at end | 464 MB | 954 MB | OK (peak 1.39 GB while opening the old version at 50k) |

## (A) Open items from earlier reports

| ID | Result now |
| --- | --- |
| PW-01 compare | Fixed, verified: 1 changed item 0.08 s at 50k (was 10.5 s); 500 edits against the working folder 0.6 s (was 20.4 s); export compare 0.58 s (was 22 s). Only the first cold call is slower (1.5 to 3.1 s at 50k). |
| PW-02 save | Fixed, verified: 5 ms median at 10k and 50k (was 64 / 592 ms). |
| PW-03 gap count at 50k | Still open but better: count 259 ms (was 577), page of 100 622 ms (was 806), coverage report 602 ms (was 587, unchanged). 10k fine. |
| PW-04 sort by number | Half fixed: 1.73 s at 50k (was 3.96 s), still 7 times the 10k time for 5 times the items. See PW21-01. |
| PW-05 expand all | Unchanged: 3.07 s, 26.9 MB at 50k. Open by plan. |
| PW-06 text size per row | Unchanged in the code; not reproducible with the short generated texts (5.3 to 5.7 MB per 10,000 rows). Needs long-text data for a true number. |
| PW-07 old version | Only partly fixed: the first open still blocks the main process 2.5 s (10k) and 5.9 s (50k). Total 15.4 s at 50k (0.20: 14.3 s). Same-version reopen is fast. See PW21-02. |
| PW-08 big exports in memory | Unchanged: ReqIF at 50k is one 146 MB string, process 954 MB at the end. Open by plan; finished here. |
| PW-09 test coverage | Fixed: `tests/perf-workspace.test.ts` exists and passes at 10k (compare, save, sort by number, old version). Its 50k limits (sort 1,500 ms, old version 25 s) would not catch the problems below; its 10k limits are 500 ms and 8 s. |
| ReqIF relations quadratic | Not visible with this data: ReqIF export time grows 4.9 times for 5 times the items (20.1 s / 4.1 s) with about 1 link per item. A project with many links on few items was not measured. |
| PERF-03 (0.18, incomplete filter worst case) | Still not measured: the generated data has no incomplete items. |

## Findings

| ID | file:line | Severity | What is wrong (F = checked, I = likely) | Suggested fix |
| --- | --- | --- | --- | --- |
| PW21-01 | `src/modules/workspace/workspace.ts:535-547` | Medium | F: Sort by outline number still loads every matching row in full (`queryAll` with all columns, 50,008 rows) and sorts them in JavaScript: 238 ms at 10k, 1.73 s (max 1.96 s) at 50k, on the main process. The ranks are cached per data version, so the cost is the row loading plus the sort. The 0.21 test limit (1,500 ms at 50k) is only just met. | Select only `id` (a brief or id-only query), sort the ids by rank, then fetch only the requested page by id. Or keep the rank as a column in the index. Target under 300 ms at 50k. |
| PW21-02 | `src/modules/workspace/versionView.ts:74-76`, `sqliteIndex.ts:299-325` | High | F: First open of an old version blocks the main process 2.5 s at 10k and 5.9 s at 50k (20 ms timer), although the yield every 200 reads was added in 0.21. A timer at 10 ms during the 50k open shows five blocks of 2.2 to 3.4 s each (at 3.2, 5.7, 8.5, 10.7 and 14.1 s of a 14.2 s open). A CPU profile of the run shows the YAML parser (`parser.js` `next`, 5.9 s self time) and native SQLite calls (6.4 s self time, the `insert` transaction in `doSync`) as the main costs. Git is not the cause: `treeBlobs` 133 ms, `readBlobs` for 50,013 blobs 823 ms (lag 121 ms). I: the yield does not help because `mapLimit` runs 64 reads at once and the single synchronous transaction inserts all 50k rows in one block. The window cannot scroll or answer for those seconds; at 50k there is no progress display. | Insert in chunks: commit every 2,000 items and yield between chunks in `doSync` (also helps the first open of the real repository, 26 s). Parse only the index columns (the fast header reader from 0.21.0 is already in the code for compare) instead of the full YAML parser. Show "reading old version" progress. |
| PW21-03 | `sqliteIndex.ts:439`, `:536-544`, `WorkspaceScreen.tsx:319` | Low | F: Gap page (100 rows) 622 ms and coverage report 602 ms at 50k; gap count 259 ms on every data change. All are linear to slightly worse (6 times for 5 times the items), not a freeze, but they are over the old 300 ms limit. | Cache the count per data version; add an index on `links(type, target)` and test at 50k with a timer. |
| PW21-04 | `workspace/context.ts` (`queryAll`), table "expand all" | Medium | F: Expand all fetches 50,008 rows: 3.07 s data time on the main process and 26.9 MB of JSON at 50k (PW-05, unchanged). Over 3 s at 50k, fine at 10k (0.33 s). | Fetch the children of expanded nodes only, or the rows on screen plus a margin. Not needed before release if 50k is outside the first release's promise. |
| PW21-05 | `sqliteIndex.ts` close of a version (`closeVersion`) | Low | F: Closing the old version took 901 ms at 50k (0.20: 231 ms), one sample. I: deleting a large temporary SQLite file after the first open. | Re-measure; delete the file in the background after the window is back. |
| PW21-06 | `tests/perf-workspace.test.ts` limits | Low | F: The 50k limits (sort 1,500 ms, old version 25 s) are far above the targets and only run by hand. Neither the main-process blocking (PW21-02) nor the cold first compare (1.5 to 3.1 s at 50k) is measured; the compare limit 6 s hides them. | Add an event-loop-lag check to the old-version case (limit, for example, 1 s at 10k) and a cold-first-compare timing. |
| PW21-07 | export (`reqif.ts`, `xlsx.ts`) | Low | F: ReqIF of all 50k items builds one 146 MB string; process 954 MB at the end (PW-08, unchanged). | Stream the output to the file; or warn above 50,000 items. |

## Questions for the owner

None are product choices. One point to decide: is it acceptable for the first release that opening an old version freezes the window for about 6 s at 50,000 items (2.5 s at 10,000)? Everything else the owner is likely to do (save, commit, push, compare, search, filter) is under 1 s at both sizes.

## Checked, nothing found

- Open cached, refresh on focus, first index build: linear, within the limits at 10k and 50k.
- Search and the type, field, no-link and suspect-link filters: all under 240 ms at 50k.
- Save, get item, git status, compare options, commit of 1, 20 and 500 files, push (first and one commit): fast, no bad growth.
- Compare (two commits, commit against working folder, export compare): fixed, under 1 s warm at both sizes.
- Matrix and its export: 0.35 s and 1.2 s at 50k; impact: 70 to 90 ms per call.
- Export CSV and Excel: linear; no memory problem at 50k.
