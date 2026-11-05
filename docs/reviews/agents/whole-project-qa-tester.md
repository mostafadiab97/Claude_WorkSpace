# Whole-project review — QA tester

Scope: (1) the High and Medium findings of the three code-reviewer reports and the security report turned into
automatic tests that fail today (`it.fails`, so the suite stays green; when a fix lands the test is reported as
"unexpectedly passing" — change `it.fails` to `it`); (2) new attempts to break the app: 10,005-item scenario data
(generated outside the repo) with branches, pull/push sequences and detached HEAD; CSV/Excel/item-file round trips with
Arabic, quotes, line breaks and very long texts; search with odd characters. `npm run check` is green
(415 passed, 26 expected fail, coverage floor kept). No product file was changed.

## New test files

| File | Covers | State today |
| --- | --- | --- |
| `tests/qa-whole-project-core.test.ts` | CR1-02a-d, CR1-03, SEC-01 | 6 fail-today (`it.fails`) |
| `tests/qa-whole-project-import-export.test.ts` | CR3-01 (2 cases), CR3-02, CR3-03a/b, CR3-04, CR3-05a/b, CR3-06a/b, SEC-02, CR3-25, SEC-03, SEC-04, SEC-05 | 15 fail-today |
| `tests/qa-whole-project-git.test.ts` | CR1-01, CR1-08a/b, QA-WP-01a | 4 fail-today |
| `tests/qa-whole-project-data.test.ts` | QA-WP-02 (fails), QA-WP-10..13 (round trips and search with odd data) | 1 fail-today, 4 pass |

Totals: 26 fail-today, 4 pass, 30 tests.

## Findings

| ID | file:line | severity | what is wrong (F = checked, I = likely) | suggested fix |
| --- | --- | --- | --- | --- |
| QA-WP-01 | src/modules/workspace/merging.ts:134-144, src/main/validate.ts:85 | Medium | F A typed answer ("edit") in the pull decision window is written without checking it against the schema. Test `QA-WP-01a`: a Status conflict answered with `Bogus` finishes the pull as successful and the item holds `status: Bogus`; an empty title, `abc`/`NaN`/`1e999` for a number field are also accepted (`mergeItems` probe). NFR-05 says validate before writing. | Run `validateItem` on every merged item in `finishPull` before writing; refuse with the part named (or keep the field's own value). |
| QA-WP-02 | src/modules/index-cache/sqliteIndex.ts:349-352 | Low | F Searching for `_` or `%` returns every item: the text goes into SQL `LIKE` unescaped (test `QA-WP-02`: 4 of 4 items instead of 1). | Escape `%`, `_`, `\` and add `ESCAPE '\'`. |
| QA-WP-03 | src/modules/import-export/xlsx.ts (write) | Low | I Excel cells are limited to 32,767 characters; a 40,000-character text is written and read back by ExcelJS, but Excel itself usually reports a damaged file. Not testable here (needs Excel). | Cut or refuse cells above 32,767 characters on export and tell the user. |
| QA-WP-04 | src/modules/index-cache/sqliteIndex.ts (search) | Low | F Search does not fold `ß`/`ss` (`strasse` misses `Straße`) and Arabic-Indic digits (`١٠٠`) do not find `100`. | Product choice; fold in the query and the index. |

New-defect count: 1 Medium, 3 Low, 0 High.

Earlier findings: each test above names its finding ID (e.g. "CR3-02: 12" display does not swallow the following rows").
Note on CR1-02d: the field is a text field in the test; the report's claim is that `true` becomes `"true"` — arguable,
drop that case if the owner accepts text.

### Not automated

| ID | Reason |
| --- | --- |
| CR2-01 (High), CR2-02, CR2-03, CR2-05 | Renderer behaviour (close button guard, reload after delete, Push while dirty, list field on blur): needs the built app and Playwright steps with several dialogs; not cheap. Suggested e2e steps are in the finding text. |
| CR2-04 | Performance of focus refresh with 10,005 items: needs the UI measurement (`npm run measure:ui`), not a pass/fail unit test. |
| CR1-04 | Inferred (I) and needs a write that fails midway (locked file); not reliably reproducible on Linux. |
| CR1-05 | Needs unpushed commits plus a failing commit hook and empty identity; setup too large for this pass. Test idea: empty `user.name`, tidy needed, push, then check `git status` is clean. |
| CR1-26, CR3-28 | Meta findings (missing tests / coverage scope); this report's tests are the answer for the cases listed. |

## Questions for the owner

- None for product choices. CR1-01 (duplicate on second "Pull from…") is the most serious defect with a failing test.

## Checked, nothing found

- 10,005-item scenario (generated into a temporary folder): open, commit, branch create, 300 edits on a branch, pull from the branch with the same items edited on both sides (different fields: 300 merged automatically, 0.9 s), pull with the same part edited (300 questions, 0.5 s); no errors.
- Pull decision window: finishing with no answers, with a bad choice, or with a stale plan (HEAD moved) is refused with a clear message.
- Detached HEAD: push, pull and pull-from all refused with a clear message. No remote: push and pull give a clear message. Opening a non-Git folder works.
- CSV round trip (comma, semicolon, tab) with quotes, line breaks, Arabic, emoji, 100,000-character cell: identical (test QA-WP-10).
- Excel round trip of Arabic, spaces, `00123`, `1e3`, 40,000-character cell through ExcelJS: identical (QA-WP-11). A control character is dropped silently; CRLF inside a cell becomes LF (acceptable).
- Item file: awkward titles (`: #`, `null`, `true`, `---`, Arabic, 200,000 characters) and a body with `---` lines round-trip (QA-WP-12).
- Search: Arabic words, quotes, FTS operators, punctuation never throw; 1 MB text stored whole, brief mode shortens (QA-WP-13).
- ReqIF export with `&`, `<`, `]]>` and Arabic reads back; control characters make the export fail (already CR3-08, Low).
