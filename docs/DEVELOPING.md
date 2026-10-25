# Developing ReqMan on Windows

## One-time setup

1. **Git for Windows** — https://git-scm.com/download/win (includes Git Credential Manager, which ReqMan's Git
   features will rely on). Then:
   `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`.
2. **Node.js 22 LTS** — https://nodejs.org (the version CI uses). Check with `node -v` in a **new** terminal.
   *Without admin rights:* download the **Windows Binary (.zip)** for 22.x LTS (x64) from https://nodejs.org/en/download
   instead of the installer, extract it to e.g. `%USERPROFILE%\tools\node`, then Start → "Edit environment variables
   for your account" → `Path` → **New** → that folder → OK. Open a new terminal: `node -v` and `npm -v` work, no
   admin needed. (Updating Node = extracting a newer zip over it.)
3. **GitHub CLI** (optional but used to watch builds and releases) — https://cli.github.com, then `gh auth login`.
4. **VS Code** with the **Claude Code** extension.
5. Clone into an empty folder (note the `.` at the end), and the test data next to it — not inside:

   ```
   cd C:\path\to\empty-folder
   git clone https://github.com/mostafadiab97/Claude_WorkSpace.git .
   git clone https://github.com/mostafadiab97/Claude_SandBox.git ..\Claude_SandBox
   npm ci
   npm run check
   ```

6. Optional first full check: `npm run build` then `npm run test:e2e` (ReqMan windows open and close by
   themselves for about a minute; screenshots land in `e2e\out\`).

## Daily work

- `npm run dev` runs ReqMan from the source with live reload. It uses the same `%APPDATA%\ReqMan` folder as the
  installed app (recent repositories, theme, logs, index caches) — that is fine; caches rebuild when needed.
- Before pushing: `npm run check` (and `npm run build && npm run test:e2e` for UI changes).
- Releasing: see "Releasing" in `CLAUDE.md`. Pushing a changed `version` in `package.json` to `main` publishes a
  release that installed copies pick up automatically.

## Line endings

`.gitattributes` keeps every text file LF in the repository and working copy, so Windows checkouts produce no
whitespace-only diffs. Item files (`requirements/**`) of user repositories get their own `.gitattributes` when
ReqMan creates the folder.
