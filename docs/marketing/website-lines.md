# Website lines — proposals (13 Nov 2026)

For `website/index.html` (read-only for marketing; the web designer applies what the owner approves).
The owner decided on 13 Nov to **keep the headline and the Ember line** — so those stay; the changes below are around
them. Each row: current → proposed → why.

## Must change before launch (facts moved on)

| Where | Current | Proposed | Why |
| --- | --- | --- | --- |
| Hero note under the buttons | Free to try. Windows 11, no administrator rights needed. | **Free for everyone, companies included. Windows 11, no administrator rights.** | The licence is decided (PolyForm Shield). "Free to try" sounds like a trial that ends. |
| Download section title | Free to try. | **Free to use. At work too.** | Same reason; answers the first question a company reader has. |
| FAQ "What does it cost?" | reqochet is free to try. The licence terms are being settled… | **Nothing. reqochet is free for everyone, including companies and teams of any size. The source is public under the PolyForm Shield licence: you may use it, change it for yourself and read every line. The one thing not allowed is building and selling a competing product from it.** | Decided licence, in plain words. |
| Footer | Source-available licence (to be confirmed) | **Source-available · PolyForm Shield 1.0.0 · Source on GitHub** (links) | Decided; links build trust. |
| Download list | — | add: **Source, user guide and a sample project to open: on GitHub.** | The sample project is the best "try it" path. |
| Download list | — | add: **Windows 10 support comes next, then Linux.** | Many company PCs are still on Windows 10; tell them it is coming instead of losing them silently. |

## Recommended improvements

| Where | Current | Proposed | Why |
| --- | --- | --- | --- |
| Hero sub-paragraph | A Windows desktop app that reads a folder of plain Markdown files as a numbered tree, a table and a web of links, and does the Git work for you. It runs offline, with no server and no accounts. | **A Windows app for requirements engineering. It reads a folder of plain Markdown files as numbered documents, a table and a web of links — and does the Git work for you. Offline, no server, no accounts.** | Names the job ("requirements engineering") in the first five words, so the right reader recognises it; "numbered documents" is closer to how engineers think than "tree". |
| New short line under the three pillars | — | **Made for engineering teams who trace requirements to tests: automotive, medical, industrial, software.** | Tells visitors in one glance whether it is for them. |
| Git section sub-line | …nobody needs to learn a Git command. | keep, add: **Nothing is ever force-pushed.** | The single most reassuring fact for someone afraid of losing work. |
| Traceability title | See what is covered, and what a change will touch. | keep | Clear and benefit-led. |
| Import section title | It gets along with Excel, and with the tools you are leaving. | **Bring what you have: Excel, CSV and ReqIF.** (alt: keep current) | Current line is charming but vague on first read; the alternative states the formats. Owner's taste call. |
| New small section before Download (optional) | — | Title **What it does not do yet** · body: **Word, PDF and HTML export, approvals and signatures, and comments inside the app are planned. Today these happen in your Git host and in Excel.** | Honest limits stop disappointed downloads and earn engineers' trust; the FAQ already has the Word part. |
| New proof line in Files section | — | **Tested with 50,000 requirements.** | A fact (user guide §16) that answers "will it scale?". |
| `<meta name="description">` | reqochet is a Windows desktop app for requirements. Every requirement is a plain Markdown file in your own Git repository. Offline, no server, no accounts. | **reqochet: requirements management without a server. Every requirement is a plain Markdown file in your own Git repository — with traceability, coverage and requirement-level Git. Free for teams. Windows 11.** | Puts the search terms people type ("requirements management", "traceability") into the search snippet. |
| `<title>` | reqochet — requirements as plain files in your own Git repository | **reqochet — requirements management in your own Git repository** | Same idea; leads with the category people search for. |
| Questions title | Questions people ask first | keep | Good. |
| FAQ, new | — | **Q: Is it open source?** A: **It is source-available: the code is public and free to use, but the licence (PolyForm Shield) does not allow selling a competing product built from it. That is the only difference that matters for most users.** | Will be asked on day one; better to answer than to be "corrected". |
| FAQ, new | — | **Q: Does it work with GitLab or Azure DevOps?** A: [owner/Claude to confirm before publishing — today the guide and tests use GitHub; plain push and pull use your installed Git] | Will be asked; answer only after it is tested (decision D-7). |

## Section title set (for a quick scan of the whole page)

1. Every requirement is a file in your own Git repository. / reqochet is the window onto them. *(kept)*
2. Offline. · No server. · No accounts. *(kept)*
3. A folder is a document. A file is a requirement. *(kept — strong)*
4. Git, at the level of a requirement. *(kept)*
5. See what is covered, and what a change will touch. *(kept)*
6. Bring what you have: Excel, CSV and ReqIF. *(proposed)*
7. For long evenings, there is Ember. *(kept — owner decision)*
8. Five languages, and one of them reads right to left. *(kept)*
9. What it does not do yet. *(proposed, optional)*
10. Free to use. At work too. *(proposed)*
11. Questions people ask first. *(kept)*
