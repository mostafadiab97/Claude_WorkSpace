# reqochet

reqochet (called ReqMan until version 0.15) is a local, Git-based requirements management tool. This repository
builds the development tool **reqochet-dev** — internal proof of concept, likely a commercial product later.

Requirements live as plain-text files (one Markdown file per requirement) in a folder of a project's own Git
repository; reqochet is the Windows desktop app to view, edit, structure, link, compare, merge, import and export them.
No server, no accounts — access is whatever the Git host (e.g. GitHub) allows.

**What it does today** (the installed version's details: `CHANGELOG.md`):

- **Requirements:** tree table with calculated outline numbers, documents (one folder each), editor with Markdown
  text, item types and custom fields set up in the window, typed links with suspect-link review (Keep / Unlink).
- **Git at requirement level:** commit / pull / push of the requirements folder only (never forced), branches, a pull
  that combines changes field by field and asks only about real clashes, a Changes view per requirement with ↶ per
  part, per-item history, baselines, and any old version shown read-only in the table.
- **Traceability:** coverage rules with gaps marked in the table, the impact chain of an item, and a traceability
  matrix with Excel export.
- **Exchange:** Excel / CSV / ReqIF import (wizard) and export, writing changes back into the original Excel file;
  an AI prompt turns a folder of Word specifications into a project (`docs/guides/word-template-prompt.md`).
- **Around it:** an in-app release self-test, light/dark themes, **English / Arabic** (right-to-left), automatic
  updates, problem reports without your user name.

## Try it (Windows 11)

1. Install [Git for Windows](https://git-scm.com/downloads/win) if you don't have it.
2. Open the repository's **Releases** page → latest release → **Assets** → download `reqochet-dev-Setup-<version>.exe`.
3. Run it. It installs for your user only — no admin rights needed. Installed copies update themselves from new releases.
4. Read the **[user guide](docs/USER-GUIDE.md)** — it starts with a 15-minute quick start.
5. Testers: follow the checklist in `docs/TESTING.md`.

## Status

The current version, the owner's last test report and the next step are in **`docs/STATUS.md`**; what each version
changed is in `CHANGELOG.md`; the release plan in `docs/design/roadmap.md` ("Release plan"). (The status is kept in
those places only, so it cannot drift — review T-04.)

## Develop

Requires Node.js 22 and Git (Windows: `docs/DEVELOPING.md`, also without admin rights).

```
npm ci
npm run dev        # run the app with live reload
npm run check      # type-check + lint (incl. module-boundary rules) + tests
npm run test:perf  # performance tests with 10,000 items (test:perf:all adds 50,000)
npm run build && npm run test:e2e   # drive the real app through the e2e scenarios (screenshots in e2e/out/)
npm run gen:repo -- <folder> [count]   # create a test repository with generated items
npm run dist:win   # build the Windows installer (on Windows)
```

To publish a release: change `version` in `package.json` and push to `main`. The **Release** workflow
builds the installer and publishes it as a GitHub Release; installed copies pick it up automatically.

## Docs

- **`docs/USER-GUIDE.md` — user guide: quick start, every feature, team setup, file format, specification**
- `CLAUDE.md` — project memory and working agreement (start here)
- `docs/ONBOARDING.md` — onboarding guide for engineers, with system diagrams
- **`docs/README.md` — map of all documentation (which file answers which question)**
- `docs/HANDOVER.md` — starting a new chat or team: one message to paste
- `docs/design/` — `decisions.md` (every decision), `requirements.md` (FR/NFR), `roadmap.md` (release plan), `analysis.md` (5-tool study)
- `docs/reviews/` — the planning discussion and analyses awaiting decisions (finished ones in `done/`) — index in its README
- `docs/PITFALLS.md` — mistakes that already cost time
- `CHANGELOG.md` — what each version changed and what testing found
- `docs/DEVELOPING.md` — setting up a Windows PC for development
- `docs/ARCHITECTURE.md` — modules, rules, module map
- `docs/TESTING.md` — manual test checklist, log file location, bug reporting
- `docs/THEMING.md` — customising colours, fonts, shapes, logo, light/dark
- `samples/sample-requirements.xlsx` — fictional smart-thermostat requirements (59 items) for testing
- `tools/README.md` — every script and the working procedures (Claude Code skills in `.claude/skills/`)
- Test data: GitHub `<owner>/Claude_SandBox` (10,005 fictional items) — clone it next to this repository
