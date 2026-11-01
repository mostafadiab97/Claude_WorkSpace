# Planning discussion — the versions after 0.13 (started 1 Nov 2026)

The owner asked for a long planning discussion "like the ones we had when we first started" before the next versions
are fixed. Input: `2026-10-31-feature-catalogue.md` (163 features, IDs A1…O5) and `2026-10-31-rm-tools-market-list.md`.
Method: the `owner-decision-walkthrough` skill — one small group of questions at a time, recommendation first, every
answer recorded here (and in `docs/design/DESIGN.md` as C when it changes the product).

## Open points

| ID | Question | Recommendation (R) | Decision |
| --- | --- | --- | --- |
| P-01 | Goal of the next phase: real use by a first team (pilot) soon, or prepare the commercial product? | A pilot team first — real use finds the important gaps faster than any list | **C 1 Nov: a) pilot team first** |
| P-02 | Order of the six themes (catalogue, last section) | 1 traceability views → 2 daily comfort → 3 documents out → 4 review on GitHub → 5 engineering traceability → 6 later/commercial | **C 1 Nov: as recommended; details per theme to be discussed** |
| P-03 | Release rhythm | One theme per minor version (≈ 1–2 weeks each), fixes as patch versions in between, ≤ 5-step checklists | **C 1 Nov: yes** |
| P-04 | The new name: when | Rename in its own version as soon as the name is chosen, before a pilot team starts | **C 1 Nov: yes** |
| P-05 | Who is the pilot team (size, field, what they write requirements for, what they use today)? | — (information) | open |
| P-06 | Theme 1 scope: types + link types in the window, required fields, matrix, coverage rules + gaps, impact chain | all six in one version (0.14.0), matrix last if it grows | open |
| P-07 | Where coverage rules live | in `schema.yaml` (shared through Git, like fields) — everyone sees the same gaps | open |
| P-08 | Matrix view: what it shows by default | rows = one item type, columns = another, filtered to the current filter; export to Excel | open |

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

- 1 Nov 2026 — owner: pun names are welcome; candidates so far (his): reqochet, reqotta, reqlace, reqtie, mavereq,
  genereq. Recommendation: reqochet (reqtie sounds like Reqtify; reqlace like "replace").
- 1 Nov 2026 — P-01 a (pilot team first), P-02 order as recommended (details per theme later), P-03 yes (one theme per
  minor version, fixes as patches), P-04 yes (rename in its own version before the pilot starts).
