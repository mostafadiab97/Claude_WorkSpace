# Whole-project review 0.21 — UI/UX reviewer (accessibility, light/dark, right-to-left)

**Scope.** Frozen commit a8244a2, screenshots from the 0.21.1 build (dated 11 Nov). I opened five: table and editor (`04`), dark with toast (`07`), Arabic (`language-1-arabic`), Changes (`10`), read-only version (`history-0.19-version`). For each earlier item I checked the code behind it (grep, `file:line`). Part A lists every UW item from the 0.20 whole-project report (UW-01…UW-20) and the older "Later" lists. Part B holds new findings. F = checked in a screenshot or the code; I = likely, not run. Not looked at again: start screen, Traceability, Versions dialog, because the pack has no new screenshot of them, and the check-links dialog.

## A. Open items from earlier reports

Owner decisions respected: UW-03 (toast position kept, closes after 9 s) and O-4 ("Changes + settings" kept with tooltip) are closed as decisions. Both are listed once so nobody re-raises them.

| ID | file:line | Status | State now (F/I) | Fix still needed |
| --- | --- | --- | --- | --- |
| UW-01 Fields "choices ar are gone" | `FieldsPanel.tsx:281`, `text.ts:660` | Fixed in code (0.21.1 changelog); one part open | F: the bug (language code read as a choice name) is fixed. The text still sends the user to "schema.yaml (optionLabels)" with no button. | Add a "Remove these names" button; `role="status"`. Low now. |
| UW-02 toolbar clipped | `styles.css:2645` | Fixed | F: `04` shows the toolbar wrapped, "+ New item" fully visible (also Arabic). A new problem from the wrap: see B-01. | — |
| UW-03 toast covers the toolbar | `07-dark.png` | Owner decision | F: still covers the Pull/Import buttons and the first characters of the editor ID ("-YXA2VXP"). Kept by the owner. The repeated message inside the Versions dialog is not covered by the decision. | Only: do not show the same sentence twice (toast and dialog), see B-09. |
| UW-04 "Changes (5) + settings" | `10-changes-view.png` | Decision (tooltip added) | F: the count problem is open. The top bar says (5), the next screen says "Uncommitted changes (8)" and "Commit 8 changes". | Name the unit: "Changes (5 items)", or use the same number everywhere. |
| UW-05 "No problems" vs "coverage gaps" | `04` status bar | Fixed | F: "No file problems" and an amber "3 coverage gaps" with a tooltip. The orange dot in the Title column is still a filled dot with a tooltip only. | Make the legend say what the dot means (Low). |
| UW-06 tab rows | `keys.ts:16`, six `role="tablist"` | Partly fixed | F: arrow keys, Home and End now work in every tab row, mirrored in Arabic. Still open: no `tabpanel`/`aria-controls` except `HistoryDialog.tsx:163`; no roving tabindex (all tabs stay in the Tab order, only History sets `tabIndex` `HistoryDialog.tsx:154`); arrow key calls `click()`, so the History tab loads on every pass. | See B-02. |
| UW-07 matrix headers | `trace-0.20-matrix.png` (not re-opened) | Still open | I: no change in `TraceabilityView.tsx` found for it. | As before: longer title on hover and focus, "no link" word in the legend. |
| UW-08 read-only version looks editable | `history-0.19-version.png`, `ItemEditor.tsx:280` | Still open | F: the form is a disabled `fieldset`, so the drop-downs still show arrows, and the Status select runs past the column edge (x≈1380). | Show plain text in read-only mode. |
| UW-09 Changes opens with the amber schema paragraph | `10-changes-view.png`, `ChangesView.tsx:336,574` | Still open | F: same screen as 0.20; amber "Schema:" block, `.gitattributes` and `.gitkeep` listed under "Other files changed", the disabled Commit button has no reason beside it. | Fold the schema text, hide `.gitkeep`/`.gitattributes`, put a reason next to Commit. |
| UW-10 text links vs buttons | `04` (New document…, Rename…, Edit, Change…, Show) | Still open | F: five blue text links of 11–12 px in the bar and the editor. | One link style for in-field actions; real buttons for New/Rename. |
| UW-11 Arabic table, ID column, English "Not saved yet." | `language-1-arabic.png` | Still open | F: the ID cell (REQ-MMWMGD4) sits under the "الوسوم" (Tags) header; the Text box shows English "Not saved yet." (test data or untranslated: unclear). | Check with the Arabic reviewer; make the ID header visible. |
| UW-12 editor footer | `04`, `ItemEditor.tsx:440` | Partly fixed | F: the arrows now have `aria-label` and a tooltip; Delete is still next to "+ Child…", "No links yet" is still cut by the footer. | Move Delete to the far end; padding below Links. |
| UW-13 Parent "Change…" + "Show" | `04` | Still open | F: two controls for one field. | One control, two buttons. |
| UW-14 Traceability document picker | `TraceabilityView.tsx:45` | Still open | F: plain text "Document: …"; owner question 1 unanswered. | Picker in the view. |
| UW-15 Settings first page | `SettingsScreen.tsx:36` | Still open | F: the first page is still `env`. | "Appearance" first, or leave and say so. |
| UW-16 old failure screenshots | `e2e/out` | Still open | F: eight `E2E *-failure.png` and `history-0.18-snapshot.png` are dated 8 Nov, three days before this run. | Delete `e2e/out` before each run. |
| UW-17 no start-screen picture | pack list | Still open | F: no `start` screenshot in the list. | Add one in light, dark, Arabic. |
| UW-18 tree toggle 20 px wide | `styles.css:865-869` | Still open | F: `width: 20px`. | `width: 24px`. |
| UW-19 matrix focus, no dark/Arabic shots | `trace-0.20-*` | Still open | I. | Add the shots; `outline-offset: -2px` in the matrix. |
| UW-20 `role="alert"` in 21 files | grep | Still open | F: 24 uses (`grep -c`: Fields 2, Traceability 2, WorkspaceScreen 2, others 1). | Errors keep `alert`; notes take `status`. |
| Older "Later": 0.17 UX17-20 (editor shows item outside filter) | | Still open (I) | Not re-tested. | |
| 0.18 UX18-12 / 0.19 UX-18/19/20 (privacy diagram: light PNG in dark, English in Arabic) | | Still open (I) | The owner's earlier answer: keep for now. | Draw it in the renderer later. |
| 0.19 UX-03, UX-04, UX-09, UX-10, UX-13, UX-26 | | Still open (I) | UX-13 = UW-13; UX-26 = UW-19. | |
| 0.20 UI-13, UI-14 | | Still open (I) | Rule sentence editing; 1–99 hint. | |
| Whole-project W22 (contrast test misses notes, placeholder, disabled), W25 (DOORS/Jama page) | | Not rechecked | | Owner: leave to the first-release polish. |

## B. New findings

| ID | file:line | Severity | What is wrong (F = checked, I = likely) | Suggested fix |
| --- | --- | --- | --- | --- |
| B-01 | `Toolbar.tsx:121-143`, `styles.css:2645`, `04`, `language-1-arabic.png` | Medium | F: when the toolbar wraps, "At the end" (insert position) stays on row 1 at the far end, while "+ New item" falls alone onto row 2 at the start (in Arabic at the opposite side). The two controls that belong together are split by a whole row, and the word "At the end" next to the Export button reads as a setting of Export. | Put both selects in one `div` with `flex-wrap: nowrap`, so they wrap together; or put "+ New item" first and the position after it. |
| B-02 | `styles.css:2658-2671`, `Toolbar.tsx:151-181` | Medium | F: the Filters pop-up opens downward over the wrapped second row (with "+ New item") and the first table rows; with the editor closed that is fine, with it open the panel (260 px) can reach the editor edge. In the code: focus does not move into the panel, Escape does not return focus to the Filters button, Tab leaves the panel without closing it, and the Escape handler is on `window`, so the same key can close an open dialog or the editor's guard at the same time. The panel has `role="group"`, not a dialog. | Close on focus leaving the box (`onBlur` with `relatedTarget`), return focus to the button on Escape, `stopPropagation` on that Escape. Add `max-inline-size: calc(100vw - 2rem)`. |
| B-03 | all six tab rows, e.g. `ItemEditor.tsx:257-265`, `TraceabilityView.tsx:37` | Medium | F: after 0.21.1 the arrow keys work, but: every tab is still a Tab stop (WAI-ARIA tabs use one stop with `tabIndex=-1` on the others), no `aria-controls`/`tabpanel` (a screen reader cannot go from the tab to its content), and the arrow key presses `click()`, so on the editor's History and Impact tabs each arrow press starts a load. | Give the tabs `tabIndex={active ? 0 : -1}`, a `tabpanel` with `aria-labelledby` for the content (as `HistoryDialog.tsx:163` does). A shared `Tabs` component is the cheapest way (one place, six users). |
| B-04 | `Toolbar.tsx:48-53` | Low | F: "⊞" and "⊟" are glyph-only buttons; the names are in `aria-label`/`title` (good), but the glyphs are not obvious, and there is no visible focus check in a screenshot. Tooltips come from `title` only, so keyboard users never see them (all toolbar tooltips are `title`). | Use text or clearer icons ("Expand all"); consider showing the `title` text on focus (CSS tooltip) for the five buttons whose label is not enough alone (Show text, Filters, Changes + settings). |
| B-05 | `07-dark.png`, `Changes + settings` tooltip | Low | F: the "+ settings" explanation is only a tooltip; a first-time user never hovers. Together with "Pull/Push/Changes/Versions/Traceability" the top bar has nine controls without grouping. | Keep the owner's decision; add a one-line note in the first-run card or the Changes screen heading ("also schema.yaml changes"). |
| B-06 | `text-ar.ts:545,1104,1094,982-984,405,77,458` | Medium | F: «نسخة» now carries five meanings: a version of the requirements (1094 "نسخة قديمة", 1104 "النسخ المحفوظة"), a duplicate of an item (982-984 "النسخة المكررة"), a clone of a project (77 "مجلد نسخة"), a saved updated file (458 "حفظ نسخة محدّثة") and the verb copy (206, 230 "نسخ"). On screen: the item's History tab calls versions plainly «النسخ» (545), which reads as "the copies"; the top bar button is «النسخ المحفوظة» ("saved copies", Versions). Line 405 still says a commit is «إصدار» ("committed as first release"), the word the 0.21.1 change reserved for app releases. | Arabic reviewer to decide the glossary: keep «نسخة» for versions only, use «مكرَّر»/«نسخة مكررة» for a duplicate item, «استنساخ» for a project clone; change 545 to «الإصدارات السابقة للعنصر» or «النسخ السابقة»; change 405 to «أُودِع كأول نسخة»; add a glossary line. |
| B-07 | `history-0.19-version.png` | Low | F: the read-only banner says "Viewing 292d44f first version": a raw hash and "first version" mean nothing to a first-time user, and the same top bar hides Pull/Push/Changes with no word on why. | Show the date and the baseline name or message; "Back to now" stays primary. |
| B-08 | `01-empty-repo.png` list, `StartScreen.tsx` | Medium | F: still no picture of what a new user sees first (recent list empty, Git missing, new folder created). Two review rounds asked (UW-17). | Add the shots to the first e2e scenario; review light, dark, Arabic once. |
| B-09 | `history-0.18-baselines.png`, toast in `07-dark.png` | Low | F: the same success sentence appears in the toast and in the dialog (0.20 UW-03); the owner's decision covers the position, not the double message. In dark the toast covers the editor's ID line for 9 s. | When the dialog shows the result, do not toast it. |
| B-10 | `07-dark.png` bottom | Low | F: the green "Exported 2 items … Show in folder / Dismiss" note stays above the status bar and does not close by itself; the text mixes a path with two links of 12 px. | Auto-close after 9 s like the toast, or keep but give the links buttons. |
| B-11 | `language-1-arabic.png` | Low | F: in the Arabic table the Type column shows "متطلب ..." cut at 6 characters and the Title cell has a lot of free room; the Type column width is not mirrored from English. | Let the Type column take the width of its longest label (min-content). |

## Questions for the owner

1. Should "At the end" and "+ New item" stay together as one group when the toolbar wraps? (B-01, recommended: yes)
2. Should the Changes count in the top bar count items (recommended) or files? (UW-04)
3. Should Traceability get its own document picker? (UW-14, still open)
4. For Arabic: one word per meaning (version / duplicate / clone / copy) as in B-06? Recommended: yes, decided with the Arabic reviewer.

## Checked, nothing found

- Toolbar wrap itself: at 1400 px with the editor open "+ New item" is fully visible in light, dark and Arabic (`04`, `07`, `language-1-arabic`).
- Tab-row direction logic: `keys.ts:6-10` reverses the arrows in right-to-left; Home and End work.
- Status bar words: "No file problems" (green) and "3 coverage gaps" (amber) have words, not colour alone.
- Dark mode: text, selection, links column ("1 out · ⚠ 1 suspect") and the toast are readable in `07-dark.png`.
- Editor footer arrows: now have `aria-label` and tooltip (`ItemEditor.tsx:440-441`).
- Dialogs: Changes screen has a close button, a reason for "0 of N decided" in the pull dialog, and a commit message hint.
- Brand mark in the top bar: same in light and dark, not mirrored in Arabic.
