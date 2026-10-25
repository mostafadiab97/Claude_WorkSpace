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

| Milestone | Status |
| --- | --- |
| M0 Foundations — skeleton, module boundaries, theme file, Windows installer | Done |
| M1 Data layer — schema, item files, repository store, index/search, performance, auto-update | Done |
| M2 Core UI — open/create a requirements folder, item table, editor, hierarchy | Done (v0.3.0: hierarchy in the table, drag & drop, field editor) |
| M3 Links — create and remove typed links | Next |
| M4–M6 | Planned |

## Develop

Requires Node.js 22 and Git.

```
npm install
npm run dev        # run the app with live reload
npm run check      # type-check + lint (incl. module-boundary rules) + tests
npm run test:perf  # performance tests with 10,000 and 50,000 items
npm run build && npm run test:e2e   # drive the real app through the prototype journey (screenshots in e2e/out/)
npm run gen:repo -- <folder> [count]   # create a test repository with generated items
npm run dist:win   # build the Windows installer (on Windows)
```

To publish a release: change `version` in `package.json` and push to `main`. The **Release** workflow
builds the installer and publishes it as a GitHub Release; installed copies pick it up automatically.

## Docs

- `docs/ARCHITECTURE.md` — modules, rules, module map
- `docs/TESTING.md` — manual test checklist, log file location, bug reporting
- `docs/THEMING.md` — customising colours, fonts, shapes, logo, light/dark
- `samples/sample-requirements.xlsx` — fictional smart-thermostat requirements (59 items) for testing
- `tools/make_sample_xlsx.py` — regenerates the sample file
