# Reviews and analyses

Findings and proposals written for the product owner's decisions. Each file says what was asked, what was found
(facts, inferences and recommendations kept apart) and, once decided, what the owner chose. Decisions themselves are
recorded in `docs/design/decisions.md` and `docs/design/roadmap.md` (source of truth) and in each file's discussion log.

## Open (this folder)

| Date | File | What it is | State |
| --- | --- | --- | --- |
| 4 Nov 2026 | `2026-11-04-public-release-repo.md` | How files would move to a public release repository (first time and per release), which files go, options — **open, not decided** | **Open** |
| 4 Nov 2026 | `2026-11-04-rename-reqochet.md` | Rename to reqochet: the brand package analysed, open points R-01…R-07 | **In progress** |
| 1 Nov 2026 | `2026-11-01-planning-discussion.md` | The planning discussion for the versions after 0.13: open points P-xx with answers, name candidates checked | **In progress** — themes 2–5 still to detail |
| 3 Nov 2026 | `2026-11-03-security-check.md` | Security check before sharing: secrets in all history (none), personal data, app hardening, pipeline, libraries | Two fixes in 0.14.1; **one decision for the owner** (work e-mail in the sandbox history) |
| 2 Nov 2026 | `2026-11-02-requiem-analysis.md` | Requiem (`requirements-manager`, Rust command-line tool, Markdown + YAML in Git): how it works, side by side with ReqMan, ideas worth taking | Reference — ideas placed in themes 1, 2, 5 |
| 31 Oct 2026 | `2026-10-31-feature-catalogue.md` | **Complete catalogue: 163 features** of ~190 tools in 15 areas — have / missing, how it works, how we would build it, when | Input for the planning discussion |
| 31 Oct 2026 | `2026-10-31-rm-tools-market-list.md` | About 190 RM tools by kind (from the owner's naming chat), with sources | Reference |
| 31 Oct 2026 | `2026-10-31-rename-impact.md` | What renaming "ReqMan" touches (599 places in 122 files) and how to do it safely; section 5 = the owner's answers | **Waiting for the new name** |

## Done (`done/`)

| Date | File | What it is | Outcome |
| --- | --- | --- | --- |
| 25 Oct 2026 | `done/2026-10-25-project-review.md` | Whole-project review: defects (D), performance (P), structure (S), security (X), tests (T); the owner's requests O-01–O-07; M8 decisions 1–7 | All decided; built in 0.8.0–0.12.0 except S-08/X-02 (later) |
| 31 Oct 2026 | `done/2026-10-31-feature-gap-analysis.md` | First ranked list: 23 features of 10 tools | Superseded by the feature catalogue |
| 31 Oct 2026 | `done/2026-10-31-rust-evaluation.md` | Would a Rust rewrite help? Measurements, costs | The owner, 31 Oct: no migration now (a pure-Rust window can't carry this interface) |
