# A drawn history for reqochet — visual idea

Asked by the owner on 13 Nov 2026. An idea with pictures, **not built and not planned yet**; no app code was changed.
Today Versions is a window with two lists (Baselines, History). The pictures show how the same information could
look as a drawing, and what that would add for requirement work.

- `fable-commit-graph/graph-light.png`, `graph-ember.png` — the whole project.
- `fable-commit-graph/requirement-light.png`, `requirement-ember.png` — the same view narrowed to one requirement.
- Drawn with the colours of `config/theme.json`; again with `node docs/reviews/agents/fable-commit-graph/render.mjs`.
  The data is made up (Door lock, Alice, Bob, Carol, Dana).

## The idea in one paragraph

Versions becomes a full view like Changes and Traceability. On the left, one row per saved version (commit), newest
on top, with a drawn line in front: one coloured line per branch, a line that leaves when a branch starts and comes
back where it was merged. A **baseline is a diamond on the line and a tinted row** — a milestone you can see from
across the room. Each row speaks in requirement terms ("1 changed · 1 added · 1 link added"), not in file terms. On
the right, the chosen version: which requirements changed, field by field, and where the change went (merged? in a
baseline yet?). The three actions that exist today stay: Open read-only, Compare with now, New baseline.

## What the drawing shows that a list does not

| In the drawing | Why it helps a requirements engineer |
| --- | --- |
| **Branch lines** leaving and returning | "Is change request 12 in main yet?" is answered by looking: the green line has come back. A list shows the same commits in time order, mixed together. |
| **An open line** with a dotted end (supplier-feedback) | Work that is still out and not merged — today only visible in the branch menu. |
| **Baseline diamonds** | What came before and after a delivery. "Not in a baseline yet — SRS-1.0 is 5 versions older" is the sentence an auditor asks for. |
| **Hollow dot** and the dashed dot on top | Not pushed yet, and not even committed yet — your own position on the line. |
| **Dotted bracket** beside the rows | What arrived with your last Pull, and from whom. After a pull today you see new rows in the table but not which versions brought them. |
| **Merge dot** with the other line's colour inside | Where two people's work met; the row says "combined field by field, nothing to decide" or "2 decisions". |
| **Requirement words on each row** | Nobody has to read commit messages to know what a version did. |

## The second picture: one requirement's life

The same view with a filter: "only versions that changed REQ-K7Q3XMB". The line shortens to the versions that touched
it, with a small "3 versions without a change" gap between them, and each row shows the field that changed
(Status Draft → Approved; Text 2 s → 1 s; Link added). The baselines stay on the line, so one reads directly:
approved for SRS-1.0 on Monday, text changed after that baseline — "changed since SRS-1.0". The side panel answers
"who changed what, when" per field, and shows the requirement as it was at the chosen version.
This is the History tab of the item editor, but placed against the project's milestones; the editor tab could simply
open this view with the filter set. The same filter works for a document or a person.

## What it could lead to later (ideas only)

- "What changed since baseline X" as a click on a diamond (it exists as Compare — the drawing makes it findable).
- A release note per baseline: the list of requirements changed between two diamonds, exported.
- A second kind of diamond for an approved or reviewed state, once approvals exist.
- Suspect links pointing back to the version that caused them ("suspect since this change" in the picture).

## Honest limits

- A drawn graph gets hard to read with many branches at once. Requirement projects usually have few (main and a
  handful of change requests), which is why it suits reqochet better than a code tool — but it needs a rule for
  more than about five lines (fold the oldest into "3 more branches").
- The line belongs to Git, the words must not: never show hashes, "HEAD", "origin" or "fast-forward" in the rows.
  The short hash stays only in the side panel for the person who needs it.
- "Arrived with your last pull" must be remembered by the app at pull time; Git does not keep it in a form that
  survives.
- In Arabic the line column moves to the right edge by itself; curves and brackets must be drawn mirrored (the
  drawing is made by the app, so this is a rule, not extra art).
- Colour alone must not carry meaning: each branch line also has its name pill, baselines have a shape.

## Rough size

| Part | Size | Notes |
| --- | --- | --- |
| Full Versions view with the line column (main only + baselines as diamonds, not-pushed dot, requirement words per row) | **Medium** — about one theme release | The data exists (history list, baselines, per-version changes); new is the view, the row summaries for many versions (needs the index, not Git calls per row) and the tests. |
| Branch and merge lines, open branches | **Medium** | Lane layout is a known algorithm; reading all branches' history is new for the core (one Git call, cached). |
| Filter to one requirement / document / person; opening it from the editor's History tab | **Small to medium** | Per-item history exists; the gaps and the "against the baselines" lines are new. |
| "Arrived with your last pull" bracket | **Small** | Store the position before each pull. |
| Keyboard, screen reader (rows read as "merge of change-request-12 by Alice, yesterday"), Arabic mirroring, 10,000-item project speed | Part of each step | The line is decoration for a screen reader; the row text must say everything the line shows. |

In all: about two theme releases if done fully; the first step alone (line + diamonds + requirement words) already
gives most of the value and could be tried by the owner before deciding on the rest.

## Questions for the owner (when the time comes)

1. Is this for after 1.0? (Recommended: yes — nothing in the 1.0 plan depends on it.)
2. Start with the simple line and the baseline diamonds, and decide on branch lines after trying it? (Recommended.)
3. Should the item editor's History tab stay as it is, or open this view filtered to the item?
