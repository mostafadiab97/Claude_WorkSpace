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
| Theme file | `%LOCALAPPDATA%\Programs\ReqMan\resources\config\theme.json` |
| Log file | `%APPDATA%\ReqMan\logs\reqman.log` (older entries in `reqman.old.log`) |

Paste a location into the Explorer address bar to open it. The app's **Diagnostics** panel also shows
the paths and has buttons to open them.

## Reporting a problem

1. In ReqMan, click **Copy diagnostics** and paste the text into your report.
2. Click **Open log folder** and attach `reqman.log`.
3. Describe what you did, what you expected and what happened (a screenshot helps).

## Manual test checklist — v0.0.2 (milestone M0)

Tick each step; any "No" is a bug to report.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Download **ReqMan-Windows-Installer** from the latest Build run, unzip, run `ReqMan-Setup-0.0.2.exe` | Windows may show "Windows protected your PC" (the proof of concept is not code-signed): click **More info → Run anyway**. Installs without asking for admin rights; ReqMan opens |
| 2 | Look at the Start menu and desktop | A **ReqMan** shortcut exists |
| 3 | Look at the start screen | Logo and "ReqMan" in the top bar; Environment shows Git ● green with a version, Theme ● green "Loaded from config/theme.json" |
| 4 | Click **Dark**, then **Light** | The whole window switches colours instantly; text stays readable in both |
| 5 | Choose **Dark**, close ReqMan, reopen it | It reopens in Dark |
| 6 | Choose **System**; in Windows Settings → Personalisation → Colours, switch app mode Light ↔ Dark | ReqMan follows Windows without restarting |
| 7 | Click **Open log folder** | Explorer opens `%APPDATA%\ReqMan\logs` containing `reqman.log` |
| 8 | Open `reqman.log` in Notepad | Lines for "starting", "Git check: installed", "Theme loaded" with times |
| 9 | Click **Copy diagnostics**, paste into Notepad | Version, Windows version, Git version, theme status and log path |
| 10 | Click **Open theme file location** | Explorer opens with `theme.json` selected |
| 11 | Close ReqMan. In `theme.json`, change `"primary"` under `"light"` to `"#d32f2f"`, save, reopen ReqMan in Light | The primary button turns red. Undo the change afterwards |
| 12 | Close ReqMan. Break `theme.json` on purpose (e.g. delete a `}`), save, reopen | ReqMan still opens with the normal look; Theme ● shows "Built-in default" with a warning, also written in the log. Undo afterwards |
| 13 | Resize the window small and large; maximise it | Layout stays usable; nothing overlaps |
| 14 | *(Optional, only if you can)* Temporarily rename Git's folder or test on a PC without Git | Git ● red with "Download Git for Windows" link that opens the browser |
| 15 | Windows Settings → Apps → Installed apps → ReqMan → Uninstall | Uninstalls without admin rights |

Not yet testable in M0: opening a repository, requirements, links, Git actions (arrive in M1–M6).
