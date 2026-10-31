# Feature gap analysis — what other requirements tools have and ReqMan does not (31 Oct 2026)

**Asked by the owner (31 Oct 2026):** a deep analysis of the features other requirements-management tools have and we
don't, ordered by relevance and importance, added to the planned updates.

**Which tools.** The tool list of the owner's other chat ("ReqMan project naming") cannot be read from this session,
so the list is built from: the five platforms analysed in `docs/design/DESIGN.md` (IBM DOORS Next, Jama Connect,
Siemens Polarion, PTC Codebeamer, Visure), **ReqView** (compared 29 Oct), **Reqord** (compared 30 Oct), and the
Git/"docs-as-code" tools closest to ReqMan: **StrictDoc**, **sphinx-needs**, **Doorstop**. The owner later supplied the
full market list from that chat (about 190 tools): `2026-10-31-rm-tools-market-list.md` — to be used in the planning
discussion (owner, 31 Oct 2026: the plan gets a long discussion later; keep this analysis in mind).

Tags: **F** = checked against the vendor's page/documentation or source this week (see Sources), **K** = established
public product knowledge, not re-checked line by line, **R** = recommendation (the order and the release plan are the
owner's decision).

## 1. The tools in one line each

| Tool | Kind | Closest to ReqMan in… |
| --- | --- | --- |
| DOORS Next (IBM) | Enterprise server, streams/baselines, OSLC | Versioning like code (streams ≈ branches) (K) |
| Jama Connect | Enterprise SaaS, review centre, trace score | Traceability rules and coverage (K) |
| Polarion (Siemens) | ALM on Subversion, LiveDoc documents | Version control as the store (K) |
| Codebeamer (PTC) | ALM, workflows, variants, standards templates | Branches and merge of variants (K) |
| Visure | RM specialist, quality analysis, reuse | Requirement quality checks (K) |
| ReqView | Desktop app, JSON documents in Git, document locking | Desktop + Git; same users (F) |
| Reqord | CLI + web dashboard, YAML/Markdown in Git, AI context | Files in Git, PR-based approval (F) |
| StrictDoc | Text files (`.sdoc`) in Git, web UI, HTML/PDF/ReqIF | Docs-as-code for safety-critical (K) |
| sphinx-needs | Requirements inside Sphinx documentation (`.rst`) | Docs-as-code, tables/graphs from text (K) |
| Doorstop | One YAML file per item in Git, review fingerprints | **Almost our data model**, incl. suspect-link fingerprints (K) |

## 2. Features they have and ReqMan does not — ranked

Ranking = **relevance** (does our user — a requirements engineer in a team that works through Git — need it?) ×
**importance** (how many tools have it, how often buyers ask for it, how painful its absence is). ★★★ = do soon,
★★ = next round, ★ = later / commercial.

| # | Feature | Who has it | Relevance | Importance | Rank | Notes for ReqMan |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Traceability matrix and coverage view** ("which system requirements have no test?", rows × columns by link type, gaps highlighted) | All five, ReqView, StrictDoc, sphinx-needs | High | High | ★★★ | FR-16, planned as M9. Our links + suspect marks already hold the data; the view is missing. Jama's "trace score" = coverage as a number. |
| 2 | **Item types and link types editable in the window** | All | High | High | ★★★ | FR-11 remainder (fields are done). Today types live only in `schema.yaml`. |
| 3 | **Word / PDF document export** (headings, outline numbers, text, attributes, links, cover page) | All except Reqord | High | High | ★★★ | Audits, customers and reviewers want a document. M10. Markdown export exists. |
| 4 | **Saved views** (named filter + columns + sort, shared or personal) | All, ReqView | High | Medium | ★★★ | Small; filters exist, saving them is missing. |
| 5 | **Bulk edit** (choose several → set status/owner/priority/tags) | All | High | Medium | ★★★ | Multi-select exists since 0.11.0 (export, move); "set field for all chosen" is small. |
| 6 | **Requirement quality checks** (vague words like "fast", "user-friendly", missing "shall", passive voice; EARS/INCOSE rules; score) | Visure, ReqView, Reqord, all five via AI | High | Medium–High | ★★★ | Cheap without AI (word lists + rules), a column "Quality hints" and a filter. |
| 7 | **Approval status tied to GitHub pull requests** (submit → PR → merged = approved; who/when recorded) and a per-requirement view of a PR | Reqord (F), DOORS/Jama reviews (K) | High | High | ★★ | FR-18 / M11. Fits the owner's decision that approval happens on GitHub (M8-2). |
| 8 | **Comments / discussion per requirement** (threads, resolve, @mention) | DOORS, Jama, Polarion, Codebeamer, ReqView | Medium–High | High | ★★ | In a Git tool: either GitHub PR review comments (with #7) or a `comments` section in the item file. Design question for the owner. |
| 9 | **Baselines** (named, frozen versions: "Release 1.0"), compare against them | All five, ReqView (Git tags), StrictDoc | High | High | ★★ | **Delayed by the owner (29 Oct 2026).** Git tags make it small; revisit after #1–#6. |
| 10 | **Rich text**: Markdown preview, images/attachments, tables | All five, ReqView | Medium | High | ★★ | Decided as M10 (rich text editor, 27 Oct 2026). Storage stays Markdown. |
| 11 | **Impact analysis across levels + traceability graph** (everything affected by a change, following links several levels; a picture of the chain) | Jama, DOORS, Reqord (graph), sphinx-needs (needflow) | Medium–High | Medium | ★★ | Our suspect links cover one level; a "follow the chain" view and a graph are next. |
| 12 | **Links to code and test results in the same repository** (requirement ID in a source file or test name → coverage "implemented / tested / passed") | StrictDoc, sphinx-needs, OpenFastTrack (K) | Medium (software teams) – High (Git-native positioning) | Medium | ★★ | **Strong differentiator for a Git tool**: the code is next to the requirements. DOORS/Jama need integrations for this. |
| 13 | **Static HTML publishing** (read-only website of the specification for people without the app, e.g. GitHub Pages) | StrictDoc, sphinx-needs, Doorstop, Reqord (dashboard) | Medium | Medium | ★★ | Lets managers/customers read without installing anything. Reuses the Markdown/Word export pipeline. |
| 14 | **Command line / CI check** (validate files, broken links, coverage rules, export — in a GitHub Action on every PR) | Doorstop, StrictDoc, sphinx-needs, Reqord, ReqView CLI | Medium | Medium | ★★ | Our core is already separate from the window (modules); a small CLI is mostly packaging. Makes "requirements reviewed like code" real. |
| 15 | **Templates**: standard item/link type sets (ISO/IEC/IEEE 29148, EARS, ASPICE, ISO 26262, DO-178C), item text templates per type | Codebeamer, ReqView, Visure, StrictDoc | Medium | Medium | ★ | "New project" could offer 3–4 schemas. |
| 16 | **macOS / Linux builds** | ReqView, Reqord, docs-as-code tools | Medium | Medium | ★ | Electron builds them with little work; needs a test round on each. |
| 17 | **Several documents per project / reuse across projects** (one requirement in several documents, linked projects) | DOORS (modules), ReqView, Visure, Jama | Medium | Medium | ★ | Owner decided one requirement set per repository (S-07); cross-repository links not wanted for now. |
| 18 | **Dashboards / metrics** (status counts, coverage %, changes this week) | Jama, Polarion, Codebeamer, Reqord | Medium | Low–Medium | ★ | Comes almost free after #1. |
| 19 | **Integrations** (Jira, Azure DevOps, Enterprise Architect), REST API, **MCP server / AI context** | All five, ReqView (Jira/EA), Reqord (AI context, Claude plugin) | Medium | Medium (rising fast for AI) | ★ | Commercial stage (owner's earlier decision). An AI-ready export ("this requirement and everything linked") is a cheap first step. |
| 20 | **Electronic signatures, tamper-proof audit trail, compliance reports** (FDA 21 CFR Part 11, ISO 26262) | Jama, Polarion, Codebeamer, Visure | Low now – High for regulated customers | Medium | ★ | Commercial; Git history is a strong base (signed commits). |
| 21 | **Workflow engine** (state machine per type, field permissions by role/state) | All five | Low | Medium | ★ | Status stays a field (decided). GitHub branch protection covers permissions. |
| 22 | **Variants / product lines** | Codebeamer, DOORS | Low | Low | ★ | Branches cover simple cases. |
| 23 | **Risk (FMEA) and test management** | Jama, Polarion, Codebeamer, Visure | Low | Low | ★ | Risk and test-case item types exist; dedicated modules only if a customer needs them. |

## 3. What ReqMan has that most of them don't (keep and build on)

Branches with **per-requirement, field-level merge** and a decision window (DOORS/Codebeamer merge at server level;
ReqView locks documents; Reqord/Doorstop/StrictDoc rely on Git's line merge) · **no locking**, several editors at
once · one Markdown file per requirement, readable in a GitHub PR · suspect links with a Keep/Unlink window ·
requirement-level Changes view with ↶ per part · calculated outline numbers (no renumbering conflicts) · random IDs
safe across branches, duplicate repair · Excel round trip incl. **writing back into the original file** · ReqIF
validated against the official schema · in-app release self-test · free (no licence, no server).

## 4. Proposed placement in the plan (R — for the owner to confirm)

| Version | Theme | Features (numbers from section 2) |
| --- | --- | --- |
| 0.12.1 | Owner's points on 0.12.0 | Branch drop-down (done 31 Oct) |
| 0.13.0 | **New name + traceability** | The rename (`2026-10-31-rename-impact.md`) once the name is chosen · #1 matrix and coverage · #2 types and link types in the window · #4 saved views · #5 bulk edit |
| 0.14.0 | **Documents out** | #3 Word and PDF export · #13 HTML publishing · #10 Markdown preview (first step of rich text) |
| 0.15.0 | **Review and quality** | #7 PR approval status + PR view per requirement · #8 comments (after the owner's design choice) · #6 quality hints |
| 0.16.0 | **Engineering traceability** | #12 links to code and tests · #11 impact chain + graph · #14 CLI / GitHub Action check |
| later | — | #9 baselines (when the owner un-delays it) · rich text editor with images and tables · #15 templates · #16 macOS/Linux · #18 dashboard · #19 integrations / MCP / AI · #20 compliance · #17, #21–#23 only on customer demand |

## Sources

- Domain analysis of DOORS Next, Jama, Polarion, Codebeamer, Visure: `docs/design/DESIGN.md` (sections 1–5, B, C, D, with its own sources).
- ReqView: [Git collaboration](https://www.reqview.com/doc/git-collaboration/), [home](https://www.reqview.com/), [Capterra](https://www.capterra.com/p/145388/ReqView/) (29 Oct 2026).
- Reqord: [github.com/kicchann/reqord](https://github.com/kicchann/reqord) (README, CLI reference, schemas; 30 Oct 2026).
- StrictDoc: [documentation](https://strictdoc.readthedocs.io/en/stable/stable/docs/strictdoc_24_development_plan.html); sphinx-needs: [GitHub](https://github.com/useblocks/sphinxcontrib-needs/); Doorstop: [documentation](https://doorstop.readthedocs.io).
- Name clash: [INNEO ReqMan](https://inneo.com/en/product-development/application-lifecycle-management-alm/reqman.html).
