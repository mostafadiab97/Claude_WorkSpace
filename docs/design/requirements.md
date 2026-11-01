# Product definition and requirements

> Part of the design documents (split from `DESIGN.md` on 1 Nov 2026; content unchanged). Tags: **C** = confirmed by the
> product owner, **R** = recommendation, **I** = inference, **F/K** = evidence (see `analysis.md` → Sources).

**What this is:** what the product is, for whom, the functional (FR) and non-functional (NFR) requirements, the first
end-to-end journey, scope by stage and the product form. Where each FR stands today: `roadmap.md` → "Where each
requirement stands".

## Product definition

The product is a local, serverless requirements tool that turns a folder in a project's existing Git repository into a structured, linkable requirements database, with a GUI that understands requirements where GitHub only sees files. It replaces scattered Word documents and Excel sheets; Git provides storage, sharing, history and branching.

Tags: **C** = confirmed by you in the answers table · **R** = my recommendation, open to change · **I** = inference.

| Aspect | Definition | Tag |
| --- | --- | --- |
| Target users | Engineering teams of 7–15 people in a 200–300-person company, all comfortable with Git/GitHub; authors, reviewers and readers of requirements | C |
| Problem 1 | Requirements are spread across many Word and Excel files with no single source of truth | C |
| Problem 2 | Changes are hard to track: who changed what, why, and what else is affected | C (implied by "manage requirements change") |
| Problem 3 | Traceability between requirements, tests and risks is maintained by hand, if at all | I |
| Problem 4 | Enterprise RM tools are too heavy and need servers and subscriptions | C |
| Goal | One structured place per project for requirements and their links, versioned exactly like the code | C |
| Goal | Prove the concept internally, then grow into a commercial product | C |
| Differentiator 1 | **Requirements-aware Git:** compare, merge and resolve conflicts per requirement and per link, not per file line | C |
| Differentiator 2 | **Zero infrastructure:** no server, no accounts; access control, sharing and review come from the existing Git host | C |
| Differentiator 3 | **Files stay readable and owned by the team:** plain-text files in their repo, no lock-in | R |
| Differentiator 4 | **All requirement work in one tool,** including Git and pull-request actions | C |

## Requirements

Twenty functional and ten non-functional requirements follow from your answers; the stage column links each to the scope plan below.

**Functional requirements**

| ID | Requirement | Tag | Stage |
| --- | --- | --- | --- |
| FR-01 | Open a local clone of a Git repository and use a designated folder in it as the requirements project | C | Prototype |
| FR-02 | Initialise a requirements folder with a default schema (types, fields, link types) | C | Prototype |
| FR-03 | Create, edit and delete items of the default types; each gets a stable, unique ID that never collides across branches | C | Prototype |
| FR-04 | Organise items in a parent/child hierarchy | I | Prototype |
| FR-05 | Create typed, directional links between items in the same repository | C | Prototype |
| FR-06 | Browse items in a table with filter, sort and full-text search; open an item's detail view with its links | C | Prototype |
| FR-07 | Show an item's change history (author, date, message, change) from Git | C | Prototype |
| FR-08 | Commit, pull and push from the tool | C | Prototype |
| FR-09 | Compare two Git references and show differences per requirement and per link | C | Prototype (basic) → MVP (full) |
| FR-10 | Export to CSV | C | Prototype |
| FR-11 | Edit the schema in the tool: add custom types, fields and link types as easily as an Excel column | C | MVP |
| FR-12 | Create and switch branches; create tags as baselines | C | MVP |
| FR-13 | Merge branches and resolve conflicts per requirement in the tool | C | MVP |
| FR-14 | Export to Word, PDF, Excel and Markdown | C | MVP |
| FR-15 | Import from Excel/CSV with column-to-field mapping | C | MVP |
| FR-16 | Coverage view and rule warnings (e.g. a system requirement with no test) defined in the schema | R | MVP |
| FR-17 | Suspect-link flag when a linked upstream item changes | R | MVP |
| FR-18 | View a GitHub pull request's changes per requirement (PR stage 1) | C | MVP |
| FR-19 | Create, review, approve and merge pull requests from the tool (PR stages 2–3) | C | Later |
| FR-20 | Import from Word; export to ReqIF | C | Later |

**Non-functional requirements and constraints**

| ID | Requirement | Tag |
| --- | --- | --- |
| NFR-01 | Works fully offline; only push, pull and PR actions need a network | C |
| NFR-02 | Runs on Windows 11; Windows 10 (for commercial customers) and Linux in later versions, without a rewrite | C / R |
| NFR-03 | Smooth up to 10,000 items per repository, usable to about 50,000; limit raisable without a format change | C |
| NFR-04 | Plain-text, diff- and merge-friendly files (one file per item); readable without the tool | R |
| NFR-05 | Never corrupts the repository or loses edits: validate before writing, atomic file writes, never force-push | R |
| NFR-06 | No server, no user accounts; access follows Git host permissions | C |
| NFR-07 | Only free, open-source dependencies whose licences allow commercial use | C |
| NFR-08 | Simple install and automatic updates on Windows | C |
| NFR-09 | Data format can later hold approvals, signatures and link confirmations without migration | R |
| NFR-10 | Conventional, tested, documented code that a future team can take over | C |
| NFR-11 | All visual styling (logo, fonts, colours, button shapes, spacing, light and dark mode) comes from one theme configuration file; UI components only reference named values from it, never hard-coded styles | C |
| NFR-12 | Every module exposes one documented public interface and is used only through it; replacing a module means providing a new implementation of that interface in a single place | C |

## Prototype: minimum end-to-end journey

The prototype succeeds if two engineers can replace a real Excel requirements sheet with this flow and find the requirement-level comparison clearly better than reading raw diffs on GitHub. That comparison is the core idea to validate, so it is in the prototype even in basic form.

1. **Engineer A** opens the tool, points it at a cloned project repo and initialises a `requirements` folder with the default schema.
2. A creates a few stakeholder needs, system requirements and test cases, arranges them in a hierarchy and links them (refines, verifies).
3. A filters the table (e.g. all system requirements with status Draft) and opens an item to see its links.
4. A commits and pushes from the tool.
5. **Engineer B** pulls in the tool, edits two requirements, adds a link and pushes.
6. A pulls and opens *Compare* between the previous commit and now: the tool lists "REQ-12 text changed", "TC-4 → REQ-7 link added" rather than file lines.
7. A opens REQ-12's history to see who changed it and when.
8. A exports the set to CSV and opens it in Excel for someone outside the repo.

**Success measures (R):** the journey works on Windows without help; a 1,000-item test repo stays responsive; the two engineers prefer the comparison view to GitHub's diff; no repository corruption across a week of trials.

## Scope by stage

The prototype proves the core loop (author → link → share via Git → compare per requirement); the MVP makes it a genuine replacement for Word/Excel in daily team use. Each stage is shippable on its own.

| Stage | Contents | Purpose |
| --- | --- | --- |
| **Prototype — MUST** | FR-01 to FR-10: open repo, default schema, items with stable IDs, hierarchy, typed links, table with filter/search, item history, commit/pull/push, basic requirement-level compare, CSV export | Validate that a Git-backed, requirements-aware tool is better than documents and spreadsheets |
| **MVP — SHOULD** | FR-11 to FR-18: schema editor for custom types/fields/links, branches and tag baselines, requirement-level merge and conflict resolution, Word/PDF/Excel/Markdown export, Excel/CSV import, coverage view and rule warnings, suspect links, PR stage 1 view; installer and auto-update | Make it a complete daily tool a team can adopt |
| **Later — CAN WAIT** | FR-19 to FR-20: create/approve/merge PRs and requirement-anchored PR comments, Word import, ReqIF export; Linux build; rich text with images and tables; traceability graph view; "copied from" provenance | Convenience and migration features |
| **Future — commercial / enterprise** | Compliance (e-signatures, tamper-proof audit, standards templates, enforced rules), GitLab/Bitbucket/Azure DevOps adapters, links to external tools (Jira etc.), AI features and governed AI-agent access, cross-repository traceability, licensing | Needed to sell to regulated and larger customers |

**Intentionally not built in the first version:** any server or cloud service; user accounts or a permission system; real-time co-editing; a workflow/approval engine beyond Git pull requests; test execution and results management; risk-analysis worksheets (FMEA) beyond a Risk item type; AI features; cross-repository links; macOS support.

## Open points for this stage

Four points need your confirmation before the product-form and architecture evaluation; the rest of the scope is settled.

- [x] Is the prototype journey above the right test of the idea, and is basic requirement-level compare rightly in the prototype rather than the MVP?

  Confirmed: the prototype journey is the right test, and basic requirement-level compare (show changes, no merge) stays in the prototype.
- [x] Should the default item fields be: ID, title, description (plain text), type, status (Draft / Review / Approved / Obsolete), priority, owner, parent, tags? Rich text (images, tables) is currently *Later*.

  Confirmed: these default fields, configurable via a configuration file. The default template ships in the tool's folder; initialising a repo copies it into the repo's requirements folder, where the team edits it, so every teammate sees the same fields and changes are versioned with the data.
- [x] Can users install software on their PCs themselves, or does installation go through IT (affects installer choice)?

  Confirmed: users may install it themselves; IT can assist if admin rights are needed. Recommendation (R): aim for a per-user install that needs no admin rights (including updates), so IT is needed only as a fallback.
- [x] Is Windows 10 still needed alongside Windows 11?

  Confirmed: Windows 11 only for the first versions; Windows 10 support moves to a later, commercial version.

Next stage, once confirmed: product-form evaluation (browser UI in a desktop shell vs. alternatives), then architecture and technology selection.

## Product form

**Recommendation (R): a desktop application whose interface is built with web technology (HTML/CSS/JavaScript) inside a desktop shell.** It keeps the browser-quality UI you wanted, adds the file and Git access a browser forbids, and installs and updates like normal Windows software. It is the only candidate that scores well on all your criteria at once, functionality first.

| Candidate | Functionality (files, Git, offline) | Install / update | Setup | UI/UX | Dev effort | Linux later | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Plain HTML file in a browser (your hypothesis) | Poor: cannot run Git or use Git credentials; folder access only in Chromium, with permission prompts | No install; updates mean replacing the file by hand | None | Excellent | Low at first, high to work around limits | Yes | Rejected: fails core functionality |
| Local web server + browser (a small program serves the UI at localhost) | Good | Two parts to install and start; port/firewall issues | Medium | Excellent | Medium | Yes | Workable, but clumsier for users than one app |
| **Web UI in a desktop shell** | **Full: files, system Git, offline** | **One installer, automatic updates, no admin needed** | **None for users** | **Excellent** | **Medium** | **Yes** | **Recommended** |
| Native Windows app (e.g. WPF/WinUI with C#) | Full | Good | Low | Good, but rich tables and diff views take more work | Medium–high | No (Windows-only) | Rejected: blocks Linux later |
| Cross-platform native (e.g. Avalonia, Qt) | Full | Good | Low | Good | High for rich editors and diff views | Yes | Viable, but slower to build the UI-heavy parts |
| VS Code extension | Good (VS Code provides Git) | Via VS Code marketplace | Requires VS Code | Constrained to VS Code panels | Medium | Yes | Rejected: ties non-developers to an IDE |
| Cloud web app | Good | None | None | Excellent | High (server) | Yes | Rejected: violates the no-server requirement |

Evidence: browser sandbox limits and the shell approach are **K**; the ratings are **I**.
