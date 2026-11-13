# Review pack — whole-project

Commit `752a435` (whole project). Made by `tools/review-pack.mjs`.

## Helpers this pack needs

- arabic-reviewer
- brand-reviewer
- code-reviewer
- performance-tester
- qa-tester
- security-reviewer
- ui-ux-reviewer

## Changed areas

### other (41 files)

- `.claude/settings.json`
- `.claude/skills/owner-decision-walkthrough/SKILL.md`
- `.claude/skills/release-to-owner/SKILL.md`
- `.claude/skills/whole-project-review/SKILL.md`
- `.gitattributes`
- `.gitignore`
- `config/default-schema.yaml`
- `config/theme.json`
- `electron.vite.config.mts`
- `eslint.config.mjs`
- `package-lock.json`
- `samples/sample-requirements.xlsx`
- `src/modules/logger/fileLogger.ts`
- `src/modules/logger/index.ts`
- `src/modules/logger/report.ts`
- `src/modules/sample-data/benchmark.ts`
- `src/modules/sample-data/generate.ts`
- `src/modules/sample-data/index.ts`
- `src/modules/self-test/index.ts`
- `src/modules/theme/defaults.ts`
- `src/modules/theme/fileTheme.ts`
- `src/modules/theme/index.ts`
- `src/shared/api.ts`
- `src/shared/domain.ts`
- `src/shared/features.ts`
- `src/shared/guide.ts`
- `tools/README.md`
- `tools/brand-icons.mjs`
- `tools/check-deps.mjs`
- `tools/check-privacy.mjs`
- `tools/ci.mjs`
- `tools/confirm-sandbox-links.mts`
- `tools/convert-sandbox-0.9.mts`
- `tools/diagrams.mjs`
- `tools/generate-scenario-repo.mts`
- `tools/generate-test-repo.mts`
- `tools/make_sample_xlsx.py`
- `tsconfig.json`
- `tsconfig.node.json`
- `tsconfig.web.json`
- `vitest.config.mts`

### build, CI, installer, updater (10 files → code-reviewer, security-reviewer)

Rules: no secrets in files; no push on pull requests; privacy check: no personal data in files.

- `.github/dependabot.yml`
- `.github/workflows/build.yml`
- `.github/workflows/release.yml`
- `build/installer.nsh`
- `e2e/acceptance.mjs`
- `electron-builder.yml`
- `package.json`
- `src/modules/updater/githubUpdater.ts`
- `src/modules/updater/index.ts`
- `src/modules/updater/versions.ts`

### docs (54 files → code-reviewer)

Rules: docs match the code (the code reviewer checks the changed areas' docs).

- `CHANGELOG.md`
- `CLAUDE.md`
- `README.md`
- `docs/AGENT-WORKFLOW.md`
- `docs/ARCHITECTURE.md`
- `docs/DEVELOPING.md`
- `docs/HANDOVER.md`
- `docs/ONBOARDING.md`
- `docs/PITFALLS.md`
- `docs/README.md`
- `docs/TESTING.md`
- `docs/THEMING.md`
- `docs/USER-GUIDE.md`
- `docs/design/DESIGN.md`
- `docs/design/analysis.md`
- `docs/design/decisions.md`
- `docs/design/requirements.md`
- `docs/design/roadmap.md`
- `docs/diagrams/README.md`
- `docs/diagrams/archify/architecture.json`
- `docs/diagrams/archify/pull-flow.json`
- `docs/diagrams/archify/save-flow.json`
- `docs/diagrams/architecture.html`
- `docs/diagrams/index.html`
- `docs/diagrams/pull-flow.html`
- `docs/diagrams/save-flow.html`
- `docs/guides/ui-review-prompt.md`
- `docs/guides/word-template-prompt.md`
- `docs/images/architecture.png`
- `docs/images/pull-flow.png`
- `docs/images/save-flow.png`
- `docs/reviews/2026-10-31-feature-catalogue.md`
- `docs/reviews/done/2026-10-31-rm-tools-market-list.md`
- `docs/reviews/2026-11-01-planning-discussion.md`
- `docs/reviews/done/2026-11-02-requiem-analysis.md`
- `docs/reviews/done/2026-11-04-next-round.md`
- `docs/reviews/2026-11-04-public-release-repo.md`
- `docs/reviews/README.md`
- `docs/reviews/agents/0.14.5-ui-ux.md`
- `docs/reviews/agents/0.15.0-code-review.md`
- `docs/reviews/agents/0.15.0-qa.md`
- `docs/reviews/agents/0.15.0-ui-ux.md`
- `docs/reviews/agents/0.16.0-brand.md`
- `docs/reviews/agents/0.16.0-code-review.md`
- `docs/reviews/agents/0.16.0-qa.md`
- `docs/reviews/agents/0.16.0-ui-ux.md`
- `docs/reviews/agents/README.md`
- `docs/reviews/done/2026-10-25-project-review.md`
- `docs/reviews/done/2026-10-31-feature-gap-analysis.md`
- `docs/reviews/done/2026-10-31-rename-impact.md`
- `docs/reviews/done/2026-10-31-rust-evaluation.md`
- `docs/reviews/done/2026-11-03-security-check.md`
- `docs/reviews/done/2026-11-04-rename-reqochet.md`
- `docs/testing/past-checklists.md`

### tests (83 files)

- `e2e/harness.mjs`
- `e2e/measure-tree.e2e.mjs`
- `e2e/run.mjs`
- `e2e/scenarios/branches.e2e.mjs`
- `e2e/scenarios/excel.e2e.mjs`
- `e2e/scenarios/fixes.e2e.mjs`
- `e2e/scenarios/health.e2e.mjs`
- `e2e/scenarios/journey.e2e.mjs`
- `e2e/scenarios/language.e2e.mjs`
- `e2e/scenarios/qa-0.15.0-polish.e2e.mjs`
- `e2e/scenarios/qa-0.16.0-rename.e2e.mjs`
- `tests/apply-theme.test.ts`
- `tests/changes-0.10.test.ts`
- `tests/compare.test.ts`
- `tests/excel-0.11.test.ts`
- `tests/fixes-0.11.1.test.ts`
- `tests/fixes-0.16.1.test.ts`
- `tests/fixtures/reqif-schema/README.md`
- `tests/fixtures/reqif-schema/driver.xsd`
- `tests/fixtures/reqif-schema/reqif.xsd`
- `tests/fixtures/reqif-schema/xhtml-attribs-1.xsd`
- `tests/fixtures/reqif-schema/xhtml-blkphras-1.xsd`
- `tests/fixtures/reqif-schema/xhtml-blkpres-1.xsd`
- `tests/fixtures/reqif-schema/xhtml-blkstruct-1.xsd`
- `tests/fixtures/reqif-schema/xhtml-charent-1.xsd`
- `tests/fixtures/reqif-schema/xhtml-datatypes-1.xsd`
- `tests/fixtures/reqif-schema/xhtml-edit-1.xsd`
- `tests/fixtures/reqif-schema/xhtml-framework-1.xsd`
- `tests/fixtures/reqif-schema/xhtml-hypertext-1.xsd`
- `tests/fixtures/reqif-schema/xhtml-inlphras-1.xsd`
- `tests/fixtures/reqif-schema/xhtml-inlpres-1.xsd`
- `tests/fixtures/reqif-schema/xhtml-inlstruct-1.xsd`
- `tests/fixtures/reqif-schema/xhtml-inlstyle-1.xsd`
- `tests/fixtures/reqif-schema/xhtml-list-1.xsd`
- `tests/fixtures/reqif-schema/xhtml-notations-1.xsd`
- `tests/fixtures/reqif-schema/xhtml-object-1.xsd`
- `tests/fixtures/reqif-schema/xhtml-param-1.xsd`
- `tests/fixtures/reqif-schema/xhtml-pres-1.xsd`
- `tests/fixtures/reqif-schema/xhtml-table-1.xsd`
- `tests/fixtures/reqif-schema/xhtml-text-1.xsd`
- `tests/fixtures/reqif-schema/xml.xsd`
- `tests/format-0.9.test.ts`
- `tests/git-adapter.test.ts`
- `tests/git-messages-0.15.2.test.ts`
- `tests/guide-0.14.2.test.ts`
- `tests/health-0.14.test.ts`
- `tests/import-export.test.ts`
- `tests/import-plan.test.ts`
- `tests/index-cache.test.ts`
- `tests/items.test.ts`
- `tests/language.test.ts`
- `tests/legacy-data-0.16.test.ts`
- `tests/logger.test.ts`
- `tests/merge-0.12.test.ts`
- `tests/order-key.test.ts`
- `tests/perf.test.ts`
- `tests/pure-logic.test.ts`
- `tests/qa-0.15.0-core.test.ts`
- `tests/qa-0.16.0-legacy-data.test.ts`
- `tests/qa-0.16.0-project-folder.test.ts`
- `tests/qa-0.16.0-rename-core.test.ts`
- `tests/rename-0.16.test.ts`
- `tests/repository-store.test.ts`
- `tests/reqif.test.ts`
- `tests/review-fixes.test.ts`
- `tests/sandbox-expectations.test.ts`
- `tests/schema.test.ts`
- `tests/self-test.test.ts`
- `tests/theme-contrast-0.15.test.ts`
- `tests/theme-tokens.test.ts`
- `tests/theme.test.ts`
- `tests/ui-polish-0.15.test.ts`
- `tests/ui-texts.test.ts`
- `tests/ui/fixes-0.16.1.test.ts`
- `tests/ui/merge-window.test.ts`
- `tests/ui/qa-0.15.0-renderer.test.ts`
- `tests/ui/qa-0.16.0-brand.test.ts`
- `tests/ui/text-diff.test.ts`
- `tests/ui/ui-logic.test.ts`
- `tests/ui/ui-polish-0.15.test.ts`
- `tests/versions-0.14.1.test.ts`
- `tests/workspace-git.test.ts`
- `tests/workspace.test.ts`

### brand (48 files → brand-reviewer)

Rules: resources/brand/README.md rules; never mirrored in Arabic; small cut below 32 px.

- `resources/brand/README.md`
- `resources/brand/brand-sheet.png`
- `resources/brand/brand-tokens.json`
- `resources/brand/icon/png/reqochet-icon-128.png`
- `resources/brand/icon/png/reqochet-icon-16.png`
- `resources/brand/icon/png/reqochet-icon-20.png`
- `resources/brand/icon/png/reqochet-icon-24.png`
- `resources/brand/icon/png/reqochet-icon-256.png`
- `resources/brand/icon/png/reqochet-icon-32.png`
- `resources/brand/icon/png/reqochet-icon-40.png`
- `resources/brand/icon/png/reqochet-icon-48.png`
- `resources/brand/icon/png/reqochet-icon-512.png`
- `resources/brand/icon/png/reqochet-icon-64.png`
- `resources/brand/icon/png/reqochet-icon-96.png`
- `resources/brand/icon/png/reqochet-icon-light-128.png`
- `resources/brand/icon/png/reqochet-icon-light-16.png`
- `resources/brand/icon/png/reqochet-icon-light-20.png`
- `resources/brand/icon/png/reqochet-icon-light-24.png`
- `resources/brand/icon/png/reqochet-icon-light-256.png`
- `resources/brand/icon/png/reqochet-icon-light-32.png`
- `resources/brand/icon/png/reqochet-icon-light-40.png`
- `resources/brand/icon/png/reqochet-icon-light-48.png`
- `resources/brand/icon/png/reqochet-icon-light-512.png`
- `resources/brand/icon/png/reqochet-icon-light-64.png`
- `resources/brand/icon/png/reqochet-icon-light-96.png`
- `resources/brand/icon/reqochet-icon-light-small.svg`
- `resources/brand/icon/reqochet-icon-light.svg`
- `resources/brand/icon/reqochet-icon-small.svg`
- `resources/brand/icon/reqochet-icon.svg`
- `resources/brand/icon/reqochet-light.ico`
- `resources/brand/icon/reqochet.ico`
- `resources/brand/logo/reqochet-logo-on-dark-2000.png`
- `resources/brand/logo/reqochet-logo-on-dark.svg`
- `resources/brand/logo/reqochet-logo-on-light-2000.png`
- `resources/brand/logo/reqochet-logo-on-light.svg`
- `resources/brand/motion/reqochet-eyes-idle-inline.svg`
- `resources/brand/motion/reqochet-eyes-idle-light-small.svg`
- `resources/brand/motion/reqochet-eyes-idle-light.svg`
- `resources/brand/motion/reqochet-eyes-idle-small.svg`
- `resources/brand/motion/reqochet-eyes-idle.svg`
- `resources/brand/motion/reqochet-eyes-thinking-inline.svg`
- `resources/brand/motion/reqochet-eyes-thinking-light-small.svg`
- `resources/brand/motion/reqochet-eyes-thinking-light.svg`
- `resources/brand/motion/reqochet-eyes-thinking-small.svg`
- `resources/brand/motion/reqochet-eyes-thinking.svg`
- `resources/brand/motion/reqochet-loading-icon.svg`
- `resources/brand/motion/reqochet-loading-on-dark.svg`
- `resources/brand/motion/reqochet-loading-on-light.svg`

### main process and window calls (8 files → code-reviewer, security-reviewer)

Rules: every window call: ReqochetApi method + Channels entry + ipc.ts handler validating with validate.ts; composition.ts is the only wiring place.

- `src/main/composition.ts`
- `src/main/importFiles.ts`
- `src/main/index.ts`
- `src/main/ipc.ts`
- `src/main/legacyData.ts`
- `src/main/validate.ts`
- `src/preload/index.d.ts`
- `src/preload/index.ts`

### data and Git core (35 files → code-reviewer, qa-tester, security-reviewer)

Rules: NFR-05 never lose data (validate, atomic writes, ConflictError, keep unknown keys, never force-push); writes and Git actions only through the workspace queue q(); never one queued call inside another; order keys compared byte-wise, never localeCompare; SQLite index changed → bump FORMAT_VERSION.

- `src/modules/git-adapter/index.ts`
- `src/modules/git-adapter/systemGit.ts`
- `src/modules/index-cache/index.ts`
- `src/modules/index-cache/sqliteIndex.ts`
- `src/modules/items/diff.ts`
- `src/modules/items/fingerprint.ts`
- `src/modules/items/ids.ts`
- `src/modules/items/index.ts`
- `src/modules/items/itemFile.ts`
- `src/modules/items/merge.ts`
- `src/modules/items/orderKey.ts`
- `src/modules/items/validate.ts`
- `src/modules/repository-store/checks.ts`
- `src/modules/repository-store/errors.ts`
- `src/modules/repository-store/fileStore.ts`
- `src/modules/repository-store/index.ts`
- `src/modules/safe-files/index.ts`
- `src/modules/schema/index.ts`
- `src/modules/schema/parse.ts`
- `src/modules/workspace/compare.ts`
- `src/modules/workspace/context.ts`
- `src/modules/workspace/exporting.ts`
- `src/modules/workspace/gitOps.ts`
- `src/modules/workspace/importing.ts`
- `src/modules/workspace/index.ts`
- `src/modules/workspace/itemOps.ts`
- `src/modules/workspace/links.ts`
- `src/modules/workspace/merging.ts`
- `src/modules/workspace/queue.ts`
- `src/modules/workspace/recent.ts`
- `src/modules/workspace/revert.ts`
- `src/modules/workspace/schemaFields.ts`
- `src/modules/workspace/structure.ts`
- `src/modules/workspace/watcher.ts`
- `src/modules/workspace/workspace.ts`

### import / export (7 files → code-reviewer, qa-tester, security-reviewer)

Rules: ReqIF valid against the official schema (tests/reqif.test.ts); old reqman.* names still import.

- `src/modules/import-export/compare.ts`
- `src/modules/import-export/csv.ts`
- `src/modules/import-export/importPlan.ts`
- `src/modules/import-export/index.ts`
- `src/modules/import-export/items.ts`
- `src/modules/import-export/reqif.ts`
- `src/modules/import-export/xlsx.ts`

### screens (62 files → code-reviewer, ui-ux-reviewer, qa-tester)

Rules: no hex/rgb in renderer code — theme tokens --rm-* only; every word from src/shared/text.ts (and text-ar.ts); no text in module-level constants; CSS logical properties only (right-to-left); renderer uses only window.reqochet and shared/domain types.

- `src/renderer/index.html`
- `src/renderer/src/app/App.tsx`
- `src/renderer/src/components/Brand.tsx`
- `src/renderer/src/components/DiagnosticsCard.tsx`
- `src/renderer/src/components/EnvironmentCard.tsx`
- `src/renderer/src/components/ErrorBoundary.tsx`
- `src/renderer/src/components/FeaturesCard.tsx`
- `src/renderer/src/components/LanguageToggle.tsx`
- `src/renderer/src/components/ProblemReportCard.tsx`
- `src/renderer/src/components/ReleaseSelfTestCard.tsx`
- `src/renderer/src/components/SelfTestCard.tsx`
- `src/renderer/src/components/StatusRow.tsx`
- `src/renderer/src/components/ThemeToggle.tsx`
- `src/renderer/src/components/UpdateBanner.tsx`
- `src/renderer/src/components/VersionsCard.tsx`
- `src/renderer/src/env.d.ts`
- `src/renderer/src/lib/activity.ts`
- `src/renderer/src/lib/features.ts`
- `src/renderer/src/lib/guide.ts`
- `src/renderer/src/lib/hooks.ts`
- `src/renderer/src/lib/language.ts`
- `src/renderer/src/lib/markdown.ts`
- `src/renderer/src/lib/schema.ts`
- `src/renderer/src/lib/sessionState.ts`
- `src/renderer/src/lib/shortcuts.ts`
- `src/renderer/src/lib/statusbar.ts`
- `src/renderer/src/lib/textDiff.ts`
- `src/renderer/src/main.tsx`
- `src/renderer/src/screens/SettingsScreen.tsx`
- `src/renderer/src/screens/StartScreen.tsx`
- `src/renderer/src/screens/WorkspaceScreen.tsx`
- `src/renderer/src/styles.css`
- `src/renderer/src/theme/applyTheme.ts`
- `src/renderer/src/theme/tokens.ts`
- `src/renderer/src/workspace/BranchMenu.tsx`
- `src/renderer/src/workspace/ChangeView.tsx`
- `src/renderer/src/workspace/ChangesView.tsx`
- `src/renderer/src/workspace/ExportDialog.tsx`
- `src/renderer/src/workspace/FieldsPanel.tsx`
- `src/renderer/src/workspace/GitPanels.tsx`
- `src/renderer/src/workspace/HistoryView.tsx`
- `src/renderer/src/workspace/ImportDialog.tsx`
- `src/renderer/src/workspace/ItemEditor.tsx`
- `src/renderer/src/workspace/ItemSearch.tsx`
- `src/renderer/src/workspace/ItemTable.tsx`
- `src/renderer/src/workspace/LinksSection.tsx`
- `src/renderer/src/workspace/MergeDialog.tsx`
- `src/renderer/src/workspace/ParentPicker.tsx`
- `src/renderer/src/workspace/RowMenu.tsx`
- `src/renderer/src/workspace/SuspectLinksDialog.tsx`
- `src/renderer/src/workspace/compareRange.ts`
- `src/renderer/src/workspace/mergeAnswers.ts`
- `src/renderer/src/workspace/screen/EditorSplitter.tsx`
- `src/renderer/src/workspace/screen/Problems.tsx`
- `src/renderer/src/workspace/screen/Toolbar.tsx`
- `src/renderer/src/workspace/screen/problemList.ts`
- `src/renderer/src/workspace/screen/useChanges.ts`
- `src/renderer/src/workspace/screen/useFilters.ts`
- `src/renderer/src/workspace/screen/useGit.ts`
- `src/renderer/src/workspace/table/columns.ts`
- `src/renderer/src/workspace/table/drag.ts`
- `src/renderer/src/workspace/table/rows.ts`

### texts (2 files → arabic-reviewer)

Rules: every key in both languages; right-to-left mark on Arabic texts; glossary: docs/guides/arabic-glossary.md.

- `src/shared/text-ar.ts`
- `src/shared/text.ts`

## Screenshots (e2e/out, from `npm run build && xvfb-run -a npm run test:e2e` on this commit)

- `e2e/out/01-empty-repo.png`
- `e2e/out/02-hierarchy.png`
- `e2e/out/03-moved-subgroup.png`
- `e2e/out/04-table-and-editor.png`
- `e2e/out/05-fields-dialog.png`
- `e2e/out/06-unsaved-guard.png`
- `e2e/out/07-dark.png`
- `e2e/out/08-settings-wide.png`
- `e2e/out/09-suspect-link.png`
- `e2e/out/09a-check-links.png`
- `e2e/out/10-changes-view.png`
- `e2e/out/10b-split-difference.png`
- `e2e/out/11-history.png`
- `e2e/out/12-pull-decision.png`
- `e2e/out/13-compare.png`
- `e2e/out/14-export.png`
- `e2e/out/E2E health-failure.png`
- `e2e/out/E2E journey-failure.png`
- `e2e/out/branches-1-panel.png`
- `e2e/out/branches-2-review.png`
- `e2e/out/branches-3-ask.png`
- `e2e/out/branches-4-many.png`
- `e2e/out/excel-1-columns.png`
- `e2e/out/excel-2-check.png`
- `e2e/out/fixes-changes-view.png`
- `e2e/out/fixes-compare-then-changes.png`
- `e2e/out/fixes-expanded.png`
- `e2e/out/fixes-release-self-test.png`
- `e2e/out/health-0-note-dark.png`
- `e2e/out/health-0-note-light.png`
- `e2e/out/health-1-settings.png`
- `e2e/out/health-2-report.png`
- `e2e/out/health-3-guide.png`
- `e2e/out/health-4-env.png`
- `e2e/out/language-1-arabic.png`
- `e2e/out/qa-0.15.0-preview.png`
- `e2e/out/qa-0.16.0-after-update.png`
- `e2e/out/qa-0.16.0-legacy-notice.png`

## How to look at the changes

- read the files of your area; `git log --oneline -30` for recent history
- project rules in full: CLAUDE.md "Non-negotiable rules"; pitfalls per area: docs/PITFALLS.md
