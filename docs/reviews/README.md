# Reviews and analyses

Findings and proposals written for the product owner's decisions. Each file says what was asked, what was found
(facts, inferences and recommendations kept apart) and, once decided, what the owner chose. Decisions themselves are
recorded in `docs/design/DESIGN.md` (source of truth) and in the review file's discussion log.

| Date | File | What it is | State |
| --- | --- | --- | --- |
| 25 Oct 2026 | `2026-10-25-project-review.md` | Whole-project review: defects (D), performance (P), structure (S), security (X), tests (T); the owner's requests O-01–O-07; M8 decisions 1–7 | All points decided; built in 0.8.0–0.12.0 except S-08/X-02 (later) |
| 31 Oct 2026 | `2026-10-31-feature-gap-analysis.md` | What 10 other requirements tools have and ReqMan does not, ranked; proposed placement in versions 0.13–0.16 | **Awaiting the owner's order** |
| 31 Oct 2026 | `2026-10-31-rename-impact.md` | What changing the name "ReqMan" touches (599 places in 122 files) and how to do it without breaking updates, settings or existing projects | **Awaiting the new name** |
| 31 Oct 2026 | `2026-10-31-rust-evaluation.md` | Would a Rust rewrite make ReqMan faster? Measurements, costs, recommendation (no rewrite; Tauri later if size matters) | **Awaiting the owner's decision** |
