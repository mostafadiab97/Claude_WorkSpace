# ReqMan

ReqMan (working name) is a local, Git-based requirements management tool — proof of concept.

Requirements live as plain-text files in a folder of a project's own Git repository; ReqMan is the
desktop GUI to view, edit, link, compare and export them. No server, no accounts.

## Try it (Windows 11)

1. Install [Git for Windows](https://git-scm.com/downloads/win) if you don't have it.
2. Open the repository's **Actions** tab → latest **Build** run → download **ReqMan-Windows-Installer**.
3. Unzip and run `ReqMan-Setup-<version>.exe`. It installs for your user only — no admin rights needed.

## Status

| Milestone | Status |
| --- | --- |
| M0 Foundations — skeleton, module boundaries, theme file, Windows installer | Done |
| M1 Data layer | Next |
| M2–M6 | Planned |

## Develop

Requires Node.js 22 and Git.

```
npm install
npm run dev        # run the app with live reload
npm run check      # type-check + lint (incl. module-boundary rules) + tests
npm run dist:win   # build the Windows installer (on Windows)
```

## Docs

- `docs/ARCHITECTURE.md` — modules, rules, module map
- `docs/THEMING.md` — customising colours, fonts, shapes, logo, light/dark
- `samples/sample-requirements.xlsx` — fictional smart-thermostat requirements (59 items) for testing
- `tools/make_sample_xlsx.py` — regenerates the sample file
