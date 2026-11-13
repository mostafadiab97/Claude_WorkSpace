# Launch plan — reqochet 1.0, the first public version (draft, 13 Nov 2026; brought in line with the owner's answers in the Fable review)

Goal: the first public reqochet (built from the separate public repository) reaches the people in the positioning,
they can install it in 15 minutes, and we learn what they need next — without tracking anyone.
Week numbers are relative to launch day (W0). The owner posts everything himself; nothing here is published by Claude.

**Decided (the owner, 13 Nov — decisions.md):** the first public version is **1.0**, after **Word export** and
**Windows 10**; launch **as soon as** the public repository and the sample project are ready; **LinkedIn only** for
now; the "built with Claude" story is a factual note plus **one** later post; the installer is **unsigned, with
SHA-256 checksums**; Discussions off; the name is not explained.

## 1. Must be ready before W0 (gate)

**Product**
- [ ] **Word export and Windows 10 support released** (the two conditions for calling it 1.0 — D-1).
- [ ] Public tool built from the public repository (`reqochet`, own app identity and update feed — decided 4 Nov).
- [ ] Release self-test passes on a clean Windows 10 PC **and** a clean Windows 11 PC; installer and zip both published.
- Not a gate (D-2): the pilot team's feedback. Take in what has arrived; do not wait for it. If the team agrees, one
  sentence from them is the best proof a launch post can carry (no names unless they agree).

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
- [ ] Discussions off; issues only (D-6).
- [ ] Privacy check and secret scan pass on the public copy.

**Sample project**
- [ ] reqochet's own public requirements as a reqochet project, published with every version — the "open it and
      look" moment. Its README says: "Clone this, open it in reqochet." Make sure it has links, a coverage rule with
      at least one visible gap, and a baseline, so every main screen has something to show.

**Website**
- [ ] Licence lines updated (FAQ "What does it cost?" and footer still say "to be confirmed") — see website-lines.md.
- [ ] Download button points to the public repository's latest release.
- [ ] SHA-256 checksums shown in the release notes, and the unsigned-installer warning explained in the FAQ, the
      README and the release note — the same three sentences in all three places (D-4).
- [ ] Windows versions on the page match the release (today the page says Windows 11).

**Docs consistency (found while reading — fix before launch)**
- [ ] User guide §16 says "Windows 10/11", "English and Arabic", "light / dark / system" → Windows 11; five
      languages; Light, Dark, Ember, System.
- [ ] User guide §19 says several documents per repository are "coming next" — built in 0.17.

**Launch assets**
- [x] Short video: `video/reqochet-45s.mp4` (16:9) and `reqochet-45s-square.mp4` (LinkedIn feed), 48 s, captions
      burnt in, no sound — made 13 Nov; look at it once more against 1.0 before posting (video.md).
- [x] Logo sting for the start or end of other videos: `video/sting/` (light, dark, Ember).
- [ ] If time allows, the 2-minute walkthrough recorded from real screens (video.md, B).
- [ ] 6–8 still screenshots at 1600 px from the sample project (Light, Dark, Ember, Arabic, matrix, Changes view).
- [ ] Posts in posts.md: every `[bracket]` replaced from the CHANGELOG; dates in the owner's own calendar.

## 2. Sequence

The clock starts when Word export and Windows 10 are released (D-1) — not on a calendar date. From there it is
about three weeks to launch day; nothing waits for anything else (D-2).

| When | What | Channel |
| --- | --- | --- |
| **W-3** | Freeze the launch feature set (only fixes from here). Public repository filled by the publish script; sample project published; README, LICENSE, templates. The repository may stay private until W0 — but auto-update needs it public, so it turns public on W0 at the latest (the owner does this himself). | GitHub |
| **W-2** | Website: licence lines, Windows versions, download link. Ask 3–5 trusted people (pilot team, colleagues) to install from the public release on their own PCs — at least one on Windows 10 — and say where they got stuck. | — |
| **W-1** | Fix what the testers hit. Final 1.0 release. Replace the `[brackets]` in the posts. Check the video against the released app. | — |
| **W0 (Tue or Wed, morning)** | Repository public. Website live. Launch post with the square video on LinkedIn; link in the first comment. Stay near the post for the first two hours and answer every comment — early answers are what carries a post further (I). | LinkedIn, website, GitHub |
| **W+1** | Post 2: the idea — plain files in Git, with the file-next-to-window picture. Answer every issue and comment within a day. | LinkedIn |
| **W+2** | Post 3: Ember and five languages (pictures). Share the launch post in the requirements-engineering and systems-engineering **LinkedIn groups** where the owner is already a member (read each group's rule on own tools first). | LinkedIn |
| **W+3** | Post 4: behind the scenes — built by one product owner with Claude (D-3 A). The 2-minute walkthrough, if recorded. | LinkedIn |
| **W+4** | First update release with fixes from public issues; post 5, "what you asked for, what changed". | LinkedIn, GitHub release notes |

**Decide closer to launch (D-5, open):** a "Show HN" post or Reddit, one day after W0. It needs a free sign-up, not a
personal social account. Expect blunt questions about the unsigned installer and the licence; the answers are already
written (website FAQ). Recommendation: decide in W-1, when it is clear how much time the owner has that week — a
Show HN that goes unanswered for a day does more harm than none.

## 3. Channels

**Now (decided): LinkedIn.**
- The owner's own posts, to his network in automotive / medical / industrial engineering. A video or 3–5 pictures
  uploaded into the post do better than a post that is only a link (I); the link goes in the first comment.
- Requirements-engineering and systems-engineering **groups on LinkedIn** where the owner is already a member — one
  share of the launch post in W+2, not a campaign.

**Always on, and not "social" (no decision needed):**
- The public repository itself: description, topics, social preview picture, a pinned "Start here" issue; the sample
  project as a second repository people can clone. People who search GitHub for "requirements management" land here.
- The website.

**Later, each its own small decision:**
- Hacker News "Show HN" / Reddit (D-5, see above).
- A short article for a requirements-engineering publication (e.g. IREB's RE Magazine takes article pitches —
  verify): "Requirements in Git without a server: what we learned" — an article, not an advert.
- Not recommended: paid adverts (NFR-07 spirit, and too early), Product Hunt (consumer audience), Facebook (the owner: no).

## 4. What success looks like — measured without tracking users

The app sends nothing anywhere and must stay that way. All signals below are public or owner-only counts the hosts
already show; nothing is added to the app or the website.

| Signal | Where it comes from | First-month target (R — a guess to compare against, not a promise) |
| --- | --- | --- |
| Installer downloads | GitHub release asset `download_count` (public API, totals only) | 150 |
| Repository stars / watchers | GitHub repository page | 40 |
| Issues opened by people outside the team | GitHub issues | 10, with at least 3 feature requests from industry users |
| Sample project clones / forks | GitHub Insights → Traffic (owner only, aggregate) | 20 clones |
| Teams that say they use it | Issues, comments, direct messages | 2 teams |
| Post reach | LinkedIn's own post statistics (owner only) | Use as a relative measure between posts |

The targets were halved in the Fable review: the first draft assumed Hacker News and Reddit as well; with LinkedIn
alone the reach is the owner's network and its second circle. They are still guesses — the first month's real numbers
become the baseline for everything after.

The most valuable signal is qualitative: **which missing feature people name first** (signatures? approvals? PDF?
another Git host? macOS?) — collect these in one list and let them steer the roadmap.

## 5. Risks and answers

| Risk | Answer |
| --- | --- |
| Windows SmartScreen warns about the unsigned installer | Say it before they meet it (website FAQ, README, release notes); publish checksums; offer the zip. Signing comes when reqochet has a good number of users (D-4). |
| "Source-available is not open source" debate | Use the word "source-available" from the start, link the licence, explain in one line who may do what. |
| Regulated-industry readers assume compliance features | "What it is not" in README and website; never imply compliance. |
| "1.0" makes readers expect a finished enterprise tool | Name the limits in the launch post itself (approvals, signatures, PDF); the "What it does not do" block in the README and on the website. |
| A text still says "Windows 11 only" or "no Word export" on launch day | Every such fact is in `[brackets]` in the drafts; W-1 has the step to replace them; search the website and README for "Windows 11" once more on W0. |
| Too many issues for one person | Issue template + labels; a pinned note about response times; feature requests welcome but no promises. |
