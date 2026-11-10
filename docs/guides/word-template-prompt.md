# Word documents → reqochet project and company template, with an AI model

Most teams already have their specifications in Word, often several files per module — one file for each version
(`Braking SRS v1.0.docx`, `Braking SRS v1.1.docx`, `Braking SRS v2.0.docx` …). This guide gives one prompt that lets an
AI model read **all Word documents in a folder** and produce:

1. **A ready reqochet project** — every requirement as a reqochet item file, one document per module, and the
   versions as **Git history with a baseline per version**, so reqochet's Versions, Compare and History screens show
   how each module changed from version to version.
2. **A format profile and a company template** — how the documents look (page, styles, numbering, title page,
   header/footer, how a requirement is laid out), for the Word export of theme 3b (decision P-18, 2 Nov 2026).

**Status:**
- Part 1 works with the current reqochet (0.20).
- The Word export (part 2) is planned for theme 3b and not built yet. The template placeholders below are the
  planned names, so a template made now may need small renames when theme 3b is built; the format profile stays
  useful as it is. This guide is updated then.
- Images and attachments come with theme 3a; until then images are kept only as files beside the project (see the
  prompt).

## Before you start

- **Confidential documents:** specifications usually belong to a customer or to the company. Use only an AI service
  your company allows for such documents, or remove customer names first.
- **The files:** the `.docx` files themselves, not PDFs (styles, numbering and tables are lost in a PDF). Old `.doc`
  files: open and save them as `.docx` in Word first.
- **One folder:** put all documents in one folder (sub-folders are fine), zip it, and attach the zip. Mixed kinds of
  document (requirements, test specifications, interface documents) are fine: the AI groups them by module and kind.
- **An AI that can run code is required** — for example Claude with file and code tools. It writes hundreds of files
  and a Git history; a chat-only AI cannot. It uses `python-docx` (or reads the XML inside the `.docx`) and `git`.
- **Size:** around 50 documents per run work well. For more, run it per group of modules.

## The prompt

Copy everything inside the box, attach the zip, and send it.

```text
You are converting a team's Word requirement specifications into a project for reqochet, a requirements tool that
stores every requirement as a Markdown file with a YAML header in a Git repository. You also record how the documents
look, so the tool can later export Word documents in the same style. Work with code (python-docx, or the XML inside
each .docx) and git. Never invent requirement content: everything in the output must come from the documents.

══ STEP 1 — Inventory and grouping ══
Read every .docx in the attached folder (all sub-folders). For each file record: file name, title, document number,
module/subsystem, kind of document (e.g. system requirements, software requirements, interface, test cases, risks),
version, date, author, and the revision-history table if there is one.
Group the files: one GROUP = one module + one kind of document. Files of the same group are VERSIONS of the same
document. Decide this from the title page, the document number and the file name together (file names alone are
often wrong). Order the versions of each group by version number, then by date, then by the revision history.
If two files claim the same version, or a file fits no group, do not guess: list it under "Questions" in the report
and leave it out.

══ STEP 2 — Extract the requirements, per version ══
For every file, walk the document in order and turn it into a tree of items:
- A heading becomes an item of type "information" (a heading), its title = the heading text WITHOUT its number.
  Body text between a heading and the next requirement becomes the text of that heading item.
- A requirement becomes an item. Recognise requirements by the team's own pattern (a requirement ID like "SRS-012",
  "shall" statements, a requirement table, a style such as "Requirement"). Write down the pattern you found.
- title = the short name of the requirement (its heading or the first sentence, max ~120 characters); text = its full
  wording in Markdown (paragraphs, bold/italic, bullet and numbered lists, tables as Markdown tables, hyperlinks).
- Attributes found with the requirement (status, priority, owner, verification method, release, safety level, …)
  become fields (step 4).
- The requirement's ID in the Word document (e.g. "SRS-012") is kept as the header key  former-id: "SRS-012".
- Parent = the heading (or the requirement) it sits under; outline numbers are never stored — reqochet calculates
  them from the tree.
- Images: save each image as attachments/<item ID>/<n>.<ext> in the output folder (OUTSIDE requirements/, see
  step 6) and put a line "[Image: attachments/<item ID>/<n>.<ext> — <caption>]" in the item text where it was.
- Traceability: a trace table or references such as "Derived from STK-004" / "Verified by TC-101" become links
  (step 5).
- Skip: title page, table of contents, revision history, list of figures, approvals, and empty template sections.
  "Definitions and abbreviations", "Purpose", "Scope" are kept as heading items with their text.

══ STEP 3 — Same requirement across versions ══
Within a group, the same requirement must keep the SAME reqochet ID in every version, so the tool can show its
history. Match an item to the previous version by, in this order: (1) the same Word requirement ID; (2) for headings
and requirements without an ID, the same title under the same parent; (3) very similar text (say so in the report).
An item that is not in a later version is deleted in that version. A new item gets a new ID. Never reuse an ID for a
different requirement. Across groups, items never share IDs.

══ STEP 4 — The schema (requirements/.reqochet/schema.yaml) ══
Start from the default schema below and keep it as it is. Add only what the documents need:
- an item type for a kind of item the defaults do not cover (id in lower-case-with-dashes, a name, a short name);
- a field for every attribute found in more than one requirement: type "enum" when it has a small fixed set of
  values (list them, as text, in "options"), "list" for several values, otherwise "text". Map attributes that mean
  the same as a default field (e.g. "State" → status, "Importance" → priority) onto that field and map their values
  onto its options (write the mapping in the report). Values that do not fit an enum: keep them as text in a new
  field, never drop them.
- a link type only if the documents use a relation the defaults do not have.
Default schema (version 1) — item types: stakeholder-need, system-requirement, software-requirement,
hardware-requirement, interface-requirement, use-case, design-element, test-case, defect, risk, change-request,
information (heading, not a requirement). Fields: status (enum: Draft, Review, Approved, Obsolete; default Draft),
priority (enum: High, Medium, Low), owner (text), tags (list). Link types (stored on the source item):
refines (reverse: refined by), satisfies, implements, verifies, mitigates, relates-to. Coverage rules: keep the
default set. If you have the default file (config/default-schema.yaml of reqochet), copy it; otherwise write it in
this form:
  version: 1
  itemTypes:
    - { id: system-requirement, name: System Requirement, short: SysReq }
  fields:
    - id: status
      name: Status
      type: enum
      options: [Draft, Review, Approved, Obsolete]
      default: Draft
  linkTypes:
    - { id: verifies, name: verifies, reverseName: verified by }
  rules:
    - { id: system-verified, type: system-requirement, link: verifies, direction: incoming, from: [test-case], min: 1, level: warning }
Use the item type that fits the document kind (a system requirements specification → system-requirement, a test
specification → test-case, etc.).

══ STEP 5 — Links ══
A link is written ONLY in the source item's file, direction as the link type says: a test case "verifies" a
requirement → the link is in the test case's file; a system requirement "refines" a stakeholder need → in the system
requirement's file. Resolve the Word IDs to reqochet IDs within the SAME version of the project (the newest version
of every other group at that point in time). A reference you cannot resolve: leave it out and list it in the report.
Do NOT write "confirmed:" on links (links without it are never marked suspect).

══ STEP 5b — Requirements that touch two modules ══
A requirement that belongs to two modules (it states what BOTH must do — e.g. an interface, a shared signal, a
timing that spans two subsystems — or the documents of both modules contain it) is kept in BOTH module folders:
- If it is already written in both modules' documents, keep both items as they are and only link them.
- If it is written in one module only, keep it there and add a COPY in the other module's folder: a new reqochet ID,
  the same title and text, header key  shared-from: <ID of the original>, placed under the best-fitting heading of
  that module (or at the end of its top level, in a heading "Shared requirements" if nothing fits). Do this only
  when the text clearly makes the other module responsible — when in doubt, list it under "Questions" instead.
- Link the two items to each other with ONE link of type relates-to, written in the item of the module that comes
  later in the alphabet. reqochet shows it on both items ("relates to" on one, "related to" on the other), so a
  second link back would show it twice.
- The copy follows the original through the versions (same copy ID while the original exists; deleted when the
  original is deleted) and appears from the version of the original in which the requirement first appears.
- A requirement touching three or more modules: one item per module, each linked to the original.
List every such pair (both IDs, both modules, why) in the report.

══ STEP 6 — Write the project files exactly in reqochet's format ══
Folder layout of the output repository:
  requirements/.gitattributes              exactly two lines:
                                           # Written by reqochet: identical line endings on every PC keep diffs clean.
                                           * text=auto eol=lf
  requirements/.reqochet/schema.yaml       step 4
  requirements/<Module name>/<ID>.md       one file per item; the folder is the reqochet "document" (one per group,
                                           e.g. "Braking SRS"; max 80 characters, none of \ / : * ? " < > |, not
                                           starting with a dot or ending with a dot or space)
  attachments/<ID>/…                        images (step 2), outside requirements/
  import-report.md                          step 8
  format/                                   part B (steps 9–10)
IDs: "REQ-" followed by 7 random characters from 0123456789ABCDEFGHJKMNPQRSTVWXYZ (no I, L, O, U), unique in the
whole project, e.g. REQ-K7Q3XMB. The file name is the ID + ".md".
Each item file, LF line endings, UTF-8, header keys in exactly this order (leave a key out when it has no value):
  ---
  id: REQ-K7Q3XMB
  type: system-requirement
  title: Brake pedal response time
  status: Draft                  <- then the other schema fields, in the order of schema.yaml
  priority: High
  former-id: SRS-012             <- keys that are not schema fields come next, sorted alphabetically
  parent: REQ-2B8R1CX            <- the parent item's ID (omit for top-level items)
  order: 30                      <- position among its siblings: 10, 20, 30 … (whole numbers only)
  links:
    - type: refines
      target: REQ-9QW4ZAD
  ---
  The system shall begin braking within 150 ms of pedal input.
Rules: quote every value that could be read as a number, a date or yes/no (priority: "1", version: "2.0",
former-id: "007"); every enum value must be exactly one of its options; a parent must be in the SAME module folder;
no parent loops. Use a YAML library to write the header (safe quoting), then the Markdown text after the closing ---.

══ STEP 7 — Versions as Git history ══
Create a Git repository with this layout and build its history in DATE ORDER across all groups (oldest version
first). For each version of a group, in that order:
  1. make that group's folder look exactly like that version (write changed and new item files, delete items that
     are gone; touch no other folder);
  2. commit only that change: message "Import <Module name> v<version> (<original file name>)", author and committer
     date = the version's date (GIT_AUTHOR_DATE / GIT_COMMITTER_DATE), author name = the document's author if known,
     otherwise "Import";
  3. make an annotated tag  baseline/<Module name>-v<version>  (spaces → "-"; it must pass
     git check-ref-format), message = the version's revision-history line.
The first commit also adds requirements/.gitattributes and schema.yaml. When the history is done, the working folder
holds the newest version of every group. If step 8 finds conflicts, add one last commit "Mark conflicts found by
the import" that adds the tag  import-conflict  to the "tags" field of every item in a conflict (newest version only;
the text stays unchanged). Zip the whole repository INCLUDING the .git folder as reqochet-project.zip.

══ STEP 8 — Check, then report ══
Before you finish, check with code: every file parses as YAML + text; header key order as in step 6; every ID
unique and well-formed; every parent and link target exists (parents in the same folder); no parent loops; every enum
value is allowed; every type, field and link type is in schema.yaml; each tag points to the right commit. Fix what
fails. Then write import-report.md:
- the groups (module, kind, versions with dates and file names) and the requirement pattern you recognised;
- per version: items added / changed / deleted, compared with the previous version;
- attribute → field and value mappings; new types, fields or link types you added and why;
- matches by text similarity (step 3, rule 3), unresolved references (step 5), images saved;
- shared requirements (step 5b);
- "Conflicts": requirements that contradict each other — within one module or across modules, in the newest
  versions (e.g. 150 ms in one, 200 ms in another for the same reaction; "shall" vs "shall not"; two values for the
  same limit, signal or unit; a requirement that a later one in another module makes impossible). Also requirements
  that say the same thing twice (duplicates). For each: both reqochet IDs and Word IDs, modules, the two sentences
  quoted, and why they conflict. Never resolve a conflict by changing or dropping text — report it only;
- "Questions": files left out, unclear versions, anything you were unsure about.

══ PART B — The format of the documents (for the later Word export) ══
STEP 9 — Format profile. Study the newest version of each group and write format/word-format.json with, per group
and a "common" section for what all groups share:
- page: size, orientation, margins, columns;
- styles in use: name, font, size, bold/italic, colour, spacing before/after, line spacing, indents — for body text,
  headings 1–6, requirement text, tables, captions, lists;
- heading numbering: pattern (1, 1.1, 1.1.1 …), whether it comes from Word's multilevel list;
- title page: which fields appear (document name, number, version, date, author, approver, customer,
  confidentiality note, logo) and where;
- header and footer: which fields (document name, number, version, page "x of y", classification);
- fixed sections before/after the requirements (revision history, purpose, scope, definitions, references,
  approvals) with their standard wording;
- how ONE requirement is laid out: heading with number + title? an attribute table (which attributes, in which
  order, column widths, borders, shading)? where the ID goes?
- the traceability table, if any: columns and look.
Also copy the logo and other fixed images to format/images/.

STEP 10 — Template. Build format/template-<group>.docx (or one template.docx when all groups look the same) from
the newest document of the group, keeping its styles, title page, header/footer and fixed sections, and replacing
the content with these placeholders (double curly braces, each block placeholder on a line of its own):
  {{document.name}}      name of the specification
  {{document.number}}    document number, if the team uses one
  {{baseline}}           baseline name, or "working copy"
  {{commit}}             short Git commit ID the export was made from
  {{date}}               export date
  {{author}}             name of the person exporting
  {{toc}}                table of contents
  {{revision.history}}   revision history table
  {{items}}              all items in outline order
  {{trace.table}}        traceability table (leave out if the documents have none)
Use Word STYLES for everything (never direct formatting): "Heading 1" … "Heading 6" with the numbering found,
"Normal", "RM Requirement Text", "RM Attribute Table" (table style), "RM Trace Table" (table style), "Caption".
Replace project-specific text in fixed sections with a short instruction in square brackets, e.g. "[Describe the
purpose of this specification]". Do not copy requirement text, customer data or names of people into templates.

══ ANSWER ══
Give: (1) reqochet-project.zip, (2) import-report.md, (3) the format folder zipped (word-format.json, templates,
images), and (4) a short summary: number of groups, versions, items per module in the newest version, and the
Questions list.
```

## After the AI has answered

1. **Read `import-report.md` first,** especially "Questions". Fix the documents or answer the AI and run again if a
   group or version is wrong — it is cheaper than fixing hundreds of files.
2. **Unzip `reqochet-project.zip`** into an empty folder and open that folder in reqochet. Check:
   - each module appears as a document, with headings and outline numbers as in Word;
   - the Problems panel (status bar) — it lists anything that is still wrong in the files;
   - **Versions:** one baseline per document version; **Compare** two baselines of the same module to see what
     changed between versions; an item's **History** tab shows its versions.
3. **Put it on GitHub** (or your company's Git server): create an empty repository there, then in reqochet use Push,
   or from a command line `git remote add origin <address>` and `git push -u origin --all` and `git push origin --tags`.
4. **Images:** keep the `attachments/` folder beside the project until theme 3a can show images; the item texts say
   which image belongs where.
5. **Conflicts:** in reqochet, filter the table by the tag `import-conflict` to see every item the report lists
   under "Conflicts". Decide each one with the authors, fix the text, and remove the tag.
6. **Shared requirements:** the copies carry `shared-from:` and a "relates to" link to the original. When one of
   them changes, change the other in the same commit.
7. **Format:** keep the `format/` folder. When the Word export is built (theme 3b), save the template as
   `requirements/.reqochet/templates/<name>.docx` in the project, commit and push; `word-format.json` is used to check
   that an export looks like the originals.

## Notes for whoever maintains this guide

- The item format in step 6 follows `src/modules/items/itemFile.ts` (header key order, `former-id` as an unknown
  key, order numbers read as order keys) and `docs/ARCHITECTURE.md` → "Data format". If either changes, update
  step 6.
- Numbers in `order:` are whole numbers on purpose: fractional and negative numbers collapse to the same key
  (review 2026-11-10, CRC-09). Unquoted numeric enum values block saving (CRC-07) — hence the quoting rule.
- Baselines are annotated tags `refs/tags/baseline/<name>` (`git-adapter`), so tags made by the AI appear in
  Versions.
- When theme 3b fixes the placeholder names or the template path, update step 10 and "After the AI has answered".
