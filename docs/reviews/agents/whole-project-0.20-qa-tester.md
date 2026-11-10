# Whole-project 0.20 — QA tester

Scope: user journeys at the workspace-service level (commit 478cb51; no worktree, new test file only): items across documents, links and suspect links, document renames (alone and against another PC's edits), outside file changes (copy, move, delete, broken files, `git checkout`, detached HEAD), schema edits against existing data, branches, baselines, old versions, no-remote and two-PC pull/push, and Excel/ReqIF export then import. I first grepped `tests/` for what is already covered and wrote only the combinations that were not. One file: `tests/qa-whole-0.20-journeys.test.ts` (47 tests, eslint and tsc clean). `it.fails` = a defect found (the suite stays green; when fixed Vitest reports it and the marker goes). Scratch files deleted.

Result: 44 pass as plain assertions, 3 are `it.fails` (2 defects below, one of them counted twice by two tests).

## Tests

| Test | Passes | Note |
| --- | --- | --- |
| W20-01..04 links across documents (cross-document reparent refused, rename keeps links, delete with incoming links, target file deleted by hand) | yes | |
| W20-10..15 outside changes (copied file, hand edit vs conflict, `git checkout`/detached, broken YAML/empty/binary files, file moved to another document, cache removed) | yes | |
| W20-20..24 schema (type in use, link type in use, enum option removed, rule for a missing type, odd field ids) | yes | all refused or lossless |
| W20-30..33 documents (hostile names, history across rename, emptied document, parent deleted with child elsewhere) | yes | |
| W20-40..46 Git states (no remote, detached, odd branch/baseline names, switch with dirty tree, read-only old version, undo twice) | yes | |
| W20-50, 52..54 two PCs (delete vs edit, dirty pull, baseline transfer, suspect link across a pull) | yes | |
| W20-51 both PCs rename the same document | `it.fails` | F-1 |
| W20-60..65 ReqIF/Excel export → import → export, odd titles, Arabic, loops in the parent column, empty project | yes | |
| W20-70, 71 rename on A, edit on B (committed and uncommitted) | yes | git follows the rename |
| W20-72..75, 77, 79 re-import after rename, bulk reparent loops, suspect after rename, field type change, duplicate-ID fix, uncommitted delete+add list | yes | |
| W20-76, 78 compare of delete+add | `it.fails` | F-2 |

## Findings

| ID | file:line | Severity | What is wrong (F = checked, I = likely) | Suggested fix |
| --- | --- | --- | --- | --- |
| QW-1 | `src/modules/git-adapter/systemGit.ts:578` (`diffNameStatus`, `-M`) | Medium | F (W20-76, W20-78): Compare between two versions pairs a deleted item with a different new item as "renamed" when the files look alike (item files are mostly header, so similarity is high). Result: the deleted item and the added item disappear and one entry "B became C" appears, with the ID of the new item and the title/diff of the old one; deletion and addition counts and the export of the comparison are wrong (2 entries instead of 3). Happens with plain delete+add, no document rename needed. The Changes list before a commit is correct (W20-79). | Drop `-M` and recognise a rename by ID instead: same ID at another path = moved (compute from the two sides' IDs, as the working-folder path already does), otherwise A and D. Or keep `-M` only for pairs whose IDs are equal. |
| QW-2 | `src/modules/workspace/itemOps.ts` (duplicate-ID warning, `fix: 'copy-id'`) with `merging.ts` pull | Low | F (W20-51): A and B rename the same document to different names; after B pulls, both folders hold the same item, so the app shows two rows with one ID, and the message says "usually a file copied by hand", which is not what happened. Nothing is lost; the "new ID" fix is offered but a real fix would be to keep one folder. | Detect at pull that the same IDs sit in two folders and offer "keep this document name / the other". At least word the message for this case. |
| QW-3 | `src/modules/repository-store/fileStore.ts:100` | Low | I (seen in W20-10/14 before the test passed `document`): `defaultDocument` is recomputed when documents change; once a second document exists, a new item without a chosen document goes into the alphabetically first folder (e.g. creating "Moved" made it the default over the first document "Spec"). The window passes the shown document, so only API/import callers without `document` see it. | Keep the document the user last used or the first created; or require `document` when there is more than one. |

## Questions for the owner

None (all findings are defects, not product choices). One to confirm: should the app offer "pick one folder" when two PCs rename a document differently (QW-2)? Recommended: yes, later.

## Checked, nothing found

- Links across documents: cross-document reparent is refused with a clear message and nothing moves; renaming a document keeps links and creates no suspect link; text edit makes a link suspect and confirm clears it, also after a rename; deleting a target removes incoming links when asked.
- Outside file changes: hand edit gives a conflict on the old revision and nothing is overwritten; a copied file is reported (file text "2 files have the ID"); hand-deleted target, broken YAML, empty and binary files are skipped without breaking the other items; `git checkout` of branches and a detached HEAD are followed after refresh; cache removal rebuilds.
- Schema: removing a type or link type in use is refused; stale revision refused; odd/duplicate field ids refused; enum option removal and field type change keep values; rule for a missing type does not crash coverage.
- Documents: hostile names (`..`, paths, empty, reserved, case variants) are refused or safe; emptied document stays; history survives a rename (rename commits by itself); parent deleted with a child elsewhere is consistent.
- Git: no remote answers in words; detached HEAD edits/commit/push do not throw; odd branch and baseline names refused (baseline names are letters/digits/`._-` only, by design); switch with a dirty tree keeps a usable state; read-only old version refuses edit/link/document/commit and closing returns to the branch; undo twice keeps the files.
- Two PCs: delete vs edit, uncommitted pull, baseline transfer, suspect link across pull, rename vs edit (committed and uncommitted) all end with one item and no conflict markers.
- Import/export: ReqIF and Excel round trips keep titles with quotes, `=`, HTML characters, line breaks, pipes and Arabic, parent structure and the relation; re-import after a rename updates in place; loops/self-parents in the parent column leave no cycle; empty project exports in all four formats; unknown chosen ID ignored; hostile document name on import writes nothing outside `requirements/`.
- Test-setup note (not a product defect): the harness used by some tests lets `openIndex` return one file for every key; with that, opening an old version overwrites the real index. The real app uses a file per key (`cacheFileName`), as the new tests do.
