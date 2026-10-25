# Testing ReqMan

Two kinds of checks protect each build:

1. **Automated checks** run on a Windows machine on GitHub for every push: type checking, lint rules
   (including the module-boundary rules) and unit tests. A build that fails any of them produces no installer.
   To see them: repository → **Actions** → latest **Build** run → **windows** → expand **Run npm run check**.
2. **Manual checks** below — done by a person on a real Windows 11 PC, because things like installation,
   Windows dark mode and Explorer integration can only be judged by hand.

## Where things are on Windows

| What | Location |
| --- | --- |
| Installed app | `%LOCALAPPDATA%\Programs\ReqMan\` |
| Your theme file (survives updates) | `%APPDATA%\ReqMan\theme.json` — created by **Edit my theme…** |
| App's built-in theme (replaced by updates — don't edit) | `%LOCALAPPDATA%\Programs\ReqMan\resources\config\theme.json` |
| Log file | `%APPDATA%\ReqMan\logs\reqman.log` (older entries in `reqman.old.log`) |

Paste a location into the Explorer address bar to open it. The app's **Diagnostics** panel also shows
the paths and has buttons to open them.

## Reporting a problem

1. In ReqMan, click **Copy diagnostics** and paste the text into your report.
2. Click **Open log folder** and attach `reqman.log`.
3. Describe what you did, what you expected and what happened (a screenshot helps).

## Getting a version to test

Each tested version is published on the repository's **Releases** page
(`https://github.com/mostafadiab97/Claude_WorkSpace/releases`). Download `ReqMan-Setup-<version>.exe` from
the release's **Assets** and run it — there is no zip and no GitHub sign-in needed. From v0.0.3 onwards,
an installed ReqMan also finds newer releases by itself and offers **Restart and update**.

### If the browser blocks the download

ReqMan is not yet code-signed (signing certificates cost money and are planned for the commercial version),
so browsers treat the installer as unknown:

- **Chrome:** press **Ctrl+J** to open Downloads, find `ReqMan-Setup-….exe`, click **Download suspicious file**
  (or **⋮ → Keep**), then **Download anyway**.
- **Edge:** open Downloads (**Ctrl+J**), hover the file, **⋯ → Keep**, then **Show more → Keep anyway**.
- From v0.0.4, each release also has a **.zip** of the installer, which browsers block less often:
  download it, right-click → **Extract All**, run the `.exe`.
- If there is no "keep" option at all, your company manages the browser: ask IT to allow downloads from
  `github.com/mostafadiab97/Claude_WorkSpace/releases`.

After the download, Windows SmartScreen may also warn when you run it: **More info → Run anyway**.

## Manual test checklist — v0.0.3 / v0.0.4

Tick each step; any "No" is a bug to report.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | From **Releases → v0.0.3 → Assets**, download and run `ReqMan-Setup-0.0.3.exe` (over an older install is fine) | Windows may show "Windows protected your PC" (the proof of concept is not code-signed): click **More info → Run anyway**. Installs without admin rights; ReqMan opens |
| 2 | Look at the Start menu and desktop | A **ReqMan** shortcut exists |
| 3 | Look at the start screen | Logo and "ReqMan" in the top bar; Environment: Git ● green with a version, Theme ● green "App theme", Updates "Up to date" |
| 4 | Click **Dark**, then **Light** | The whole window switches colours instantly; text stays readable in both |
| 5 | Choose **Dark**, close ReqMan, reopen it | It reopens in Dark |
| 6 | Choose **System**; in Windows Settings → Personalisation → Colours, switch app mode Light ↔ Dark | ReqMan follows Windows without restarting |
| 7 | Click **Open log folder** | Explorer opens `%APPDATA%\ReqMan\logs` containing `reqman.log` |
| 8 | Open `reqman.log` in Notepad | Lines for "starting", "Git check: installed", "Theme loaded", "Update status" with times |
| 9 | Click **Copy diagnostics**, paste into Notepad | Version, Windows version, Git version, theme, update status and log path |
| 10 | Click **Edit my theme…** | Explorer opens `%APPDATA%\ReqMan` with a new `theme.json` selected |
| 11 | Close ReqMan. In that `theme.json`, change `"primary"` under `"light"` to `"#d32f2f"`, save, reopen in Light | The primary button turns red; Theme shows "Your theme.json" |
| 12 | Close ReqMan. Break your `theme.json` on purpose (delete a `}`), save, reopen | ReqMan opens with the normal look; Theme ● shows a warning (also in the log). Undo afterwards |
| 13 | Resize the window small and large; maximise it | Layout stays usable; nothing overlaps |
| 14 | **Update test** — tell Claude you have v0.0.3 installed; Claude publishes v0.0.4. Open ReqMan (or click **Check for updates**) | A bar shows "Downloading ReqMan 0.0.4…", then "ReqMan 0.0.4 is ready to install" with **Restart and update**. Click it: ReqMan closes, updates and reopens showing 0.0.4 — and your red theme from step 11 is still there |
| 15 | Disconnect from the network, click **Check for updates** | Updates shows "Could not check for updates…"; nothing else breaks |
| 16 | *(Optional)* Test on a PC without Git | Git ● red with a "Download Git for Windows" link that opens the browser |
| 17 | Windows Settings → Apps → Installed apps → ReqMan → Uninstall | Uninstalls without admin rights |

Not yet testable: opening a repository, requirements, links, Git actions (arrive with M1–M6).
