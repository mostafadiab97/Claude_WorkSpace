# Renaming ReqMan — impact analysis (31 Oct 2026)

**Why:** the owner found that "ReqMan" is already the name of another requirements tool (INNEO's ReqMan, an ALM
add-on sold in Germany — [inneo.com](https://inneo.com/en/product-development/application-lifecycle-management-alm/reqman.html);
an older SourceForge project "ReqMan" also exists). The product needs a new name before any public or commercial use.
The new name itself is the owner's decision (candidates discussed 29–30 Oct: Branchwise, Mergewell, Plaintrace,
Tracewell; trademark and domain check still to do).

Tags: **F** = counted in the repository today, **I** = inference, **R** = recommendation.

## 1. How much of the project carries the name (F)

`git grep -i reqman` on 31 Oct 2026: **599 occurrences in 122 files** — 361 × "ReqMan" (what people read), 238 ×
"reqman" (technical identifiers).

| Area | Examples | Visible to users? | Effort |
| --- | --- | --- | --- |
| Product name | `package.json` `productName`, `electron-builder.yml` `productName`, window title, installer name `ReqMan-Setup-x.y.z.exe`, start-menu entry | **Yes** | S |
| On-screen texts | 17 places in `src/shared/text.ts` ("ReqMan commits only…") | **Yes** | S (one file, S-06 pays off) |
| Documentation | README, CLAUDE.md, docs/*, CHANGELOG, diagrams (`docs/diagrams/*`, Archify sources) | Yes (team, customers) | M (search/replace, then re-read; diagrams regenerated with `node tools/diagrams.mjs`) |
| Files written into **customers' repositories** | `requirements/.reqman/schema.yaml` (folder name) | Yes, in Git | **M — needs migration** (see 3) |
| Exported files | ReqIF header `REQ-IF-TOOL-ID`/`SOURCE-TOOL-ID` = "ReqMan", identifiers `reqman-dt-…`, attribute names `ReqMan.Markdown`, `ReqMan.Type`, `ReqMan.Number` | Yes, to other tools | S, but must keep **reading** the old names (files exported before the rename) |
| Per-user data on Windows | `%APPDATA%\ReqMan\` (theme.json, logs, cache, recent repositories, import memory, export settings) — the folder name comes from the product name | Indirectly | **M — needs migration** (see 3) |
| Install folder | `%LOCALAPPDATA%\Programs\ReqMan\` | Indirectly | S (follows the product name) |
| App identity / update chain | `appId: com.reqman.app`; update feed = GitHub Releases of `mostafadiab97/Claude_WorkSpace` | No | **Keep unchanged** (see 3) |
| Code identifiers | `window.reqman` (83 uses), package name `reqman`, temp-folder prefixes `reqman-…`, `ReqManApi` type, log tags | No | S–M (optional) |
| Tests and e2e | expectations of texts, `.reqman` paths, temp names (18 test files) | No | S (follow the code) |
| Repositories | `Claude_WorkSpace` (code), `Claude_SandBox` (test data) | Owner only | None needed (names do not contain ReqMan) |

## 2. What must change vs what may stay (R)

**Must change (visible):** product name, installer and window title, on-screen texts, documentation, ReqIF tool
name, the README and release notes. With S-06 (all texts in one file) the visible part is about one day of work.

**Should change, with migration:** the `.reqman` folder inside customers' repositories and the `%APPDATA%` folder.

**May stay (invisible):** `window.reqman`, the `ReqManApi` type, module names, temp prefixes, package name. Renaming them
costs a large but mechanical diff and risks nothing for users; it can be done in the same release for cleanliness
(a team taking over expects one name), or left. Recommendation: rename them too, in one commit, so new engineers
never meet two names — **except** `appId`.

## 3. The four places where a careless rename would hurt users (I/R)

1. **Auto-update chain (`appId`).** Electron-builder's Windows installer identifies the installed app by `appId`. A new
   `appId` makes the new version a *different* app: the old one would not update itself, both would be installed side
   by side, and the owner would have to uninstall by hand. **R:** keep `appId: com.reqman.app` (nobody sees it) until
   the commercial launch, where a fresh install is expected anyway. Keep the same release feed.
2. **Per-user data.** Changing `productName` moves Electron's user-data folder from `%APPDATA%\ReqMan` to
   `%APPDATA%\<NewName>`: theme, recent repositories and import memory would look lost, and every repository would be
   indexed again (10k items: 5–8 s once). **R:** on first start, if the new folder does not exist and the old one does,
   copy the old one (one function in `src/main/index.ts`, with a unit test). The cache is rebuilt anyway if not copied.
3. **`requirements/.reqman/` in every project repository** (incl. the 10,005-item sandbox). A new app that looks only
   for `.<newname>/` would not recognise existing projects. **R:** read both (new name first, old name as fallback);
   new projects get the new folder; existing projects keep working; an optional one-click "Update folder name"
   (`git mv`, committed like any change) — never automatic, because colleagues on an older version would then
   no longer see the schema. The sandbox is moved once with `git mv` (IDs and history unchanged).
4. **Exported ReqIF and Excel files.** Files exported before the rename carry `ReqMan.Markdown` etc. **R:** import
   accepts both names forever; export writes the new names. The ReqIF schema test stays as is.

## 4. Plan (R) — one release, after the owner picks the name

| Step | Work | Size |
| --- | --- | --- |
| 0 | Owner chooses the name; trademark/domain/GitHub search (a lawyer for the commercial launch) | owner |
| 1 | Visible rename: productName, installer, window title, `text.ts`, README/docs, diagrams, logo text | S |
| 2 | `%APPDATA%` migration (copy old folder once) + unit test | S |
| 3 | Schema folder: read new and old name, write new for new projects; optional "Update folder name"; sandbox `git mv` | M |
| 4 | ReqIF/Excel: write new attribute and tool names, read both | S |
| 5 | Code identifiers (`window.reqman`, types, temp prefixes, package name) — mechanical | S–M |
| 6 | Tests: update expectations, add tests for both folder names, the APPDATA copy and old ReqIF files; self-test step "opens a project with the old folder name" | S |
| 7 | Checklist for the owner: update arrives (same app, new name), his theme/recent list are still there, the sandbox opens, an old export imports | — |

Total: about 2–3 days of work, one test round. Keeping `appId` means the owner's installed copy simply updates to the
new name.

## 5. Owner's answers (31 Oct 2026)

- **Branchwise is taken** (an HR tool, an iOS Git game, a Polish service company, an AI decision tool). The owner is
  looking for a new name himself. Logo/name ideas he showed: reqoin, reqouple, reqochet, reqnote (red and green
  dots in the letters). Note: his market list (`2026-10-31-rm-tools-market-list.md`) found "Req-" names crowded.
- **Clean switch wanted:** the version with the new name should **uninstall the old app and install the new one**,
  removing all files under the old name. This replaces recommendation 3.1 (keep `appId`): give the new name its own
  `appId`; the new installer (NSIS `customInit` in `electron-builder`) finds the old ReqMan uninstaller in the
  registry and runs it silently. **Still to keep (R):** copy the user's own settings (`theme.json`, recent list,
  export/import memory) from `%APPDATA%\ReqMan` to the new folder *before* the old one is removed, then delete it;
  the cache is rebuilt. `requirements/.reqman/` folders inside project repositories are the user's data, not app
  files — they are read as before and never deleted by the installer. Last update of the old app should be a
  ReqMan version that points to the new installer (the old feed cannot install a different `appId` by itself).
