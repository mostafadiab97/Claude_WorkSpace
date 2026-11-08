# Theme 1b — traceability views: open details (8 Nov 2026)

Scope already decided: P-06 (all of theme 1), P-07 (coverage rules shared in `schema.yaml`), P-08 (matrix: rows = one
item type, columns = another, filtered by the current filter, Excel export), decisions.md "report, not enforce"
(rules are warnings and coverage gaps; formal enforcement belongs to later commercial versions). The owner chose 1b
as the next version (0.20.0) on 8 Nov 2026. The points below are the details still open; nothing is built until they
are answered.

| ID | Point | Recommendation (R) | Decision |
| --- | --- | --- | --- |
| T-01 | Where the views live | A **Traceability** button in the top bar opens a full-width view like Changes, with tabs **Coverage** and **Matrix**; the impact chain is a tab **Impact** in the item editor (next to Details and History) | **C 8 Nov: as recommended** (top-bar view with Coverage + Matrix, Impact tab in the editor) |
| T-02 | Starter rules in new projects | Stakeholder Need → refined by ≥ 1 System Requirement; System / Software / Hardware / Interface Requirement → verified by ≥ 1 Test Case; Risk → mitigated by ≥ 1 requirement. Existing projects get them offered once (not forced) | **C 8 Nov: starter set**, offered once to existing projects |
| T-03 | Editing rules | In the window: a **Rules** tab in the item-types dialog (type, link type, direction, at least N); `schema.yaml` stays the store | **C 8 Nov: in the window** (Rules tab in the item-types window) |
| T-04 | Warning or error | Warnings only in the app; each rule also stores a level (warning / error) for the later command-line check in CI (P-32) | **C 8 Nov: warnings, level stored** for the later CI check |
| T-05 | What is counted | Items whose status is Obsolete are not counted; links count across documents; the view follows the document picker | **C 8 Nov: skip Obsolete**, links across documents, follows the document picker |
| T-06 | Impact chain | Everything that depends on the item, all levels down (items that refine, verify, implement, mitigate it, and its children), as a tree with suspect marks; also reachable from a changed item in Changes | **C 8 Nov: all levels as a tree**, also from Changes |
| T-07 | Big matrices | (technical, builder) rows = the filtered items of the row type, columns = only items of the column type linked to them; above ~300 columns the view switches to a list "row → linked items"; Excel export always has the full grid | builder (technical), as written |
| T-08 | Completeness warnings | A small gap mark in the table rows (like the incomplete "!"), a **Coverage gaps** group in the Problems panel, and coverage % per rule in the Coverage view | **C 8 Nov: all three** — row mark, Problems group, Coverage gaps filter |

## Discussion log

- 8 Nov 2026 — list written; T-07 is a technical choice (explained to the owner, not asked).
- 8 Nov 2026 — the owner answered T-01…T-06 and T-08: all as recommended (T-08: row mark + Problems + filter). Built as 0.20.0.
