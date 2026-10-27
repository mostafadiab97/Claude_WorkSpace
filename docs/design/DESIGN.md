# Requirements Management Platforms — Domain Analysis

> Exported on 25 Oct 2026 from the Claude Doc where the analysis, your answers and the design were worked out
> (https://claude.ai/artifact/Rjiq1ojBgzDPrLtPEjCkMM). **This copy in the repository is now the source of truth**;
> update it here as decisions change. Tags used throughout: C = confirmed by the product owner, R = recommendation,
> I = inference; evidence letters refer to the Sources section.

Oct 24, 2026 · @Mostafa

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

## Questions to define your product

The five questions marked ★ shape the architecture most; the rest refine scope. Short answers are fine, and "don't know yet" is a valid answer — it becomes an open question rather than an assumption.

**Answers recorded so far (24 Oct 2026)**

| Type | Statement |
| --- | --- |
| Confirmed requirement | Branching / parallel versions are needed, implemented as ordinary Git branches: the tool works on whichever branch is checked out and compares or merges branches at requirement level. This covers parallel releases, drafts reviewed by pull request and simple variants. Carrying one change into many long-lived variant branches would use Git cherry-pick, not a dedicated feature like Codebeamer's Delta Merge. |
| Confirmed requirement | Core thesis: a simpler, much smaller tool — not an enterprise ALM suite. |
| Confirmed requirement | Purpose: one structured, central place to manage project requirements and their changes, replacing scattered Word documents and Excel sheets. |
| Confirmed requirement | No dedicated requirements server: requirements are stored as files in a folder of the project's existing Git repository, hosted wherever the code already is (GitHub or similar). The product is a client GUI for viewing, editing, linking and visualising those files. |
| Confirmed requirement | Branching, history and baselines can be delegated to Git (branches, commits, tags) and reviews to pull requests. Confirmed: Git is the product's version control and data store; there is no separate database. Data Git cannot express (e.g. suspect-link state) is stored in the repository files themselves; any local index is a rebuildable cache. |
| Open question | Confirmed: all users know Git/GitHub. Confirmed: the tool includes Git actions (commit, pull, push, branch) and shows differences and merge conflicts at the requirement level (e.g. "REQ-42 text changed on both branches", "link added here, deleted there") rather than as raw file lines. This requirement-aware diff and merge is a likely differentiator. Still open: whether conflict resolution and full Git actions belong in the prototype or a later stage. |
| Confirmed requirement | Internal tool first; likely to become a commercial product if it proves reliable. Implication (I): no licensing, billing or multi-tenant features now, but keep company-specific choices (requirement types, ID formats, templates) configurable and use only dependencies whose licences allow commercial distribution. |
| Confirmed scope decision | Regulatory-compliance features — version-bound approvals/signatures, tamper-proof audit trail, enforced coverage reporting, formally frozen baselines — are deferred to later commercial releases. Recommendation (R): keep the file format able to hold approval and link-confirmation data later, so adding them needs no data migration. Support for specific standards (ISO 26262, IEC 62304, DO-178C, ASPICE, 21 CFR Part 11) is also deferred to the commercial version. Target industry still to be named. |
| Confirmed context | Organisation of 200–300 people (mid-size; around the EU's 250-employee line between medium and large), teams of 7–15. So roughly 7–15 people work on one repository's requirements at once — comfortably within what Git handles. Confirmed: traceability stays inside one repository. A requirement needed in another repo is copied there as a new, independent item (no cross-repo links or sync). Recommendation (R): optionally record a "copied from" note (source repo + ID) so the origin can be found later at near-zero cost. |
| Confirmed requirement | Access control is delegated to the Git host: whoever can read/write the repository can read/write its requirements. The tool has no user accounts or permission system of its own in the first version. Inference (I): finer control is still possible with the host's own features (protected branches, required pull-request reviews, CODEOWNERS per folder); people without repo access receive exported documents. |
| Confirmed non-functional requirement | Project size is unknown and varies; scalability should not be a hard limit. Proposed design target: smooth performance up to 10,000 requirements per repository, usable up to about 50,000, with no design choice that caps growth beyond that (e.g. one file per requirement, a local rebuildable index instead of loading everything into memory). Confirmed 24 Oct 2026: the target is accepted for now, and the design must allow raising it on demand without changing the file format. |
| Confirmed requirement | Item-centric: the primary experience is a database of requirement items to filter, sort and link (closest to Jama/Codebeamer, not Polarion's LiveDoc). Inference (I): this fits one file per item well; any document is a generated view/export. Confirmed: export to Word, PDF, Excel and CSV is required (printable versions and data for other tools), plus Markdown for sharing with AI tools and ReqIF as optional. No live connection to other tools and no direct AI-tool access in the first version. Confirmed: import from existing Word and Excel/CSV files is also required. Inference (I): Excel/CSV import is simple (map columns to fields); Word import is harder and needs rules (e.g. by heading style or ID pattern), as Polarion's rule-based import shows — a candidate for a later stage than Excel import. |
| Confirmed requirement | Requirement types, fields and link types are fully configurable per repository. Recommendation (R): store this schema as a configuration file in the same repo, so it is versioned and branched with the data; ship a sensible default template; the tool validates items against the schema and flags items left invalid by a schema change. Confirmed: anyone with write access may change the schema (teams can still restrict it later with CODEOWNERS). |
| Confirmed requirement | Compare any two Git references (branches, commits or tags used as baselines), shown per requirement: added, deleted and changed items, with differences in text, fields and links — the requirement-level equivalent of comparing two branches in Git. |
| Confirmed requirement | No links to external tools in the first version (revisit for the commercial product); all traced artifacts live inside the tool. Common artifact types are available from day one, and users can add custom types as easily as adding an Excel column. Default set (accepted 24 Oct 2026, refined from the default templates of the analysed tools, evidence K): Stakeholder Need, System Requirement, Software Requirement, Hardware Requirement, Interface Requirement, Use Case, Design Element, Test Case, Defect, Risk, Change Request, plus a non-requirement Heading/Information item for structure and explanatory text. Default link types: refines/derives from, satisfies, implements, verifies, mitigates, relates to. |
| Open question (with proposed default) | Enforce or only report traceability rules — undecided. Proposed default (R): rules such as "every System Requirement must be verified by a Test Case" are declared in the repo's schema file and shown as warnings and coverage gaps, never blocking saves or commits. Blocking enforcement can be switched on later without changing the data, so this decision does not hold up the architecture. |
| Confirmed requirement | Approval = the GitHub pull-request flow: open PR → review → requested changes → approval → merge to the main branch. No separate workflow engine in the tool. Inference (I): GitHub's PR page will show raw file diffs, which you noted it cannot present well, so reviewers need the tool's requirement-level view of the PR's changes. Decision (user, 24 Oct 2026): handle the PR process in the tool if feasible. Assessment (I/R): feasible in stages, since GitHub's API supports creating PRs, reviews (approve / request changes), comments and merges. Stage 1 — view changes in the tool, approve on GitHub (no risk). Stage 2 — create, approve and merge PRs from the tool (moderate effort). Stage 3 — review comments anchored to individual requirements and synced with GitHub (hardest, because comments must map to file lines). Requires a GitHub sign-in token; other hosts (GitLab, Bitbucket, Azure DevOps) have different APIs, so this should sit behind a host adapter. Confirmed: all three stages are in scope; the tool is the central place for every requirements action, including PRs. Which stage lands in the prototype vs. MVP is decided at scoping. |
| Confirmed requirement | Audit trail for v1 = normal Git history (author, time, message, change per commit), shown per requirement in the tool. Teams wanting stricter control can enable branch protection and signed commits in GitHub; tamper-proof audit is part of the deferred compliance features. |
| Confirmed scope decision (25 Oct 2026) | M4 Git: when a pull finds items changed on both sides, ReqMan stops without changing anything and lists them (choosing per item comes with FR-13); M4 shows the current branch only (creating/switching branches stays FR-12, MVP); ReqMan commits only the `requirements/` folder, never other project files. |
| Confirmed scope decision (25 Oct 2026) | M5 Compare: the default comparison is "since my last pull" (what the last pull brought in); ReqMan pulls right before any comparison; exporting the comparison list comes with the M6 exports. |
| Confirmed decision (25 Oct 2026) | CSV exports use a comma separator (the owner's Excel setting). After the prototype (M6), the order is: Excel export and import (M7), then branches and per-requirement conflict resolution (M8); Word/PDF export, PR view and coverage rules later. |
| Confirmed decision (25 Oct 2026) | M7 import: rows whose ID already exists **update** those items (with a preview of what changes); links are **read too** (from a Links column like the export writes). |
| Confirmed decision (27 Oct 2026) | Item IDs are independent of the item type: one prefix `REQ-` for all items + random part; the type can change without changing the ID. Existing sandbox data is converted directly in the sandbox repository (no conversion feature in the tool). |
| Confirmed decision (27 Oct 2026) | No ID pool: IDs use 7 random characters (`REQ-K7Q3XMB`); duplicate IDs created on different branches are repaired automatically at pull/merge (the local, unshared item is renamed with its links). |
| Confirmed decision (27 Oct 2026) | Every item has an outline number (1, 1.2, 2.3.1 …) calculated from the hierarchy when displayed — not stored — so moves renumber instantly and change only the moved item's file. |
| Confirmed requirement | Collaboration works like GitHub: no real-time co-editing. Each person edits in their own local copy/branch, shares by push/pull, and conflicts are resolved per requirement in the tool; formal review happens through pull requests. Inference (I): this removes the need for any collaboration server, consistent with the no-server requirement. |
| Confirmed scope decision | No AI features in the first version (no quality checks, drafting, test generation or agent access); possibly in a later version. Markdown export covers manual use of external AI tools. |
| Confirmed requirement | Deployment: the tool runs locally on each user's PC; data lives in a Git repository hosted like any other repo (GitHub or similar). Confirmed: the tool must work fully offline (all viewing, editing, linking, comparing, exporting and local commits); only push, pull and PR actions need a connection. How the local tool is built (desktop app, locally served web UI, etc.) is a product-form decision for the architecture stage, not yet decided. Confirmed: Windows is the primary OS; some teams use Linux. Inference (I): this argues for cross-platform technology and against Windows-only UI frameworks, unless Linux support is explicitly postponed. Confirmed: Windows only for the first releases; Linux later. Recommendation (R): treat "Linux possible without a rewrite" as a selection criterion in the technology stage. |
| Confirmed constraint | The first version is a proof of concept developed by Claude; technology choices are delegated to Claude. Only free, open-source dependencies whose licences also permit later commercial use. Inference (I): favour mainstream, well-documented technologies with strong automated testing, a repo that holds the specs and decisions so work continues across sessions, and a person on your side who builds and tries each release on Windows. Confirmed: you will run the trial builds; if the proof of concept proves valuable, a full team takes over. Recommendation (R): therefore keep the code readable and conventional, with tests and architecture notes, in a language a typical hiring team knows. |
| User hypothesis (decision delegated to Claude) | Product form: user suggested an HTML file opened in a browser that manages files in its folder (for UI/UX and ease of development). Decision criteria set by user: functionality first, then installation, updating, environment setup, UI/UX, performance and reliability. Preliminary inference (I), to be confirmed in the product-form evaluation: a browser UI is a good idea, but a plain HTML file is sandboxed — it cannot run Git, use the user's Git credentials/SSH keys, or freely read and write the repo folder (file access works only in Chromium browsers, with permission prompts). The likely fit is the same HTML/JavaScript UI packaged in a lightweight desktop shell, which adds full file and Git access, an installer and auto-updates. |

**Effect on the analysis (I):** this places the product in the docs-as-code group from section D (sphinx-needs, StrictDoc, Doorstop), which become the closest reference products alongside the five enterprise tools. It also makes the file format a core design decision: it must be text-based, diff- and merge-friendly, and give each requirement a stable ID that does not collide when two branches add requirements at the same time.

**1. Vision and market**

1. ★ What is the core thesis — why would someone choose your product over Jama, Polarion or a Jira plug-in? (e.g. simplicity for small teams, AI-native authoring, docs-as-code/Git, a specific industry, price, open source)
2. Is this a commercial product, an internal tool for your organisation, or open source?
3. Which industries do you target, and are they regulated (medical, automotive, aerospace, rail, none)?
4. What size of organisation: start-ups and small teams, mid-size engineering companies, or large enterprises?

**2. Users and scale**

1. Who authors requirements, who reviews them, and who only reads them? Are external parties (customers, suppliers, auditors) involved?
2. Expected users per organisation and concurrent users (roughly: 5, 50, 500, 5,000)?
3. ★ Expected size of a project: about 1,000, 10,000 or 100,000+ requirements?

**3. Requirement model**

1. ★ Document-centric or item-centric: do users think mainly in specifications to write and sign, or in a database of items to filter?
2. Must one requirement be able to appear in several documents or products without copying?
3. Fixed requirement types (e.g. stakeholder / system / software / test) or fully configurable types, fields and link types?

**4. Versioning and variants**

1. ★ Is linear history plus baselines enough, or do you need parallel versions (branches) for product variants or concurrent releases?
2. Do you need to compare any two baselines or revisions and see differences in text and links?
3. *(Follow-up — branching confirmed.)* Which branching do you need: (a) product variants that live in parallel for years, (b) parallel releases (maintain v1 while writing v2), (c) private drafts / change sets merged after review, or several of these? Must an approved change be propagated across branches, and must merge conflicts in requirement text be resolved in the tool? Answered: same model as GitHub — any branch can serve any purpose (release, draft, variant), merges happen through pull requests or merges, a change is carried to other branches by merge or cherry-pick, and conflicts are shown and resolved per requirement in the tool.

**5. Traceability and scope**

1. Which artifacts should live *inside* your product (requirements only, plus tests, risks, design elements) and which should be linked from other tools?
2. Should the product enforce traceability rules (e.g. "every system requirement must be verified by a test") or only report on them?

**6. Process and compliance**

1. Which standards must be supported, if any (ISO 26262, IEC 62304, DO-178C, FDA 21 CFR Part 11, ASPICE)?
2. Do approvals require electronic signatures, multi-step workflows, or is a simple status change enough?
3. How strict must the audit trail be (everything immutable vs. normal history)?

**7. Collaboration**

1. Do several people need to edit the same specification at the same time (real-time co-editing)?
2. Do you want a formal review process (invite reviewers, collect comments, sign off) in the first version?

**8. Integration and AI**

1. Which existing tools must it connect to (Jira, Azure DevOps, GitHub/GitLab, Word, Excel, ReqIF, modelling tools)?
2. What role should AI play: quality checking, drafting, test generation, giving AI coding agents governed access, or none initially?

**9. Deployment and constraints**

1. ★ Where must it run: vendor-hosted cloud, customer-hosted on-premises, air-gapped networks, or all of these? Any data-residency rules?
2. Must it work offline?
3. What are your team size, skills, timeline and budget for the first version?
4. Do you already have assumptions about the solution — e.g. desktop vs web, a language such as C# or Python, mobile? Please list them; I will record them as **hypotheses** to evaluate later, not as requirements.

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

## Architecture

**Recommendation (R): a modular monolith — one desktop application split into clearly separated modules with narrow interfaces.** There is no server, so microservices, event buses or client–server splits would add cost without benefit. Modules keep the code understandable for a future team and let parts (e.g. the Git host adapter) be swapped later.

The app has two processes, as all desktop-shell apps do: a **UI process** (the screens) and a **core process** (files, Git, indexing). The UI never touches the disk or Git directly; it calls a small, typed API exposed by the core. This is also the main security boundary.

| Module | Responsibility | Talks to |
| --- | --- | --- |
| UI | Table, item editor, links, compare/merge views, schema editor, Git panel | Core API only |
| Domain core | Items, links, hierarchy, schema validation, coverage rules, suspect-link logic — pure logic, no I/O | Repository store, Diff/merge |
| Repository store | Reads and writes item files and the schema file in the repo folder; atomic writes | File system |
| Diff / merge engine | Compares two versions of the requirement set per item and link; builds and applies merge resolutions | Repository store, Git adapter |
| Git adapter | Commit, pull, push, branch, tag, log, read file at any revision — by calling the installed Git | System Git |
| Index cache | Local, rebuildable search/filter index for speed at 10k–50k items; never the source of truth | Repository store |
| Import / export | CSV, Excel, Word, PDF, Markdown (ReqIF later) | Domain core |
| Git host adapter | Pull requests via the GitHub API; an interface so GitLab etc. can be added later | GitHub API (online only) |
| App services | Settings, auto-update, logging, crash reports kept locally | — |

API/service boundaries: the only external boundary is the Git host API (optional, online). Everything else is in-process.

**Design rules for replaceability and configurability (C, from your review):**

1. **One theme file.** A `theme` configuration defines design tokens — logo, fonts, colours, corner radii, spacing, light and dark palettes. Components use token names (e.g. `color.primary`), never literal values, so restyling or rebranding is a one-file change.
2. **One public interface per module.** Each module has a single entry file that declares its API (typed interface + short README). Other modules may import only that file; reaching into a module's internals is blocked by an automated lint rule on every build.
3. **Wiring in one place.** All modules are connected in a single composition file at start-up. Replacing a module (e.g. the Git adapter or the index cache) means writing a new implementation of the same interface and changing one line there.
4. **Settings over code.** Behaviour that teams may want to change — default schema, export templates, keyboard shortcuts, theme — lives in configuration files, not in code.
5. **Module map in the repo.** An architecture note lists every module, its interface and who uses it, kept up to date with each change.

## Data architecture

**Recommendation (R): one Markdown file per item with a YAML header, plus one schema file, all inside a `requirements/` folder of the project repo.** Git sees small, line-based text files, so diffs and merges stay clean; GitHub even renders each item readably, and nothing is locked into the tool.

```
requirements/
  .reqtool/schema.yaml     types, fields, link types, coverage rules (copied from the tool's default template)
  items/SYS-K7Q3XM.md      one file per item
  items/TC-9F2D4A.md
```

```markdown
---
id: SYS-K7Q3XM
type: system-requirement
title: Brake pedal response time
status: draft
priority: high
owner: m.hassan
parent: STK-2B8R1C
order: 30
tags: [braking]
links:
  - type: refines
    target: STK-2B8R1C
    confirmed: 4e1a9c
---
The system shall begin braking within 150 ms of pedal input.
```

| Decision | Choice (R) | Why / trade-off |
| --- | --- | --- |
| IDs | Type prefix + 6 random characters (e.g. SYS-K7Q3XM), assigned once and never reused | Sequential numbers (REQ-0042) collide when two branches create items at once; random IDs never do. Trade-off: less tidy than sequential numbers |
| File per item | Yes, named by ID | Two people editing different items never conflict; renaming a title never moves a file |
| Field layout | Fixed field order, one value per line | Keeps diffs and merges line-clean and predictable |
| Links | Stored only in the source item; reverse links computed by the index | No double bookkeeping, no half-updated link pairs |
| Suspect links | Each link stores a short fingerprint of the target's content when last confirmed; a mismatch marks it suspect | Works offline and survives branching, with no server |
| Hierarchy and order | `parent` field plus a numeric `order` with gaps (10, 20, 30) | Inserting an item rarely touches its siblings |
| History and baselines | Git log per file; baselines are Git tags | Nothing to build; consistent with the Git-first decision |
| Index cache | Local database file outside the repo, rebuilt from files when missing or stale | Fast filtering at 50k items without a second source of truth |
| Future compliance data | Optional header fields (e.g. approvals) can be added later; unknown fields are preserved | Satisfies NFR-09 without migration |

## Technology choices

**Recommended stack (R): Electron + TypeScript throughout, React for the UI, the installed Git for version control, SQLite as a local cache, packaged with electron-builder and auto-updated from GitHub Releases.** All parts are free and permissively licensed (MIT, ISC, Apache-2.0, BSD), which allows later commercial sale. Criteria, in your order: functionality and reliability; easy install and update; one language for a future team; Linux later; mainstream, well-documented tools. Library facts are **K**; picks are **R**.

| Decision | Realistic alternatives | Pick | Why |
| --- | --- | --- | --- |
| Desktop shell | Electron · Tauri 2 · Wails | **Electron** | Most mature, same Chromium engine on Windows and Linux, built-in PDF printing, everything in one language. Tauri is much smaller but needs Rust in the core and uses a different web engine on Linux — the strongest alternative if download size becomes important |
| Language | TypeScript · JavaScript · Rust/Go (with Tauri/Wails) | **TypeScript** | One typed language for UI and core; easiest for a future team to hire for and maintain |
| Git integration | Call the installed Git (via `simple-git`) · isomorphic-git (pure JS) · libgit2 bindings | **Installed Git** | Exactly the Git your team already uses, including their credentials and SSH keys, full merge support. isomorphic-git lacks SSH and full merging; libgit2 bindings for Node are poorly maintained. Requires Git for Windows on each PC — normal for GitHub users |
| UI framework | React · Vue · Svelte | **React** | Largest ecosystem for data-heavy tables and editors; most widely known |
| Table / large lists | TanStack Table + Virtual · AG Grid Community | **TanStack** | Fully MIT; virtual scrolling keeps 50k rows responsive |
| File parsing | `yaml` + `gray-matter` | as listed | Standard Markdown-with-YAML handling; preserves unknown fields |
| Index / search | SQLite (`better-sqlite3`, full-text search) · in-memory (MiniSearch) | **SQLite** | Handles 50k items with fast filtering and full-text search; rebuildable cache file |
| Exports | `docx` (Word), ExcelJS (Excel/CSV), Electron print-to-PDF, plain Markdown | as listed | All free; PDF reuses the app's own rendering |
| Imports | ExcelJS (MVP); `mammoth` for Word (Later) | as listed | Excel first, Word later as planned |
| GitHub API (MVP+) | Octokit · hand-written calls | **Octokit** | Official GitHub client library |
| Install / update | electron-builder (NSIS, per-user) + electron-updater via GitHub Releases · MSIX/Store | **electron-builder** | One-click per-user install without admin rights; free automatic updates |
| Testing | Vitest (logic) + Playwright (end-to-end UI) | as listed | Covers the reliability requirement; runs on every build |

What you need on each PC: Windows 11 and Git for Windows. Nothing else.

## Trade-offs, postponed decisions and risks

The main trade-off is accepting a larger app download (Electron, roughly 100+ MB) in exchange for one language, mature tooling and reliable behaviour. The main risk is merge quality on structured files, which is why requirement-level compare is in the prototype.

| Type | Item | Handling |
| --- | --- | --- |
| Trade-off | Random IDs (SYS-K7Q3XM) instead of tidy sequential numbers | Avoids branch collisions; can add an optional display number later |
| Trade-off | Depends on Git for Windows being installed | The tool checks at start-up and links to the installer |
| Trade-off | Links stored one-way in the source item | Reverse view always computed; nothing to keep in sync |
| Postponed | Git host adapters beyond GitHub; rich text with images and tables; ReqIF; compliance features; Linux and Windows 10 builds | Kept possible by the module boundaries and the extensible file format |
| Risk | Users editing item files by hand in ways the tool cannot read | Validate on load, show clear errors, never overwrite unreadable files |
| Risk | Large merges with many conflicts become confusing | Per-item conflict list with "mine / theirs / edit" choices; test with realistic data early |
| Risk | Performance at 50k items | Index cache plus virtual scrolling; a 50k-item test repo in the test suite |
| Risk | Continuity across Claude sessions | Specs, decisions (this document) and architecture notes live in the repo; every feature has tests |

**Status of conclusions:** product form, architecture, data format and stack were approved by you on 24 Oct 2026, with the configurability and modularity rules added (formerly recommendations, **R**). Next step: the implementation plan for the prototype (repository setup, milestones, test data), then building.

## Prototype implementation plan

The prototype is built in seven milestones, each ending with a Windows build you can install and try. Every milestone adds one testable slice of the 8-step journey, so problems surface early rather than at the end.

| Milestone | Delivers | Done when |
| --- | --- | --- |
| M0 Foundations | Project skeleton (Electron, TypeScript, React); module folders each with one interface file; lint rule blocking cross-module internals; composition file; theme file with light and dark mode; automated build producing a Windows installer; Git-installed check | You install the empty app on Windows 11 and switch light/dark |
| M1 Data layer | Default schema template; item file read/write (Markdown + YAML); ID generator; validation; repository store; SQLite index cache; generators for 1k and 50k-item test repos; automatic updates via GitHub Releases (moved from M6); user theme overrides kept in %APPDATA%\\ReqMan so updates never overwrite them | Unit tests pass; a 50k-item repo indexes and filters within target; an installed build updates itself to the next release |
| M2 Core UI | Open a repo, initialise `requirements/`; item table with filter, sort and search; item editor; hierarchy tree | Journey steps 1–3 work (without links) |
| M3 Links | Create and remove typed links; item detail with outgoing and incoming links | Journey step 2 complete, including links |
| M4 Git | Status of changed items; commit, pull, push; per-item history | Journey steps 4, 5 and 7 work between two PCs |
| M5 Compare | Pick two commits/branches/tags; per-item and per-link difference view | Journey step 6 works |
| M6 Export and hardening | CSV export; end-to-end tests of the whole journey; bug fixes from your trials | The full 8-step journey passes on two Windows PCs; success measures met |

**Progress (25 Oct 2026):** M0–M6 are complete — **the prototype scope (FR-01 to FR-10) is built**; the current release is **v0.7.0**. M2 was extended after the owner's trials in v0.3.0 (hierarchy in the table, drag-and-drop moves, parent picker, field editor, column chooser); M3 (v0.4.0) added typed links both ways, suspect links with confirmation (FR-17 pulled forward), Text/Links columns, link filters; v0.4.1 fixed old index caches. M4 (v0.5.0): Git bar, per-item changes, commit (requirements folder only), pull that stops safely on items changed on both sides, push (never forced), undo of unpushed commits, per-item history (FR-07, FR-08). M5 (v0.6.0): Compare — pulls first, per requirement and per link, default "what the last pull brought in" (FR-09). M6 (v0.7.0): export of the table and of Compare to CSV (Excel, comma) and Markdown (FR-10, part of FR-14), error boundary, large-repo smoke test in CI, combined checklist and a two-PC trial script. Waiting for the owner's trial of 0.5.0–0.7.0 and the two-PC journey (success measures). Next: **M7 Excel export and import** (FR-14 part, FR-15), then **M8 branches and per-requirement conflict resolution** (FR-12, FR-13) — owner's order, 25 Oct 2026. See `CLAUDE.md` → "Next step". This file in the repository is the living design document.

**How we work:** I write the code, tests and architecture notes in a Git repository; after each milestone you install the build, try it and comment here or in chat. Specs and decisions stay in this document and the repo, so work continues across sessions.

**What I need from you to start:**

- [x] An empty GitHub repository for the tool's code (private is fine), connected to this chat so I can push to it
- [x] Optionally, an anonymised sample of a current requirements Excel sheet, for realistic test data and later import work
- [x] A working name for the tool (can change later)

  Working name: **ReqMan**. Sample data: a fictional smart-thermostat requirements sheet (59 items: needs, system/software/hardware requirements, tests, risks, change requests) is in the repo at `samples/sample-requirements.xlsx`.

## Roadmap after the prototype (proposal, 25 Oct 2026 — to discuss with the owner)

The prototype scope (FR-01 to FR-10) is built (v0.7.0). This section plans the next versions: where each
requirement stands, what is still missing compared with the five analysed products, the preferred new features, and
a proposed version sequence. Everything here is a recommendation (R) unless marked C; the owner decides the order
after his test round and the project review (`docs/reviews/2026-10-25-project-review.md`).

### Where each requirement stands

| ID | Requirement | Status (v0.7.0) |
| --- | --- | --- |
| FR-01 – FR-06 | Open repo, default schema, items with stable IDs, hierarchy, typed links, table/filter/search | Done |
| FR-07 | Item history from Git | Done (History tab with field-level comparison) |
| FR-08 | Commit, pull, push | Done (only `requirements/`, never forced, stops on clashes) |
| FR-09 | Compare two versions per requirement and link | Done (basic and most of full; pulls first) |
| FR-10 | Export to CSV | Done (+ Markdown; Compare export) |
| FR-11 | Schema editor | Partly — fields done; item types and link types still in `schema.yaml` |
| FR-12 | Branches and tag baselines | Branch shown only → M8 |
| FR-13 | Merge and resolve conflicts per requirement | Pull stops safely → M8 |
| FR-14 | Word, PDF, Excel and Markdown export | Markdown done; Excel → M7; Word/PDF → later |
| FR-15 | Excel/CSV import with column mapping | → M7 |
| FR-16 | Coverage view and rule warnings | Not started |
| FR-17 | Suspect links | Done (v0.4.0) |
| FR-18 | GitHub pull-request view per requirement (stage 1) | Not started |
| FR-19, FR-20 | PR create/approve/merge in the tool; Word import, ReqIF | Later |

### What is still missing compared with the analysed tools

| Feature (from "B. Common features") | In ReqMan today | Proposal |
| --- | --- | --- |
| Word and Excel import/export, round trip | CSV + Markdown export | **M7**: Excel export + import (update existing items by ID, read links — C, 25 Oct 2026); Word/PDF export M10 |
| Baselines | Any commit can be compared | **M8**: tags as named baselines ("Release 1.0"), compare against them |
| Branches / parallel versions | Shown only | **M8**: create, switch, compare branches |
| Merge and conflict resolution per requirement | Pull stops and lists clashes | **M8**: field-level 3-way merge, choose mine/theirs/edit only for real conflicts |
| Traceability matrix and coverage views | Link filters ("without links", "suspect") | **M9**: coverage view (e.g. which system requirements have no verifying test) and a matrix (rows × columns by link type) |
| Configurable types and workflows | Fields editable in the GUI | **M9**: item types and link types editable in the GUI; status stays a field (no workflow engine) |
| Query language / advanced filters | Search + type/field/link filters | **M9**: saved filters ("views"); later a small query syntax (`status:Draft type:SYS`) |
| Rich text with tables and images | Markdown text, plain editor | **M10**: Markdown preview in the editor; later images as attachments |
| Formal review with sign-off | GitHub pull requests outside the tool | **M11**: PR stage 1 (view a PR's changes per requirement) |
| Dashboards and reports | Export only | **M10**: one printable report (PDF) of a filtered set; later a simple project overview |
| Reuse across projects | Copy by hand (C: no cross-repo links) | Later: "copy from another repository" with a `copied-from` note |
| Jira / Azure DevOps, REST API, MCP server, AI checks | Not planned now (C) | Commercial stage |
| Risk management (FMEA) | Risk item type | Later, only if a safety-critical customer needs it |

### Preferred new features (candidate backlog)

**Must (MVP):** Excel export + import with preview and update by ID (M7) · branches, tags as baselines, per-requirement
merge (M8) · item types and link types in the GUI, coverage view, saved views (M9) · Word/PDF export, Markdown
preview (M10) · PR stage 1 (M11).

**Should:** bulk edit (select several items → set status/owner/tags, move, delete) · item templates per type
(pre-filled text, e.g. "The system shall…", acceptance-criteria section) · "find items linking to …" impact view (all
items affected by a change, following links several levels) · keyboard shortcuts list · recent changes panel ("what
changed this week") · Windows 10 build (commercial need, C) · single-instance app and other fixes from the review.

**Could:** traceability graph view · copy items to another repository with provenance · duplicate-ID repair ·
requirement quality hints without AI (vague words like "fast", "user-friendly", missing "shall") · Linux build ·
English/Arabic UI (if wanted; see review S-06) · several requirement sets per repository (review S-07).

**Later / commercial:** PR create/approve/merge in the tool and comments per requirement (FR-19), Word import,
ReqIF, GitLab/Bitbucket/Azure DevOps adapters, compliance features (signatures, tamper-proof audit, standards
templates), AI features and governed AI access, licensing, private update channel and code signing (review S-08,
X-02).

### Proposed versions

| Version | Milestone | Contents | Why in this order |
| --- | --- | --- | --- |
| 0.7.x | Fixes | Owner's test findings for 0.5–0.7; review fixes D-01–D-04, D-06, D-07, D-10, P-01, P-02, T-03 | Stabilise before adding more |
| 0.7.x | Refactor (no visible change) | Review S-01, S-02, X-01, T-04, T-05, X-03 | M7/M8 add many calls and screens; cheaper on a clean base |
| 0.8.0 | **M7 Excel** | .xlsx export (same options as CSV), import wizard for .xlsx/.csv: sheet, header row, column → field mapping (guessed), type per row, hierarchy from Level/Parent, links from a Links column, **update existing items by ID** with a preview of what changes, new IDs + `source-id` for foreign IDs; result = uncommitted changes to review in Compare | Owner's order (C); the main migration path from Excel |
| 0.9.0 | **M8 Branches and merge** | Order keys that never need renumbering (review S-04, data format); create/switch branches; tags as baselines; compare branches/tags; pull/merge with field-level 3-way merge and a per-requirement conflict screen; duplicate-ID repair | Owner's order (C); needs S-04 first |
| 0.10.0 | M9 Schema, coverage, views | Item types and link types in the GUI; coverage view + matrix; saved views; bulk edit | Completes "configurable like an Excel column" and traceability |
| 0.11.0 | M10 Documents | Word (.docx) and PDF export (document order, headings, fields table), Markdown preview, item templates | Stakeholder communication outside the repository |
| 1.0.0 | M11 MVP | GitHub PR stage 1 (view per requirement), Windows 10 build, hardening, docs for a team hand-over | MVP scope (FR-11 – FR-18) complete |

### Decisions needed from the owner

1. Order of M9 / M10 / M11 after M8 (above is a proposal).
2. Translation of the UI ever needed? (review S-06)
3. Several requirement sets per repository / configurable folder? (review S-07)
4. Commercial preparation timing: private update channel and code signing (review S-08, X-02).
5. Which "Should" features matter most to the teams (bulk edit, templates, impact view, quality hints…)?

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
