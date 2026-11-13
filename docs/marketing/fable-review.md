# Marketing review by Fable (13 Nov 2026)

A second look at the launch drafts in this folder, after the owner's answers in `decisions.md`. The documents were
edited in place; this page says what changed and why, where I disagree, and what the owner still has to decide.
Nothing was published or posted. **F** = fact, **I** = inference, **R** = recommendation.

## The main finding

The drafts were written for a launch of today's version (0.22: Windows 11, no Word export). The owner then decided
that the first public version is **1.0, after Word export and Windows 10**. So on launch day the drafts' most
repeated sentences — "Windows 11 today, Windows 10 next", "no Word export yet" — would have been wrong, in the launch
post itself. All texts are now written for the launch day, with every fact that is not built yet in
`[square brackets]`, and one table that says what to check (positioning.md → "What is true on launch day").

## What changed

| Document | Change | Why |
| --- | --- | --- |
| positioning.md | The promise in three lengths (tagline · one sentence · 35 words); the sentence now ends "…reqochet is the window onto them" | Post, video and website now say the same sentence; "requirements management" comes first because it is what people search for. |
| positioning.md | New: "the one thing to be remembered for" — Git at the level of a requirement (field-by-field merge) | Plain files and a table exist elsewhere; this is the part nobody else has. With room for one proof, use it. |
| positioning.md | New table: what is true today / at 1.0; three voice habits; "the name is not explained" | Keeps every later text honest on the day; records the owner's answer. |
| posts.md — post 1 | Rewritten: two-line promise first; three bullets as situations ("Two people edit the same requirement?"); limits named; ends with a question; link moved to the first comment | The first two lines are all LinkedIn shows; situations are recognised faster than feature names; the question brings the comments that tell us what to build. |
| posts.md — post 3 | The 5.5 : 1 contrast figure is claimed for Ember only | F: the CHANGELOG records it for Ember; the draft said "every mode". |
| posts.md — post 4 | No longer "optional"; calmer first line; ends "judge the result, not the method" | The owner chose D-3 A (one post, about three weeks later). |
| posts.md — release note | Written for 1.0; "source-available" added to the licence line; checksum sentence says what to do with it | Launch-day facts; D-4. |
| launch-plan.md | Gate: Word export and Windows 10 added; pilot feedback is no longer a gate; test on Windows 10 too | D-1 and D-2. |
| launch-plan.md | Sequence starts three weeks before launch instead of four; Show HN taken out of the fixed sequence into "decide closer to launch"; channels split into now / always on / later | D-5 (LinkedIn only for now); nothing waits (D-2). |
| launch-plan.md | First-month targets halved (downloads 300 → 150, stars 100 → 40) | I: the first numbers assumed Hacker News and Reddit; LinkedIn alone reaches the owner's network. |
| launch-plan.md | Two new risks: "1.0 sounds finished" and "a stale Windows-11 sentence on launch day" | Both follow from D-1. |
| website-lines.md | Lines that depend on 1.0 are marked **[1.0]**; a ready answer for "GitLab / Azure DevOps / Bitbucket?"; the unsigned-installer text; "What it does not do yet" is now recommended, not optional | D-7 gives a true answer today ("uses your installed Git; tested with GitHub"); D-4. |
| video.md | Concept A replaced by the film as built (48 s); rules now separate "recorded = real app only" from "animated = drawn, and says so"; recording notes moved to B | The film exists; the old rule "no mock-ups" would have forbidden it without saying why it is still honest. |
| new: video/ | The film (16:9 and square), poster, sting in three colours, sources, licences | Tasks 2 and 3 — see `video/README.md`. |
| decisions.md | Not changed | The owner's answers stand as written. |

## Where I disagree (recommendation first)

1. **Keep 1.0 as decided — but open the public repository quietly two to three weeks before the announcement.**
   Waiting for Word export and Windows 10 is right for a version called 1.0. The cost is that nobody outside sees
   anything until then, and the announcement day becomes the first day strangers install it. A repository that is
   public but not announced (no post) lets the 3–5 trusted testers install exactly what the public will get, and lets
   auto-update prove itself. This is already half in the plan (W-3 "may stay private"); I would make "public, silent"
   the default. Needs the owner's yes, because it is his account.

2. **Use the animated film for the launch post, and record the real-screen walkthrough (B) for the website.**
   The first concept said "real screens only". I made an animated film instead because that was the task, and I think
   it is the better opening: it can show a file and a window side by side and a change travelling along links, which
   a screen recording cannot. But it is a drawing. Engineers will want to see the real window within a click — so B
   (or at least four real screenshots in the first comment) should follow quickly. If the owner prefers real screens
   only at launch, the film still works as a 48-second explainer on the website.

3. **Say "source-available" every time "free" is said.** The drafts mostly did; the end card of the film says only
   "Free for teams and companies" (no room for more). The post carries the word, so I left it — but if the owner wants
   it on the end card too, it is one line.

4. **"What it does not do yet" on the website should not be optional.** At 1.0 a regulated-industry reader assumes
   approvals and signatures. Saying no before they ask costs a few downloads and saves the product's name with the
   people who would have been disappointed.

5. **Do not post in LinkedIn groups in launch week.** The draft had groups in W+2 already, and I kept it there: one
   share after the launch post has comments on it reads as "people are discussing this", the same share on day 0
   reads as an advert.

6. **Post 4's first line.** The earlier draft opened with "Zero lines of code written by hand." It is true (F) and
   it will travel — and the discussion under it will be about AI, not requirements. The owner chose to let the
   product lead (D-3 A), so the new first line is quieter ("I have not written a line of reqochet's code. I decided
   what it should do."). If reach matters more than tone for this one post, the old line is the stronger hook.

## Decisions for the owner

| # | Question | Recommended |
| --- | --- | --- |
| F-1 | Launch film: the animated one, or wait for a recording of real screens? | **Animated at launch**, real-screen walkthrough within three weeks. |
| F-2 | Public repository visible two to three weeks before the announcement, without a post? | **Yes** — real installs before the real day. |
| F-3 | Sound on the film? | **None for LinkedIn** (it plays muted); add a licensed track later only for the website version. |
| F-4 | "Source-available" on the film's end card as well? | **No** — the post says it; the card stays readable on a phone. |
| F-5 | The sting hops along the letters — a small visual nod to the name, with no words. Fine with "no explanation of the name for now"? | **Yes** — it explains nothing, it only moves. If not, the same script can let the letters simply rise in. |
| F-6 | First-month targets: 150 downloads, 40 stars, 2 teams? | **Yes, as a baseline to compare against**, not a promise. |

## Checked facts

- File format, key order and the example file: user guide §15. The film's file leaves out the optional keys
  (priority, owner, tags, links).
- Suspect links: only links that point **to** the changed item turn suspect; changes to type, title or text trigger
  it; Keep / Unlink (user guide §6). The film shows exactly that — the changed item's own link to its parent stays calm.
- Field-by-field pull that asks only about real clashes; nothing force-pushed: README, user guide §8.
- Coverage rules and gaps, matrix to Excel: user guide §6 (0.20.0).
- Five languages, Ember, the 5.5 : 1 figure for Ember: CHANGELOG 0.22.0.
- 50,000 requirements tested: user guide §16.
- Not claimed anywhere as built: Word export, Windows 10, Linux, approvals, signatures, PDF.
