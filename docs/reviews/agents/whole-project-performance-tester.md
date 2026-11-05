# Whole-project review — performance tester

**Scope.** Commit `752a435`, Linux container (2 CPUs, no virus scanner, so Windows numbers will be slower). I ran
`npm run test:perf:all`, `npm run measure:ui` and three new scripts of mine (`tools/perf-qa-whole.mjs`,
`tools/perf-qa-focus.mjs`, `tools/perf-qa-block.mjs`; they drive the built app through `window.reqochet`) on a
generated 10,005-item scenario repository (`gen:scenario`, 9,994 links, 161 suspect). Nothing else was changed.
Targets come from `docs/TESTING.md` lines 24-28 (sandbox: open incl. first index 5-8 s, expand all 0.4-0.6 s, scroll
65 ms, suspect filter 0.3 s, 10k queries under 15 ms, 50k first index 18-73 s on the owner's PC) and the limits in
`tests/perf.test.ts`. Everything is within target; the findings below are risks and gaps, not regressions.

## Measurements

| What | Size | Time | Target / earlier |
| --- | --- | --- | --- |
| Data layer: write files | 10k / 50k | 2.6 s / 17.2 s | no target |
| Data layer: first index | 1k / 10k / 50k | 0.48 s / 3.05 s / 16.4 s | limit 15 / 60 / 240 s; owner PC 50k 18-73 s |
| Data layer: re-open (nothing changed) | 10k / 50k | 208 ms / 1,161 ms | limit 5 s / 20 s |
| Data layer: slowest query ("sort by title, page 50") | 10k / 50k | 32.5 ms / 63.2 ms | limit 150 / 300 ms; "10k queries < 15 ms" is exceeded only by title sort (32 ms) |
| Data layer: other queries (filter, tag, text, suspect, no links, links sort) | 10k | 2.9 - 8.9 ms | under 15 ms |
| Data layer: same at 50k | 50k | 9.4 - 40.9 ms | limit 300 ms |
| App open, cold (no cache, first index; log says index 3.4 s) | 10k | 5.9 s (5.9-7.7 s over 3 runs) | 5-8 s |
| App open, warm (cache present; log says sync 236 ms) | 10k | 2.75 s | no target (see PQ-02) |
| measure:ui expand all (first screen) | 10k | 263 / 299 ms | 0.4-0.6 s; 0.26 s in 0.8.0 |
| measure:ui scroll to bottom | 10k | 53-54 ms | 65 ms |
| measure:ui collapse all | 10k | 271 / 52 ms | none |
| measure:ui search, open, clear (reveal) | 10k | 434-511 ms | none |
| measure:ui filter "With suspect links" | 10k | 587-909 ms | 0.3 s earlier (see PQ-03) |
| Query over the bridge: text search, status filter, no-links | 10k | 5-9 ms | under 15 ms |
| Query over the bridge: suspect filter / sort by title offset 5000 | 10k | 45 ms / 74 ms | - |
| `queryItems` 10,000 rows brief (= `fetchAll`) / not brief | 10k | 393 ms / 224 ms | - |
| `getItem` / `getAncestors` / `getItemHistory` (git log of one item) | 10k | 2.2 / 0.6 / 30 ms | - |
| Save (`saveItem`, median of 20, max 56 ms) | 10k | 36.6 ms | no target; 0.09 s refresh after save in 0.8.0 |
| `refreshRepository(focus)`, nothing changed | 10k | 91 ms (60 ms of it is the fixed SETTLE wait) | - |
| `refreshRepository` after 1,000 / 5,000 files edited outside | 10k | 685 ms / 1,880 ms (5,000 > MANY=2000 so a full check) | - |
| `getGitState` clean / 20 / 1,000 / 5,000 uncommitted files | 10k | 31 / 59 / 74 / 262 ms | - |
| `getCompareOptions` with 1,000 uncommitted | 10k | 64 ms | - |
| `compareVersions` HEAD..WORKING, 1,000 / 5,000 edits | 10k | 1.67 s / 2.85 s | 3,000 real edits 1.8 s (0.8.0) |
| `compareVersions` first commit..HEAD, about 6,000 changed files | 10k | 3.6-4.0 s | 9,118 confirmation-only files 0.4 s (0.8.0) |
| Commit of 1,000 / 5,000 files from the app | 10k | 434 ms / 971 ms | - |
| One window focus, collapsed tree | 10k | 3 main-process calls (refresh 95 ms, query 1 ms, git state 55 ms) | CR2-04 |
| One window focus, Expand all (31 open levels) | 10k | 33 calls: refresh 81 ms, 31 queries 34 ms in total, git state 64 ms; no renderer task over 50 ms | CR2-04 |
| Memory: whole app working set after Expand all / after 10 focuses / after 30 expand-collapse + 30 focuses | 10k | 711 / 714 / 772 MB; renderer JS heap 48 / 48 / 48 MB | none |

## Findings

| ID | file:line | Severity | What is wrong (F = checked, I = likely) | Suggested fix |
| --- | --- | --- | --- | --- |
| PQ-01 | src/modules/workspace/workspace.ts:363, src/modules/workspace/compare.ts:107-250 | Medium | **F** A big Compare blocks the whole main process. `compareVersions` is not queued and does all its parsing and diffing in one synchronous stretch. With `tools/perf-qa-block.mjs` (first commit..HEAD, about 6,000 changed files, 3.6 s) a `getItem` call made every 20 ms waited up to **1,033 ms** (27 probes in 3.6 s). During that time saving, opening an item and the Git bar all stand still. Compare of a branch (the PR view) on a 10k repository will do the same. | Give up the event loop every few hundred entries (`await setImmediate` inside the pairing and the diff loops), or move the compare engine to a worker thread. Add the probe of `perf-qa-block.mjs` to `measure:ui` with a limit (for example slowest probe under 250 ms). |
| PQ-02 | src/main/ipc.ts (openRepository handler), src/modules/workspace/workspace.ts:216-235, src/renderer/src/screens/StartScreen.tsx | Medium | **I** About 2.5 s of every open is not the index. Warm open takes 2.75 s although the log says the sync took 236 ms (the data benchmark re-opens 10k in 208 ms). Cold open: 5.9 s with 3.4 s of indexing, again about 2.5 s extra. The constant gap points at work around the open (folder check, Git calls for the state, recent list, first renderer render and queries). Not measured in phases, so the source is inferred. | Log the phases of `openRepository` (check folder, index, git state, first query) and show them in the log line; start `getGitState` in parallel with the first table query; then fix the largest. |
| PQ-03 | e2e/measure-tree.e2e.mjs (filter step), src/renderer/src/workspace/screen/useFilters.ts | Low | **F** The suspect-link filter in the table takes 587-909 ms in `measure:ui` against 0.3 s measured on the sandbox earlier; the query itself is 45 ms over the bridge. The rest is the window (pop-up open, select, table reload; the script also waits a fixed 300 ms, so about 300 ms of the number is the script). The earlier 0.3 s was probably measured without the pop-up. Not a regression proven, but the number in TESTING.md no longer matches the script. | Remove the fixed 300 ms wait (wait for the table to settle instead) and update the number in docs/TESTING.md. |
| PQ-04 | src/renderer/src/screens/WorkspaceScreen.tsx:117-129 (CR2-04) | Low | **F** Measured the cost of CR2-04 with `tools/perf-qa-focus.mjs`: one focus is 3 main-process calls on a collapsed tree and 33 with Expand all on 10k (refresh 81-95 ms, 31 level queries 34 ms, Git state 49-64 ms); about 400 ms of wall time, no renderer long task (over 50 ms), so the window stays responsive. On this scenario the tree has 31 open levels, below `BULK_REFRESH` = 60, so it never reaches `fetchAll`. With more than 60 open levels (a sandbox with deeper groups) every focus moves all 10,005 rows over the bridge: 393 ms of IPC measured for `fetchAll` alone, plus a re-render of 10k rows. So CR2-04 costs little on this data, and the "visible delay" depends on the 60-level threshold. Memory does not grow from it (714 vs 711 MB after 10 focuses). I rate it Low, not Medium, for this data size. | As CR2-04: raise dataVersion only when `lastSync.changedFiles > 0`; keep `git.reload()` for outside commits. Also skip the fixed 60 ms SETTLE wait when the watch has nothing pending. |
| PQ-05 | tests/perf.test.ts:21-31, package.json:20-21 | Low | **F** `npm run test:perf` and `test:perf:all` print no timings: the `[perf]` lines from `console.log` do not appear in the output (only "3 passed"), so CI logs show nothing to compare releases with. I had to run vitest with `--disableConsoleIntercept`. Only a limit breach is visible, and the limits are 5-20x above the real values (10k first index 3 s against a 60 s limit), so a 10x slow-down passes. | Print the table with `process.stdout.write` or add `--disableConsoleIntercept` to the npm scripts; write the numbers to `docs/reviews/perf-history.json` per release and fail above 3x the last value (or lower the limits to about 5x the typical value). |
| PQ-06 | src/modules/workspace/compare.ts:~192-197 | Low | **I** Compare cost grows with changed files: 1,000 edits 1.67 s, 5,000 edits 2.85 s, about 6,000 changed files 3.6-4.0 s (about 0.6 ms per file). Each entry also does its own `s.index.incomingLinks(id)` (one SQL query per entry, N+1) and carries its full `diff` over the bridge, so the result for 6,000 entries is a large message. 50k repositories with a big pull would take about 20 s and block (PQ-01). | Fetch the suspect counts for all entry IDs in one query; send only the summary for the list and the diff on demand (`compareItemVersion` already exists for one item). |
| PQ-07 | src/modules/index-cache/sqliteIndex.ts:~395, ~398 | Low | **I** `query()` calls `db.prepare(...)` for every call (count and rows), so each table query pays SQL parsing, and the correlated counts in `COUNTS` (three sub-selects per row) run for all returned rows. Small now (title sort 32 ms at 10k, 63 ms at 50k, over the 15 ms of the earlier note), but the title and field sorts are the only queries that grow quickly (3.5x for 5x items; title sort at 10k is the slowest). | Cache prepared statements by SQL text in a Map; for sorts by title/text consider an index on `title COLLATE NOCASE` (needs `FORMAT_VERSION` bump). |
| PQ-08 | (whole app) | Low | **F** The whole app uses 711 MB (working set, all processes) with a 10k tree expanded, and grew to 772 MB (+61 MB, +8.6%) after 30 Expand/Collapse cycles and 30 focus events, while the renderer JS heap stayed flat at 48 MB. So the growth is in the main process, the GPU or the Chromium cache, not in the window's JavaScript. 30 cycles are too few to tell a leak from caching. | Run `tools/perf-qa-whole.mjs` with 300 cycles and read the per-process split (`app.getAppMetrics()`); if the main process keeps growing, look at the SQLite statement cache and the IPC result buffers. |

## Questions for the owner

None (all findings are technical).

## Checked, nothing found

- Data layer at 10k and 50k: first index, re-open and all queries stay far inside the limits in `tests/perf.test.ts`; growth from 10k to 50k is about linear (index 5.4x, re-open 5.6x, queries 2-7x).
- Index sync with nothing changed: it stats every file only (236 ms at 10k); changed files are read 64 at a time; one transaction. No rebuild happens on a normal open.
- Index rebuild: only when `FORMAT_VERSION` or the root changes (`signature()`); a schema field change re-reads nothing.
- Save/edit: 36.6 ms median, max 56 ms; the refresh after a save is the targeted `syncPaths` (no full check). Commit of 5,000 files 0.97 s.
- N+1 in the tree: `fetchLevel` runs one query per open level (31 queries = 34 ms in total); `fetchAll` takes over above 60 levels.
- Synchronous file reads in the main process: only `readFileSync` of `app-update.yml` (ipc.ts:32) and the update-hold file, plus `appendFileSync` per log line in `fileLogger.ts`; none on a per-item path.
- Git state, history of one item (30 ms), compare options: all under 0.3 s even with 5,000 uncommitted files.
- Search and filters over the bridge: 5-9 ms for text, status, no-links; suspect filter 45 ms.
- Expand all, scroll and collapse in the window: within the earlier numbers (0.26-0.30 s, 53 ms).
- `links_target`, `links_rid`, `items_parent` and `item_fields` indexes exist, so the incoming/child counts do not scan.
- Not measured: Windows (virus scanner), the real sandbox clone, 50k in the window (the app tree), the Excel/ReqIF import and export speed, undo/discard of large sets.
