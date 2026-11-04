# Working with helper agents (decided by the owner, 3 Nov 2026)

One **builder** (the main Claude session) writes the product. Three helper agents check its work before each theme
release: a **code reviewer**, a **QA tester** and a **UI/UX reviewer**. (An architect review before foundation-changing
versions was discussed and not added for now.) Helpers are started by the builder with the Agent tool from the same
session; the owner talks only to the builder.

## Rules that prevent conflicts

1. **One writer for product code.** Only the builder changes `src/`, `config/`, workflows, the texts files and the
   styles. Helpers never edit those files.
2. **Helpers work on a frozen commit.** When a version is built and `npm run check` + all e2e scenarios are green, the
   builder commits it and stops editing. All helpers look at that same commit, at the same time.
3. **Reviewers are read-only.** The code reviewer and the UI/UX reviewer only read (code, screenshots of that commit)
   and write a report; they change nothing.
4. **The QA tester writes tests only — new files, own copy.** It works in its own Git worktree (isolated copy of the
   repository) on a branch `qa/<version>`, and may only **add new files**: `tests/qa-<version>-*.test.ts` and
   `e2e/scenarios/qa-<version>-*.e2e.mjs`. It never edits existing files, so its work cannot clash with the
   builder's. A test that fails shows a real bug — it reports it, it does not fix the product.
5. **The builder decides.** Every finding is sorted into: fix in this version / later version / question for the
   owner (product decisions stay his). The builder makes all fixes, brings in the QA tests that are useful, runs every
   check again, then releases.
6. **Reports are kept** in `docs/reviews/agents/<version>-<role>.md` (findings with ID, severity, evidence, and what
   was done), so the owner and a future team can see them. No personal data in reports (privacy check).
7. **Small patch versions** (a fix or two) skip the helpers unless the change touches data, Git or merging.

## One theme version, step by step

| Step | Who | What |
| --- | --- | --- |
| 1 | builder | build the version; unit tests, all e2e scenarios, privacy check green; commit (= frozen) |
| 2 | code reviewer · QA tester · UI/UX reviewer, in parallel | review the frozen commit; QA adds tests on its branch; each writes its report |
| 3 | builder | sort findings; ask the owner about product questions (short list, recommendation first) |
| 4 | builder | fix, take in QA tests, run everything again; save reports with outcomes |
| 5 | builder + CI | release; the acceptance run tests the installed app; checklist for the owner |

## What each helper is asked to do

- **Code reviewer** — reads the version's changes (diff against the previous release) cold: bugs, data-loss risks
  (NFR-05), broken project rules (theme tokens, texts in both languages, module boundaries, window-call validation,
  workspace queue), security, missing tests. Output: findings with file/line, severity, suggested fix.
- **QA tester** — tries to break the version's new features: edge cases, odd or large data (10,000 items), Arabic and
  right-to-left, Light/Dark, interrupted actions, Git situations (conflicts, no remote, many branches). Writes new
  automatic tests for what it finds and reports which fail.
- **UI/UX reviewer** — uses `docs/guides/ui-review-prompt.md` on the screenshots the e2e scenarios made for the frozen
  commit; focuses on the screens the version changed.

## Cost

Each helper run uses its own share of the usage allowance — roughly as much as a long reply each. That is why they run
once per theme version, not on every small change.

## Fourth helper: brand / logo designer (owner, 4 Nov 2026)

For the rename version and whenever the logo, icon or motion change, a **brand helper** reviews how they sit in the
app: sizes and clear space, light and dark, Arabic (never mirrored), small-size legibility, motion and reduced motion,
installer and taskbar icon. It follows the brand package's rules (`resources/brand/README.md`), works on screenshots of
the frozen commit like the UI/UX reviewer, may draw proposals in its own scratch folder, and writes
`docs/reviews/agents/<version>-brand.md`. It never edits product files; adopted proposals are applied by the builder
(a changed logo drawing comes back to the owner first).
