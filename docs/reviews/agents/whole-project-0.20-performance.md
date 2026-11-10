# Performance tester — whole project 0.20 (commit 478cb51)

Scope: the items still marked "Later" in the earlier performance reports (PERF19-02, PERF19-04, PERF-02/03 of 0.18.0, P3/P5 of 0.20.0) re-measured, plus one table of the main user actions at 10,005 and 50,004 generated scenario items (`gen:scenario`, one Git commit each, plus two small commits made during the run). The data layer is the real `createWorkspace`, called in-process. This is the same code the window calls, without the IPC bridge (add about 50 to 300 ms for large results). The machine is a 2-core Linux container with an SSD, so Windows with a virus scanner will be slower. One repository existed at a time, and all of them are deleted. `npm run test:perf:all` passed (10k and 50k limits, 47 s). I did **not** run `measure:ui` (the tree-table timings need the window, which is not available here). "Expand all" below is the data part only. No project file was edited. My scripts are in the scratchpad folder, not in `tools/`: `all.mjs` (the main run), `exp.mjs` (exports), `cmp3.mjs` (compare of two commits).

## Main user actions (median of 3 to 5 runs unless noted)

| Action | 10,005 items | 50,004 items | Target / note |
| --- | --- | --- | --- |
| Open first time (index build) | 4.5 s | 22.5 s | first index < 60 s / < 240 s: OK |
| Open, cached (nothing changed) | 0.19 s | 1.26 s | OK |
| Refresh on window focus, nothing changed | 0.21 s | 1.15 s | grows 5.5 times for 5 times the items: linear |
| Top-level page (200 rows) | 1 ms | under 1 ms | OK |
| Tree "expand all" (all rows, brief, data only) | 0.37 s, 5.3 MB | 3.6 s, 26.9 MB | over 300 ms at 50k, see PW-05 |
| Same, with text up to 3,001 characters per row (10,000 rows) | 0.29 s, 5.7 MB | 0.26 s, 5.3 MB | the scenario texts are short, see PW-06 |
| Search, one word / two words | 4 ms / 4 ms | 10 ms / 9 ms | OK |
| Filter: type / field / no links | 3 / 8 / 4 ms | 9 / 31 / 15 ms | OK |
| Filter: suspect links | 42 ms | 206 ms | OK |
| Filter: coverage gaps (first 100 of 5,547 / 27,815) | 101 ms | 806 ms | 10k limit 150: OK; 50k limit 300: **over** (PW-03) |
| Gaps count (`limit 0`, runs on every data change) | 49 ms | 577 ms | **over** at 50k (PW-03) |
| Filter: incomplete | 0 ms | 0 ms | no incomplete items in this data, so the worst case was **not** measured |
| Sort by title, offset 5000 | 65 ms | 312 ms | 50k limit 300: borderline |
| Sort by outline number (all rows sorted in JS) | 283 ms | 3.96 s (max 5.25 s) | **over** at 50k (PW-04) |
| Open one item (`getItem`, 20 calls) | 23 ms | 35 ms | OK |
| Save one item (median of 20) | 64 ms (max 388) | 592 ms (max 798) | 10 times slower for 5 times the items (PW-02) |
| Git status (20 edits / 500 uncommitted) | 31 / 48 ms | 226 / 275 ms | OK |
| Compare options (the pick list) | 43 ms | 273 ms | OK |
| Commit, 20 changed files | 0.37 s | 1.94 s | OK |
| Commit, 500 changed files | 0.74 s | 1.81 s | OK |
| Refresh after 500 files changed outside | 0.63 s | 2.12 s | OK |
| Compare HEAD with working folder, 20 edits | 0.10 s | 0.94 s | OK |
| Compare HEAD with working folder, 500 edits | 3.2 s | 20.4 s | **bad** (PW-01) |
| Compare two commits, 1 changed item | 2.4 s (event loop blocked 2.0 s) | 10.5 s (blocked 9.5 s) | **bad** (PW-01) |
| Compare two commits, about 520 changed | 6.1 s | 23.6 s | **bad** (PW-01) |
| Coverage report, all documents | 157 ms (372 KB) | 587 ms (428 KB) | 50k limit 300: **over** (PW-03) |
| Matrix, system-requirement by test-case | 122 ms (1,517 rows) | 357 ms (2,000 of 8,230 rows) | OK |
| Impact, top heading with the most nodes (40 tops tried, 40 calls total) | 3.0 s for 40 calls, max 1,433 nodes | 3.9 s for 40 calls, hit the 5,000 cap | about 75 to 100 ms per call, OK |
| Open an old version, first time | 3.6 s (event loop blocked 3.4 s) | 14.3 s (blocked 13.0 s) | **freezes the window** (PW-01 family, see below) |
| Open the same old version again | 0.38 s | 1.36 s | fixed since 0.19 (temporary index reused) |
| Close old version / first query back in the real index | 60 ms / 46 ms | 231 ms / 290 ms | OK (first query at 50k about 290 ms: the cold-first-query effect is down from 393 ms) |
| Export all items, CSV | 0.30 s (2.7 MB) | 3.3 s (14.1 MB) | OK |
| Export all items, Excel | 1.7 s (0.7 MB) | 8.7 s (3.2 MB, memory 1.0 GB) | OK |
| Export all items, ReqIF | 4.0 s (28.5 MB) | 19.4 s (146 MB, memory 1.3 GB) | acceptable; memory is high |
| Export matrix, Excel | 0.38 s | 1.68 s (8,230 rows) | fixed since 0.20.0 (was out of memory) |
| Export compare, Excel (about 515 changes) | 5.1 s | 22.2 s | same cause as the compare (PW-01) |
| Memory (whole process) at the end of the run | 478 MB | 723 MB | OK |

## Findings

| ID | file:line | Severity | What is wrong (F = checked, I = likely) | Suggested fix |
| --- | --- | --- | --- | --- |
| PW-01 | `src/modules/workspace/compare.ts:232-235,273-292` | High | F: Comparing two commits always reads and parses the **whole** tree of the newer commit (`numbersFromTree`: `treeBlobs`, `readBlobs`, then `parseItemFile` for every file in one synchronous loop) just to get outline numbers, however few items changed. One changed item takes 2.4 s at 10k and 10.5 s at 50k, and the main process answers nothing for 2.0 s / 9.5 s (event-loop lag measured with a 20 ms timer). The profile (6 runs at 10k) shows `numbersFromTree` at 25.0 s and `parseItemFile` at 27.4 s of about 29 s. Git itself is fast: `diffNameStatus` 33 ms and `readBlobs` for 1,024 blobs 85 ms. The older commit is read the same way when any change is structural (the tree is read a second time; I: this is why the 50-change run costs 2.3 s more than the 1-change run at 10k). Compare against the working folder with 500 edits takes 3.2 s / 20.4 s although the newer side comes from the index. I: those 500 edits cost about 6 ms per item (parse, diff, number lookup), about 15 times the 0.4 ms an index sync needs per item. `exportCompare` repeats the whole cost (5.1 s / 22.2 s). | Get the numbers without parsing every file: read only `id`, `parent` and `order` from the first YAML lines (a small line scanner, no YAML library), or keep the version index of 0.19 (it already has the structure) and ask it for the numbers. Yield to the event loop every 500 files like `YIELD_EVERY` does elsewhere. Profile the per-change cost for the working-folder case separately. |
| PW-02 | `src/modules/workspace/itemOps.ts` (save), `sqliteIndex.ts` | Medium | F: Saving one item takes 592 ms median at 50k (max 798 ms) against 64 ms at 10k. That is 9 times for 5 times the items, so it grows worse than linearly. The window shows the save as finished only after this call. The cause is not profiled (I: the incremental index update plus the `git status` of the file; the earlier 0.17.0 report measured the same pattern). | Profile one save at 50k. Check that `git status` is run for one path only and that the index update does not recount all items. Target under 300 ms. |
| PW-03 | `sqliteIndex.ts:439` and `:536-544`, `WorkspaceScreen.tsx:319` | Medium | F: Still open (P3/P5 of 0.20.0). The gap SQL costs 577 ms for the count (`limit 0`) at 50k, 49 ms at 10k (12 times for 5 times the items), and 806 ms for a page of 100. The window runs the count on every data change. Coverage for all documents takes 587 ms at 50k (over the 300 ms limit), now with a small payload (428 KB, the 1,000-per-rule cap works). | Cache the gap count per data version, or add an index on link type and target. Run the count only when the coverage rules exist and the status bar shows it. Test at 50k with a timer. |
| PW-04 | `workspace.ts:521-525` | Medium | F: Sort by outline number reads **all** matching rows and sorts them in JavaScript: 283 ms at 10k, 3.96 s (max 5.25 s) at 50k, synchronously on the main process. It is also the likely cost behind "expand all" with outline numbers. | Store the outline number order key in the index (calculated at sync), or compute it once per data version and cache the sorted list. |
| PW-05 | `workspace/context.ts` (`queryAll`), table "expand all" | Medium | F: Expanding all at 50k fetches 50,004 rows, which is 26.9 MB of JSON and 3.6 s of data time on the main process. This is five pages of 10,000, with the window waiting on each. (PERF19-04, see below.) I: the window then holds all rows in memory (renderer heap not measured here). | Fetch only the rows on screen plus a margin, or fetch the children of the expanded nodes only. |
| PW-06 | `ItemTable` text request (`textUpTo: 3001`) | Low | I: PERF19-04 stays as it was: the table still asks up to 3,001 characters per row, so the payload is rows times text size. With this generated data a 10,000-row page is 5.3 to 5.7 MB (short texts), so it does not reproduce the 24 MB of the 0.19 report (that used realistic 2,000-character texts). The 50k "expand all" with 2,000-character texts is I: about 120 MB. Not re-measured with long texts. | Fetch the text only for visible rows (as PW-05). |
| PW-07 | `versionView.ts:44-89` | Medium | F: PERF19-02 is only half fixed. Opening the **same** old version again is now fast (0.38 s / 1.36 s, the temporary index is reused: fixed). The **first** open still costs 3.6 s / 14.3 s (0.19 report: 2.3 to 2.9 s / 13.5 to 18.7 s), with the event loop blocked 3.4 s / 13.0 s. The window cannot scroll or answer for those seconds, and at 50k there is no progress shown. | Yield every 500 items in the version's sync (`setImmediate`), as already proposed; or parse only the index columns (same fix as PW-01). |
| PW-08 | export (`reqif.ts`, `xlsx.ts`) | Low | F: Exporting all 50k items to ReqIF builds one 146 MB string (process memory 1.3 GB at the end); Excel of all items peaks at 1.0 GB. Both finished, but the main process has the default heap limit, and a project with long texts or many more items could run out. The earlier matrix crash (P1 of 0.20.0) is gone: 8,230 rows take 1.7 s. | Stream the ReqIF output to the file, or warn above about 50,000 items. |
| PW-09 | `tests/perf.test.ts` | Low | F: The CI perf test still covers only queries and the first index. None of PW-01, PW-02, PW-04 or PW-07 would be seen by it (open version, compare, save at 50k, sort by number). Same gap as PERF-07 and PERF19-07. | Add `tests/perf-git.test.ts` (10k, `PERF=1`): compare of two commits with 1 change under 1 s and event-loop block under 500 ms; first open of an old version under 5 s; sort by number under 150 ms. |

## Earlier "Later" items

| ID | Result now |
| --- | --- |
| PERF19-02 (old version at 50k) | Re-measured: first open 14.3 s, loop blocked 13.0 s, no better than 0.19; second open of the same commit 1.4 s (better). See PW-07. |
| PERF19-04 (full text size) | Unchanged in the code (`textUpTo` 3,001). My data gives 5.3 to 5.7 MB per 10,000 rows. Needs long-text data to compare with the 24 MB figure. See PW-06. |
| PERF-02 of 0.18.0 (snapshot cache and parsing in parts) | The `getSnapshot` call no longer exists (replaced by `openVersion` in 0.19). Its replacement is measured above (PW-07). |
| PERF-03 of 0.18.0 (incomplete IDs, most items incomplete) | Not re-measured. The generated data has no incomplete items, so the filter returned 0 matches in 0 ms. The worst case needs a repository where a required field is empty on every item. |
| P3 / P5 of 0.20.0 (gap SQL) | Still slow at 50k: count 577 ms (was 340), page of 100 806 ms, coverage 587 ms (was 380). The machine differs, so compare the ratio to 10k (about 12 times for 5 times the items) rather than the absolute time. See PW-03. |

## Questions for the owner

None are product choices. One point to decide: is it acceptable for the first release that comparing two commits takes about 10 s at 50,000 items and freezes the window? At 10,000 items it is 2.4 s.

## Checked, nothing found

- First index, cached open, refresh on focus: linear, within the limits at 10k and 50k.
- Search and the type, field, suspect-link and no-link filters: all under 210 ms at 50k.
- `getItem`, git status, compare options, commit of 20 and 500 files: fast, no bad growth.
- Closing an old version and the first query afterwards: 231 ms and 290 ms at 50k.
- Matrix view and matrix export: fast at both sizes; the cap and the list sheet work.
- CSV and Excel export of all items: finish at 50k (Excel at 8.7 s).
- Memory: 478 MB (10k) and 723 MB (50k) at the end of the run; no growth seen over repeated old-version opens (720 to 727 MB, then 712 MB).
- `npm run test:perf:all`: passed.
