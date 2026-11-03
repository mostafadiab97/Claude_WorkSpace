# Security check before sharing the repositories (3 Nov 2026)

Mostafa asked for a check before the pilot team gets access: tokens, passwords or other information that would make
the repositories vulnerable. Checked: `Claude_WorkSpace` (code, 99 commits, full history) and `Claude_SandBox` (test
data, 14 commits). **F** = fact found, **R** = recommendation.

## Result in one line

No secrets in either repository or their history. Two weaknesses fixed in 0.14.1; one decision for Mostafa (an e-mail
address in the sandbox history).

## What was checked

| Check | How | Result |
| --- | --- | --- |
| Secrets (tokens, keys, passwords) in files **and every past commit** | gitleaks 8.28 (≈ 800 rules) on both repositories; extra searches for GitHub tokens, AWS keys, private keys, `password=` | **F: none found** |
| Tokens used by the build | the workflows use only GitHub's own short-lived `GITHUB_TOKEN`; the acceptance run masks the address that contains it | **F: no stored secret exists** |
| Files that should not be public | `.env`, keys, certificates, logs, screenshots | **F: none tracked**; `e2e/out/`, logs, `coverage/` and personal Claude settings are in `.gitignore` |
| Personal data in files | e-mail addresses, phone numbers, Windows user paths, personal notes | **F: none in files** (cleaned 1 Nov) |
| Personal data in commit authors | `git log` author names and e-mails | **F: code repository** — only "Claude" and Dependabot. **Sandbox** — 8 commits by `MostafaNasr-SwiftAct <mostafa.nasr@…>` (a work e-mail, shows the employer) — see decision below |
| App: what a web page inside the window could do | Electron settings | **F:** context isolation on, sandbox on, no Node in the page, strict Content-Security-Policy, new windows refused, every window call checked (`src/main/validate.ts`). **Weakness:** the window itself could be navigated to another page (e.g. a link dropped onto it), which would then see the app's window functions → **fixed in 0.14.1** (navigation away is blocked; https links open in the browser) |
| Build pipeline | workflows | **Weakness:** the acceptance run's real push would also run for pull requests → **fixed in 0.14.1** (push only for pushes to `main` and manual runs). Pull requests from other people's copies get a read-only token from GitHub anyway |
| Libraries | `npm audit` | **F: 0 problems in what ships with the app**; 30 "moderate" in build-only tools (never installed on users' PCs). Dependabot proposes fixes; `npm run check:deps` warns before every build |
| Installer | signature | **F:** not code-signed (known; certificate costs money) — Windows warns on first install. **R:** ask the company to sign for a 50-person pilot |

## Decision for Mostafa

**The work e-mail in the sandbox history.** Eight early commits of `Claude_SandBox` carry the author
`MostafaNasr-SwiftAct <mostafa.nasr@…>`. Anyone can read it in the commit list. Options:

1. **Leave it** (recommended if the pilot team are colleagues — they know you and your employer anyway).
2. **Rewrite the sandbox history** to replace the author with a neutral name. This changes every commit ID; the two
   clones on your PC (`Claude_SandBox`, `Claude_SandBox_B`) must be cloned again. It needs a force-push, which the
   project rules forbid unless you explicitly decide it.
3. **Make the sandbox private** and give the pilot team a fresh copy without history.

Also for future commits from your PC: GitHub can hide your e-mail (Settings → Emails → "Keep my email addresses
private"; then use the `…@users.noreply.github.com` address in Git).

## Rules that keep it this way

- Never put a token, password or customer name in the repository; the build uses only `GITHUB_TOKEN`.
- Pilot requirement data lives in the **team's own** repository, never in these two.
- Run gitleaks before making any repository public or sharing it with a new group
  (`gitleaks git . --redact`; free, MIT licence).
