# Diagrams

| Diagram | Interactive (open in a browser) | Picture (used in the docs) | Source |
| --- | --- | --- | --- |
| How the parts connect (architecture) | `architecture.html` | `../images/architecture.png` | `archify/architecture.json` |
| Saving an item — conflict-safe (sequence) | `save-flow.html` | `../images/save-flow.png` | `archify/save-flow.json` |
| Pull — stops safely before anything changes (workflow) | `pull-flow.html` | `../images/pull-flow.png` | `archify/pull-flow.json` |

Made with [Archify](https://github.com/tt-a1i/archify) (Apache-2.0; owner's choice, 28 Oct 2026). The HTML pages are
self-contained (no internet needed): zoom, light/dark, and every box links to the source lines it was drawn from.
On GitHub, download an `.html` file and open it, or look at the PNG.

**To change a diagram:** edit its JSON in `archify/` (schemas and examples are in the Archify repository), then run
`node tools/diagrams.mjs <name>` — it checks the diagram (layout, labels, the cited source lines) in a real browser
and rewrites the HTML and the PNG. Archify must be cloned next to this repository (see the script's header).

**Keep them true:** each diagram pins the commit its source lines come from (`meta.repository.revision`). When a
release changes what a diagram shows (e.g. 0.9.0 order keys, 0.10.0 Changes view), update the JSON, the cited
lines and that revision in the same release.
