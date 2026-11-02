# Making the company Word template with an AI model

Decision P-18 (2 Nov 2026): the Word export (theme 3) fills a company template that is stored in the repository as
`requirements/.reqman/templates/<name>.docx`. Most teams already have finished specifications in Word. This guide lets
an AI model study those documents and produce the template, instead of someone building it by hand.

**Status:** the Word export is planned for theme 3 and not built yet. The placeholder names below are the planned
ones. When theme 3 is built, this guide is updated to the final names. Until then, a template made with it may need
small renames.

## Before you start

- **Confidential documents:** finished specifications usually belong to a customer or to the company. Use only an AI
  service your company allows for such documents, or remove customer names first.
- **Which documents:** 3–10 finished specifications of the *same kind* (for example all software requirement
  specifications for one customer). Mixed kinds give a muddled template; make one template per kind instead.
- **What the AI needs:** the `.docx` files themselves, not PDFs. Styles, headers and numbering are lost in a PDF.
- **Best result:** an AI tool that can run code (for example Claude with file and code tools) can write the `.docx`
  directly with `python-docx`. A chat-only AI can still produce the analysis and the step list (part A and C of the
  answer); a person then applies it in Word in about 15 minutes.

## The prompt

Copy everything inside the box, attach the documents, and send it.

```text
You are helping a requirements engineering team create a Microsoft Word TEMPLATE for exported requirement
specifications. Attached are finished specification documents of the same kind, written by this team.

A program (the requirements tool) will later open the template and fill in the content. Your job is to capture the
LOOK and the FIXED PARTS of these documents, not their requirements.

Step 1 — Study all attached documents and find what they have in common:
- page size, margins, orientation; fonts and sizes for body text, headings (levels 1–4), tables, captions;
- heading numbering style (1, 1.1, 1.1.1 …) and whether numbers come from Word's multilevel list;
- title page: which fields appear (document name, document number, version, date, author, approver, customer,
  confidentiality note, logo) and where;
- header and footer: which fields (document name, number, version, page "x of y", classification);
- fixed sections that every document has before or after the requirements (revision history, purpose, scope,
  definitions and abbreviations, references, approvals) — keep their headings and any standard wording, but no
  project-specific content;
- how one requirement is shown: heading with number and title? a table of attributes (ID, status, priority, …)?
  in which order? which table style (borders, shading, column widths)?
- whether there is a traceability table and how it looks.
Where documents disagree, follow the majority and list the differences.

Step 2 — Build the template. Use Word STYLES for everything (never direct formatting), so the program can apply them:
- "Heading 1" … "Heading 4" with the numbering found in step 1;
- "Normal" for body text; "RM Requirement Text" for the text of a requirement;
- "RM Attribute Table" (a table style) for the attribute table of a requirement;
- "RM Trace Table" (a table style) for the traceability table;
- "Caption" for figure and table captions.
Put these placeholders exactly as written (double curly braces) where the program must insert content:
  {{document.name}}      name of the specification
  {{document.number}}    document number, if the team uses one
  {{baseline}}           baseline name, or "working copy"
  {{commit}}             short Git commit ID the export was made from
  {{date}}               export date
  {{author}}             name of the person exporting
  {{toc}}                table of contents (on a line of its own)
  {{revision.history}}   revision history table (on a line of its own)
  {{items}}              all requirements in outline order (on a line of its own)
  {{trace.table}}        traceability table (on a line of its own; leave it out if the documents have none)
Inside the header and footer, use the same placeholders. Keep the logo and any fixed images from the documents.
Keep fixed sections (step 1) with their standard wording; replace project-specific text with a short instruction in
square brackets, e.g. "[Describe the purpose of this specification]".

Step 3 — Answer in three parts:
A. A short report: what you found common, what differed between the documents and which version you chose.
B. The template file (template.docx), if you can create files. If you cannot, say so and skip to C.
C. Numbered steps a person can follow in Word to build or correct the template (styles to create or change, where
   each placeholder goes), so the result is the same as B.

Do not copy any requirement text, customer data or names of people into the template.
```

## After the AI has answered

1. Open `template.docx` in Word and check the title page, header/footer and heading numbering. Compare with part A of
   the answer.
2. Save it as `requirements/.reqman/templates/<name>.docx` in the project (for example `srs.docx`), commit it and
   push. The whole team then exports with the same look.
3. Export one document from ReqMan with this template (theme 3) and compare it with one of the original documents.
