# A public release repository — how files would move (analysis, 4 Nov 2026)

**Status: open point for discussion; nothing is decided.** The owner, 4 Nov 2026: a new repository will hold the
released, public tool; this repository stays the development repository for now. Only the files that matter to a
user go there, plus a description of the tool and of how it was built — from publicly documented features of other
tools, not by reverse engineering. This file answers "how would files move, the first time and at every release, and
which files". F = fact, I = inference, R = recommendation.

## 1. Why a separate repository at all (F)

- This repository's **history** holds the owner's name and old e-mail addresses (3 Nov decision: history is not
  rewritten; the current files are clean and checked by `tools/check-privacy.mjs`). A public copy must therefore start
  **without history** — copying files, not pushing commits.
- Installed apps update from the **GitHub Releases** of the repository named in `electron-builder.yml`
  (`publish`); that repository must be public (tested 0.4: private → 404). Today it is this one.

## 2. Which files (R — a first proposal to discuss)

| Group | Files | Public? | Why |
| --- | --- | --- | --- |
| The app's source | `src/`, `config/`, `resources/`, `samples/` | **Yes** | what the tool is |
| Build and test | `package.json`, `package-lock.json`, `electron-builder.yml`, `electron.vite.config.mts`, `tsconfig*.json`, `eslint.config.mjs`, `vitest.config.mts`, `tests/`, `e2e/` (scenarios, harness, acceptance), `tools/` build scripts | **Yes** | anyone can build and check it; the tests show the quality |
| Workflows | `.github/workflows/` (build, release) | **Yes, adapted** | the public repo builds and publishes the installers; secrets stay in GitHub settings, never in files |
| User documentation | `docs/USER-GUIDE.md`, `docs/THEMING.md`, `docs/images/` | **Yes** | for users and admins |
| Engineering documentation | `docs/ARCHITECTURE.md`, `docs/ONBOARDING.md`, `docs/DEVELOPING.md`, `docs/diagrams/` | **Yes** | how it is built |
| New for the public repo | `README.md` (what reqochet is, install, build), `HOW-IT-WAS-BUILT.md` (clean-room statement, below), `LICENSE`, `CHANGELOG.md` (user-facing only), `SECURITY.md` (how to report a problem) | **Yes, written for it** | the shop window |
| Development history | `docs/reviews/` (incl. `agents/`), `docs/design/decisions.md`, `docs/design/analysis.md` (the 5-tool study), `docs/design/roadmap.md`, `docs/testing/`, `docs/TESTING.md` (the owner's checklists), `docs/PITFALLS.md`, `docs/HANDOVER.md`, `docs/AGENT-WORKFLOW.md`, `docs/guides/` (prompts) | **No** — stays here | progress, research, discussions |
| AI working files | `CLAUDE.md`, `.claude/` (skills, settings) | **No** | how this repository is worked on |
| Repository-only files | `.github/dependabot.yml`, `tools/check-privacy.mjs` hashes | No / adapted | |

Points to discuss: whether `docs/design/requirements.md` (the product definition) goes public (I lean yes, trimmed);
whether the **tests that name the sandbox** go (they need the 10,005-item test data — `Claude_SandBox` would then be
public too, or those tests are skipped there).

**`HOW-IT-WAS-BUILT.md` (R, outline):** the tool was designed from the publicly documented features of existing
requirements tools (their manuals, product pages and standards such as ReqIF) — listed by name with the public
sources used; no tool was decompiled, disassembled or its network traffic inspected; no code or data from those tools
was used; the data format is our own (Markdown + YAML in Git); ReqIF support follows the published OMG standard and
is checked against its official schema. The source list can be built from `docs/design/analysis.md` without its
working notes.

## 3. How files move (R — options)

**A. A "publish" script with an allow-list (recommended).** One file in this repository lists what is public
(`tools/public-files.txt`, folders and files, plus the replacements such as the public README). A script
`tools/publish-public.mjs <version>`:
1. takes the files of the release commit (`git archive` of the allow-list — never the working folder);
2. copies them into a clone of the public repository, replacing everything there (deleted files disappear too);
3. runs the privacy check and the secret scanner on the result — stops if anything is found;
4. builds and runs the tests there (the copy must build on its own);
5. makes **one commit per release** ("reqochet 0.16.0") with a tag; the public history is one clean commit per
   version.

The same script does the first copy and every later one. It can run by hand at first (the owner sees the result
before anything is pushed), later automatically as the last step of the release workflow.

**B. Only installers in the public repository** (no source): simplest, but nobody can see how it is built — does not
match "the tool files with the documentation".

**C. Moving Git history** (subtree/filter): rejected — the history holds personal data.

## 4. Things that change with it (I)

- **Update feed.** If installers are published from the public repository, `electron-builder.yml` `publish` points
  there, and this repository may become private again. The **rename version** (new app identity, clean install) is the
  natural moment to switch the feed — otherwise installed apps need one more bridge release later. → decide before
  the rename version ships, or keep the feed here for the rename and switch with a later release (one extra step).
- **Who pushes:** the release workflow needs permission to push to the public repository (a fine-grained token or
  deploy key stored as a secret). It touches the owner's account → the owner creates it when we get there.
- **Licence:** a public repository needs a licence choice (open-source, source-available, or "all rights reserved"
  with the code only visible). A product decision, with a lawyer before the commercial launch.
- **Issues and contributions:** off at first, or on?
- **Privacy check** runs on the public copy too; the forbidden-names hashes stay only here.

## 4a. Decided (C, owner 4 Nov 2026)

- **Two tools, two update feeds.** The development tool (built from this repository) updates from this repository's
  releases; the release tool (built from the public repository) updates from the public repository's releases. The
  owner installs both for manual tests. Each tool's "go back to an earlier version" list shows only its own feed.
- I: two tools on one PC need different app identities, names and data folders (otherwise one installer replaces the
  other) — see the rename discussion, R-10.

- I (0.16 build): electron-builder names the install folder after package.json `name` — the release repository must
  use `name: reqochet`, `productName: reqochet`, appId `com.reqochet.app` (this repository: `reqochet-dev` everywhere),
  otherwise the two tools would install into the same folder.

## 5. Questions for the owner — decided 12 Nov 2026

1. **Source + docs public** (as proposed in §2): app source, tests, user guide and engineering docs; planning,
   reviews and AI files stay in this repository.
2. ~~Update feed~~ — decided: each tool updates from its own repository (4a).
3. **Licence: source-available** (free for internal / non-commercial use, commercial use needs a licence — the exact
   licence text, e.g. Business Source License or PolyForm, is chosen when the public repository is made).
4. **Neither `requirements.md` nor the sandbox data is public.** Instead, reqochet's own *public* requirements (what
   the tool does, as a user sees it) become a reqochet project folder — `requirements/` in reqochet's format — that is
   published with every public version: realistic fictional-free sample data and a living specification at once.
5. **Issues on, with a template** (asks for the app's problem report).

(Original questions, 4 Nov: source public or installers only; licence; requirements and sandbox public; issues.)
