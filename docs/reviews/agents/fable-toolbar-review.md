# The bar above the table — review of the owner's ideas and a proposed layout

Review only; no app code was changed. Asked by the owner on 13 Nov 2026: "too many buttons above the table".
Looked at: `e2e/out/` screenshots (structure-0.17-documents, ember-1-workspace, ember-3-workspace-arabic),
`workspace/screen/DocumentBar.tsx`, `workspace/screen/Toolbar.tsx`, `screens/WorkspaceScreen.tsx`, `styles.css`.

Mock-ups (drawn with the colours of `config/theme.json`, Light and Ember; not screenshots of the app):

- `fable-toolbar/toolbar-1280.png` — current and proposed at 1280 px, the owner's layout taken literally, and what
  opens from each button.
- `fable-toolbar/toolbar-900.png` — current and proposed at 900 px, and at 900 px with the item editor open.
- Drawn again with `node docs/reviews/agents/fable-toolbar/render.mjs` (needs Playwright's Chromium).

## Short answer

The owner is right: today there are **15 controls** above the table (6 for the document, 9 for the items), in two
rows at 1280 px and four rows at 900 px with the editor open. The proposal has **7 controls in one row** at every
width tested, and nothing is removed — the rarely used actions move one click away into menus.

```
[ Specification  42 items ▾ ] | [ Search…            ] [⇕] [filter ②] [view] [⋯]            [ + New item ]
  document button                search                 outline  filters  view  more          primary action
```

## Facts found in the code

- Document strip: label, picker (a native list), New document…, Rename…, Delete…, Merge into… (only with two or more
  documents). Rename and New already open an inline text box; Delete and Merge ask inline.
- Item toolbar: search, Expand all, Collapse all, Filters (pop-up, shows a count), Columns (pop-up, also leads to
  Fields and Types), Show text (toggle), Import…, Export…, the place list ("Below the selected item"), New item (a
  list of types).
- The tree remembers "everything open" or "everything closed" plus a list of exceptions (`rows.ts`), so the app can
  tell cheaply whether the tree is fully open, fully closed or mixed.
- Choosing a type in "New item" makes a draft and opens it in the editor on the right — the editor already is the
  "creation panel" for title, text and the other fields.
- Keys today: Ctrl+F search, Ctrl+N New item, Ctrl+Shift+C Changes, Ctrl+S save, Alt+↑/↓ move the item.
- Every control is its own Tab stop: 15 presses of Tab to get from the top bar to the table.

## The owner's ideas, one by one

### 1. Merge Expand all and Collapse all into one button — **agree, adjusted**

True at the two ends: a fully open tree cannot be expanded, a fully closed one cannot be collapsed. But the usual
state is **mixed** (some branches open), and there both actions make sense. A single button that flips would have to
guess, and both guesses have a cost:

- "mixed → collapse": the user who opened one branch and wants everything sees his branch close first; two clicks.
- "mixed → expand": to tidy up a half-open tree of 10,000 items the app first opens all of them (slow), then closes.

Recommendation: **one "outline" button that opens a two-line menu** — Expand all, Collapse all — with the line that
can do nothing greyed out (this is the owner's observation, kept). One control instead of two, always honest about
what will happen, and there is room later for "show down to level 1 · 2 · 3", which outline tools usually offer.
The cost is one extra click; the keys below make it one stroke for regular users.
Acceptable second choice if the owner wants a plain toggle: flip, with the rule "fully open → collapse, otherwise
expand", and the tooltip and the screen-reader name always say which of the two the next press does.
For screen readers the button says "Expand or collapse all, menu"; a flipping button must not use "pressed" (it is
not an on/off state).

### 2. Group the document controls — **agree**; the exact layout — **adjust**

Agree fully that New / Rename / Delete / Merge belong to the document and should not sit as four separate links.
On the proposed layout (name editable on click · count · arrow · plus · bin), point by point:

| Idea | Verdict | Why |
| --- | --- | --- |
| Remove the "Document" label | Agree | The name with an arrow explains itself; the word stays as the tooltip and the screen-reader name ("Document: Specification, 42 items"). |
| Item count as a quiet label | Agree | Inside the button, in muted text. At narrow widths it shortens to the number. |
| Arrow opens the documents menu | Agree, wider | Make the **whole** name + count + arrow one button. The most frequent action (switch document) gets the biggest target; a small arrow alone is hard to hit. |
| Name becomes editable when clicked | Adjust | (a) Click on the name is what people use to switch; with click = rename, switching moves to the small arrow. (b) A name that looks like text does not show it can be edited — rename becomes hard to find, or happens by accident. (c) "All documents" and "Items without a document" cannot be renamed, so the same spot would sometimes edit and sometimes not. (d) A rename is a Git commit that moves a folder, heavier than fixing a label. Keep the in-place text box (it exists), but start it from **Rename…** in the menu, from **F2**, or by **double-click** on the name. |
| Ask for confirmation if the name changed | Adjust | In the text box, **Enter (or ✓) is the confirmation**, Esc or clicking away cancels and nothing changes. A second question after Enter would be asked every time and teaches people to click through it. A line under the box says what happens: "Renames the folder — one commit". |
| "+" icon for a new document | Adjust | It would be the second plus in the same row, next to the plus of "New item"; the picture cannot say which is which. Put "New document…" as the first action in the document menu (creating is part of choosing). |
| Bin icon to delete the document | Disagree as an always-visible icon | Deleting a document removes all its items; it is rare and it is the most destructive action on the screen. A bin 30 px from the document switcher invites a mis-click (the question afterwards protects, but it is still an interruption). In the menu, in red, with the bin icon, last. The inline question "Delete Specification and its 42 items?" stays. |
| Merge into… (not mentioned) | Into the menu | It appears only with two or more documents, so as a link it makes the bar jump. In the menu it opens the existing "choose target → Merge" strip under the bar. |

Result: one document button. Its menu lists the documents (with counts, a tick on the current one), then a line,
then New document…, Rename "X"…, Merge "X" into…, Delete "X"…. The top bar's branch button already works this way
(a list plus actions), so the pattern is one the user knows. The literal layout is drawn as "Variant" in the 1280
picture for comparison; if the owner prefers visible icons after seeing both, the least risky version is: document
button, then a pencil — and the plus and the bin still in the menu.

Notes for building it: the native list gives arrow keys, typing the first letters and screen-reader support for
free; a self-made menu must do the same (↑ ↓ Home End, type-ahead, Esc gives the focus back to the button,
`aria-haspopup`, `aria-expanded`, the current document announced as selected). `RowMenu` / the branch menu are the
models. The actions are not offered for "All documents"; in an old version (read-only) the menu only lists.
The one-time notices ("give the items folder a name", loose files) stay as a strip under the bar.

### 3. One "New item" button with the place inside the panel — **agree, two adjustments**

Agree: the place list ("Below the selected item") is the widest control in the bar, is disabled half of the time and
is read before the button it belongs to. Moving it into the panel that opens from the button is right.

- **Keep the words "New item" while there is room**; shrink to the plus alone only when the bar gets narrow (under
  about 700 px for the table part). It is the main action of the screen; a lone plus is easy to find only when it is
  the only one, and new users read words faster than icons. The filled colour stays.
- **Keep the panel small: type and place only**, then the draft opens in the editor on the right as today. The editor
  already holds title, text and every other field; a second form with the same fields would have to be kept equal to
  it for ever (fields are configurable per project). So: plus → small panel → Create → the editor with the cursor in
  the title.

The panel: types as a list (the last used one already chosen), the place as three choices that name the selected row
("Below 'Lock on speed above…'", "Inside it", "At the end of the document"; the first two greyed out when no row is
selected, as today), Create and Cancel. Same number of clicks as today for the usual case (open, Create); with keys:
Ctrl+N, Enter. The place choice is remembered as today.

### 4. The rest of the buttons

| Today | Proposed | Why |
| --- | --- | --- |
| Search box, 260 px fixed | Stays, grows with the window, magnifier icon inside, shorter hint ("Search…"; the long text moves to the tooltip) | The most used control; it should take the room the others give back. |
| Filters (icon + word) | Icon only, with the count bubble and tooltip "Filters (Ctrl+Shift+F)" | The funnel-lines icon is well known; the bubble already tells that filters are on. "Clear filters" still appears next to it while a filter is on. |
| Columns ▾ and Show text | One **View** icon button: "Rows: title and text / one line per item" on top, the column ticks below, Fields… and Types… at the end | Both answer "how does the table look"; Show text is changed rarely and is a setting, not an action. |
| Import… and Export… | Into a **More (⋯)** menu | Used a few times per project, not per session. Words stay readable in the menu, which matters more than an icon nobody can tell apart (arrow up or arrow down?). |
| Expand all, Collapse all | One outline button (see 1) | |
| Place list + New item | One button (see 3) | |

What should **not** become an icon: New item (while there is room), the document name, and anything destructive
without its word next to it.

## Recommended layout

One row; the document button first because it sets the scope for everything to its right; New item last, at the far
end (the right in English, the left in Arabic).

| # | Control | Shows | Opens / does | Key |
| --- | --- | --- | --- | --- |
| 1 | Document button | name, item count, arrow | documents list + New, Rename, Merge, Delete | F2 renames when the button has the focus; Ctrl+Shift+N new document |
| 2 | Search | box with magnifier | filters the table while typing | Ctrl+F (exists) |
| 3 | Outline | icon | Expand all / Collapse all | Ctrl+Shift+↓ / Ctrl+Shift+↑ when the table has the focus |
| 4 | Filters | icon + count | the filter pop-up (unchanged) | Ctrl+Shift+F |
| 5 | View | icon | rows (with text / one line), columns, Fields…, Types… | — |
| 6 | More | ⋯ | Import…, Export… | — |
| 7 | New item | plus + words (plus alone when narrow) | type + place panel, then the editor | Ctrl+N (exists), Enter creates |

The proposed keys are free in the code today, but must be checked on the owner's PC for clashes with Windows and with
the Arabic keyboard before they are fixed; the up/down arrows were chosen because they mean the same in a
right-to-left window (left/right arrows would have to swap).

**Keyboard.** Make the bar one Tab stop (a "toolbar": Tab enters it, ← → move between the buttons, Tab leaves to the
table; in Arabic ← → swap by themselves when the code uses "next / previous"). From 15 presses of Tab to reach the
table to 1. Every menu: ↑ ↓, Enter, Esc returns to its button.

**Tooltips.** Icon-only buttons depend on them. Today's tooltips are the browser's (`title`): slow, never shown for
keyboard users, not shown on touch. With four icon buttons in the main bar this is the moment for a small own
tooltip that appears on hover **and on keyboard focus** and shows the name plus the key ("Filters · Ctrl+Shift+F").
Each icon button also gets the same words as its screen-reader name; the filter count is spoken ("Filters, 2 on").

**Arabic (right-to-left).** Nothing in the proposal has a direction: the icons are symmetric or vertical (plus, ⋯,
funnel, columns, up/down arrows, the menu arrow points down), the order mirrors by itself with the logical CSS the
app already uses, menus open from the "start" edge of their button. Arabic words are often wider than English ones
(the current Arabic toolbar takes two full rows at 1400 px), so fewer words in the bar helps Arabic most. The count
bubble sits at the "end" corner. Latin document names inside an Arabic window need `dir="auto"` on the name.

**Small windows.** Order in which the bar gives way, so it stays one row: (1) the search box narrows to about
90 px; (2) "42 items" becomes "42"; (3) "New item" becomes the plus; (4) only below about 430 px for the table part
does it wrap, document button on the first row. The 900 px picture shows the hardest real case — editor open, 520 px
left for the table: four rows today, one row proposed, 100 px more of the table visible.

**Mixed and special states.** Outline menu lines grey out at the two ends and while a filter is on (the tree is
flat then; today the two buttons disappear, which makes the bar jump — greying is calmer). While "Expand all" is
loading, the outline button shows the busy state as today. Read-only (an old version is shown): New item, Import and
the document actions are hidden as today; the bar keeps its shape.

## What it costs and what to watch

- New texts in `text.ts` and `text-ar.ts` (menu lines, tooltips, panel headings); several old ones go.
- e2e tests that find controls by their words or by `#document-picker` (a native list today) must be changed with
  it — see the "e2e label matching" pitfall; the user guide pictures and the website shots show the old bar.
- Three small pop-ups are new (document menu, outline menu, New item panel) and one is merged (View). They should
  share one menu component with the row menu rather than be four hand-made ones.
- Risk: things used rarely are one click further away (Import, Export, Show text, Rename, Delete). That is the
  purpose, but if the owner uses one of them daily, it can stay outside — say which.
- Suggested order if done in steps: (1) Import/Export into More, Show text into View, Filters and Columns as icons —
  small and safe; (2) New item panel; (3) document button with its menu; (4) outline button, one Tab stop, own
  tooltips.

## Questions for the owner

1. Document actions: in the document button's menu (recommended), or visible icons as in the "Variant" drawing?
2. Expand/Collapse: one button with a two-line menu (recommended), or one flipping button?
3. New item: small panel with type + place, then the editor (recommended), or a larger panel that also asks for
   title and fields?
4. Is any of Import, Export, Show text used often enough to stay outside the menus?
