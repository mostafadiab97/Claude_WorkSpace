# Whole-project QA 2 (0.21, frozen commit a8244a2) — QA tester

Scope: (A) every earlier QA report re-checked for findings still open; (B) attempts to break what changed since 0.20.1
(W-01…W-07, push rules, fast outline numbers, kept numbers, sort by number, old-version view). 48 new tests in three
files; all pass with `npx vitest run` (44 pass, 4 are `it.fails` marking real defects) and lint cleanly. No product
file was changed; scratch files under /tmp were removed.

## New test files

| File | Covers | State |
| --- | --- | --- |
| `tests/qa-whole-0.21-numbers.test.ts` (7) | fast header reader vs full parser; Compare numbers vs live numbers on hand-edited files; kept numbers after saves; sort by number with orphans | 6 pass, 1 `it.fails` (QW21-01) |
| `tests/qa-whole-0.21-copies-git.test.ts` (19) | W-01 copied documents (before/after, Arabic, accents); W-02 non-ASCII names through rename/history/compare/baseline/pull; push rules | 19 pass |
| `tests/qa-whole-0.21-versions-import.test.ts` (22) | W-03 link extras; W-04/W-07 old-version export and compare; the version view under concurrent calls; W-05/06 CSV and Excel limits | 19 pass, 3 `it.fails` (QW21-43, QW21-60b, QW21-67) |

## Findings

| ID | file:line | Severity | What is wrong (F = checked, I = likely) | Suggested fix |
| --- | --- | --- | --- | --- |
| QW21-1 | `src/modules/import-export/csv.ts:85-92` (`rowEndsEarly`) | Medium | F (test QW21-60b): W-05 is only half fixed. A short row that ends in a quoted cell, followed by another row that is also short, still swallows every later row into one cell. `a,b,c\n1,"x"\n2,"y"\n3,4,5` gives 3 rows instead of 4; `"",""\n4\n5,6,7` the same. Only a following row with a full set of separators ends the short row. | When the quote is followed by a line end and the next line has no quote-opening problem (does not start inside the cell), prefer closing; keep the "12\"" rule only if the cell text so far contains a line break or the next line would make the file end inside an open quote. Or count rows in a first pass and choose the reading that gives the more consistent column count. |
| QW21-2 | `src/modules/items/itemFile.ts:147-190` (`readStructure`) | Low | F (test QW21-01): the fast reader ignores YAML continuation lines. `parent: REQ-B` followed by an indented `  CCC` reads parent REQ-B (the parser reads `REQ-B CCC`); `order: a1` + `  b` reads a1 (parser: none); `id: X` followed by an indented `  parent: Y` is accepted although the parser refuses the file. Only hand-edited files; Compare then numbers a file the app lists as broken. | If a header line after id/parent/order starts with a space or tab, return null (full parser decides). |
| QW21-3 | `src/modules/items/merge.ts:154-165` | Low | F (test QW21-43): one PC removes a link, the other only edits its note (or other extra key): the link is dropped with no question and the note edit is lost silently. Same class as the other conflicts that are asked (CR-04). | Treat "removed on one side, extra changed on the other" as a conflict like a changed/removed field. |
| QW21-4 | `src/modules/import-export/xlsx.ts:121-134` (`sheetRows`, via ExcelJS) | Low | F (test QW21-67): ExcelJS copies the first cell's text into every cell of a merged range. A 50,000-character text merged over 2,000 rows is read as 100 million characters; at 20,000 rows × 100,000 characters the result is 2 GB ("Invalid string length"); a range down a whole column (B2:B1000000) made the import run for over 100 s (hung the test run). Only odd or crafted files (a whole-column merge is possible in real Excel). | Read the sheet's merge list first and skip cells that are not the master, or refuse a merge range above a size; set a time/size guard like W-06. |
| QW21-5 | `src/modules/repository-store/fileStore.ts:100` | Low | F (re-run of earlier QW-3): once a second document exists, `newItem` without a document puts the item in the alphabetically first one (Zeta + Alpha → Alpha, `defaultDocument` = Alpha). Not wrong if the window always passes the shown document; surprising for import/API callers. No new test (needs no assertion: seen in a scratch run). | Keep the document the project was created with as default, or require the caller to name one. |
| QW21-6 | `src/modules/workspace/itemOps.ts` duplicate-ID warning with `merging.ts` pull | Low | F (earlier QW-2, still `it.fails` in `tests/qa-whole-0.20-journeys.test.ts` W20-51): two PCs rename the same document differently; after the pull two folders hold the same items. The owner chose only a clearer message (O-6); the test stays failing by design. | None beyond O-6, unless the owner wants the pull to merge the two folders. |

### Part A: earlier QA reports

All 14 earlier QA test files run green today (263 passed, 1 expected fail). Every earlier test that is not `it.fails`
passes, so each earlier finding is either fixed or its test was restated by the builder after a decision.

| Report | Not marked Fixed in the report | State today |
| --- | --- | --- |
| 0.15.0 (QA-01…12) | all 12 (the report has no outcome table) | Their tests pass without `it.fails` → fixed or restated (the test file notes QA-08 as fixed). Not re-checked one by one. |
| 0.16.0 (QA-01…11) | all (no outcome table) | Tests pass → fixed or restated; QA-07 was never a defect. |
| 0.17.0 (QA-01…10) | all (no outcome table) | Tests pass. QA-09 (other loose `.md` files moved by "rename loose files") and QA-10 (same-name rename message) were "I" with no test: not re-checked. |
| 0.18.0 | all marked Fixed or not a defect | closed |
| 0.19.0 | all marked Fixed | closed |
| 0.20.0 | all marked Fixed | closed |
| whole-project (QA-WP-01…04) | QA-WP-02/04 (search `_`/`%`, ß and Arabic digits), QA-WP-03 (Excel 32,767 cell limit) | tests in `qa-whole-project-*.test.ts` pass (no `it.fails` left), so QA-WP-01/02 are fixed; QA-WP-03/04 were I / product choice and are still open (not re-run). |
| whole-project 0.20 (QW-1…3) | QW-1 fixed (W-07; my test QW21-53 confirms one deletion + one addition) | QW-2 open (W20-51 `it.fails`, O-6 message only) = QW21-6; QW-3 open = QW21-5 |

## Questions for the owner

- QW21-6 / QW21-5: is it enough that two PCs renaming one document differently gives only a clearer message, and that a new item without a chosen document goes to the alphabetically first one? (Product choices; nothing is lost.)

## Checked, nothing found

- W-01 copied documents: copy sorting before and after the original, Arabic names, names with a space and accents: renew the copy's parent and then each child leaves the original files byte for byte unchanged, every ID once, the copy keeps its shape (QW21-10); child renewed first, then parent (QW21-11); links to the old ID from a third document stay on the original, the copy's own links survive (QW21-12); both copies tracked → refused with a message, nothing written (QW21-13); two renewals at once (QW21-14); no Git → refused (QW21-15).
- W-02 non-ASCII names: Arabic → Arabic rename with Git, history follows, Compare across the rename gives one entry, a baseline taken before still opens with the old document name (QW21-20); decomposed accent, composed accent, emoji, CJK names through rename, history and Compare (QW21-21); Arabic document with a clean pull and with an overlapping text edit on both PCs (QW21-22, QW21-23).
- W-03 link extras: added/removed/untouched notes, list and map values in other key order, both sides adding the same link with different notes (asked), `__proto__` / `constructor` keys (QW21-40…44, except QW21-43).
- W-04/W-07: csv, markdown, xlsx and ReqIF export of a shown old version hold the old titles and the right count, no control characters; a hand-edited title with control characters reads back as valid ReqIF and CSV; export of a comparison while an old version is shown; delete + add of look-alike files; a file renamed by hand (QW21-50…54).
- Old-version view: seven overlapping open/query/close calls, writes and Git actions refused during the view with nothing written, a save racing with close, bad refs (`--output=…`, unknown hash), tag, branch, short hash (QW21-55…57).
- Push rules: no upstream (first push sets it, another branch does not touch main), `branch.<name>.pushRemote`, `remote.pushDefault`, upstream = local branch, rejected non-fast-forward, detached HEAD, no remote, missing remote (QW21-30…35).
- Fast outline numbers vs full parser: 20 awkward headers (only QW21-2 differs); Compare numbers equal live numbers at both commits for CRLF, BOM, quoted parent, legacy numeric order, orphan, parent loop, order tie, parent in another document (QW21-02).
- Kept numbers (W-21): save after title, order, parent, parent removed, type, links, order removed and document rename; six parallel saves; an outside edit during a save — numbers equal a freshly opened project each time (QW21-03…05).
- Sort by number: 12 siblings (1.10 after 1.9), orphan and loop items last in both directions, paging stable, two documents with a text filter (QW21-06, 07).
- CSV: CRLF, quoted multi-line cells, BOM, Arabic with `;`, tab, unterminated quote, 200,000 rows in a few seconds (QW21-60…62). Excel: row 1,048,577 refused at once, rows 2^32 and 10^14 do not crash, last allowed row reads in seconds, columns beyond XFD are refused by ExcelJS, non-zip refused, empty zip gives no sheets (QW21-63…66).
