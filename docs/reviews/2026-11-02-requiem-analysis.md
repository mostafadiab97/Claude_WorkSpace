# Requiem (`requirements-manager`) — analysis of a similar tool (2 Nov 2026)

Mostafa found this tool and asked for an analysis: it looked very similar to ReqMan. Sources are listed at the end.
**F** = fact from its documentation, **I** = inference, **R** = recommendation.

## 1. What it is (F)

| Point | Requiem |
| --- | --- |
| Name | project **Requiem**, Rust package `requirements-manager`, command `req` |
| Kind | plain-text requirements tool, **command line only** — "doesn't provide a graphical interface" |
| Origin | "spiritual successor to Doorstop" (the Python tool in our market list, section 10), aiming to be much faster and to allow several parents per requirement |
| Maturity | version 0.1.0 (Jul 2025), 0.1.1 (14 Nov 2025); one maintainer (danieleades); README: "early stages, not production-ready", a personal project open to contributions |
| Code | Rust; graph with `petgraph`, YAML/TOML, SHA-256, parallel loading (`rayon`); docs built with mdBook |
| Licence | **not confirmed** — the GitHub repository could not be reached from this session (I: Rust crates are usually MIT/Apache; check before reusing anything) |

## 2. How it works (F)

- **One Markdown file per requirement** with a YAML header (`_version`, UUID, created time, `parents`). The
  human-readable ID (HRID, e.g. `USR-001`) is the first word of the `# heading`.
- **IDs:** a UUID (stable, internal) plus an HRID with a **running number per kind** (`req add SYS` → next free
  `SYS-0xx`). `req clean` repairs HRIDs stored in links when files were renamed.
- **Links:** only one kind, **parent**; a requirement may have several parents (a graph without loops, DAG). Each
  parent reference stores the parent's UUID, HRID and **fingerprint**.
- **Suspect links:** fingerprint = SHA-256 of the body and the tags (not the ID, UUID, date or parents). A child whose
  stored fingerprint differs from the parent's current one is *suspect*; `req suspect` lists them, `req accept` (or
  `--all`) confirms. Even an added space or blank line makes a link suspect.
- **Templates:** `.req/templates/USR.md`, `SYS.md` …, also per namespace; command-line text overrides them.
- **Listing:** `req list` with columns, filters (kind, tag, orphans, leaves, text/regex), tree / ancestors /
  descendants views, output as table, JSON or CSV.
- **CI:** `req status` and `req suspect` end with exit code 1 when suspect links exist, so a pipeline can fail a pull
  request.
- **Git:** no Git features in the tool; Git is the intended way to work — branches for changes, pull requests for
  review, merge commits as approval, tags as releases.
- **Docs integration:** requirement files can be included in mdBook or Sphinx pages, so the documentation shows the
  current requirement text.
- **Planned, not built:** automatic suspect flagging, review status (current / suspect / under review / approved),
  stakeholder assignment, suspect reports, cycle detection, shell completion. The README also lists coverage reports
  and import/export; the command reference does not show them (I: not finished).

## 3. Side by side

| | Requiem | ReqMan |
| --- | --- | --- |
| Storage | Markdown + YAML, one file per item, in Git | the same |
| Who can use it | engineers comfortable with a terminal | anyone — a desktop window (table, tree, editor), Arabic/English |
| IDs | running number per kind (`SYS-001`) + UUID | random `REQ-XXXXXXX` — chosen (O-01) so two branches never create the same ID |
| Structure | several parents, one link kind | one document tree (outline numbers) + any number of **typed** links (verifies, refines …) |
| Suspect links | fingerprint on the link; body + tags; whitespace counts | fingerprint on the link (`confirmed:`); type, title, text; status/owner/order do not count |
| Git work | none in the tool (user runs Git) | in the window: commit, push, pull, branches, field-level 3-way merge, compare a branch like a PR, revert parts |
| Import / export | JSON/CSV listing | Excel, ReqIF, Markdown (CSV, Word, PDF planned) |
| Speed | Rust, parallel load (no figures published) | 10,005 items: index and queries measured in every build |
| Maturity | 0.1.1, one person, "not production-ready" | 0.13.1, 192 unit + 5 window tests, released and tested on Windows |

## 4. What it means for us

- **I — it confirms the idea.** A second, independent project chose exactly our storage: Markdown files with a header,
  in Git, suspect links by fingerprint stored on the link, pull requests as review. That is good evidence the format
  is sound and familiar to engineers who know Doorstop.
- **I — it is not the same product.** Requiem is a command-line tool for people who live in a terminal; ReqMan's
  value is the window, Git at requirement level (merge, compare, revert) and DOORS/Jama-style formats for teams like
  the pilot. It is closer to Doorstop, StrictDoc and sphinx-needs than to us.
- **I — its running IDs show the problem we avoided:** two branches that both add `SYS-021` collide at merge; it needs
  UUIDs plus `req clean` to cope. Our random IDs avoid this (O-01, D-09 repairs the rare duplicate).
- **I — whitespace-sensitive fingerprints** make links suspect after harmless edits (an extra blank line). Ours ignore
  fields that do not change meaning; worth keeping.

### Ideas worth taking (R)

| Idea | Where it fits | Note |
| --- | --- | --- |
| A command-line check that **fails a pull request** when there are suspect links, broken links or coverage gaps (exit code 1) | theme 5 (K10 command line + GitHub Action) — already planned; Requiem confirms the exit-code design | make `reqman check` the same rules as the window's warnings |
| **Include a requirement in other documentation** (mdBook / Sphinx) so docs show the current text | theme 5, with HTML publishing (J7) | small: a stable file path per item already exists |
| **Templates per kind and per namespace** | theme 2 templates (P-12): per type **and per document** (theme 1) | adds one level to the planned `template:` |
| **Confirm all suspect links at once** (`accept --all`) | small addition to the existing suspect-links window | only after showing the list — never silently |
| Views "orphans" (no parent link) and "leaves" (nothing below) | theme 1 coverage view / completeness warnings | already covered by coverage rules; name them the same way |

Nothing to change in the format or in decisions already taken.

## Sources

- [requirements-manager 0.1.1 on docs.rs (README, versions, dependencies)](https://docs.rs/crate/requirements-manager/latest)
- [Its own requirements (USR/SYS)](https://docs.rs/crate/requirements-manager/latest/source/docs/src/requirements.md)
- [Design approach](https://docs.rs/crate/requirements-manager/latest/source/docs/src/core-concepts/requiem-approach.md)
- [Command reference](https://docs.rs/crate/requirements-manager/latest/source/docs/src/reference/cli.md)
- [Fingerprints](https://docs.rs/crate/requirements-manager/latest/source/docs/src/maintaining/fingerprints.md)
