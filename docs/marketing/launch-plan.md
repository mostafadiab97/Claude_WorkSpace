# Launch plan — first public version (draft, 13 Nov 2026)

Goal: the first public reqochet (built from the separate public repository) reaches the people in the positioning,
they can install it in 15 minutes, and we learn what they need next — without tracking anyone.
Week numbers are relative to launch day (W0). The owner posts everything himself; nothing here is published by Claude.

## 1. Must be ready before W0 (gate)

**Product**
- [ ] Public tool built from the public repository (`reqochet`, own app identity and update feed — decided 4 Nov).
- [ ] The pilot team's first round of feedback taken in (I: the pilot was approved 3 Nov; its findings are the best
      launch-day proof that a real team used it).
- [ ] Release self-test passes on a clean Windows 11 PC; installer and zip both published.

**Repository (public)**
- [ ] `README.md` written for strangers: what it is (one line), a screenshot, install in 4 steps, "what it is not",
      link to the user guide and the sample project.
- [ ] `LICENSE` — PolyForm Shield 1.0.0 text, plus one plain-language paragraph at the top of the README.
- [ ] `HOW-IT-WAS-BUILT.md` — clean-room statement (public documentation only, no reverse engineering) and,
      if the owner chooses, the AI-built note (see decisions D-3).
- [ ] `SECURITY.md`, `CHANGELOG.md` (user-facing only).
- [ ] Issue template that asks for the app's problem report (Settings → Report a problem) — decided 12 Nov.
- [ ] Repository description, topics (`requirements-management`, `requirements-engineering`, `traceability`, `reqif`,
      `git`, `windows`, `markdown`), social preview image (Ember screenshot works well).
- [ ] Discussions on or off (decision D-6).
- [ ] Privacy check and secret scan pass on the public copy.

**Sample project**
- [ ] reqochet's own public requirements as a reqochet project, published with every version — the "open it and
      look" moment. Its README says: "Clone this, open it in reqochet." Make sure it has links, a coverage rule with
      at least one visible gap, and a baseline, so every main screen has something to show.

**Website**
- [ ] Licence lines updated (FAQ "What does it cost?" and footer still say "to be confirmed") — see website-lines.md.
- [ ] Download button points to the public repository's latest release.
- [ ] SHA-256 checksums shown in the release notes (helps with the unsigned installer).

**Docs consistency (found while reading — fix before launch)**
- [ ] User guide §16 says "Windows 10/11", "English and Arabic", "light / dark / system" → Windows 11; five
      languages; Light, Dark, Ember, System.
- [ ] User guide §19 says several documents per repository are "coming next" — built in 0.17.

**Launch assets**
- [ ] Short video (30–60 s) and, if time allows, the 2-minute walkthrough (video.md).
- [ ] 6–8 still screenshots at 1600 px from the sample project (Light, Dark, Ember, Arabic, matrix, Changes view).
- [ ] Posts in posts.md adjusted and scheduled in the owner's own calendar.

## 2. Sequence

| When | What | Channel |
| --- | --- | --- |
| **W-4** | Decide D-1…D-6. Freeze the launch feature set (no new features after this, only fixes). | — |
| **W-3** | Public repository filled by the publish script; sample project published; README, LICENSE, templates. Repository stays private until W0 if the owner prefers (but note: auto-update needs it public — so make it public at the latest on W0). | GitHub |
| **W-2** | Record the videos from the sample project. Website licence lines. Ask 3–5 trusted people (pilot team, colleagues) to install from the public release on their own PCs and report where they got stuck. | — |
| **W-1** | Fix what the testers hit. Final release. Prepare posts. | — |
| **W0 (Tue or Wed)** | Make the repository public (if not already). Launch post + 30–60 s video on LinkedIn. Website live. | LinkedIn, website, GitHub |
| **W0 + 1 day** | Show HN post (only if the owner wants a developer audience — expect blunt feedback about the unsigned installer and the licence). | Hacker News |
| **W+1** | Post 2: "plain files in Git" idea, with the file-next-to-window picture. Answer every issue and comment within a day. | LinkedIn |
| **W+2** | Post 3: Ember and five languages (visual post). Share in requirements-engineering and systems-engineering groups where the owner is already a member. | LinkedIn, groups |
| **W+3** | Post 4 (optional): behind the scenes — built by one product owner with Claude. 2-minute walkthrough video. | LinkedIn |
| **W+4** | First update release with fixes from public issues; a short "what we heard, what we fixed" post. | LinkedIn, GitHub release notes |

## 3. Channels (where the audience already is)

- **LinkedIn** (primary): the owner's own network in automotive / medical / industrial engineering. Posts with a
  native video or 3–5 images do better than link posts (I); put the link in the first comment or the last line.
- **Communities** (post only where members may share their own tools; read each group's rules first):
  requirements-engineering and systems-engineering LinkedIn groups; INCOSE chapter or working-group channels if the
  owner is a member; Reddit communities on systems engineering, embedded and medical devices — check each one's
  self-promotion rule.
- **Git hosting pages**: the public repository itself (topics, social preview, a pinned "Start here" issue or
  discussion); the sample project as a second repository people can clone.
- **Newsletters / magazines**: requirements-engineering publications (e.g. IREB's RE Magazine accepts article
  pitches — verify) — pitch a short article "Requirements in Git without a server: what we learned", not an ad.
- **Hacker News "Show HN"** (optional, decision D-5): large reach among developers; less of the core audience.
- Not recommended now: paid ads (NFR-07 spirit, and too early), Product Hunt (consumer-leaning audience).

## 4. What success looks like — measured without tracking users

The app sends nothing anywhere and must stay that way. All signals below are public or owner-only counts the hosts
already show; nothing is added to the app or the website.

| Signal | Where it comes from | First-month target (R — a guess to compare against, not a promise) |
| --- | --- | --- |
| Installer downloads | GitHub release asset `download_count` (public API, totals only) | 300 |
| Repository stars / watchers | GitHub repository page | 100 |
| Issues opened by people outside the team | GitHub issues | 10, with at least 3 feature requests from industry users |
| Sample project clones / forks | GitHub Insights → Traffic (owner only, aggregate) | 30 clones |
| Teams that say they use it | Issues, comments, direct messages | 3 teams |
| Post reach | LinkedIn's own post statistics (owner only) | Use as a relative measure between posts |

The most valuable signal is qualitative: **which missing feature people name first** (Word export? signatures?
GitLab? Linux?) — collect these in one list and let them steer the roadmap.

## 5. Risks and answers

| Risk | Answer |
| --- | --- |
| Windows SmartScreen warns about the unsigned installer | Say it before they meet it (website FAQ, README, release notes); publish checksums; offer the zip. Decision D-4 on signing. |
| "Source-available is not open source" debate | Use the word "source-available" from the start, link the licence, explain in one line who may do what. |
| Regulated-industry readers assume compliance features | "What it is not" in README and website; never imply compliance. |
| Windows 10 users can't install (many companies) | Say "Windows 11 now, Windows 10 next" everywhere; collect interest in an issue. |
| Too many issues for one person | Issue template + labels; a pinned note about response times; feature requests welcome but no promises. |
