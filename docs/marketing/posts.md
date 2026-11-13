# Ready-to-paste drafts (13 Nov 2026; tightened in the Fable review)

Written in the owner's voice ("I"), for **LinkedIn** (the only channel for now — the owner, 13 Nov). The owner posts
everything himself.

**Before posting, every time**
- Replace `[link]` and `[version]`. Anything else in `[square brackets]` is a fact that is only true once 1.0 is out
  (Word export, Windows 10, Linux) — check the CHANGELOG, then keep the words or delete the sentence
  (positioning.md → "What is true on launch day").
- The first two lines are all that shows before "…see more": they must work alone.
- Upload the video or the pictures **into the post** (not as a link); put `[link]` in the first comment and say so in
  the last line. Three hashtags at most.
- Never "open source" — the licence is source-available. No explanation of the name.

---

## Post 1 — Launch (day 0, with `video/reqochet-45s-square.mp4` uploaded into the post)

> Requirements management without a server.
> Every requirement is a plain file in your own Git repository.
>
> Today I'm releasing reqochet 1.0 — a free desktop app for requirements engineering.
>
> It reads a folder of plain Markdown files as numbered documents, a table and a web of links. And it does the Git
> work for you, per requirement instead of per line:
>
> • Two people edit the same requirement? A pull combines their changes field by field and asks only when both
>   changed the same field.
> • A requirement changes its meaning? Every link to it is marked suspect until someone has looked at it.
> • What is not covered by a test yet? Coverage rules mark the gaps in the table; the matrix exports to Excel.
>
> No server, no database, no accounts. It works offline, and it was tested with 50,000 requirements.
> You can bring what you have: import from Excel, CSV or ReqIF — and leave again the same way[, or as a Word document].
>
> Free for everyone, companies included (source-available, PolyForm Shield licence). Runs on [Windows 10 and 11][ and Linux].
>
> What it does not do: approvals and signatures. If your team needs them — or something else — tell me in the
> comments; that list decides what comes next.
>
> Download, user guide and a sample project to open: link in the first comment.
>
> #RequirementsEngineering #SystemsEngineering #Git

First comment: `Download and source: [link] · Sample project to open: [link]`

Why this shape: the two opening lines are the promise from positioning.md; the three bullets are situations a
requirements engineer has met, each answered by the feature only reqochet has in this form; the limits are named
before a reader finds them; the last question invites the comments that tell us what to build.

Spare first lines, if the owner wants to try another (use one, not both):
- "Your requirements are in Word and Excel. Your code is in Git. Why not both in Git?"
- "This is a requirement:" + the picture of the file — then the text above from "Today I'm releasing…".

---

## Post 2 — The idea: plain files in Git (week 1, picture: the file next to the window — `video/reqochet-45s-poster.png`)

> This is a requirement. The whole of it.
>
> ```
> ---
> id: REQ-K7Q3XMB
> type: system-requirement
> title: Door lock
> status: Approved
> ---
> The door shall lock automatically within 2 s after the vehicle starts moving.
> ```
>
> One file per requirement. One folder per document. In the same Git repository as your code.
>
> What you get from that:
> 1. You own the data. Any text editor reads it; a script can check it.
> 2. History, branches and baselines are ordinary Git — the tools your developers already trust.
> 3. Nothing to install in a data centre, nothing to keep running.
>
> The hard part: Git sees lines, not requirements. That is the part reqochet does. It shows the files as a numbered
> tree (the numbers are calculated, never stored — moving a chapter rewrites nothing else), and it compares and merges
> per requirement and per field.
>
> IDs are random, so two people — or two branches — never create the same one.
>
> Free for teams and companies. Link in the first comment.
>
> #RequirementsEngineering #DocsAsCode #Git

---

## Post 3 — Ember and five languages (week 2, four pictures: Light, Dark, Ember, Arabic — or the 8-second cut of scene E)

> Engineering tools don't have to look like 2005.
> reqochet has a third look next to Light and Dark: Ember.
>
> Warm dark colours, orange accents and serif headings, for long evenings. Every text in Ember keeps a contrast of
> at least 5.5 : 1 — it is a look, not a strain.
>
> It also speaks five languages: English, Deutsch, Français, Español and العربية. In Arabic the whole window turns
> right to left — table, editor, menus, even the name.
>
> A company can set its own colours, fonts and logo in one theme file.
>
> Native speakers: each translation is one file with a word list. If a phrase sounds clumsy, an issue is very welcome.
>
> Link in the first comment.
>
> #RequirementsEngineering #UXDesign #Localization

(Changed: the contrast figure is stated for Ember only — that is what the CHANGELOG records; the earlier draft claimed
it for every mode.)

---

## Post 4 — Behind the scenes: built by one product owner with Claude (week 3 — decided, D-3 A)

> I have not written a line of reqochet's code.
> I decided what it should do. Claude, Anthropic's AI, wrote the code, the tests and the documentation.
>
> I installed every release on my own PC and reported what worked and what didn't. What made that hold together:
>
> • Small releases. Every version ended with a checklist of at most five steps for me to try.
> • Tests as the safety net: [number] automated tests, [number] scenarios that drive the real app, and a self-test
>   inside the app that anyone can run.
> • Reviewers. Before a release, separate AI reviewers checked the code, the screens and the tests; their findings
>   were fixed or argued.
> • Decisions written down. Every product question, my answer and the reason are in the repository.
>
> What it did not replace: knowing what requirements engineers need — and saying no.
>
> The source and the whole paper trail are public. Judge the result, not the method: link in the first comment.
>
> #AI #SoftwareEngineering #RequirementsEngineering

(Facts behind it: 734 unit tests and 14 e2e scenarios at 0.21.2, a 25-step in-app release self-test — STATUS.md.
Refresh both numbers from STATUS.md on the day. This is the **one** post about how it was built; the repository's
`HOW-IT-WAS-BUILT.md` carries the facts for everyone else.)

---

## Post 5 — One month later (week 4)

> reqochet, one month in. What you asked for, and what changed:
>
> • [most requested thing] — [done / planned for version X]
> • [second] — [...]
> • [fix that came from an issue]
>
> Thank you to everyone who opened an issue. The next thing on the list: [one item]. Link in the first comment.

---

## Short release note (GitHub release, first public version)

> **reqochet 1.0 — first public release**
>
> Requirements management without a server. Every requirement is a plain Markdown file in your own Git repository;
> reqochet shows them as numbered documents, a table and a web of links, and does the Git work at the level of a
> requirement. Offline. No server, no accounts.
>
> **In this version**
> - Requirements in documents (one folder each) with calculated outline numbers; item types and fields set up in the window
> - Typed links, suspect links, coverage rules with gaps marked, impact, traceability matrix with Excel export
> - Commit, pull, push and branches from the window; field-level merge; Changes view; history; baselines; old versions read-only
> - Import from Excel, CSV and ReqIF; export to Excel, ReqIF, CSV[, Word] and Markdown
> - Five languages (English, Deutsch, Français, Español, العربية); Light, Dark and Ember; automatic updates
>
> **Install:** download `reqochet-Setup-[version].exe` (or the `.zip`). [Windows 10 or 11], no administrator rights.
> Git for Windows is needed for history and sharing. The installer is not code-signed: if Windows warns you, choose
> **More info → Run anyway**. To check your download, compare its SHA-256 with: `[checksum]`.
>
> **Try it on real data:** clone the sample project [link] and open it.
>
> **Not in this version:** PDF and HTML export, approvals and signatures, comments inside the app.
>
> **Licence:** PolyForm Shield 1.0.0 — source-available, free for everyone including companies; building and selling
> a competing product from it is not allowed. **Problems:** open an issue and attach the report from
> Settings → Report a problem.
