# ReqMan

ReqMan (working name) is a local, Git-based requirements management tool — proof of concept.

Requirements live as plain-text files in a folder of a project's own Git repository; ReqMan is the
desktop GUI to view, edit, link, compare and export them. No server, no accounts.

## Try it (Windows 11)

1. Install [Git for Windows](https://git-scm.com/downloads/win) if you don't have it.
2. Open the repository's **Releases** page → latest release → **Assets** → download `ReqMan-Setup-<version>.exe`.
3. Run it. It installs for your user only — no admin rights needed. Installed copies update themselves from new releases.
4. Follow the checklist in `docs/TESTING.md`; it also explains where the log file is and how to report a problem.

## Status

The prototype (milestones M0–M6) is complete. What each version changed is in `CHANGELOG.md`; the current
state and the next step are in `CLAUDE.md` ("Status"), and the release plan in `docs/design/DESIGN.md`
("Release plan"). (The status is kept in those places only, so it cannot drift — review T-04.)

## Develop

Requires Node.js 22 and Git.

```
npm install
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

- `CLAUDE.md` — project memory and working agreement (start here)
- `docs/ONBOARDING.md` — onboarding guide for engineers, with system diagrams
- `docs/reviews/` — project reviews (known risks, proposed improvements)
- `docs/design/DESIGN.md` — domain analysis, product decisions, requirements, architecture, milestone plan
- `CHANGELOG.md` — what each version changed and what testing found
- `docs/DEVELOPING.md` — setting up a Windows PC for development
- `docs/ARCHITECTURE.md` — modules, rules, module map
- `docs/TESTING.md` — manual test checklist, log file location, bug reporting
- `docs/THEMING.md` — customising colours, fonts, shapes, logo, light/dark
- `samples/sample-requirements.xlsx` — fictional smart-thermostat requirements (59 items) for testing
- `tools/make_sample_xlsx.py` — regenerates the sample file
