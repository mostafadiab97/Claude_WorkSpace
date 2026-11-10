# Project review — 10 Nov 2026 (after v0.20.1, before the first release)

**Status: findings ready, waiting for the owner.** No code changes until the owner has gone through them.

Same method as the first review (`done/2026-10-25-project-review.md`). Eight helpers checked the frozen commit
`478cb51` (the pack names `758fd4f`; the only change between them is the helper files): code reviewer ×2 (core /
app), security, QA, performance, UI/UX, Arabic, docs — without Fable, on the owner's instruction. Tags: **F** fact
(seen in code, a command or a measurement), **I** inference, **R** recommendation. Severity: **High** = can lose or
hide data, crash, or block work; **Medium** = wrong result or clear friction; **Low** = polish. Effort: S ≤ ½ day,
M ≤ 2 days, L more. IDs: **W-nn** in this report; the helper ID in brackets points to the full evidence in
`agents/whole-project-0.20-<helper>.md`.

## Summary

| Helper | Findings | High | Medium | Low |
| --- | --- | --- | --- | --- |
| Code — data and Git core (CRC) | 24 | 2 | 5 | 17 |
| Code — main, window, import/export, updater (CRA) | 27 | 0 | 3 | 24 |
| Security (SEC-WP2) | 12 | 0 | 3 | 9 |
| Performance (PW) | 9 | 1 | 5 | 3 |
| QA — 47 new journey tests, 44 pass (QW) | 3 | 0 | 1 | 2 |
| UI/UX (UW) | 20 | 0 | 10 | 10 |
| Arabic (W1–W15) | 15 | 0 | 6 | 9 |
| Docs (DOC) | 26 | 3 | 11 | 12 |
| **Total** | **136** | **6** | **44** | **86** |

**In plain words (I):** the app is in good shape for its size — the 44 new end-to-end journey tests (links across
documents, files changed by hand, two PCs, import → export → import, old versions) passed except three rare cases.
What stands between today and a first release is a **short list of data-safety bugs in corner cases** (a copied parent
whose children get the wrong file, Arabic document names confusing Git, link notes lost in a merge, a crafted Excel
file closing the app), **speed at 50,000 items** (compare, save, sort by number, first open of an old version), and
**out-of-date documents** (status, README and the user guide still describe 0.13). None of it is a redesign.

## A. Possible defects (data and Git first)

| ID | What (tag) | Severity | Effort |
| --- | --- | --- | --- |
| W-01 | "Give the copy a new ID" on a copied **parent** rewrites the **original** child instead of the copy's child when the copy's document sorts after the original's (F, reproduced) [CRC-01] | High | S |
| W-02 | Documents with Arabic or other non-ASCII names: Git prints their paths quoted, so a pull with a clash there is refused as "conflict outside requirements" and item history misses entries (F, command) [CRC-02] | High | S |
| W-03 | A merge (pull where both sides touched an item) drops extra keys on links (`note:` etc.) and can lose a change that only touched such a key (F) [CRC-03] | Medium | S |
| W-04 | Export while an old version is shown puts NUL characters in the title → the ReqIF file is not valid XML (F) [CRC-06] | Medium | S |
| W-05 | CSV import: a short row ending in a quoted cell swallows all following rows (F, ran it) [CRA-01] | Medium | S |
| W-06 | A 17 KB Excel file (one cell at row 50,000,000) closes the app on Import (F, ran it) [SEC-WP2-01] | Medium | S |
| W-07 | Compare between versions shows "B became C" when one item was deleted and another added (Git's rename guess) (F, 2 QA tests) [QW-1] | Medium | S |
| W-08 | Commit, pull, branch switch and undo still have the 30-second Git limit; the owner hit this with `add` on 8 Nov (I) [CRC-04] | Medium | S |
| W-09 | "Restart to update" and "Go back to version X" do not ask about unsaved edits (I) [CRA-02] | Medium | S |
| W-10 | Messages still English in Arabic: Problems list texts, Compare summaries, updater texts, self-test, theme warnings, export headers (F) [CRC-05, CRA-03, CRA-05…07] | Medium | M |
| W-11 | Push relies on the user's Git settings: a `+` push rule would make it a forced push (I) [CRC-16] | Low | S |
| W-12 | Windows paths over 260 characters: saves work, Git commands fail (I) [CRC-17] | Low | S |
| W-13 | Both PCs rename the same document differently → after pull, two folders with the same items and a misleading message; nothing lost (F) [QW-2] | Low | M |
| W-14 | Hand-edited files: number values (`priority: 1`) block saving; a list as title becomes "[object Object]"; huge `order:` numbers throw (F) [CRC-07…09] | Low | S |
| W-15 | Error paths that leave the table stale or files half-moved: import "Verified by" step, pull from a branch in parts, Windows-lock retries missing for deletes/renames, session start failure, discard without HEAD check (F/I) [CRC-10…13, 18, 19, 21] | Low | M |
| W-16 | Other low items: dead duplicate-repair code, `.tmp` files trigger full checks, wrong "timed out" text, baseline push "rejected" read as "name taken", editor/keyboard small bugs, unused window call (F/I) [CRC-14, 15, 20, 22; CRA-04, 08–19, 25–27] | Low | M |

## B. Performance and scale (measured at 10,005 and 50,000 items)

| ID | What (tag) | Severity | Effort |
| --- | --- | --- | --- |
| W-20 | Compare of two commits reads the whole newer tree for outline numbers: 2.4 s at 10k, 10.5 s at 50k, window frozen (F) [PW-01] | High | M |
| W-21 | Saving one item: 64 ms at 10k but 592 ms at 50k — grows faster than the data (F, cause not profiled) [PW-02] | Medium | M |
| W-22 | Sort by outline number: 283 ms at 10k, 4 s at 50k, on the main process (F) [PW-04] | Medium | M |
| W-23 | First open of an old version: 3.6 s / 14.3 s with no progress shown; reopening is fast (F) [PW-07] | Medium | M |
| W-24 | Coverage gap count 577 ms at 50k, run on every data change (F, open since 0.20.0) [PW-03] | Medium | M |
| W-25 | Expand all at 50k sends 27 MB to the window (F) [PW-05] | Medium | L |
| W-26 | Big exports hold everything in memory (ReqIF 146 MB string, 1.3 GB process) (F) [PW-08]; ReqIF import slows with the square of relations per item (F) [SEC-WP2-07] | Low | M |
| W-27 | The CI speed test does not cover compare, save at 50k, sort by number or old versions (F) [PW-09] | Low | S |

Everything else measured is within target (open cached, search, filter, Git status, matrix, Excel export).

## C. Design and structure

No structural problem found: module rules hold, the new traceability and version-view code follows the existing
patterns. Small items: `tools/review-pack.mjs` has no area for `src/shared/` (CRA-22); four old scripts in `tools/`
are not documented (CRA-23); unused window call `confirmLinks` (CRA-18).

## D. Security and robustness

| ID | What (tag) | Severity | Effort |
| --- | --- | --- | --- |
| W-30 | `.claude/settings.json` lets an AI session run any `gh api repos/…` call without asking — including changing visibility or deleting a release, against the owner's rule (F) [SEC-WP2-03] | Medium | S |
| W-31 | CI: library install scripts could change code that later runs with the release token (I) [SEC-WP2-02]; "Run workflow" can publish a release from any branch (F) [SEC-WP2-11] | Medium | S |
| W-32 | Electron 45.0.0 is locked; 45.2.3 has Chromium security fixes (F) [SEC-WP2-09] | Low | S |
| W-33 | The problem report contains the Windows user name in every path (F) [SEC-WP2-10] | Low | S |
| W-34 | Smaller hardening: CSV export does not protect cells starting with `-` (Excel does); IDs like `NUL`/`CON` accepted; unlimited required-field types in a pulled schema; Compare reads working files without the size/link check; editor preview formats the whole text (F) [SEC-WP2-04…06, 08, 12] | Low | S–M |

## E. Tests and process

- QA added `tests/qa-whole-0.20-journeys.test.ts` (47 tests; 3 marked `it.fails` = W-07 ×2, W-13). When those are
  fixed Vitest says so.
- Missing tests named by the code reviewers for W-01…W-06 and W-14 (CRC-24), the window-call validators (CRA-21), and
  the destructive actions in the release self-test (CRA-20).
- The full-suite flaky test (`qa-0.17.0` "incomplete combined") stays on the watch list.

## F. Screens, Arabic and documents

**Screens (UI/UX):**
- **W-40:** the editor panel covers the end of the toolbar ("+ New item" cut; Arabic too) [UW-02, W14].
- **W-41:** the success toast covers the toolbar and the editor's ID line [UW-03].
- **W-42:** a typo in the Fields dialog text ("choices ar are gone") [UW-01].
- **W-43:** five of six tab rows have no arrow-key handling [UW-06].
- **W-44:** "Changes + settings" is unclear [UW-04].
- **W-45:** "No problems" next to "3 coverage gaps" reads as a contradiction [UW-05].
- **W-46:** the matrix headers look alike [UW-07].
- **W-47:** a new project's Changes screen opens with a schema paragraph [UW-09].
- **W-48:** the start screen is never in the screenshots [UW-17].
- Plus 11 more (UW-08, 10–16, 18–20).

**Arabic:**
- **W-50:** "version" is إصدار in about 14 places; the glossary says نسخة [W1].
- **W-51:** tree and column-resize arrow keys are not mirrored, and five arrow symbols are not mirrored either [W9 and others].
- **W-52:** wrong agreement in counted phrases [W3].
- **W-53:** `<email>` can show as `>email<` [W5].
- **W-54:** user values are not isolated in about 30 texts [W6].
- Plus 10 Low.

**Documents:**
- **W-60 (High):** `STATUS.md` still has the 2 Nov "read this first" block (0.13.1, name not chosen) — the hand-over guide sends new sessions there [DOC-01].
- **W-61 (High):** `README.md` describes v0.13.0 [DOC-02].
- **W-62 (High):** USER-GUIDE §16 lists traceability as "planned" [DOC-05].
- **W-63:** ARCHITECTURE / ONBOARDING details out of date (cache format, `.reqman`, timeouts, duplicate repair) [CRC-23, CRA-24, DOC-…].
- Plus 22 more (DOC-03…26).

## G. What works well — keep it

- The 44 passing journey tests cover what users really do (documents, links, hand edits, two PCs, round-trip import),
  and the never-lose-data rules held in all of them.
- Module boundaries, the text/Arabic system and the theme rule are still enforced by tests and lint, with no breaks found.
- Old-version view and traceability: no data-loss path found; the earlier Excel crash (P1 of 0.20.0) is gone.
- Open cached, search, filter, Git status, matrix and Excel export are within the speed targets at 50k.
- The helper reports came in at about 90–150 k tokens each with the new budget rules.

## H. Proposed order (R — for the owner to confirm)

1. **0.20.2 — data safety (patch, about 2 days):** W-01…W-09, W-11, W-12, W-30…W-33, plus the missing tests (CRC-24). No new screens, so the checklist is short.
2. **0.21.0 — speed at 50k:** W-20…W-25, W-27 (with a CI speed test so they stay fixed).
3. **0.21.x or bundled with 0.21.0 — screens, Arabic and documents:** W-10, W-40…W-54, W-60…W-63. These are mostly small, and the documents must be right before a public release.
4. **Later, low:** W-13…W-16, W-26, W-34 and the remaining Low items, picked up when their area is touched.

## I. Owner decisions needed

| ID | Question | Recommendation |
| --- | --- | --- |
| O-1 | Order and bundling as in H (data safety first, then speed, then screens + docs)? | As in H — **C 10 Nov: yes** |
| O-2 | W-30: remove the blanket permission so an AI session must ask before any GitHub change to your repositories? | Yes, remove it — **C 10 Nov: keep the permission; report every such action** (rule added to CLAUDE.md) |
| O-3 | Is 50,000 items a must for the first release, or is 10,005 (the sandbox) the target and 50k "should"? This decides how much of B goes into 0.21.0 | 10k must, 50k should (fix W-20…W-23 now, W-24/W-25 later) — **C 10 Nov: A, as recommended** |
| O-4 | W-44: rename "Changes + settings" — e.g. "Changes" with settings moved behind a gear icon? | Gear icon for settings — **C 10 Nov: keep the button as it is** (settings = changed project files such as schema.yaml, committed together with the item changes); **add a description** of \"settings\" to its tooltip |
| O-5 | W-45: the status bar — show "3 coverage gaps" as a separate amber chip, with "No problems" meaning file problems only? | Separate chip with a tooltip |
| O-6 | W-13: both PCs rename the same document — just a clearer message (rare), or merge the folders automatically? | Clearer message only |
| O-7 | W-33: replace your Windows user name in problem reports with `%USERPROFILE%`? | Yes |

## Discussion log

- 10 Nov 2026 — review run (8 helpers, without Fable, on the owner's instruction); findings merged; waiting for the owner.
- 10 Nov 2026 — O-1 yes (order as in H); O-2 keep `gh api repos/*`, but every GitHub call that changes something must be reported to the owner.
- 10 Nov 2026 — O-3 A: 10k items a must, 50k a should (W-20…W-23 in 0.21.0, W-24/W-25 later). The owner also asked to update the Word AI prompt (folder of documents, one file per version, format extraction) → `docs/guides/word-template-prompt.md` rewritten.
- 10 Nov 2026 — O-4: keep "Changes + settings", explain "settings" in the tooltip (screens batch). Word prompt: report conflicts between requirements (tagged `import-conflict`); a requirement touching two modules is kept in both, linked with relates-to.
