# reqochet — positioning (draft, 13 Nov 2026)

Sources: README, user guide (§16 specification, §19 DOORS/Jama), CHANGELOG 0.22.0, product definition
(`docs/design/requirements.md`), 5-tool study (`docs/design/analysis.md`), public-repository review (licence, sample
project). **F** = fact from those files, **I** = inference, **R** = recommendation.

## One-line promise (R)

> **Requirements management without a server: every requirement is a plain file in your own Git repository, and
> reqochet is the window that understands them.**

Shorter (posts, social cards): **"Requirements as plain files in your own Git repository."** (already the website
footer — keep it as the tagline).

## Who it is for

| | |
| --- | --- |
| **Roles** | Requirements engineers and systems engineers (authors); team leads and reviewers; test engineers who link test cases to requirements; quality/safety people who need coverage and a matrix for an audit. |
| **Team type** | Engineering teams of roughly 5–20 people (F: the product definition names 7–15), often **distributed** across sites or companies (supplier ↔ OEM), already using Git for their code. |
| **Industries** | Automotive, medical devices, industrial/automation, software products — anywhere requirements must be traced to tests and changes must be explainable (owner, 13 Nov). |
| **Their situation today** | Requirements in Word and Excel files, or in a large enterprise platform that needs a server, licences and an administrator. |
| **Who it is not for (yet)** | Teams that need e-signatures, approval workflows or formal compliance records built into the tool; Mac users; teams that refuse Git entirely. |

## The problem (F, from the product definition)

1. Requirements are spread across many Word and Excel files; there is no single source of truth.
2. Changes are hard to follow: who changed what, why, and what else it touches.
3. Traceability to tests is kept by hand, if at all.
4. Enterprise requirements tools are heavy: servers, subscriptions, accounts, administration.

## Three proof points (all F — built and released in 0.22.0)

1. **Plain files, no lock-in.** One Markdown file per requirement with a short header, in a folder of your own
   repository. Readable in any editor; history is ordinary Git history; export to ReqIF (checked against the official
   schema), Excel, CSV, Markdown at any time.
2. **Git at the level of a requirement.** Review changes per requirement and per field; a pull combines changes field
   by field and asks only about real clashes; branches for change requests; baselines; any old version opened
   read-only. Nothing is ever force-pushed.
3. **Traceability that is checked, not drawn by hand.** Typed links, suspect links when a target changes meaning,
   coverage rules with gaps marked in the table, impact chain, a traceability matrix exported to Excel.

Supporting facts for detail pages: tested with 10,000 and 50,000 requirements; offline; no server, no database, no
accounts; per-user install without administrator rights; automatic updates; five window languages (English, German,
French, Spanish, Arabic with full right-to-left); Light, Dark and Ember colour modes; a company theme file; Excel /
CSV / ReqIF import with a check step before anything is written.

## What it is not (say this openly — it builds trust with engineers)

- **Not a server or cloud service**, and not a permission system: access is whatever your Git host allows.
- **Not (yet) a compliance tool**: no e-signatures, no approval workflow, no audit trail beyond Git history. Don't
  claim ISO 26262 / IEC 62304 / 21 CFR Part 11 support.
- **No Word, PDF or HTML export yet** (planned). No rich text with images and tables yet (planned).
- **No pull requests, comments or approvals inside the app yet** (planned); today those happen on the Git host.
- **Windows 11 only for now**; Windows 10 next, then Linux. No macOS planned.
- **Not open source** in the OSI sense: PolyForm Shield is *source-available* — free to use for everyone, including
  companies; only building and selling a competing product is not allowed. Never write "open source".

## Competitive frame (internal — keep public texts generic and factual)

| Alternative | What it is like | reqochet's honest difference |
| --- | --- | --- |
| **Word + Excel** (the real competitor) | Familiar, free, no structure, no links, merging by e-mail | Same freedom (plain files, free), plus IDs, a tree, links, coverage, and merges per requirement |
| **Enterprise requirements platforms** (DOORS Next, Jama Connect, Polarion, Codebeamer, Visure — studied in `analysis.md`) | Server or cloud platforms with accounts, licences and administration; deep features (reviews, signatures, workflows, risk) | No server, no accounts, no licence fee; the data stays in the team's own repository. Far fewer features — say so. ReqIF import makes the move possible. |
| **Docs-as-code tools** (e.g. sphinx-needs, StrictDoc, Doorstop) | Requirements as text files in Git; built around text editors, scripts and generated documents | Same storage idea; reqochet adds a desktop window for people who don't live in a text editor, plus merge and review per requirement and field |

Public wording (R): "enterprise requirements platforms" and "spreadsheets", never a competitor's name in a claim. The
user guide's "Coming from DOORS or Jama?" page is factual migration help and fine to link.

## Voice

Plain, calm, exact. Short sentences. Show the file, then the window. No "revolutionary", "seamless",
"AI-powered". Every adjective needs a fact next to it.
