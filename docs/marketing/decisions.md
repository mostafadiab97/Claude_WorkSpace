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
- **D-5** — LinkedIn now (the owner's only active account); other channels to be discussed when needed.
- **D-6 A** — GitHub Discussions off at first; issues only.
- **D-7** — asked to explain (other Git hosts); open.
- Name story ("Why reqochet?"): the first wording felt too detailed — a shorter one proposed.
- Release plan approved: 0.23.0 Windows 10 · 0.24.0 Linux · 0.25.0 theme editor · then Word export · then 1.0.
