# Reviews and analyses

Findings and proposals written for the product owner's decisions. Each file says what was asked, what was found
(facts, inferences and recommendations kept apart) and, once decided, what the owner chose. Decisions themselves are
recorded in `docs/design/decisions.md` and `docs/design/roadmap.md` (source of truth) and in each file's discussion log.

## Open (this folder)

| Date | File | What it is | State |
| --- | --- | --- | --- |
| 4 Nov 2026 | `2026-11-04-next-round.md` | 1a structure questions, the whole-project review plan, more helper agents, cheaper helper runs | **Open** — waiting for the owner |
| 4 Nov 2026 | `2026-11-04-public-release-repo.md` | How files would move to a public release repository (first time and per release), which files go, options — **open, not decided**; decided so far: two tools, two update feeds | **Open** — 4 questions in section 5 |
| 1 Nov 2026 | `2026-11-01-planning-discussion.md` | The planning discussion for the versions after 0.13: open points P-xx with answers, release plan (0.14 … 0.24) | **Decided** — the plan in use; each theme's details are settled when it starts |
| 2 Nov 2026 | `2026-11-02-requiem-analysis.md` | Requiem (`requirements-manager`, Rust command-line tool, Markdown + YAML in Git): how it works, side by side with ReqMan, ideas worth taking | Reference — ideas placed in themes 1, 2, 5 |
| 31 Oct 2026 | `2026-10-31-feature-catalogue.md` | **Complete catalogue: 163 features** of ~190 tools in 15 areas — have / missing, how it works, how we would build it, when | Reference — placed in themes 1–6; read when a theme starts |
| 31 Oct 2026 | `2026-10-31-rm-tools-market-list.md` | About 190 RM tools by kind (from the owner's naming chat), with sources | Reference |

Helper-agent reports per version: `agents/` (all findings answered; 0.16.0 brand questions answered 4 Nov).

## Done (`done/`)

| Date | File | What it is | Outcome |
| --- | --- | --- | --- |
| 25 Oct 2026 | `done/2026-10-25-project-review.md` | Whole-project review: defects (D), performance (P), structure (S), security (X), tests (T); the owner's requests O-01–O-07; M8 decisions 1–7 | All decided; built in 0.8.0–0.12.0 except S-08/X-02 (later) |
| 31 Oct 2026 | `done/2026-10-31-feature-gap-analysis.md` | First ranked list: 23 features of 10 tools | Superseded by the feature catalogue |
| 4 Nov 2026 | `done/2026-11-04-rename-reqochet.md` | Rename to reqochet: brand package, R-01…R-10 | Built in 0.16.0–0.16.2 |
| 3 Nov 2026 | `done/2026-11-03-security-check.md` | Security check before sharing | Fixes in 0.14.1; work e-mail removed from the sandbox history (0.14.2) |
| 31 Oct 2026 | `done/2026-10-31-rename-impact.md` | What renaming ReqMan touches and how | Applied in 0.16.0 |
| 31 Oct 2026 | `done/2026-10-31-rust-evaluation.md` | Would a Rust rewrite help? Measurements, costs | The owner, 31 Oct: no migration now (a pure-Rust window can't carry this interface) |
