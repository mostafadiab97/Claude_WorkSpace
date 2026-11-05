# reqochet (formerly ReqMan) — project memory for Claude

reqochet (called ReqMan until 0.15) is a small, serverless requirements-management desktop app (Windows 11 first). This
repository builds the **development tool reqochet-dev**; a release repository will build plain **reqochet** (owner, 4 Nov 2026). Requirements are plain
files in a `requirements/` folder of a project's own Git repository; reqochet is the GUI that understands them
(table, hierarchy, links, suspect links) and, from M4 on, does the Git work at requirement level.
Internal proof of concept first; likely a commercial product later.

**Claude writes all of the code, tests and docs.** The product owner decides the product, installs every
release on his Windows 11 PC and reports back. A team may take the code over later, so it must stay conventional,
tested and documented (NFR-10).

This file is the project memory and hand-over note: whoever continues (a cloud session, Claude Code in VS Code on
the owner's PC, or a future team) reads it fully first, then the documents it points to when a task touches them.
**Keep it current with every release** (status, next step, decisions, pitfalls).

Where development happens: in a cloud session; a local Windows setup is described in `docs/DEVELOPING.md`.
Nothing lives outside this repository and `Claude_SandBox`.

## Where everything is

Map of all documents: **`docs/README.md`**. Starting a new chat or handing over: **`docs/HANDOVER.md`**.

| What | Where |
| --- | --- |
| Decisions (source of truth): product questions + answers, technical design, per-milestone decisions, the owner's small preferences | `docs/design/decisions.md` |
| Product definition, FR/NFR, scope | `docs/design/requirements.md` |
| What has been built, where each requirement stands, release plan | `docs/design/roadmap.md` |
| The 5-tool domain study (frozen) | `docs/design/analysis.md` |
| **Planning discussion in progress** (open points P-xx with answers) and other analyses | `docs/reviews/` (index: its README); finished reviews in `docs/reviews/done/` |
| Module map, rules, data format, UI structure | `docs/ARCHITECTURE.md` |
| Onboarding for engineers (diagrams, first change end to end) | `docs/ONBOARDING.md`, diagrams in `docs/diagrams/` |
| Pitfalls already hit — read before changing an area | `docs/PITFALLS.md` |
| **Helper agents (code reviewer, QA tester, UI/UX reviewer) and how conflicts are avoided** | `docs/AGENT-WORKFLOW.md` |
| The owner's current checklist, log/data locations, bug reporting | `docs/TESTING.md` (older checklists: `docs/testing/past-checklists.md`) |
| What changed per version + the owner's reports | `CHANGELOG.md` |
| Theme · local setup · scripts and skills | `docs/THEMING.md` · `docs/DEVELOPING.md` · `tools/README.md` (skills in `.claude/skills/`: `release-to-owner` for every release, `owner-decision-walkthrough` for every question round, `whole-project-review`) |
| Test data (10,005 fictional items) | GitHub `<owner>/Claude_SandBox` — clone **next to** this repo |
| Releases (installers + auto-update feed) | GitHub Releases of `<owner>/Claude_WorkSpace` |

## How to work with the owner

- He tests each **release**, not branches: every change he should try ends with a version bump, a green CI release
  and a short checklist in `docs/TESTING.md` ("Manual test checklist — vX.Y.Z", numbered steps, expected results;
  move the previous one down as "Previous checklist"; only the current and the previous one stay — older ones go
  to `docs/testing/past-checklists.md`). He refers to checklist step numbers in feedback
  ("test 6 failed").
- Explain in plain language, short. He asks "explain this further" when he wants depth. No jargon without a
  one-line explanation.
- Product decisions are his (ask, with a recommended option first). Technical decisions are yours ("I leave the
  final decision to you"); explain them briefly. Facts / inferences / recommendations are kept distinct.
- When he reports a bug: reproduce it in a test first, fix, explain the cause in one or two sentences, release.
- Bundle small fixes he asks for into the next milestone release when he says so ("add this fix in the same
  version as M3").
- **No personal data in this repository's files** (owner, 3 Nov 2026): never write the owner's name, account name,
  user name or e-mail into any file — say "the owner"; `<owner>/Claude_SandBox` in docs; the privacy check fails the
  build otherwise. A public release repository will later start from the files without history.
- **Helper agents (owner, 3 Nov 2026):** for every theme version, after building and before releasing, run the code
  reviewer, QA tester and UI/UX reviewer on the frozen commit — rules in `docs/AGENT-WORKFLOW.md` (one writer; QA adds
  new test files only, in its own worktree; reports in `docs/reviews/agents/`).
- He asked to be asked before steps that affect his accounts/repos (e.g. repository visibility). Never change
  repo visibility, delete releases, rewrite history or force-push.
- Only free, open-source dependencies whose licences allow commercial use (NFR-07). No paid services.

## Non-negotiable rules (from the design; enforced by lint/tests where possible)

- **NFR-11 theme:** every colour, font, size, radius, spacing comes from `config/theme.json` via CSS variables
  `--rm-*`. No hex/rgb in renderer code (a test fails on it). User overrides live in `%APPDATA%\reqochet-dev\theme.json`.
- **NFR-12 modules:** each `src/modules/<name>/index.ts` is that module's only public entry (ESLint blocks deep
  imports); `src/main/composition.ts` is the single place that wires implementations. The renderer may use only
  `window.reqochet` (contract in `src/shared/api.ts`) and types from `src/shared/domain.ts` — no Node/Electron.
- **NFR-05 never lose data:** validate before writing; atomic writes; every write is conflict-checked against the
  file revision it was read at (`ConflictError`); unknown header keys are preserved (`extra`); never force-push.
- Offline first; no server; no user accounts — access = Git host permissions.
- Data format: one Markdown file per item, `requirements/items/<ID>.md`, YAML header in fixed key order, links
  stored only on the source item, each with `confirmed:` (target fingerprint). Schema in
  `requirements/.reqochet/schema.yaml` (projects made with ReqMan: `.reqman`, read until the user takes the rename). IDs `REQ-XXXXXXX` (7 random Crockford base32, every type; older `PREFIX-XXXXXX` stay valid). `order:` is an order
  key (`src/modules/items/orderKey.ts`) compared **byte-wise** (`<`), never with `localeCompare`; outline numbers
  are calculated, never stored. Details: ARCHITECTURE.md.
- The SQLite index (`%APPDATA%\reqochet-dev\cache\<sha1(root)>.sqlite`) is only a cache. **If you change its tables,
  bump `FORMAT_VERSION` in `src/modules/index-cache/sqliteIndex.ts`** — the cache is then dropped and rebuilt
  (lesson of v0.4.1, see Pitfalls).
- **Texts (S-06):** every word on screen comes from `src/shared/text.ts` (`T.area.key`, functions for texts with
  values); core messages shown to the user too. `tests/ui-texts.test.ts` fails on literal words in `.tsx`.
  **Arabic (0.13.0):** every key also in `src/shared/text-ar.ts` (the compiler insists); never store a text in a
  module-level constant (the language switch swaps `T` in place — read it when rendering; memoised lists depend on
  `useLanguage()`); CSS uses logical properties only (the window is right-to-left in Arabic).
- **Window calls:** add a method to `ReqochetApi` + a `Channels` entry + a handler in `src/main/ipc.ts` (the compiler
  insists) that checks its inputs with `src/main/validate.ts`. The preload needs no change.
- **Writes and Git actions go through the workspace queue** (`q(...)` in `workspace.ts`) — never call one queued
  operation from inside another (it would wait for itself).

## Commands

```
npm ci                    # install exactly what package-lock.json says
npm run dev               # run the app with live reload
npm run check             # typecheck (both projects) + ESLint (incl. module rules) + unit tests — must be green
npm run build             # production build into out/ (needed before e2e)
npm run test:e2e          # e2e scenarios (e2e/scenarios/*.e2e.mjs, two at a time) drive the built app; `-- fixes` runs one; screenshots in e2e/out/
npm run test:perf         # 10k data-layer performance test (every build); test:perf:all adds 50k (releases)
npm run measure:ui -- <repo>   # tree-table timings on a big repo (e.g. the sandbox clone)
npm run gen:repo -- <folder> [count]        # uniform generated items (performance)
npm run gen:scenario -- <folder> [count]    # rich scenario data (what Claude_SandBox was made with)
npm run dist:win          # local Windows installer into dist/ (CI does this for releases)
npm run check:deps        # library security problems + updates; also runs before every build; warns only, never blocks
node tools/ci.mjs status  # GitHub runs; wait / failures (annotations) / release (start by hand) / released
node tools/diagrams.mjs   # rebuild the Archify diagrams + navigator index.html in docs/diagrams (Archify cloned next to the repo; --index = navigator only)
```

On Linux CI/containers e2e needs `xvfb-run -a`; on Windows it opens real windows briefly.

## Releasing

1. Bump `version` in `package.json` (semver: milestone = minor, fix = patch).
2. Update `docs/TESTING.md` checklist, `CHANGELOG.md`, README status table if a milestone finished, and the
   progress line and release-plan row in `docs/design/roadmap.md`.
3. `npm run check`, `npm run build`, `npm run test:e2e` locally.
4. Commit and push to `main`. Two workflows run on `windows-latest`:
   - `build.yml` (every push): check, perf tests, build, e2e, installer artifact.
   - `release.yml` (push that changes `package.json` or the workflow, or manual): skips if `v<version>` release
     exists; otherwise check, build, e2e, `electron-builder --publish never`, zips the installer, and
     `gh release create v<version>` with `reqochet-dev-Setup-<v>.exe`, `.blockmap`, `.zip`, `latest.yml`.
5. Installed copies auto-update from that feed (electron-updater, GitHub provider in `electron-builder.yml`).
   The repository **must stay public** for auto-update to work without a token (tested: private → 404).
6. Watch with `node tools/ci.mjs status | wait | failures | release | released` (REST only — works in the cloud
   session where `gh run …`/`gh workflow run` are refused). Tell the owner the version and the checklist location
   when it is green.

Commit messages: imperative summary with version, blank line, bullet details. End with
`Co-Authored-By: Claude <noreply@anthropic.com>`.

## Status (v0.16.3, 5 Nov 2026) — prototype complete; Changes view; Excel + ReqIF; branches; health tools + acceptance run

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
| **Next** | Owner's 0.16.3 checklist; **0.16.4** (PQ-01/02, CR2-04, AR-01…05/11 with child = "عنصر فرعي", CR1-08 core messages in Arabic, UX-W01/02/03/05 with the counter counting items, keyboard access for every action, "Coming from DOORS or Jama?" guide page, choose parent/level for a new item, docs that no longer match, quick Lows); then 1a; the four open questions of the public release repository (`docs/reviews/2026-11-04-public-release-repo.md`; its package name must be `reqochet`, appId `com.reqochet.app`); then 1a structure (plan in `docs/reviews/2026-11-01-planning-discussion.md`) | — |

The owner's last report (31 Oct 2026): **0.13.1 all 4 steps passed**, 21/21 (66.8 s) — nothing open.
Before: 0.13.0 all 5 passed, 21/21 (63.6 s); three small points → 0.13.1.
Before: 0.12.1 steps 1–3, 5 passed, 21/21 (50.7 s); step 4 (pull from a branch
committed at once) and three requests → 0.13.0. Before: **0.12.0 all 5 steps passed** — that was the two-folder trial (two clones of the
sandbox, `Claude_SandBox` and `Claude_SandBox_B`, still on his PC) — self-test 21/21 in 44.6 s, Git 2.52.0. His four
points on the branch panel went into 0.12.1. He has no DOORS/Jama to try ReqIF: exports are validated against the
official schema in `tests/reqif.test.ts` (`tests/fixtures/reqif-schema/`, xmllint-wasm).

Automated tests: 441 unit tests (with a coverage floor) + 9 e2e scenarios (`journey`, `fixes`, `excel`, `branches`,
`language`, `health`, `qa-0.15.0-polish`, `qa-0.16.0-rename`, `fixes-0.16.3`) + the 22-step in-app release self-test + the CI acceptance run on the installed app; what each covers and every speed measurement: `docs/TESTING.md` → "Automated
checks in detail".

## Where we are right now (2 Nov 2026) — read this first

- **Built and accepted by the owner:** everything up to **0.13.1**. **0.14.0 released 2 Nov** (health tools +
  acceptance run; its first acceptance run passed: update 0.13.1 → 0.14.0, self-test, 10,005-item sandbox, real push
  to `ci/acceptance-*` and delete) — **0.14.1 released 3 Nov** (user guide, go back to an earlier version, security check, calmer notes) —
  the owner's report 3 Nov: 0.14.0/0.14.1 passed with small points → **0.14.2 released 3 Nov** (Settings and help with the
  guide inside, privacy guard, sandbox history cleaned) — 0.14.2: steps 1, 3, 4 passed; step 2 → **0.14.3** (pages) —
  0.14.3 passed → **0.14.4 released 3 Nov** (no personal data in files; Check for updates on the Updates line; blue Back)
  — 0.14.4 passed with two touches → **0.14.5 released 3 Nov** — 0.14.5 released; **0.15.0 (UI polish) released 4 Nov** — his report 4 Nov: steps 2, 5 passed, points on 1, 3, 4 → **0.15.1 released 4 Nov** — all passed with three touches → **0.15.2 released 4 Nov** — all passed → **0.16.0 (rename to reqochet-dev) released 4 Nov** — steps 1, 2, 5 passed, points on 3, 4 → **0.16.1 released 4 Nov** — all 5 passed; icon redraw asked → **0.16.2 released 4 Nov** — all 3 passed → whole-project review 5 Nov → **0.16.3 released 5 Nov** — waiting for his 0.16.3 checklist (5 steps). **Question round open:** `docs/reviews/2026-11-04-next-round.md` (1a structure S-01…S-07, whole-project review V-01/V-02, more helper agents, cheaper helper runs W-01/W-02). History question settled: not rewritten; a public release repository
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

## Pitfalls

`docs/PITFALLS.md` lists every mistake that already cost time (cache upgrades, byte-wise order keys, e2e label matching,
language switch, Windows runner quirks, cloud-session limits…). **Read the entries for the area you change.**
