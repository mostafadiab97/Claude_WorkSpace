# Decisions for the owner — launch (13 Nov 2026)

Recommended option first. Each one is small; answer with the letter.

**D-1 What to call the first public version**
- **A (recommended): "public preview", version continues (0.2x).** Honest while Word export, signing and Windows 10
  are missing; 1.0 can be its own announcement later (a second launch moment).
- B: call it 1.0 — stronger headline, but sets expectations for completeness.

**D-2 When to launch**
- **A (recommended): after the pilot team's first round of feedback** — fewer surprises, and a real team's experience
  to mention (only with their permission, no names unless they agree).
- B: as soon as the public repository and sample project are ready.

**D-3 The "built by one product owner with Claude" angle**
- **A (recommended): state it factually in `HOW-IT-WAS-BUILT.md` and the README; one behind-the-scenes post (post 4)
  about three weeks after launch.** The product leads; the story follows for those who are curious. Never hidden.
- B: no post — only the factual line in the repository.
- C: lead the launch with it. Big reach, but the discussion may be about AI instead of requirements, and
  quality-minded buyers in regulated industries may be sceptical before they see the tests.

**D-4 The unsigned installer**
- **A (recommended): launch unsigned, warn clearly** (website FAQ, README, release notes), publish SHA-256 checksums,
  keep the zip. Revisit signing when companies ask.
- B: get a code-signing certificate before launch. Removes the warning over time, but costs money every year (against
  the "no paid services" rule, so the owner's call). Free signing programmes for open-source projects usually require
  an OSI licence — PolyForm Shield likely does not qualify (I; to verify).

**D-5 Developer channels (Hacker News "Show HN", Reddit)**
- **A (recommended): LinkedIn and requirements-engineering groups first; Show HN one day later** — wider reach, blunt
  feedback, and some readers will be in the target industries.
- B: LinkedIn and groups only.

**D-6 GitHub Discussions in the public repository**
- **A (recommended): off at first; issues only** (decided: issues with a template). Less to watch for one person.
- B: on, for questions and ideas separate from bugs.

**D-7 GitLab / Azure DevOps / Bitbucket**
- **A (recommended): say "tested with GitHub" until Claude has run the release self-test against another host**, then
  add it to the website. Plain push and pull go through the installed Git, so it likely works (I), but nothing is
  claimed untested.
- B: claim "any Git host" now.

**Fixes to make before launch regardless (not decisions):** user guide §16 (Windows 10/11 → 11, two languages → five,
add Ember) and §19 ("several documents… coming next" — built in 0.17); website licence lines (see
website-lines.md).

## Answers (the owner, 13 Nov 2026)

- **D-1 B** — call the first public version **1.0**; not released until **Word export and Windows 10** are done.
- **D-2 B** — launch as soon as the public repository and the sample project are ready (and D-1's conditions are met).
- **D-3 A** — factual `HOW-IT-WAS-BUILT.md` + README line; one behind-the-scenes post about three weeks after launch.
- **D-4 A** — launch unsigned with clear warnings and SHA-256 checksums; buy a code-signing certificate if reqochet gets
  a good number of users.
- **D-5** — LinkedIn now; Hacker News / Reddit (free sign-up, no personal social account) decided closer to launch; no Facebook.
- **D-6 A** — GitHub Discussions off at first; issues only.
- **D-7** — the owner: others may add their Git host themselves; keep the Git work in one easy-to-find module, or make
  it configurable. Fact: all Git work is already one module (`src/modules/git-adapter`, one public entry) and
  "Publish to GitHub…" just adds the address and pushes — any host's address works; only the texts say GitHub.
  Plan (0.23.0): neutral texts ("Publish to a Git host…", examples for GitHub / GitLab / Azure DevOps / Bitbucket) and an
  engineering note `docs/guides/git-hosts.md` (where Git is called, how to add host-specific help). Website: "tested
  with GitHub" until another host is tested.
- Name story: **no explanation for now** (the owner).
- Release plan approved: 0.23.0 Windows 10 · 0.24.0 Linux · 0.25.0 theme editor · then Word export · then 1.0.

## Changes (the owner, 13 Nov 2026, evening)

- Plan changed: **first an internal release to the owner's team**, then the following version goes public.
  **Windows 10 and Linux postponed**; Word/PDF export, the theme editor and the open review points come first. The
  videos and the website still serve as a quick tour of the tool.
- Fable decisions: F-1 yes, but the end card cycles Light / Dark / Ember; F-2 yes; F-3 no music, but a narrator and
  sound effects; F-4–F-6 yes.
- Audit questions (13 Nov evening): O-1 only "daily comfort" (bulk edit, duplicate, saved views, templates) before the
  team release, the rest after their feedback; O-2 Word export with today's plain text first, rich text later; O-4 a
  drawn commit history after the team release — ask Fable for a visual idea.

## Answers (the owner, 13 Nov 2026, night)

- Daily comfort details: **B-1 a** writing help in the same version; **B-2 a** saved views personal and shared;
  **B-3 a** references to outside things after the team release.
- **The public repository holds 1.0, and that is what the team gets** — the dev repository is not shared with them.
  So the public repository (group F) comes *before* the team release.
- Toolbar (Fable's review): **T-1 a** document actions in the document button's menu; **T-2 a** one outline button with
  a two-line menu; **T-3 a** New item = small panel (type + place) then the editor; **T-4** Import, Export and Show
  text may go into menus. Built in 0.23.0.
- Film: end card **Ember → Dark → Light**; sounds perfect; **male voice**; shown words fine; no own voice.
- Drawn history: Fable's idea approved; after 1.0 (first step first).
