# Domain analysis — five requirements-management platforms (24–25 Oct 2026)

> Part of the design documents (split from `DESIGN.md` on 1 Nov 2026; content unchanged). Tags: **C** = confirmed by the
> product owner, **R** = recommendation, **I** = inference, **F/K** = evidence (see `analysis.md` → Sources).

**What this is:** the study of IBM DOORS Next, Jama Connect, Siemens Polarion, PTC Codebeamer and Visure that started
the project: what each does, common and special features, design approaches and their consequences. **Frozen** — kept
as the record; newer comparisons are in `docs/reviews/` (feature catalogue, market list).

> Exported on 25 Oct 2026 from the Claude Doc where the analysis, your answers and the design were worked out
> (https://claude.ai/artifact/Rjiq1ojBgzDPrLtPEjCkMM). **This copy in the repository is now the source of truth**;
> update it here as decisions change. Tags used throughout: C = confirmed by the product owner, R = recommendation,
> I = inference; evidence letters refer to the Sources section.

Oct 24, 2026 · @the owner

## Scope and evidence legend

The five platforms analysed are IBM DOORS Next, Jama Connect, Siemens Polarion, PTC Codebeamer and Visure Requirements ALM. Visure was chosen as the fifth because it is a requirements-centric specialist (not a broad ALM suite) and a frequent competitor in the same safety-critical deals, which gives a useful contrast. Lighter-weight alternatives (Jira-based RM, docs-as-code tools) are covered briefly in section D.

Every finding carries a tag:

| Tag | Meaning |
| --- | --- |
| **F** | Fact verified this session against a vendor page, vendor documentation or a dated press release (linked in Sources) |
| **K** | Fact from established public product knowledge (documentation, training material, user community) not re-checked line by line this session; reliable but treat version-specific details with care |
| **I** | Reasonable inference from the facts — not stated by the vendor |
| **R** | My recommendation (appears only in section E and the questions) |

Public information is uneven: IBM, Siemens and PTC publish deep documentation; Jama publishes good user guides; Visure publishes mostly marketing-level material, so its rows carry more **K** and **I** tags.

## 1. IBM Engineering Requirements Management DOORS Next

DOORS Next is the configuration-management heavyweight: its defining idea is that requirements are versioned like source code (streams, change sets, baselines) and linked across tools through open linked-data standards. It runs on IBM's Jazz platform, which uses OSLC for cross-tool linking ([Wikipedia](https://en.wikipedia.org/wiki/DOORS)).

| # | Aspect | Finding | Ev. |
| --- | --- | --- | --- |
| 1 | Purpose / users | Enterprise systems engineering in regulated, large organisations (aerospace, defence, automotive, rail). Part of the IBM Engineering Lifecycle Management (ELM) suite. | K |
| 2 | Core functionality | Artifact authoring, modules (structured specs), typed links, views, formal reviews, baselines, local and global configuration management, reporting, ReqIF exchange. | K |
| 3 | Data model | Everything is an *artifact* of a configurable *artifact type*. A **base artifact** lives in a folder; a **module** is an ordered tree of *bindings* that reference base artifacts, so one requirement can appear in several modules. *Collections* are flat sets. The type system (artifact types, attribute types, data types, link types) is defined per project/component. | K |
| 4 | Organisation | Project area → components → folders (storage) + modules (document structure). Separating *where an artifact is stored* from *where it appears in a document* is a distinctive choice. | K |
| 5 | Attributes | Typed custom attributes (text, integer, float, date, enumeration, user, etc.) built from reusable data types; shared across artifact types; type systems can be imported between components. | K |
| 6 | Versioning | Per-artifact revision history. With configuration management enabled: **components** contain **streams**, **baselines** and **change sets** at local and global levels ([IEEE Spectrum](https://spectrum.ieee.org/global-configuration-management)). Changes are made in a change set, then delivered to a stream with conflict resolution — essentially Git-style branching for requirements. | F |
| 7 | Baselines | Immutable snapshot of a stream. **Global configurations** compose baselines/streams from many components and tools (requirements, tests, models) into one consistent release view; they can be nested ([jazz.net](https://jazz.net/downloads/rational-doors-next-generation/releases/6.0?p=news)). | F |
| 8 | Traceability | Typed, directional link types with optional constraints. Cross-tool links follow OSLC (e.g. requirement *validated by* test case). With global configurations, links resolve to the correct version on each side ([IEEE Spectrum](https://spectrum.ieee.org/global-configuration-management)). Traceability views and matrices in the UI. | F |
| 9 | Workflow / approval | Optional per-artifact-type workflows (state machines). Delivery of change sets can be gated, e.g. requiring an associated work item ([training outline](https://doorsnext.com/trainings/introduction-ibm-engineering-global-configuration/)). | F/K |
| 10 | Collaboration | Threaded comments on artifacts, @mentions, formal reviews with approve/disapprove/abstain, personal streams for in-progress work ([IBM Docs](https://www.ibm.com/docs/SSYMRC_7.1/com.ibm.rational.gcapp.doc/topics/working_with_rm_change_set.html)). | F/K |
| 11 | Roles / permissions | Jazz project-area roles with permission sets; team areas; permissions to create/deliver change sets ([IBM Docs](https://www.ibm.com/docs/en/SSYMRC_7.0.3/com.ibm.rational.gcapp.doc/topics/t_work_with_multiple_csets.html)). | F/K |
| 12 | Search / reporting | In-app filters and saved views; cross-tool reports via Jazz Reporting Service over the Lifecycle Query Engine (an RDF index queried with SPARQL); document generation via PUB. Users report reporting as a weak point ([PeerSpot](https://www.peerspot.com/products/ibm-rational-doors-next-generation-pros-and-cons)). | F/K |
| 13 | Import / export | ReqIF, Word/RTF, CSV/Excel; migration path from DOORS Classic. | K |
| 14 | Integrations / APIs | OSLC services, REST-style APIs, a JavaScript extension API for in-UI widgets; native ELM integrations (work items, test management, modelling); third-party OSLC connectors (e.g. Jira) ([SodiusWillert](https://www.sodiuswillert.com/en/blog/recommendations-on-using-changes-with-configurations-in-doors-next)). | F/K |
| 15 | Architecture | Java server applications on the Jazz Team Server; relational database for storage plus RDF indexes; separate reporting index (LQE). Typically a multi-server on-premises topology; IBM also offers hosted options. AI layer via a separate IBM Engineering AI Hub (v1.3 GA June 2026) ([jazz.net blog](https://jazz.net/blog/index.php/tag/ibm-engineering-requirements-management-doors-next/)). | F/K |
| 16 | Strengths / limitations | **Strengths:** most mature versioning, variant and parallel-release management; open linking standard; proven at scale. **Limitations:** steep learning curve, heavy administration, reporting and data storage criticised, capacity limits per server, perceived weak agile fit ([PeerSpot](https://www.peerspot.com/products/ibm-rational-doors-next-generation-pros-and-cons)). | F |

**Inference (I):** the base-artifact / module-binding split is what makes reuse and versioning precise, but it is also a major source of user confusion ("which copy am I editing?"). It is an implementation choice, not a domain requirement.

## 2. Jama Connect

Jama Connect's defining idea is *modelled* traceability: a project declares which item types must be linked to which (its Traceability Information Model), and the tool continuously measures coverage against that model. It favours usability and review workflows over Git-style branching ([YesPress profile](https://yespress.io/jama)).

| # | Aspect | Finding | Ev. |
| --- | --- | --- | --- |
| 1 | Purpose / users | Multidisciplinary engineering teams building regulated products (medical devices, automotive, semiconductors, aerospace). Unifies requirements, risk and test management ([GetApp](https://www.getapp.com/project-management-planning-software/a/jama/)). Owned by Francisco Partners since 2024. | F |
| 2 | Core functionality | Requirements authoring, Review Center, baselines, reuse and synchronisation, risk (FMEA) and test management, Live Traceability, AI assistant (Advisor) ([YesPress](https://yespress.io/jama.md)). | F |
| 3 | Data model | Configurable **item types**, each with its own fields and workflow. Items connect through typed **relationships**. A **Relationship Rule** set defines the allowed/expected relationships between item types. | K |
| 4 | Organisation | Project → components → **sets** (a set holds items of one type) → folders → items, with parent/child nesting. A *Document View* renders the tree as a readable document rather than storing a document object. | K |
| 5 | Attributes | Per-item-type fields: text, rich text, picklist (shared across types), multi-select, user, date, integer, URL, test steps, calculated fields. | K |
| 6 | Versioning | Every save creates an item version; versions can be compared. No branch/merge of a specification; variants are handled by **reuse with synchronisation** (copy items elsewhere, keep a sync link, compare and push/pull changes). | K |
| 7 | Baselines | Point-in-time snapshot of a chosen source (set, folder, filter). Baselines can be compared; a finalised review can automatically create a signed baseline. Electronic signatures support 21 CFR Part 11 workflows. | K |
| 8 | Traceability | Typed relationships; **suspect links** flagged when an upstream item changes. Live Trace Explorer scores coverage against the defined model so gaps surface during development rather than at audit ([aqua review](https://aqua-cloud.io/jama-connect-review-features-pricing/)). | F |
| 9 | Workflow / approval | Per-item-type status workflows with transition rules; approval primarily runs through Review Center rather than a general BPM engine. | K |
| 10 | Collaboration | **Review Center** is a hallmark: invite reviewers and approvers, threaded comments per item, review revisions, moderator controls, sign-off. Stakeholder licences let non-authors review cheaply. | K |
| 11 | Roles / permissions | Organisation and project roles; groups; read / read-write / manage access at project, component and set level; licence types (creator, reviewer, stakeholder). | K |
| 12 | Search / reporting | Filters and advanced filters; Office-template and Velocity reports; Datatap / analytics add-ons. Reporting complexity is a common complaint ([aqua review](https://aqua-cloud.io/jama-connect-review-features-pricing/)). | F/K |
| 13 | Import / export | Word and Excel/CSV import, ReqIF, export to Word, Excel and PDF. | K |
| 14 | Integrations / APIs | Public REST API; Jama Connect Interchange synchronises with Jira, Azure DevOps, Excel and others ([Jama](https://www.jamasoftware.com/legacy/blog/jama-connect-interchange-live-traceability-realized/)). MCP server announced May 2026 with v9.35, giving AI clients access under existing permissions ([YesPress](https://yespress.io/jama.md)). | F |
| 15 | Architecture | Containerised Linux application deployed self-hosted with Replicated KOTS + containerd; content in a relational database (MySQL 8.4 or SQL Server 2022) on a separate server; attachments on a persistent volume; Elasticsearch for search ([Jama support](https://support.jamasoftware.com/hc/en-us/articles/41247505197325-Supported-Software-for-Jama-Connect-Self-Hosted-9-28-x)). Jama recommends its cloud offering for most customers ([Jama support](https://support.jamasoftware.com/hc/en-us/articles/24072328211085-Jama-Connect-Self-Hosted-Scope-of-Support)). | F |
| 16 | Strengths / limitations | **Strengths:** approachable UI, best-in-class review workflow, measurable traceability, cloud-first. **Limitations:** opaque pricing, reporting complexity, performance at scale, add-ons priced separately ([aqua review](https://aqua-cloud.io/jama-connect-review-features-pricing/)); weaker parallel-version management than DOORS Next or Codebeamer (I). | F/I |

**Inference (I):** Jama treats the *traceability model* as first-class configuration. That turns traceability from a reporting afterthought into a continuously checked rule — an idea worth separating from Jama's specific UI.

## 3. Siemens Polarion

Polarion's defining idea is the **LiveDoc**: a Word-like document whose paragraphs can be structured work items, combined with a storage layer where every change is a repository revision. It stores almost all data and configuration as XML in Subversion and serves reads from a Lucene index ([Siemens blog](https://blogs.sw.siemens.com/polarion/?p=656)).

| # | Aspect | Finding | Ev. |
| --- | --- | --- | --- |
| 1 | Purpose / users | Full ALM for regulated industries (automotive, medical, aerospace, industrial); requirements, test, quality and change in one web platform. Current release line: Polarion 2606 and Polarion X 2606 (May 2026) ([Siemens blog](https://blogs.sw.siemens.com/polarion/page/85/)). | F |
| 2 | Core functionality | Universal work items, LiveDocs, test management, variants, Live Report pages, Word round-trip, AI Copilot with customer-supplied LLM ([Siemens blog](https://blogs.sw.siemens.com/polarion/?p=8274)). | F |
| 3 | Data model | One generic object — the **work item** — with a configurable type (requirement, test case, defect, task, risk…). A LiveDoc contains free text interleaved with embedded work items; the same work items also live in the project tracker. Typed **link roles** connect work items. | K |
| 4 | Organisation | Repository → project groups → projects → spaces → LiveDocs; hierarchy inside a document is expressed through the outline and a parent link role. | K |
| 5 | Attributes | Custom fields per work-item type, shared enumerations; calculated values and validation through scripts. | K |
| 6 | Versioning | Because storage is Subversion, every change to every object is a revision with full history; LiveDocs can be branched, reused and merged. Historical queries use a separate SQL database ([Siemens blog](https://blogs.sw.siemens.com/polarion/?p=862)). | F |
| 7 | Baselines | A baseline is essentially a named repository revision — cheap to create. Project and document baselines both exist ([Siemens developer docs](https://developer.siemens.com/polarion/limitations-and-known-issues.html)). | F/I |
| 8 | Traceability | Link roles with direction and rules; suspect-link flagging; traceability matrices and reports built from queries and report widgets; links to code commits and external tools. | K |
| 9 | Workflow / approval | Configurable workflows for work items **and** documents, with conditions and functions (scriptable); document approvals and electronic signatures. | K |
| 10 | Collaboration | Comments on work items and documents, document approval rounds, cheap reviewer licences, Word export/re-import so external reviewers can comment offline. | K |
| 11 | Roles / permissions | Global and project roles with fine-grained permissions; it also interprets Subversion folder access rules, whose complexity affects performance ([Siemens blog](https://blogs.sw.siemens.com/polarion/?p=1282)). | F |
| 12 | Search / reporting | Lucene query syntax for most reads, SQL for joined and historical queries ([Siemens blog](https://blogs.sw.siemens.com/polarion/?p=862)); Live Report pages assembled from widgets and Velocity scripts. | F |
| 13 | Import / export | Rule-based Word import (now also via REST), Excel round-trip, ReqIF, PDF/Word export ([Siemens blog](https://blogs.sw.siemens.com/polarion/?p=8274)). | F |
| 14 | Integrations / APIs | Long-standing SOAP API; REST API since 22 R2 based on JSON:API with OpenAPI docs and JWT auth ([Siemens blog](https://blogs.sw.siemens.com/polarion/?p=4275)), expanded in 2606. Known REST gaps still include baselines, variants and spaces ([developer docs](https://developer.siemens.com/polarion/limitations-and-known-issues.html)). Simulink and OSLC connectors. | F |
| 15 | Architecture | Java web application; Subversion as the system of record (XML files); Lucene "Index" for reads; PostgreSQL for SQL and historical queries. Subversion processes one commit transaction at a time and needs local-speed disk ([Siemens blog](https://blogs.sw.siemens.com/polarion/?p=1282)). | F |
| 16 | Strengths / limitations | **Strengths:** document + structured-item hybrid, complete history for free, broad ALM scope, deep configurability. **Limitations:** storage-driven performance limits (whole-document re-indexing on change, serialised commits), scripting-heavy customisation, REST coverage still catching up ([Siemens blog](https://blogs.sw.siemens.com/polarion/?p=1282)). | F |

**Inference (I):** Polarion shows that an append-only, revision-based store makes history and baselines nearly free — but that putting a version-control system *underneath* the database creates query and concurrency costs. The *concept* (immutable revisions) is valuable; the *mechanism* (SVN) is an implementation choice.

## 4. PTC Codebeamer

Codebeamer's defining idea is the **configurable tracker**: every artifact type is a tracker with its own fields, workflow and permissions, and traceability is largely expressed as reference fields between trackers. Recent releases focus on variants and parallel product lines: working sets and branching (3.0), cross-project streams (3.1), and Delta Merge to carry an approved change across variants (3.3) ([ARC Advisory](https://www.arcweb.com/node/163836)).

| # | Aspect | Finding | Ev. |
| --- | --- | --- | --- |
| 1 | Purpose / users | ALM and requirements system of record for regulated, software-driven products — automotive, medtech, federal, aerospace and defence ([PTC](https://www.ptc.com/en/news/2026/ptc-delivers-new-ai-functionality-with-new-alm-releases)). Strong in ISO 26262 / ASPICE contexts via standards templates. | F/K |
| 2 | Core functionality | Requirements, risk, test and change management; review hub; standards templates; variant management with Pure Variants; Codebeamer AI (governed AI assistance, semantic search in 1.2) ([PTC](https://www.ptc.com/en/news/2026/ptc-delivers-new-ai-functionality-with-new-alm-releases)). | F |
| 3 | Data model | Project → **trackers** (each a configurable item type with fields, workflow and permissions) → **items**. Reference fields point at items in other trackers; separate free *associations* also exist. | K |
| 4 | Organisation | Items form parent/child trees inside a tracker and can be shown as a document view. Working sets group trackers into a versionable configuration; streams span projects ([SPK](https://www.spkaa.com/blog/the-codebeamer-product-roadmap-2025-explained)). | F/K |
| 5 | Attributes | Very rich field system: typed custom fields, computed fields (formulas), choice fields that reference other items, and field permissions that can depend on both role and workflow status. | K |
| 6 | Versioning | Item version history with a difference viewer; tracker branching and merging; Delta Merge across variant lines ([ARC Advisory](https://www.arcweb.com/node/163836); [SPK](https://www.spkaa.com/blog/the-codebeamer-product-roadmap-2025-explained)). | F |
| 7 | Baselines | Project, tracker and stream baselines; full baseline filtering added in 3.1 ([SPK](https://www.spkaa.com/blog/the-codebeamer-product-roadmap-2025-explained)). | F |
| 8 | Traceability | Reference fields and associations, suspected-link marking, a traceability browser and coverage browser for multi-level matrices. | K |
| 9 | Workflow / approval | Per-tracker state-transition workflows with guards (conditions) and actions; electronic signatures on transitions; escalation rules. | K |
| 10 | Collaboration | Review Hub with filtering and statistics ([SPK](https://www.spkaa.com/?p=40379)); comments; wiki pages. | F/K |
| 11 | Roles / permissions | Project roles; permissions per tracker; field-level permissions that change with status; stream-management permissions added in 3.3 ([ARC Advisory](https://www.arcweb.com/node/163836)). | F/K |
| 12 | Search / reporting | cbQL query language; reports and dashboards; database full-text indexes for description search ([PTC docs](https://support.ptc.com/help/codebeamer/r2.2/en/codebeamer/install_guide/2060016.html)); AI semantic search with a controllable indexing service ([ARC Advisory](https://www.arcweb.com/node/163836)). | F/K |
| 13 | Import / export | Word and Excel round-trip, ReqIF, migration from DOORS and other tools ([PTC](https://www.ptc.com/en/success-paths/get-started-with-codebeamer/plan/system-requirements-and-integrations)). | F |
| 14 | Integrations / APIs | REST API (Swagger-documented); integrations with Windchill PLM, Jira, Azure DevOps, Git/SCM; a requirements connector including a DOORS Next adaptor on the roadmap ([SPK](https://www.spkaa.com/?p=40379)). | F/K |
| 15 | Architecture | Java server on 64-bit x86 Windows or Linux; relational database Oracle or PostgreSQL ([PTC](https://www.ptc.com/en/success-paths/get-started-with-codebeamer/plan/system-requirements-and-integrations)); full-text search delegated to the database; PTC also offers SaaS. | F |
| 16 | Strengths / limitations | **Strengths:** extremely configurable, strong variant and branch management, standards templates, PLM digital thread. **Limitations:** configuration sprawl and UI complexity; scalability with large data sets has been a stated roadmap priority ([SPK](https://www.spkaa.com/blog/the-codebeamer-product-roadmap-2025-explained)). | F/I |

**Inference (I):** Codebeamer encodes traceability *inside the schema* (reference fields). That makes links easy to query and validate like ordinary data, but couples link semantics to item-type configuration — changing the traceability model means changing tracker definitions.

## 5. Visure Requirements ALM

Visure is a requirements-centric specialist that adds test, risk, defect and change management around a requirements core, with strong Microsoft Word/Excel integration and explicit reuse modes across projects ([Visure](https://visuresolutions.com/tool-suite/requirements-alm-platform)). Its public technical documentation is thin, so this profile is the least certain of the five.

| # | Aspect | Finding | Ev. |
| --- | --- | --- | --- |
| 1 | Purpose / users | Safety- and business-critical industries (aerospace and defence, automotive, medical, rail, energy, finance); founded 2002 ([YesPress](https://yespress.io/visure-solutions.md)). Often positioned as a lower-cost or DOORS-migration alternative. | F/I |
| 2 | Core functionality | Requirements, test, defect/issue, change and risk management in one platform; traceability, reporting, standards compliance ([Visure](https://visuresolutions.com/tool-suite/requirements-alm-platform)). AI assistant *Vivia* (since V8.3, 2023) and an MCP server for AI agents (June 2026) ([YesPress](https://yespress.io/visure-solutions.md)). | F |
| 3 | Data model | Requirement elements of configurable types with attributes, arranged in specification trees per project; links between elements across types. | K (low confidence) |
| 4 | Organisation | Projects containing hierarchical specifications; reusable components shared between projects in several reuse modes ([Visure](https://visuresolutions.com/tool-suite/requirements-alm-platform)). | F/K |
| 5 | Attributes | Custom typed attributes; quality-analysis attributes produced by checking requirement wording. | K |
| 6 | Versioning | Element version history; reuse modes control whether reused items stay linked to their source. | K/I |
| 7 | Baselines | Baselines that can be electronically signed as part of review ([Visure](https://visuresolutions.com/tool-suite/requirements-alm-platform)). | F |
| 8 | Traceability | Cross-element links, traceability matrices and impact analysis — the capability reviewers praise most ([SoftwareReviews](https://cdn1.softwarereviews.com/products/visure-requirements-alm)). | F |
| 9 | Workflow / approval | Configurable status workflows; change-management process with change requests. | K |
| 10 | Collaboration | Reviews with sign-off on baselines; comments; Word-based authoring for stakeholders. | F/K |
| 11 | Roles / permissions | Role-based project permissions. | K |
| 12 | Search / reporting | Filters, impact analysis, report templates; Word/Excel output. | K |
| 13 | Import / export | Word and Excel round-trip ([GetApp](https://www.getapp.co.uk/software/117643/visure-requirements)), ReqIF, dedicated DOORS migration support ([YesPress](https://yespress.io/visure-solutions.md)). | F |
| 14 | Integrations / APIs | Connectors to Jira, Azure DevOps, modelling and test tools; MCP server for AI agents ([YesPress](https://yespress.io/visure-solutions.md)). | F/K |
| 15 | Architecture | Historically a client–server product with a Windows client over a relational database, plus a web client; now marketed as accessible from any device ([Subscribed.fyi](https://subscribed.fyi/visure-requirements/reviews/)). | K (low confidence) |
| 16 | Strengths / limitations | **Strengths:** requirements-first focus, Office integration, reuse, traceability and impact analysis. **Limitations:** small market share (about 1% ALM mindshare per PeerSpot, March 2026) ([PeerSpot](https://origin.peerspot.com/vendors/visure-solutions)), smaller ecosystem, limited public technical documentation. | F |

**Inference (I):** Visure confirms that a credible product can compete as a *requirements-first* tool rather than a full ALM suite — but every competitor has converged on bundling test and risk management, which suggests customers expect at least verification traceability.

## Side-by-side comparison

The five products agree on *what* must exist (typed items, links, baselines, reviews) and differ mostly on *where structure lives* and *how versions are managed*.

| Dimension | DOORS Next | Jama Connect | Polarion | Codebeamer | Visure |
| --- | --- | --- | --- | --- | --- |
| Core unit | Artifact (base) + module binding | Item of an item type | Work item | Tracker item | Requirement element |
| Document concept | Module = ordered references | Rendered view of a tree | LiveDoc = stored document with embedded items | Document view of a tracker | Specification tree |
| Schema location | Type system per component | Item types per org/project | Work-item types per project | Tracker definition | Element types per project |
| Link model | Separate typed link objects, OSLC | Typed relationships + relationship rules | Link roles | Reference fields + associations | Typed links |
| Versioning model | Streams, change sets, deliver/merge | Linear item versions + reuse/sync | Repository revisions + document branching | Item history + branches, streams, Delta Merge | Linear versions + reuse modes |
| Baseline cost | Snapshot of a stream | Snapshot of a selection | A named revision (cheap) | Snapshot of tracker/project/stream | Signed snapshot |
| Traceability analytics | Views, LQE reports | Trace Score vs model | Query-built matrices | Traceability & coverage browsers | Matrices, impact analysis |
| Reviews | Formal reviews | Review Center (signature workflow) | Document approvals | Review Hub | Baseline review/sign |
| API style | OSLC + REST | REST + MCP | SOAP + JSON:API REST | REST | Connectors + MCP |
| Storage | RDBMS + RDF indexes | MySQL/SQL Server + Elasticsearch | Subversion + Lucene + PostgreSQL | Oracle/PostgreSQL | RDBMS (assumed) |
| Deployment | On-prem, IBM-hosted | Cloud-first, self-hosted via KOTS | On-prem, Siemens cloud | On-prem, PTC SaaS | On-prem, cloud |

Cell values summarise the per-product tables above, where each claim carries its evidence tag and source.

## A. Fundamental domain concepts

Ten concepts appear in all five products under different names, and each answers a need that exists even with pen and paper: they are the domain, not the implementation. Evidence: all **I**, derived from the product tables above.

| Concept | What it is | Why it is fundamental (not a product choice) | Names used by products |
| --- | --- | --- | --- |
| Requirement with stable identity | An atomic, uniquely identified statement whose ID survives rewording, moving and reordering | Contracts, tests and audits cite requirements by ID; if the ID changes, every reference breaks | Artifact, item, work item, tracker item, element |
| Type and attributes | A classification (stakeholder, system, software, constraint…) with typed metadata (priority, status, owner, rationale) | Different kinds of requirements need different information and rules | Artifact type, item type, work-item type, tracker |
| Specification structure | An ordered hierarchy with headings and explanatory text, read as a document | Specifications are still the unit people review, sign and send to suppliers | Module, set/document view, LiveDoc, document view, specification |
| Typed, directional trace relationships | A link with a meaning (refines, satisfies, verifies, mitigates) from one item to another | Traceability *is* the reason the discipline exists: proving every need is designed and verified | Link type, relationship, link role, reference field |
| Revision history | Immutable record of every change: who, when, what, previous value | Audits and regulators require reconstructing past state | History, versions, revisions |
| Baseline | A named, immutable, mutually consistent snapshot of a set of items **and their links** | Releases, contracts and certifications are tied to an agreed state | Baseline, global baseline, project baseline |
| Change impact (suspect links) | When an upstream item changes, downstream items linked to it are flagged for re-assessment | Change is constant; unflagged change silently invalidates verification | Suspect links (all five) |
| Lifecycle state and approval | A status per item/spec, with sign-off by accountable people | Only approved requirements should drive design and testing | Workflow, review, approval, e-signature |
| Access control | Who can see, edit and approve which requirements | Specifications contain IP and contractual commitments | Roles, permissions, groups |
| Coverage | The question "is every requirement of level X traced to Y?" answered at any time | It is the primary evidence produced for audits | Coverage analysis, Trace Score, matrices |

One further concept is fundamental in **regulated** settings only: **electronic signatures bound to a specific revision** (e.g. FDA 21 CFR Part 11). Inter-organisation **exchange** (ReqIF) is fundamental in supply chains (automotive, aerospace) but not in single-company use.

## B. Common features

These are implemented by most or all five products but are market expectations rather than domain necessities — a new product can defer or replace several of them.

| Feature | Present in | Domain necessity? |
| --- | --- | --- |
| Rich-text bodies with tables, images, equations | All | Partly — plain structured text is enough to validate an idea |
| Word and Excel import/export, often round-trip | All | No, but it is the main migration and stakeholder-review path |
| ReqIF import/export | All | Only for supply-chain exchange |
| Formal review module with sign-off | All | The *approval* is fundamental; a dedicated review UI is a product choice |
| Configurable per-type workflows | All | No — a fixed status set works for many teams |
| Traceability matrix and coverage views | All | Coverage is fundamental; the matrix UI is one presentation |
| Query language / advanced filters | All (cbQL, Lucene, filters) | No |
| Dashboards and document-generation reports | All | No, but audits need exportable evidence |
| Test management bundled in | All five | No — but customers clearly expect verification traceability |
| Risk management (FMEA, hazards) | Jama, Polarion, Codebeamer, Visure | Only in safety-critical domains |
| Reuse across projects | All, via different mechanisms | No |
| Jira / Azure DevOps integration | All | No, but most software teams already plan work there |
| REST API | All (Polarion REST still incomplete) | No, but required for any ecosystem |
| AI requirement-quality checks and test generation | All five in 2026 | No — a 2025–26 market convergence |
| MCP server for AI agents | Jama (May 2026), Visure (June 2026); Polarion via Copilot API and community servers | No — but becoming an expectation fast |
| Vendor-hosted SaaS plus self-hosted option | All | No |

## C. Product-specific features

Each product has one or two ideas worth studying on their own merits, independent of the rest of the product.

| Product | Distinctive capability | Why it is interesting |
| --- | --- | --- |
| DOORS Next | Global configurations composing versioned components across tools | Solves "which version of the test verifies which version of the requirement" across a whole toolchain |
| DOORS Next | Base artifact vs module binding | One requirement can appear in several documents without copying |
| DOORS Next | OSLC linked-data links | Links to other tools without importing their data |
| Jama Connect | Traceability Information Model + Trace Score | Traceability rules become checkable configuration; gaps are a live metric |
| Jama Connect | Review Center with cheap reviewer licences | Makes broad stakeholder review economically and practically easy |
| Jama Connect | Interchange sync layer | Treats connections between tools as their own managed layer |
| Polarion | LiveDoc | Document authoring and structured items in the same editor |
| Polarion | Complete revision store + historical queries | Any past state can be queried, not just baselined ones |
| Codebeamer | Field permissions that vary by role **and** workflow state | Fine control needed in strict regulated processes |
| Codebeamer | Computed fields, standards templates (ISO 26262, ASPICE) | Encodes process knowledge in the tool |
| Codebeamer | Delta Merge across variant streams; Pure Variants feature models | Propagates one approved change to many product variants |
| Visure | Explicit reuse modes across projects | Makes "copy, share, or link" a deliberate choice |
| Visure | Requirement quality analysis on wording | Early quality gate before review (now matched by AI features elsewhere) |

## D. Different implementation approaches

The same seven problems are solved in materially different ways; each row is a design decision we will have to make deliberately. Trade-offs are **I** (inferred).

| Problem | Approach | Used by | Trade-off |
| --- | --- | --- | --- |
| Relating documents and items | Document stored as its own object containing items | Polarion | Natural authoring; whole-document operations become expensive |
|  | Document = ordered list of references to items | DOORS Next | Reuse without copying; confusing "which instance" semantics |
|  | Document = a rendered view of an item tree | Jama, Codebeamer, Visure | Simple model; an item lives in exactly one place |
| Representing trace links | Links as separate first-class objects | DOORS Next, Jama, Polarion, Visure | Links can carry type, status, suspect flag, history independently |
|  | Links as reference fields in the item schema | Codebeamer | Easy to query and validate; link model tied to schema changes |
| Versioning | Linear item history + snapshot baselines | Jama, Visure | Easy to understand; parallel versions need copy-and-sync |
|  | Streams, change sets, deliver/merge | DOORS Next, Codebeamer (branches, streams) | Handles variants and parallel releases; high cognitive and implementation cost |
|  | Version-control system as the store | Polarion (Subversion) | History and baselines nearly free; query and concurrency costs |
| Variants and reuse | Copy with synchronisation link | Jama | Simple; divergence must be managed manually |
|  | Branch per variant + merge | DOORS Next, Codebeamer, Polarion | Precise; merge conflicts on prose are hard for users |
|  | Feature model + filtering | Codebeamer with Pure Variants | Scales to many variants; requires product-line discipline |
| Ensuring traceability completeness | Declared model + continuous scoring | Jama | Gaps are visible early; model must be maintained |
|  | Ad-hoc queries and matrix reports | Others | Flexible; gaps are found late |
| Cross-tool traceability | Linked data across tools (OSLC) | DOORS Next | No duplication; requires every tool to speak the standard |
|  | Synchronisation / replication | Jama Interchange, most Jira connectors | Works with any tool; two copies can drift |
| Search and reporting | Separate search index | Jama (Elasticsearch), Polarion (Lucene), DOORS (RDF index) | Fast search; index must be kept consistent |
|  | Database full-text | Codebeamer | Simpler operations; less powerful search |

**Lighter-weight approaches outside the five (K):** many software teams manage requirements as **Jira issues** with traceability plug-ins, trading formal baselines and documents for workflow familiarity. A growing **docs-as-code** group (e.g. sphinx-needs, StrictDoc, Doorstop) stores requirements as text files in Git, so branching, review and baselining come from Git pull requests and tags. Both are relevant if your product targets software teams rather than systems engineers.

## E. Architectural implications

The single biggest architectural driver is the versioning model: whether we need only linear history with baselines, or true branching for variants and parallel releases. Almost every other decision below depends on that answer, which is why it is the first question in the next section. These are implications for *any* RM system — not yet a design for yours.

**Confirmed requirement (24 Oct 2026):** branching is needed. Points 3 and 5 below therefore move from optional to mandatory: the revision model must support parallel versions from the first release. Still open: which kind of branching (see question 4.3).

1. **Separate identity from content (I).** Every product distinguishes a stable item identity from its changing content. **R:** model an item as a permanent ID plus a chain of immutable revisions; "current" is just a pointer to the latest revision.
2. **Treat links as first-class, versioned data (I).** Suspect detection requires a link to remember which revision of its source was last confirmed. **R:** links as their own entity with type, direction, endpoints and the confirmed source revision — not as free-form fields.
3. **Make baselines cheap (I).** Polarion shows that immutable revisions make a baseline little more than a set of pointers. **R:** a baseline = a stored set of (item, revision) and (link, revision) pairs, never a copy of content.
4. **Decide the document–item relationship early (I).** Whether one requirement can appear in several documents (DOORS) or exactly one (Jama, Codebeamer) changes the schema, the editor, permissions and baselines. This is an **open decision** for you.
5. **Design the revision model so branching can be added later (R).** Even if the first version has only linear history, storing a parent-revision pointer per revision keeps streams and variants possible without a rewrite. Retrofitting branching into a linear model is what makes it expensive.
6. **Configurable schema is a requirement, not a luxury (I).** All five let organisations define types, fields and link types. This rules out a hard-coded "Requirement" table with fixed columns. The storage approach (typed columns, JSON attributes, or entity-attribute-value) is a **technology decision for later**, with querying and reporting as the main criteria.
7. **Traceability is graph traversal, but not necessarily a graph database (I).** Coverage questions are multi-hop queries (stakeholder → system → software → test). At the scale of hundreds of thousands of items, a relational database with recursive queries is likely sufficient; a dedicated graph store is an optimisation to justify later.
8. **Search and reporting indexes should be derived and rebuildable (I).** Jama, Polarion and DOORS all keep a separate index; Polarion's experience shows the cost when the index is tightly bound to storage. **R:** one source of truth; any search index is a projection that can be rebuilt.
9. **Audit and signatures need tamper-evident history (I).** For regulated customers, signatures must bind to an exact revision. **R:** append-only audit log from day one; it is far harder to add later than any feature.
10. **Store rich text as structured content (R).** Diffing, Word round-trip, ReqIF export and AI processing all work better on a structured document model than on opaque HTML blobs.
11. **API-first, with governed AI access (I/R).** Every vendor shipped AI-agent access in 2026 (Jama and Visure MCP servers, Polarion Copilot API, Codebeamer AI). An API that enforces the same permissions and audit trail for humans and agents is becoming a baseline expectation, and is a plausible differentiator if done well from the start.
12. **What not to copy (R):** a version-control system as the primary database (Polarion), RDF/linked-data infrastructure unless cross-tool linking is your core proposition (DOORS), and multi-server or microservice topologies before scale demands them.

These points intentionally stop short of choosing a product form, architecture or technologies; those follow once requirements are established.

## Sources

- [DOORS — Wikipedia](https://en.wikipedia.org/wiki/DOORS)
- [Jazz Community Blog — DOORS Next posts](https://jazz.net/blog/index.php/tag/ibm-engineering-requirements-management-doors-next/)
- [IEEE Spectrum — Global configuration management](https://spectrum.ieee.org/global-configuration-management)
- [jazz.net — DOORS Next 6.0 New & Noteworthy](https://jazz.net/downloads/rational-doors-next-generation/releases/6.0?p=news)
- [IBM Docs — Change sets in personal streams (7.1)](https://www.ibm.com/docs/SSYMRC_7.1/com.ibm.rational.gcapp.doc/topics/working_with_rm_change_set.html)
- [IBM Docs — Multiple change sets (7.0.3)](https://www.ibm.com/docs/en/SSYMRC_7.0.3/com.ibm.rational.gcapp.doc/topics/t_work_with_multiple_csets.html)
- [Global configuration training outline](https://doorsnext.com/trainings/introduction-ibm-engineering-global-configuration/)
- [SodiusWillert — Configurations in DOORS Next](https://www.sodiuswillert.com/en/blog/recommendations-on-using-changes-with-configurations-in-doors-next)
- [PeerSpot — DOORS Next pros and cons](https://www.peerspot.com/products/ibm-rational-doors-next-generation-pros-and-cons)
- [YesPress — Jama profile](https://yespress.io/jama) and [timeline](https://yespress.io/jama.md)
- [aqua cloud — Jama Connect review 2026](https://aqua-cloud.io/jama-connect-review-features-pricing/)
- [GetApp — Jama Connect](https://www.getapp.com/project-management-planning-software/a/jama/)
- [Jama — Connect Interchange](https://www.jamasoftware.com/legacy/blog/jama-connect-interchange-live-traceability-realized/)
- [Jama Support — Self-hosted 9.28.x supported software](https://support.jamasoftware.com/hc/en-us/articles/41247505197325-Supported-Software-for-Jama-Connect-Self-Hosted-9-28-x)
- [Jama Support — Self-hosted scope of support](https://support.jamasoftware.com/hc/en-us/articles/24072328211085-Jama-Connect-Self-Hosted-Scope-of-Support)
- [Siemens — Polarion 2606 overview](https://blogs.sw.siemens.com/polarion/page/85/) and [Polarion X 2606](https://blogs.sw.siemens.com/polarion/?p=8274)
- [Siemens — Polarion 22 R2 REST API](https://blogs.sw.siemens.com/polarion/?p=4275)
- [Siemens Developer — Polarion REST limitations](https://developer.siemens.com/polarion/limitations-and-known-issues.html)
- [Siemens — Polarion architecture and scalability (a)](https://blogs.sw.siemens.com/polarion/?p=656), [(b)](https://blogs.sw.siemens.com/polarion/?p=1282), [(c)](https://blogs.sw.siemens.com/polarion/?p=862)
- [PTC — Codebeamer 3.2 and Codebeamer AI 1.0 (Jan 2026)](https://www.ptc.com/en/news/2026/ptc-delivers-new-ai-functionality-with-new-alm-releases)
- [ARC Advisory — Codebeamer 3.3](https://www.arcweb.com/node/163836)
- [SPK — Codebeamer roadmap](https://www.spkaa.com/blog/the-codebeamer-product-roadmap-2025-explained)
- [PTC — Codebeamer system requirements](https://www.ptc.com/en/success-paths/get-started-with-codebeamer/plan/system-requirements-and-integrations)
- [PTC Help — Codebeamer database configuration](https://support.ptc.com/help/codebeamer/r2.2/en/codebeamer/install_guide/2060016.html)
- [Visure — Requirements ALM platform](https://visuresolutions.com/tool-suite/requirements-alm-platform)
- [YesPress — Visure profile](https://yespress.io/visure-solutions.md)
- [SoftwareReviews — Visure](https://cdn1.softwarereviews.com/products/visure-requirements-alm)
- [GetApp UK — Visure](https://www.getapp.co.uk/software/117643/visure-requirements)
- [PeerSpot — Visure](https://origin.peerspot.com/vendors/visure-solutions)
- [Subscribed.fyi — Visure](https://subscribed.fyi/visure-requirements/reviews/)
