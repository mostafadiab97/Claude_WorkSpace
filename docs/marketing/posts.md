# Ready-to-paste drafts (13 Nov 2026)

Written in the owner's voice ("I"). Replace `[link]`, `[version]`. Every claim is in the user guide or CHANGELOG.
LinkedIn: keep the first two lines strong (they show before "…see more"); put the link in the first comment or at the
end; three hashtags at most.

---

## Post 1 — Launch (W0, with the 30–60 s video)

> Requirements management without a server.
>
> Today I'm releasing reqochet, a free Windows app for requirements engineering.
>
> The idea is simple: every requirement is a plain Markdown file in your project's own Git repository. reqochet is the
> window that understands those files — a numbered tree, a table, typed links — and does the Git work for you.
>
> What that gives a team:
> • No server, no database, no accounts. Who may read or write is decided by your Git host, as for your code.
> • Changes reviewed per requirement and per field, not per line of text. A pull combines changes field by field and
>   only asks when two people changed the same field.
> • Traceability that is checked: coverage rules, gaps marked in the table, suspect links, impact, and a matrix you
>   can export to Excel.
> • Bring what you have: import from Excel, CSV or ReqIF; export to ReqIF, Excel, CSV and Markdown.
> • Works offline. Tested with 50,000 requirements.
>
> It is free for everyone, companies included (PolyForm Shield licence — source-available). Windows 11 today,
> Windows 10 next.
>
> What it does not do yet: Word/PDF export, approvals and signatures. I'd like to hear which of these you'd need first.
>
> Download, user guide and a sample project to open: [link]
>
> #RequirementsEngineering #SystemsEngineering #Git

---

## Post 2 — The idea: plain files in Git (W+1, with the image "file next to window")

> What if your requirements lived next to your code — in the same repository, as plain text?
>
> This is a requirement in reqochet:
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
> One file per requirement. A folder per document. Links are stored on the requirement they start from.
>
> Why this matters:
> 1. You own the data. Any text editor can read it; a script can check it.
> 2. History, branches and baselines are ordinary Git — the same tools your developers already trust.
> 3. Nothing to install in a data centre, nothing to keep running.
>
> The hard part is that Git sees lines, not requirements. That is the part reqochet does: it shows the tree with
> outline numbers (calculated, never stored, so moving a chapter rewrites nothing else), and it compares and merges
> per requirement and per field.
>
> IDs are random, so two people — or two branches — never create the same one.
>
> Free for teams and companies: [link]
>
> #RequirementsEngineering #DocsAsCode #Git

---

## Post 3 — Ember and five languages (W+2, carousel of 4 images: Light, Dark, Ember, Arabic)

> Engineering tools don't have to look like 2005.
>
> reqochet [version] has three looks: Light, Dark and Ember — warm dark colours, orange accents and serif headings for
> long evenings. Or it follows Windows. Every text in every mode keeps a contrast of at least 5.5 : 1.
>
> And it speaks five languages: English, Deutsch, Français, Español and العربية. In Arabic the whole window turns
> right to left — table, editor, menus, even the name.
>
> Companies can set their own colours, fonts and logo in one theme file.
>
> Native speakers: each translation is one file with a word list. If you find a clumsy phrase, an issue is very
> welcome.
>
> [link]
>
> #UXDesign #RequirementsEngineering #Localization

---

## Post 4 — Behind the scenes: built with an AI team (optional, W+3 — only if the owner chooses D-3 B or C)

> One product owner. Zero lines of code written by hand.
>
> reqochet was built by me deciding what the product should do, and Claude (Anthropic's AI) writing all of the code,
> the tests and the documentation. I installed every release on my own PC and reported back what worked and what
> didn't.
>
> What made it work:
> • Small releases. Each version ended with a checklist of at most five steps for me to test.
> • Tests as the safety net: hundreds of automated tests, end-to-end scenarios that drive the real app, and a
>   self-test inside the app that anyone can run.
> • Helper reviewers. Before a release, separate AI reviewers checked the code, the screens and the tests, and their
>   findings were fixed or argued.
> • Decisions written down. Every product question, my answer and the reason are in the repository.
>
> What it did not replace: knowing what requirements engineers need, and saying no.
>
> The source and the documentation are public: [link]
>
> #AI #SoftwareEngineering #ProductManagement

(Facts behind it: 734 unit tests and 14 e2e scenarios at 0.21.2, a 25-step in-app release self-test — STATUS.md. If the
owner wants exact numbers in the post, refresh them from STATUS.md on the day.)

---

## Post 5 — One month later (W+4, optional)

> reqochet, one month in. What you asked for, and what changed:
>
> • [most requested thing] — [done / planned for version X]
> • [second] — [...]
> • [fix that came from an issue]
>
> Thank you to everyone who opened an issue. [link]

---

## Short release note (GitHub release, first public version)

> **reqochet [version] — first public release**
>
> reqochet is a Windows desktop app for requirements. Every requirement is a plain Markdown file in your own Git
> repository; reqochet shows them as a numbered tree, a table and a web of links, and does the Git work at the level of
> a requirement. Offline. No server, no accounts.
>
> **In this version**
> - Requirements in documents (one folder each) with calculated outline numbers, item types and fields set up in the window
> - Typed links, suspect links, coverage rules with gaps marked, impact, traceability matrix with Excel export
> - Commit, pull, push and branches from the window; field-level merge; Changes view; history; baselines; old versions read-only
> - Import from Excel, CSV and ReqIF; export to Excel, ReqIF, CSV and Markdown
> - Five languages (English, Deutsch, Français, Español, العربية), Light / Dark / Ember, automatic updates
>
> **Install:** download `reqochet-Setup-[version].exe` (or the `.zip`). Windows 11, no administrator rights. Git for
> Windows is needed for history and sharing. The installer is not code-signed yet: if Windows warns you, choose
> **More info → Run anyway**. SHA-256: `[checksum]`.
>
> **Try it on real data:** clone the sample project [link] and open it.
>
> **Not yet:** Word / PDF / HTML export, approvals and signatures, Windows 10 and Linux.
>
> **Licence:** PolyForm Shield 1.0.0 — free for everyone, including companies; building and selling a competing
> product is not allowed. **Problems:** open an issue and attach the report from Settings → Report a problem.
