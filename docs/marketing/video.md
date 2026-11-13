# Video concepts (13 Nov 2026)

Rules for both: record **real app screens** from the public **sample project** (reqochet's own requirements — real,
fictional-free, and anyone can open the same data afterwards). No mock-ups, no features that are not built. Captions
burnt in (LinkedIn autoplays muted). 1920×1080 master; a 1080×1350 crop for the LinkedIn feed.

**Free tools:** OBS Studio (screen recording), Clipchamp (comes with Windows 11; free tier exports 1080p) or
DaVinci Resolve / Shotcut / Kdenlive (free) for editing; music from the YouTube Audio Library or another library whose
licence allows commercial use without attribution conflicts — check the licence of the chosen track and note it in the
release folder. Before recording: Windows at 125 % scaling, a clean desktop, notifications off, the app maximised,
mouse highlight on in OBS.

---

## A. "The file and the window" — 45 seconds (launch post)

**Music mood:** calm, steady electronic or soft piano, ~90 BPM, no vocals. A single soft hit at the Ember switch.

| # | Time | Shot (real screen) | On-screen text |
| --- | --- | --- | --- |
| 1 | 0–4 s | Notepad with `REQ-K7Q3XMB.md` (header + one sentence) | **This is a requirement.** |
| 2 | 4–8 s | Explorer: `requirements/System/` full of `.md` files next to `src/` | **A plain file in your own Git repository.** |
| 3 | 8–14 s | reqochet opens the same folder: tree table with outline numbers; click the same requirement, editor shows it | **reqochet is the window onto them.** |
| 4 | 14–20 s | Drag a requirement to another chapter; numbers renumber | **Numbers are calculated. Nothing else is rewritten.** |
| 5 | 20–27 s | Changes view: one requirement, status Draft → Approved, text difference | **Review changes per requirement, not per line.** |
| 6 | 27–33 s | Traceability → Coverage, gap dot in the table; then the matrix | **See what is covered — and what is not.** |
| 7 | 33–38 s | Colour switch: Light → Dark → Ember; language switch to Arabic, the window mirrors | **Ember. Five languages.** |
| 8 | 38–45 s | Logo on Ember background | **reqochet — offline · no server · no accounts. Free for teams. Windows 11.** + link |

---

## B. "A day with reqochet" — about 2 minutes (website and W+3)

**Story:** two engineers on one project, one change request, from edit to merged — the prototype journey from the
product definition, shown for real. Record with two clones of the sample project (as in the owner's two-folder trial)
so the pull and the decision window are genuine.

**Music mood:** light, optimistic, low in the mix; voice-over optional (captions carry the story either way).

| # | Time | Shot | Caption / voice-over |
| --- | --- | --- | --- |
| 1 | 0:00–0:10 | Explorer: repository with `src/` and `requirements/` | "Your requirements, in the same repository as your code. Plain files." |
| 2 | 0:10–0:25 | Open the folder in reqochet; documents bar; tree table; Show text on | "reqochet reads them as documents with numbered chapters." |
| 3 | 0:25–0:40 | New requirement under a chapter; set type and status; add a `verifies` link from a test case | "Write, structure and link. IDs are random — no clashes, even on branches." |
| 4 | 0:40–0:55 | Branch button → new branch `change-request-12`; edit two requirements | "A change request gets its own branch." |
| 5 | 0:55–1:05 | Changes → Commit → Push | "Review, commit and push — only the requirements folder, never forced." |
| 6 | 1:05–1:25 | Second window (colleague's clone): Pull; a clash on the same field; the decision window — choose "theirs" for one field | "Different fields are combined. Only real clashes ask." |
| 7 | 1:25–1:40 | A suspect link appears; open it; Keep | "When a linked requirement changes meaning, the link is marked for review." |
| 8 | 1:40–1:50 | Compare branch with main; then Versions → baseline | "Compare like a pull request. Mark a baseline." |
| 9 | 1:50–2:00 | Export → matrix to Excel; Excel opens it | "Hand the matrix to an auditor or a supplier." |
| 10 | 2:00–2:10 | End card | "reqochet. Free for teams and companies. Windows 11. Link below." |

**Cut-downs from B:** 15 s each for the "pull asks only what it must" scene (6) and the "Ember / Arabic" switch — good
for posts 2 and 3.

## Do not show

The owner's name, account, e-mail, GitHub user name or any real company repository (the privacy rule applies to
videos too — check the Git identity shown in Settings and in commit history before recording). Features not built:
Word export, approvals, in-app pull requests.
