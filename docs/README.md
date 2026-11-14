# Documentation map

Which file answers which question. Every file starts with a short "what this is" line.

## Start here

| If you are… | Read |
| --- | --- |
| **A new chat / AI session continuing the work** | `docs/HANDOVER.md` (one paste to start), then `CLAUDE.md` |
| **A new engineer** | `docs/ONBOARDING.md` (30 minutes, with diagrams), then `CLAUDE.md`, `docs/ARCHITECTURE.md` |
| **The product owner** | `docs/TESTING.md` (your current checklist), `CHANGELOG.md` (what each version changed) |

## Everything

| Question | File |
| --- | --- |
| Rules, commands (project memory) | `CLAUDE.md` |
| Current status, versions, next step | `docs/STATUS.md` |
| What did the owner decide, and why? | `docs/design/decisions.md` |
| What is the product and what must it do (FR/NFR)? | `docs/design/requirements.md` |
| What is built, where each requirement stands, what comes next? | `docs/design/roadmap.md` |
| How do the big RM tools work? (frozen study, 24–25 Oct 2026) | `docs/design/analysis.md` |
| What is being discussed or analysed right now? | `docs/reviews/` (index in its README; finished ones in `done/`) |
| How is the code organised (modules, rules, data format, UI parts)? | `docs/ARCHITECTURE.md` |
| How does data move through the system (diagrams)? | `docs/ONBOARDING.md`, `docs/diagrams/index.html` |
| Which mistakes already cost time? | `docs/PITFALLS.md` |
| How is reqochet tested (automated, self-test, manual checklist, logs, bug reports)? | `docs/TESTING.md`; older checklists in `docs/testing/past-checklists.md` |
| What changed in each version, and what did the owner report? | `CHANGELOG.md` |
| How do I set up a Windows PC for development? | `docs/DEVELOPING.md` |
| How do I use the app (user guide, quick start, specification)? | `docs/USER-GUIDE.md` |
| How do I change colours, fonts, logo? | `docs/THEMING.md` |
| Which Git hosts work, where is Git called, how to add help for a host? | `docs/guides/git-hosts.md` |
| Which words does the German / French / Spanish / Arabic window use? | `docs/guides/glossary-de.md`, `glossary-fr.md`, `glossary-es.md`, `arabic-glossary.md` |
| Positioning, launch plan, posts, website lines, video? | `docs/marketing/` |
| How do I turn a folder of Word specifications (several versions per module) into a reqochet project, and make the company Word template, with an AI model? | `docs/guides/word-template-prompt.md` |
| How do I get a UI/UX review of the app from an AI agent? | `docs/guides/ui-review-prompt.md` |
| How do the helper agents (reviewer, QA, UI/UX) work without conflicts? | `docs/AGENT-WORKFLOW.md` |
| What does each script do? Which working procedures (skills) exist? | `tools/README.md`, `.claude/skills/` |

## Keeping it tidy

- Status lives only in `docs/STATUS.md` and `CHANGELOG.md`; other files link there.
- `docs/TESTING.md` holds the current and the previous checklist; move older ones to `docs/testing/past-checklists.md`.
- A review or analysis moves to `docs/reviews/done/` once every point in it is decided.
- New decisions go to `docs/design/decisions.md` (and the release plan to `roadmap.md`).
