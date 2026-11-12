# Project review 2 — 12 Nov 2026 (after v0.21.1)

**Status: findings merged; owner questions asked (section E); fixes in progress.**

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
| Q-1 | Public repository: source code and documents public (as the 4 Nov proposal), or installers only? | Source + user and engineering docs public |
| Q-2 | Licence | (see the question round) |
| Q-3 | `requirements.md` and the sandbox test data public? | Requirements no (product planning), sandbox yes (fictional, useful for testers) |
| Q-4 | Issues on the public repository | On, with a template |

## Discussion log

- 12 Nov 2026 — review 2 run (8 helpers, without Fable); reports merged; questions Q-1…Q-4 asked; building 0.21.2.
