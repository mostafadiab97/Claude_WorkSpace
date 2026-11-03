# Hand-over — starting a new chat (or a new team) without losing anything

Everything that matters lives in this repository: decisions, status, plan, procedures, pitfalls. A new chat needs
no memory of the old one — only these files.

## The message to paste into a new chat

Copy everything in the box into the first message of the new chat:

```
You are continuing the development of ReqMan (working name; a new name is being chosen), a serverless,
Git-based requirements-management desktop app. You write all the code, tests and docs; I (the owner) am the
product owner: I decide the product, install every release on my Windows 11 PC and report back.

1. Add and clone the repository <owner>/Claude_WorkSpace, and clone the test data
   <owner>/Claude_SandBox next to it (never inside).
2. Read CLAUDE.md completely, then docs/README.md, then the open files in docs/reviews/
   (start with 2026-11-01-planning-discussion.md).
3. Run `npm ci` and `npm run check` to confirm everything is green.
4. Tell me in a few lines where we are (last version, what I reported, what is open) and continue with the
   next open point. Use the skills in .claude/skills/ (owner-decision-walkthrough for questions,
   release-to-owner for every release).
```

## What the new chat will find

| Need | Where |
| --- | --- |
| Rules that must never be broken, commands, release steps | `CLAUDE.md` |
| Current status, next step, decisions waiting | `CLAUDE.md` → "Status" and "Where we are right now" |
| Every decision with its date and reason | `docs/design/decisions.md`, `docs/design/roadmap.md`, discussion logs in `docs/reviews/` |
| Working procedures (how releases and decision rounds are done) | `.claude/skills/` |
| Mistakes not to repeat | `docs/PITFALLS.md` |
| Working agreement (how releases are tested, how decisions are asked) | `CLAUDE.md` → "How to work with the owner" |

## Before the old chat ends (checklist for the outgoing session)

- Everything committed and pushed (`git status` clean, `git log origin/main..` empty).
- `CLAUDE.md` "Where we are right now" names the last version, the owner's last report and the next open point.
- Any half-finished work is either finished, or described in "Where we are right now" with the branch/files.
