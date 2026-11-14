# Git hosts — where reqochet talks to Git, and how to add help for a host

reqochet works with **any Git host** (GitHub, GitLab, Azure DevOps, Bitbucket, a company server): it never talks to the
host itself. Every Git action runs the `git` program installed on the PC, with the user's own Git settings and sign-in
(Git Credential Manager, SSH keys, tokens). What is **tested** today: GitHub (the in-app self-test pushes to a local
bare repository that stands in for it; the owner works with GitHub).

## Where Git is called

All Git work is one module, with one public entry:

| File | What it holds |
| --- | --- |
| `src/modules/git-adapter/index.ts` | The `GitAdapter` interface — every Git action reqochet uses (status, commit, pull, push, branches, history, merge, remotes…). The rest of the app sees only this. |
| `src/modules/git-adapter/systemGit.ts` | The implementation: builds each `git` command line (`GIT_CONFIG_ARGS`: plain paths, no fsmonitor, long paths on Windows), runs it with time limits, reads its output. |
| `src/main/composition.ts` | Wires `systemGit` into the app (the only place that knows the implementation). |
| `src/modules/workspace/gitOps.ts`, `merging.ts` | Requirement-level Git work built on the adapter (pull with per-field questions, push rules). |

**Publish to a Git host…** (`workspace.ts` `publish`) only adds the address the user pastes as `origin` and pushes —
nothing host-specific. Any host's address works.

## What is host-specific today

Nothing in the code. Two things differ per host for the *user*:

1. **Creating the empty repository** happens on the host's website (reqochet asks for its address).
2. **Signing in** is Git's job: GitHub and Azure DevOps usually through Git Credential Manager, GitLab and Bitbucket
   through it or SSH keys / personal access tokens. If `git push` works in a terminal, it works in reqochet.

## Adding help for a host

To add host-specific help (e.g. "create the repository for me", a pull-request link, a host's sign-in check):

1. Keep `GitAdapter` host-neutral. Put host work behind a **new small interface** (for example
   `src/modules/git-host/index.ts` with `createRepository`, `pullRequestUrl`), one implementation per host, chosen in
   `composition.ts` by the remote address. Planned theme 4 ("Sign in with GitHub", pull requests) follows this rule:
   "all host calls behind one adapter so other hosts can follow".
2. New window calls follow the project rule: a method in `src/shared/api.ts`, a channel, a checked handler in
   `src/main/ipc.ts`.
3. Every word on screen goes into `src/shared/text.ts` and the four translations.
4. Test it the way the self-test tests GitHub: against a local bare repository, plus the host's real API only in a
   manual check (no tokens in tests or CI).

The licence (PolyForm Shield) allows changing the code for your own use and sending the change back; it does not allow
selling a competing version.
