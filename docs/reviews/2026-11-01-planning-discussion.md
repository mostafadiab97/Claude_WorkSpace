# Planning discussion — the versions after 0.13 (started 1 Nov 2026)

Mostafa asked for a long planning discussion "like the ones we had when we first started" before the next versions
are fixed. Input: `2026-10-31-feature-catalogue.md` (163 features, IDs A1…O5) and `2026-10-31-rm-tools-market-list.md`.
Method: the `owner-decision-walkthrough` skill — one small group of questions at a time, recommendation first, every
answer recorded here (and in `docs/design/decisions.md` as C when it changes the product).

## Open points

| ID | Question | Recommendation (R) | Decision |
| --- | --- | --- | --- |
| P-01 | Goal of the next phase: real use by a first team (pilot) soon, or prepare the commercial product? | A pilot team first — real use finds the important gaps faster than any list | **C 1 Nov: a) pilot team first** |
| P-02 | Order of the six themes (catalogue, last section) | 1 traceability views → 2 daily comfort → 3 documents out → 4 review on GitHub → 5 engineering traceability → 6 later/commercial | **C 1 Nov: as recommended; details per theme to be discussed** |
| P-03 | Release rhythm | One theme per minor version (≈ 1–2 weeks each), fixes as patch versions in between, ≤ 5-step checklists | **C 1 Nov: yes** |
| P-04 | The new name: when | Rename in its own version as soon as the name is chosen, before a pilot team starts | **C 1 Nov: yes** |
| P-05 | Who is the pilot team (size, field, what they write requirements for, what they use today)? | — (information) | **1 Nov: ~50 users; embedded devices; ISO 26262 + ASPICE; today DOORS and Jama, Excel when no licence, one client wants Word; all know Git/GitHub** |
| P-06 | Theme 1 scope: types + link types in the window, required fields, matrix, coverage rules + gaps, impact chain | all six in one version (0.14.0), matrix last if it grows | **C 1 Nov: keep all six** (Mostafa asked how this fits document-to-document traceability → P-09) |
| P-07 | Where coverage rules live | in `schema.yaml` (shared through Git, like fields) — everyone sees the same gaps | **C 1 Nov: a) shared in schema.yaml** |
| P-08 | Matrix view: what it shows by default | rows = one item type, columns = another, filtered to the current filter; export to Excel | **C 1 Nov: as recommended** |
| P-09 | Documents (DOORS modules / Jama sets) as a first-class idea: several specifications in one project, each with its own tree and outline numbers, links between them | yes, inside one repository, in the theme 1 version (a revisit of the 26 Oct rule "one tree per repository"); cross-repository links later | **C 1 Nov: a) documents inside one repository in theme 1; cross-repository links planned for later** — Mostafa's idea: a repository tag before the ID (IDs are unique only within one repository); R: a short alias per linked repository declared in the schema (alias → address), so renaming a GitHub repository does not break links |
| P-10 | Baselines again: ASPICE (SUP.8) and ISO 26262 expect named, frozen baselines | un-delay: Git tags as baselines, compare against a baseline — in theme 4 or earlier | **C 1 Nov: a) un-delayed, in the theme 1 version** (create with name + note → annotated tag pushed; Baselines list; "compare with baseline" in Changes; open a baseline read-only; GitHub tag protection) |
| P-11 | Word: the pilot has a client who wants Word | keep "Documents out" (Word/PDF export) as theme 3; Word **import** of that client's documents as part of it | **C 1 Nov: no Word import** (foreign Word files cannot be guaranteed to follow rules — would be buggy). Formats: **import** Excel, ReqIF, CSV, ReqMan repositories; **export** Excel, ReqIF, CSV, ReqMan repositories, Markdown, Word, PDF |
| P-12 | Theme 2 (daily comfort) core: A14 bulk edit, A13 duplicate, B7 saved views, A8 templates per type, D8 restore an older version of one item | all five in the theme 2 version | *asked 2 Nov* |
| P-13 | Duplicate (A13): what is copied | fields + text with new IDs; children only if ticked; links **not** copied (a copy would claim traces nobody checked) | *asked 2 Nov* |
| P-14 | Saved views (B7): personal or shared | both: personal on this PC, "share with the team" writes `requirements/.reqman/views.yaml` (travels through Git) | *asked 2 Nov* |
| P-15 | Writing help: A9 EARS / user-story patterns, G1 wording hints (vague words, missing "shall", two "shall" in one sentence, passive voice), A11 spell check | patterns offered as templates; hints shown in yellow, never block saving, word list editable in `schema.yaml`; spell check = the free one built into the window (English) | *asked 2 Nov* |
| P-16 | C12 external references (a Jira ticket, a datasheet PDF, a web page) | move to theme 5 (engineering traceability, next to links to code and tests) | *asked 2 Nov* |

## Name candidates checked 1 Nov 2026 (web search for the exact word; not a trademark check)

| Name | Idea | Search result |
| --- | --- | --- |
| reqochet | a change ricochets through the links | nothing found |
| Shallmark | "shall" (the word in every requirement) + hallmark (mark of quality) | nothing found |
| Threadwise | requirements as threads you can follow | nothing found (only KDE "ThreadWeaver") |
| Linkwell | links done well | no software found |
| Ripplewise | change ripples outward | nothing found, but "Ripple" (crypto) fills search results |
| Upstrand | upstream + strand | nothing found; sounds like "Upland Software" |
| Sutra, Nexum, Shallot, Knotwork, Weft, Kinlink | — | taken (Sutra: USGS tool + LMS; Nexum: several companies; Shallot: file manager; Knotwork: AI app; Weft: several dev tools; Kinlink: an awkward near-match "KinkLink") |

## Discussion log

- 1 Nov 2026 — name candidates proposed by Mostafa: reqochet, reqotta, reqlace, reqtie, mavereq,
  genereq. Recommendation: reqochet (reqtie sounds like Reqtify; reqlace like "replace").
- 1 Nov 2026 — P-01 a (pilot team first), P-02 order as recommended (details per theme later), P-03 yes (one theme per
  minor version, fixes as patches), P-04 yes (rename in its own version before the pilot starts).
- 1 Nov 2026 — P-05 pilot: ~50 users, embedded devices, ISO 26262 + ASPICE, DOORS/Jama today (Excel without licence,
  one client on Word), all know Git/GitHub. P-06 keep all six; P-07 a (shared rules); P-08 as recommended. Mostafa's
  question: "doesn't traceability work by linking SW requirements (one document) to system requirements (another
  document)?" → answered, new points P-09 (documents), P-10 (baselines), P-11 (Word).
- 1 Nov 2026 — P-09 a, with cross-repository links later (repository prefix before the ID). P-10: Mostafa asked what a
  baseline is (branch that is never deleted, or a stored commit?) → explained (a tag); P-11: Mostafa recalled that Word
  import was promised only for ReqMan-generated files → clarified (round trip vs import by rules).
- 1 Nov 2026 — P-10 a (baselines back, theme 1). P-11: no Word import at all; import = Excel, ReqIF, CSV, ReqMan
  repositories; export = Excel, ReqIF, CSV, ReqMan repositories, Markdown, Word, PDF. Documentation reorganised
  for hand-over (`docs/README.md`, `docs/HANDOVER.md`).
- 2 Nov 2026 — theme 2 (daily comfort) opened: P-12 … P-16 asked.
