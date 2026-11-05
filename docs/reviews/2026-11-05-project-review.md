# Whole-project review — 5 Nov 2026 (after v0.16.2)

**Scope:** the whole repository at v0.16.2 (≈ 19,300 lines in `src/`, 411 unit tests, 8 e2e scenarios, CI, docs), read by
seven helper agents one area at a time (the owner, 5 Nov 2026), from the review pack
`docs/reviews/agents/whole-project-pack.md`. **No product code was changed.** Each report lists every finding with
evidence (F = checked, I = inferred), severity and a suggested fix; this file is the index and the plan.

## The reports

| Report | Area | High | Medium | Low |
| --- | --- | --- | --- | --- |
| `agents/whole-project-security-reviewer.md` | paths, logs, CI, libraries | 0 | 5 | 13 |
| `agents/whole-project-arabic-reviewer.md` | Arabic texts, right-to-left | 0 | 5 | 8 |
| `agents/whole-project-code-reviewer-1.md` | core modules (store, Git, merge, index) | 1 | 6 | 19 |
| `agents/whole-project-code-reviewer-2.md` | screens | 1 | 4 | 14 |
| `agents/whole-project-code-reviewer-3.md` | main process, import/export, tests, docs | 0 | 8 | 26 |
| `agents/whole-project-qa-tester.md` | 30 tests reproducing findings + new defects | 0 | 1 | 3 |
| `agents/whole-project-performance-tester.md` | 10k/50k speed, memory | 0 | 2 | 6 |
| `agents/whole-project-ui-ux-reviewer.md` | every screen, accessibility, pilot readiness | 4 | 10 | 12 |
| **Total** | | **6** | **41** | **101** |

QA turned 26 High/Medium findings into tests that fail today (`tests/qa-whole-project-*.test.ts`, `it.fails`); a fix
is done when its test passes (the `.fails` is then removed). Every High/Medium finding is checked against the code by
the builder before it is fixed.

## The six High findings

- **CR1-01** a second "Pull from…" the same branch can split one requirement into two (new ID for your copy).
- **CR2-01** the ✕ beside the project name closes it without asking — unsaved edits lost; clickable during pull/push.
- **UX-W01** first run: one grey line, no hint about Import or what to do first.
- **UX-W02** the Links column speaks in symbols (`→1 ⚠1`) explained only in mouse tooltips.
- **UX-W03** the row menu opens only with the right mouse button — no keyboard way.
- **UX-W05** the top bar speaks Git ("Changes (8)", Pull, Push) — counts files, not requirements.

## Proposed plan (R — for the owner to confirm)

| Version | Name | Contents |
| --- | --- | --- |
| 0.16.3 | Stabilisation 1 — data and safety | CR1-01…05, CR2-01…03, CR2-05, CR3-01…06, CR3-25, SEC-01…06, QA-WP-01, the owner's SEC-05/SEC-07 answers; QA tests turn green; main process into the coverage floor (CR3-28) |
| 0.16.4 | Stabilisation 2 — speed, Arabic, docs, first run | PQ-01, PQ-02, CR2-04, AR-01…05, AR-11, CR1-08 (core messages in Arabic), UX-W01, UX-W02, UX-W03, UX-W05, the docs that no longer match, the Low findings that are quick |
| 0.17.0 … | 1a structure (documents as folders, …) | as decided; UX findings about documents/DOORS habits (UX-W25) placed there; remaining Lows sorted into later versions |

## Questions for the owner (collected from all reports)

1. CR1-01 — same requirement back from a branch: a) treat as the same requirement, ask only about differing parts (R) · b) today's rule (new ID)
2. CR1-12 — "Undo last commit" right after a pull: a) hide it (R) · b) keep with a warning
3. CR2 — ✕ beside the project name asks Save / Discard / Keep editing: a) yes (R) · b) no
4. CR2 — Push while an item has unsaved edits: a) disabled like Pull (R) · b) save first, then push
5. CR2 — where a new item goes: a) correct the guide now (R) · b) change the app (next to the selected item)
6. CR3-04 — updating an `.xlsm`: a) only "Update a copy" as .xlsx (R) · b) try to keep the macros
7. CR3-06 — updating your own CSV: a) leave unchanged cells exactly as they were (R) · b) protect every cell like an export
8. UX-W05 — the Changes counter: a) count requirements and links, not files (R) · b) keep files
9. UX-W25 — a "Coming from DOORS or Jama?" guide page: a) before the pilot (R) · b) after the pilot's first feedback
10. UX-W03 — keyboard access to every action required for the pilot: a) yes, in 0.16.4 (R) · b) later
11. The plan above: a) as proposed (R) · b) changes

## Discussion log

- 5 Nov 2026 — all eight reports in; plan and questions sent to the owner.
