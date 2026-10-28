---
name: "owner-decision-walkthrough"
description: "Discuss open product questions or review findings with a non-specialist product owner one point at a time, with a recommendation first, and record each answer in the project docs."
---

# Owner decision walkthrough

Use when a product owner must decide several things (feature requests, review findings, a release plan) and is
not a specialist in this field (e.g. an embedded C developer building a desktop tool). Product decisions are
the owner's; technical decisions are yours, explained in a sentence.

## Before starting

1. Collect every open point in one numbered list in a project file (e.g. `docs/reviews/<date>-review.md`,
   section "Discussion log"), with an ID per point (O-01, D-03, S-04 …). Never change code for these points
   until the owner has confirmed what to do.
2. Propose an order (defects first, then speed, then structure, then process) and group small points so one
   message covers 2–4 of them.

## For each point (or small group)

1. **What it is**, from first principles, in 2–4 short sentences. Explain any term in one line; use an analogy
   from the owner's own field where it helps (C: a mutex for a queue, `fsync`+rename for an atomic write).
2. **What happens if we do nothing** (concrete: "two files with one ID after a merge").
3. **Options**, recommended one first and marked "(recommended)", each with its cost in plain words.
4. **One direct question** per decision, numbered so the owner can answer "1. yes 2. option B".
5. Keep messages short: the owner asks "explain more" when he wants depth. Facts, inferences and
   recommendations stay visibly separate.

## After each answer

1. Record it at once: in the discussion log (date, the point, the decision in one or two lines) and, if it
   changes the product, in the design document as a confirmed decision (tag C).
2. Restate decisions that change earlier ones ("replaces the M5 rule 'pull before compare'").
3. If the answer adds a feature, place it in the plan and say where ("version 0.11.0, with the Excel export").
4. Move on to the next point without re-asking settled ones.

## At the end

1. Turn all decisions into a release plan table (version, name, contents, why in this order) and ask once for
   confirmation.
2. Write the confirmed plan into the design document and the project memory (e.g. CLAUDE.md "Where we are
   now" and "Status"), and mark each review point with the version that will carry it.
3. Then start the first version of the plan; do not wait for a second confirmation unless the owner asked.