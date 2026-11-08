# Status and history (moved out of CLAUDE.md, 8 Nov 2026)

CLAUDE.md is read at the start of every session and again after every context compaction; keeping the long status
history there cost thousands of tokens each time (the owner asked to save tokens, 8 Nov 2026). **This file is the
status**: update it with every release (the version table, "Next", the owner's last report, test counts).

## Status (v0.17.2, 8 Nov 2026) — prototype complete; Changes view; Excel + ReqIF; branches; health tools + acceptance run

Every version, what it brought and what the owner reported: `CHANGELOG.md`; the full list of milestones and the
plan: `docs/design/roadmap.md`. Latest:

| Milestone | State |
| --- | --- |
| 0.12.0 M8 branches — create/switch (commit / take along / discard), pull and "pull from branch" with field-level 3-way merge + decision window (S-05), compare a branch like a PR, duplicate-ID repair (D-09), D-05; tag baselines delayed | Done (v0.12.0) |
| 0.12.1 the owner's points on 0.12.0 — branch drop-down under the button, click a name to switch, Pull from… / Compare with… on the current branch, search + scrolling for tens of branches | Done (v0.12.1) |
| 0.13.0 the owner's points on 0.12.1 — pull from another branch = uncommitted changes for review, delete branch, Git controls in the top bar + one-row toolbar (Filters pop-up), **Arabic / English with right-to-left** | Done (v0.13.0) |
| 0.13.1 the owner's points on 0.13.0 — floating note tinted green/red/blue with frame and glow, centred text; red Delete button per branch; right-to-left mark on every Arabic text (word order in tooltips/dialogs) | Done (v0.13.1) |
| 0.14.0 health (P-40/P-41) — feature switches (Settings → Features; team `features:` in schema.yaml; `src/shared/features.ts`, `renderer/lib/features.ts`), Report a problem (one text file), coverage floor (`vitest.config.mts` thresholds, part of `npm run check`), **automatic acceptance run** (`e2e/acceptance.mjs` in build.yml + release.yml: install previous → update from local feed → self-test → 10k sandbox → real push to `ci/acceptance-*`, deleted) | Released (v0.14.0) |
| 0.14.1 before the pilot — `docs/USER-GUIDE.md` (quick start + everything); Settings → Versions: go back to an earlier version (`src/modules/updater/versions.ts`, `update-hold.json` pauses updates; `OLDEST_REVERT_TARGET` must be raised at the rename); security check `docs/reviews/done/2026-11-03-security-check.md` (no secrets; navigation guard; no push on PRs); floating notes theme-coloured, blue `neutral` Git results | Released (v0.14.1) |
| 0.14.2 Settings and help — left panel (`SettingsScreen.tsx`), user guide built in (`renderer/lib/guide.ts`, `docs/USER-GUIDE.md?raw`, marked); privacy guard in build.yml (`tools/check-privacy.mjs` + gitleaks, both repos, full history); sandbox history rewritten (work e-mail removed, approved) | Released (v0.14.2) |
| 0.14.3 Settings and help as pages — one page per settings group and per guide section (`src/shared/guide.ts` splits the guide; `renderer/lib/guide.ts` renders it); Back on top of the shaded panel. The owner cannot set a global private Git e-mail (company repos) → per-repository config in the sandbox clones only | Released (v0.14.3) |
| 0.14.4 no personal data in the tool's files — the owner's name → "the owner"; no account name anywhere (workflows use `github.repository_owner`, CI passes `-c.publish.owner/repo`, the app reads `app-update.yml`, `tools/ci.mjs` reads the Git remote); `tools/check-privacy.mjs` checks current files only (names as hashes); Check for updates on the Updates line; blue Back | Released (v0.14.4) |
| 0.14.5 blue Check for updates; folding User guide topics; UI review prompt `docs/guides/ui-review-prompt.md` (the owner may send back a review file to apply) | Released (v0.14.5) |
| 0.15.0 UI polish — every accepted UI/UX finding (`docs/reviews/agents/0.14.5-ui-ux.md`); first version checked by the three helper agents (`docs/reviews/agents/0.15.0-*.md`, QA tests taken in); schema `labels`/`optionLabels` (Arabic names), `src/renderer/src/lib/{markdown,schema,shortcuts,statusbar}.ts`, Git identity per repository (+ global only when empty), Settings → Appearance, guide page 18 Keyboard shortcuts | Released (v0.15.0) |
| 0.15.1 the owner's points on 0.15.0 — self-test state for the whole session (`renderer/lib/sessionState.ts`), Add link stays open when the type list is used (`data-keeps-search`), comparisons name link-review-only files (`CompareResult.reviewedOnly`), sticky Back in Settings | Released (v0.15.1) |
| 0.15.2 the owner's touches on 0.15.1 — self-test steps fold, "Link review only" row in Changes, suspect warning counts only links still waiting for review, Back on its own sticky bar, index preview keeps a leading bold | Released (v0.15.2) |
| 0.16.0 the new name **reqochet** — this repository builds **reqochet-dev** (package/productName, appId `com.reqochet.dev`, `build/installer.nsh` removes ReqMan, `src/main/legacyData.ts` moves `%APPDATA%\\ReqMan`); brand package in `resources/brand` (`components/Brand.tsx`, `lib/activity.ts`); project folder `.reqochet` (reads `.reqman`, "Rename folder" commit); `window.reqochet`/`ReqochetApi`; revert floor 0.16.0; four helper agents incl. brand | Released (v0.16.0) |
| 0.16.1 the owner's points on 0.16.0 — top bar clipped the Push questions (`overflow-x: clip` only), small-cut white-tile eyes (BR-02), lighter eyes on the dark tile (`resources/brand/README.md`), splash ≥ one loop, Fields window warns about stale translations (`staleTranslations`) | Released (v0.16.1) |
| 0.16.2 Windows icon redrawn — brighter eyes + thin outline (`#7a8499`, class `ring`) on every dark-tile drawing; PNG/.ico made by `tools/brand-icons.mjs`; finished reviews moved to `docs/reviews/done/` | Released (v0.16.2) |
| 0.16.3 stabilisation 1 — the whole-project review's data, safety, import/export and screen fixes (`docs/reviews/2026-11-05-project-review.md`); seven helpers saved in `.claude/agents/`, `tools/review-pack.mjs`; QA tests `tests/qa-whole-project-*`; e2e `fixes-0.16.3`; unzipper override (SEC-05) + `@aws-sdk/client-s3` external in electron.vite.config | Released (v0.16.3) |
| 0.16.4 stabilisation 2 — the owner's two points (Text cursor `caretFromClick`, CSV quote rule + `checkCells`), Insert position for new items (`newItem(type, parent, after)`, `structure.orderAfter`), first-run card, Links in words, row menu by keyboard, Changes counts items, focus reload only on changed files, Compare gives way (`YIELD_EVERY`), Arabic fixes (glossary), core texts `T.validate`, guide page 19 DOORS/Jama, e2e `fixes-0.16.4` | Released (v0.16.4) |
| 0.17.0 1a structure part 1 — documents as folders (S-10: `requirements/<document>/`, `DocumentBar.tsx`, `workspace.createDocument/renameDocument`, loose files = document ''), Types window (S-04: `TypesPanel.tsx`, `saveSchemaTypes`, `writeSchemaTypes`, `typeUsage`), required fields + Incomplete (S-05: `ItemTypeDef.required`, `withRequired`), Columns drag and drop (S-11); watcher closed during pull/switch/discard/undo (`paused`); helper reports `docs/reviews/agents/0.17.0-*.md` | Released (v0.17.0) |
| 0.17.1 the owner's 0.17.0 test 2 — renaming the 10,005-item folder failed on Windows (30 s Git limit, folder not put back, ENAMETOOLONG on Discard all): `git.move` (`git mv`), `commitFiles` path list via stdin, `PATHS_PER_COMMAND`/`BULK_TIMEOUT` in `systemGit.ts`, put-back with retries + re-read in `renameDocument`, discard restores a rename's old path, self-test step 23 | Released (v0.17.1) |
| 0.17.2 the owner's points on 0.17.0 — document group rows in All documents (`rows.ts` `GROUP_KEY`, `treeRows(…, groups)`), column header drag (`moveColumn`), Columns menu alignment + Title row, orange Clear filters, Settings → Privacy and access (`T.settings.privacy`, lists in texts), guide pictures (`docs/images/guide/*.svg` inlined by `lib/guide.ts`), diagrams re-checked (`tools/diagrams.mjs` with a temporary spec copy), light .ico + theme-following taskbar icon (`windowIcon()`), status moved here from CLAUDE.md | Released (v0.17.2) |
| **Next** | Owner's 0.17.2 checklist; then **1a part 2** — baselines + history list (S-06/08/09; graph library `commit-graph` to try) — decisions in `docs/reviews/2026-11-04-next-round.md`; the four open questions of the public release repository (`docs/reviews/2026-11-04-public-release-repo.md`); later items from the 0.17.0 reviews (CR-23, CR-29, CR-30) and remaining Lows of the whole-project review | — |

The owner's last report (31 Oct 2026): **0.13.1 all 4 steps passed**, 21/21 (66.8 s) — nothing open.
Before: 0.13.0 all 5 passed, 21/21 (63.6 s); three small points → 0.13.1.
Before: 0.12.1 steps 1–3, 5 passed, 21/21 (50.7 s); step 4 (pull from a branch
committed at once) and three requests → 0.13.0. Before: **0.12.0 all 5 steps passed** — that was the two-folder trial (two clones of the
sandbox, `Claude_SandBox` and `Claude_SandBox_B`, still on his PC) — self-test 21/21 in 44.6 s, Git 2.52.0. His four
points on the branch panel went into 0.12.1. He has no DOORS/Jama to try ReqIF: exports are validated against the
official schema in `tests/reqif.test.ts` (`tests/fixtures/reqif-schema/`, xmllint-wasm).

Automated tests: 529 unit tests (with a coverage floor) + 11 e2e scenarios (`journey`, `fixes`, `excel`, `branches`,
`language`, `health`, `qa-0.15.0-polish`, `qa-0.16.0-rename`, `fixes-0.16.3`, `fixes-0.16.4`, `structure-0.17`) + the 23-step in-app release self-test + the CI acceptance run on the installed app; what each covers and every speed measurement: `docs/TESTING.md` → "Automated
checks in detail".

## Where we are right now (2 Nov 2026) — read this first

- **Built and accepted by the owner:** everything up to **0.13.1**. **0.14.0 released 2 Nov** (health tools +
  acceptance run; its first acceptance run passed: update 0.13.1 → 0.14.0, self-test, 10,005-item sandbox, real push
  to `ci/acceptance-*` and delete) — **0.14.1 released 3 Nov** (user guide, go back to an earlier version, security check, calmer notes) —
  the owner's report 3 Nov: 0.14.0/0.14.1 passed with small points → **0.14.2 released 3 Nov** (Settings and help with the
  guide inside, privacy guard, sandbox history cleaned) — 0.14.2: steps 1, 3, 4 passed; step 2 → **0.14.3** (pages) —
  0.14.3 passed → **0.14.4 released 3 Nov** (no personal data in files; Check for updates on the Updates line; blue Back)
  — 0.14.4 passed with two touches → **0.14.5 released 3 Nov** — 0.14.5 released; **0.15.0 (UI polish) released 4 Nov** — his report 4 Nov: steps 2, 5 passed, points on 1, 3, 4 → **0.15.1 released 4 Nov** — all passed with three touches → **0.15.2 released 4 Nov** — all passed → **0.16.0 (rename to reqochet-dev) released 4 Nov** — steps 1, 2, 5 passed, points on 3, 4 → **0.16.1 released 4 Nov** — all 5 passed; icon redraw asked → **0.16.2 released 4 Nov** — all 3 passed → whole-project review 5 Nov → **0.16.3 released 5 Nov** — steps 1, 3, 4 passed, points on 2 and 5 → **0.16.4 released 7 Nov** — the owner asked to go on without testing → **0.17.0 (1a structure part 1) released 8 Nov** — step 1 passed, step 2 (rename of the big folder) failed → **0.17.1 released 8 Nov** — all passed; 0.17.0 steps 3–5 and 0.16.4 steps 2–5 passed with points → **0.17.2 released 8 Nov** — waiting for his 0.17.2 checklist. **Question round open:** `docs/reviews/2026-11-04-next-round.md` (1a structure S-01…S-07, whole-project review V-01/V-02, more helper agents, cheaper helper runs W-01/W-02). History question settled: not rewritten; a public release repository
  will start from the files without history.
- **Planning discussion in progress** — `docs/reviews/2026-11-01-planning-discussion.md` (method: the
  `owner-decision-walkthrough` skill; record every answer there and, when it changes the product, in
  `docs/design/decisions.md` / `roadmap.md`). Decided so far (1 Nov 2026):
  - P-01 next phase = **a pilot team** (~50 users, embedded devices, ISO 26262 + ASPICE, today DOORS/Jama, Excel
    without licence, one client wants Word; all know Git/GitHub).
  - P-02/P-03 six themes, one per minor version, fixes as patches: **1 traceability you can see** → 2 daily comfort →
    3 documents out → 4 review on GitHub → 5 engineering traceability → 6 later/commercial (details per theme still to
    discuss: themes 2–5).
  - P-04 the **rename gets its own version before the pilot** starts.
  - **Theme 1 version contents:** item and link types editable in the window, required fields, coverage view (rules
    shared in `schema.yaml`), impact chain, traceability matrix (rows/columns by type, current filter, Excel export),
    completeness warnings, **documents** (several specifications in one repository, each with its own tree and
    outline numbers — replaces "one tree per repository"; cross-repository links later with a repository alias before
    the ID), **baselines** (Git tags with note, list, compare with baseline, open read-only).
  - **Theme 2 (2 Nov, P-12…P-16, all as recommended):** bulk edit, duplicate (no links copied), saved views
    (personal + shared), templates with EARS/user-story patterns, wording hints, spell check, restore an older item
    version; external references → theme 5. 
  - **Theme 3 (2 Nov):** Word (company template in the repo; AI prompt `docs/guides/word-template-prompt.md`), PDF,
    Markdown, CSV; document = title page with baseline/commit, contents, items, optional trace table; HTML site +
    JSON → theme 5. Split: **3a rich text** (toolbar editor storing Markdown, tables, images + diagrams as files
    beside the item, equations) → **3b documents out**. 
  - **Theme 4 (2 Nov, P-25…P-29):** github.com, other hosts via a host adapter; browser sign-in; approvals per item;
    PRs created/approved/merged in the app; change requests; comment files in the repo; optional "Approved only via
    merged PR"; review sessions. Split 4a → 4b.
  - **Theme 5 (2 Nov):** 5a verification (code links from a code folder or Doxygen output — code is in other repos;
    JUnit + manual test results; check on demand, locally, chosen branch) → 5b sharing (spec website, JSON, graph,
    external refs); built-in user guide. All AI parts (AI guide, AI export, MCP) → last versions.
    P-38 approval: status of an edited Approved item changes only when pushed; P-39 one-file HTML instead of a
    website; P-40 feature switches + stabilisation patch per theme + coverage floor + report-a-problem.
    **Release plan confirmed 2 Nov** (planning file / roadmap: 0.14 rename+health … 0.24 AI). P-41 **yes**: automated Windows
    acceptance run in CI (install previous → update → self-test → 10k sandbox → real push to `ci/acceptance-*`, deleted
    after → version e2e); every run/report lists numbered what it did. **Next: build 0.14 health parts (feature switches,
    coverage floor, Report a problem) + the acceptance run now; apply the rename when the owner picks the name**
    (considering ShallWe, Plumbline, Keelson).
  - P-11 **no Word import**. Import: Excel, ReqIF, CSV, ReqMan repositories. Export: Excel, ReqIF, CSV, ReqMan
    repositories, Markdown, Word, PDF.
- **3 Nov 2026: the CTO approved a pilot with a complete team** — the rename must ship before the team gets the tool.
- **New name:** the owner is choosing (decision expected 3 Nov). Candidates 3 Nov: reqochet, reqoin, reqornea (his), Reqoncile, Reqonnect, Reqosmos, Reqompass, Reqollect, Reqipe; avoid Reqord (existing tool). Latest candidates (2 Nov): ShallWe (recommended), Plumbline, Keelson; earlier: reqochet (felt long, "misses the target"), Shallmark, Threadwise, Linkwell. Rename plan: `docs/reviews/done/2026-10-31-rename-impact.md` (section 5:
  uninstall old → install new, `.reqman` folder renamed by Git rename, copy the user's settings first).
- **Rust: no migration now** (31 Oct). Feature input: `docs/reviews/2026-10-31-feature-catalogue.md` (163 features),
  market list `docs/reviews/2026-10-31-rm-tools-market-list.md`.

**Testing rule from 0.8.0 (the owner, 28 Oct 2026):** the manual checklist per version has **at most 5 steps** (update
arrives, release self-test, open the sandbox, one real push only when Git changed, the version's new feature).
Everything else must be automated (unit tests, e2e in CI, the in-app release self-test).

