# Project review 2 — 12 Nov 2026 (after v0.21.1)

**Status: findings merged; owner questions answered 12 Nov (section E); fixes in progress.**

Second whole-project review, on the owner's request after the free weekly reset (12 Nov 2026): eight helpers on the
frozen commit `a8244a2` (pack `agents/whole-project-0.21-pack.md`), each with two jobs — (A) every point of its earlier
reports that is not fixed, checked again in the code; (B) new findings since 0.20.1. Tags F / I / R and severities as
in the first review. Full evidence: `agents/whole-project-0.21-<helper>.md`; IDs below are the helpers' own.

## Summary

| Helper | New (B) | Earlier still open (A) | Most important |
| --- | --- | --- | --- |
| Code — data and Git core | 7 (2 Medium) | 26 open / partly, 2 now fixed | Same ID in two files: open/save/**delete** of the copy act on the original (B-02); the fast header reader still disagrees with the full parser on some hand edits (B-01) |
| Code — app, import/export, CI | 13 (3 Medium) | 35 (2 Medium) | CSV import still wrong for two short rows in a row and a 3-line quoted cell (N-01, N-02 — my 0.20.2 patch); W-10 English core messages in Arabic never done (N-03) |
| Security | 1 Medium + new Lows | 18 open, 4 fixed, 1 decided | A 14 KB Excel file with cells in column XFD still runs Import out of memory (SEC-WP3-01) |
| QA (48 new tests, 44 pass, 4 `it.fails`) | 6 (1 Medium) | — | CSV short rows (QW21-1); the fast reader (QW21-01) |
| Performance | 3 (1 High, 2 Medium) | PW-03/05/08 open, PW-04/07 half | First open of an old version blocks the main process 2.5 s at 10k, 5.9 s at 50k (PW21-02); sort by number 1.7 s at 50k; Expand all 3 s / 27 MB at 50k |
| UI/UX | 11 (4 Medium) | most UW items open, 2 fixed, 2 decided | When the toolbar wraps, "+ New item" leaves its "At the end" partner (B-01); Filters pop-up over the second row (B-02); tabs need one Tab stop + tabpanel (B-03); «نسخة» has five meanings (B-06); no start-screen screenshots (B-08) |
| Arabic | 13 (3 Medium) | W3–W8, W12, W13, AR-09, AR-13 | Agreement after counts (B1), e-mail brackets (B3), user values not isolated in ~9 texts (B4) — exact replacements given |
| Docs | 17 (1 High, 5 Medium) | 10 open (mostly Low), 11 fixed | STATUS "read this first" still says 0.20.1 (N-01); CHANGELOG order; three versions named for the documents batch; user guide shortcut table and first-run steps |

**In plain words (I):** no data-loss path in normal use; the serious items are corner cases (an ID copied into two
files, crafted Excel files, CSV with short rows), one blocking pause when an old version is opened the first time,
Arabic wording, and documents that lag a day behind. Three of the findings are gaps in my own 0.20.2/0.21.0 fixes
(CSV, Excel, fast reader) — each now gets the stricter fix.

## A. Fix plan (R — technical, builder's decision)

1. **0.21.2 data and import safety** — same ID in two files: every read/write/delete of a row goes by its file path,
   not only by ID (core B-02); CSV reader rewritten to RFC 4180 with an explicit "short rows" rule and tests for every
   case so far (N-01, N-02, QW21-1); Excel reads only existing cells (SEC-WP3-01); the fast header reader is used only
   for files written by reqochet's serializer — anything else goes to the full parser (B-01, QW21-01); the missing
   long-time-limit and window-call tests (A-03); the other core Lows that touch data.
2. **0.21.3 speed** — old version: chunked inserts with pauses and the fast reader (PW21-02); sort by number from the
   index without loading full rows (PW21-01); Expand all fetches only open branches' children (PW21-04 / PW-05); gap
   count only when rules or links change (PW-03).
3. **0.21.4 screens and Arabic** — toolbar groups (B-01, B-02), tab rows with one Tab stop and tabpanels (B-03),
   start-screen screenshots (B-08), W-10 core messages through `T` in both languages (N-03, CRA-03, A-01), the Arabic
   replacements (B1, B3, B4, B6 «نسخة» meanings per the glossary), the one-click "keep one name" for O-6.
4. **Documents (no version)** — STATUS "read this first", CHANGELOG order, one name for the documents batch,
   user-guide shortcuts and first-run steps, the remaining DOC Lows.
5. **Lows** — the rest of the open Low items of all reports, taken with the versions above where they touch the same
   files; any left are listed at the end of this file with a reason.

## B. What works well

- No data loss in the 48 new journey tests (copies, Arabic names through pull/merge/history/baselines, imports).
- 0.20.2 fixes hold: copied parents, plain Git paths, link extras, export of old versions, push rules, problem reports.
- 0.21.0: compare 10.5 → ~1 s at 50k, saves in milliseconds, self-test back under 100 s on the owner's PC.

## C. Open points in other review documents

The docs helper checked every file in `docs/reviews/`: the only undecided points are the public release repository
questions (`2026-11-04-public-release-repo.md` §5) — asked in E. Postponed work groups are already in the roadmap.

## E. Owner decisions needed

| ID | Question | Recommendation |
| --- | --- | --- |
| Q-1 | Public repository: source code and documents public (as the 4 Nov proposal), or installers only? | Source + user and engineering docs public — **C 12 Nov: as recommended** |
| Q-2 | Licence | All rights reserved — **C 12 Nov: source-available** |
| Q-3 | `requirements.md` and the sandbox test data public? | Sandbox yes, plan no — **C 12 Nov: neither; instead reqochet's own public requirements as a reqochet project folder, published with every public version** |
| Q-4 | Issues on the public repository | On, with a template — **C 12 Nov: as recommended** |

## F. Outcome so far (12 Nov 2026, evening)

**Fixed and released / pushed** (details in CHANGELOG 0.21.2, 0.21.3 and the commits "Review 2 Lows …"):
- All Medium/High: core B-01, B-02; app N-01, N-02, N-03 (W-10); security SEC-WP3-01; QA QW21-01, -1, -43, -67;
  performance PW21-02 (old-version pause 1.9 → 0.3 s); UI B-01, B-03 (one Tab stop; tabpanels not yet), B-08;
  Arabic B1, B3, B4; docs N-01…N-06; the owner's O-6 ("Merge into…").
- Lows: core A-02, A-03, A-04, A-12, A-20, A-21, A-22, A-23, A-24, A-26, A-27, B-03, B-04, B-05, B-07; app N-05, N-08,
  N-10, N-12, N-13, CRA-08, CRA-10, CRA-11, CRA-14, CRA-17, CRA-18, CRA-19, CR3-19, CR3-26; security SEC-WP3-05,
  -06, -07, -08, -09, -10, -16, -19, -20, -24; UI UW-15, UW-16, UW-17, UW-18, B-10; Arabic B2, B5 (most), B6, B7,
  B8, B10, B11, B12, B13; docs N-07, N-08, N-09, N-11, N-14.

**Still open — next round** (each named in its helper report):
- UI: UW-04 count units (items vs files), UW-07 matrix header titles, UW-08 read-only form look, UW-09 Changes opens
  with the schema paragraph, UW-10 link vs button styles, UW-11 Arabic table column order, UW-13 parent control,
  UW-14 document picker in Traceability, UW-19, UW-20 (`role="alert"` for notes), B-04, B-05, B-07, B-09, B-11,
  tabpanel ids (B-03 rest).
- Speed (50k "should", O-3): PW-03 gap count on every change, PW-05 Expand all 27 MB, PW-08 big exports in memory,
  PW21-01 sort by number 1.7 s.
- Core / app / security Lows not listed above (mostly hardening of hand-edited or crafted files, and messages);
  Arabic B9, AR-09, AR-13; docs N-15, N-16.

## Discussion log

- 12 Nov 2026 — review 2 run (8 helpers, without Fable); reports merged; questions Q-1…Q-4 asked; building 0.21.2.
- 12 Nov 2026 — Q-1 source + docs; Q-2 source-available; Q-3 neither public — reqochet's own public requirements as a published reqochet project instead; Q-4 issues on with a template. Recorded in `2026-11-04-public-release-repo.md` §5.
- 12 Nov 2026 (evening) — 0.21.2 released; 0.21.3 release restarted by hand after a speed-limit fix; Lows batches pushed; outcome in F.
- 12 Nov 2026 (night) — Fable trial (visual review, `agents/fable-trial-visual-review.md`): the owner answered its questions — 1 keep the tile (the tile-less icon "looks creepy"); only repair the small sizes; 2 toast: show a mock-up first; 3 logo eyes still when idle; 4 keep icon + name in the top bar; 5 let Fable build its changes, screenshots to the owner before anything is pushed. Fable builds them in a separate worktree (branch `fable-visual-polish`), plus the owner's extra points: Changes view headers as a shaded bar (GitHub style) and an Arabic wordmark «ريكوشيه» proposal.
- 12 Nov 2026 (night) — the owner's 0.21.3 report: Copy report did nothing (my 0.21.3 permission change refused clipboard writing — fixed, e2e check added); importing into a new document showed the rows only after switching windows (wrong paths synced — fixed, test); a second import of the same rows showed "same" with Import off (correct — IDs exist once per project — now explained in the wizard); a Delete document option was missing (added, with an inline confirmation).
- 12 Nov 2026 (night) — licence question: the owner understood "source-available" as "free for everyone, paid only for someone who builds on it and sells their version". That matches a no-compete licence (PolyForm Shield / Perimeter), not PolyForm Noncommercial (which makes every company pay). To be confirmed by the owner before the public repository is made.

