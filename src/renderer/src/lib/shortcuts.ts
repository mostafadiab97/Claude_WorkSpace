// When the main window's keyboard shortcuts may act (UX-25; code review CR-01 of 0.15): not while Settings or a
// dialog covers the table, and Alt+↑/↓ not while a list or text box has the focus (there Alt+↓ opens the list).

/** True when the workspace is visible and no dialog (aria-modal) is open. */
export function workspaceHasKeyboard(root: HTMLElement | null): boolean {
  if (!root || root.closest('[hidden]')) return false
  return document.querySelector('[aria-modal="true"]') === null
}

/** True when the focus is in a control that uses the arrow keys itself (lists, text boxes). */
export function focusUsesArrows(): boolean {
  const el = document.activeElement
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['SELECT', 'INPUT', 'TEXTAREA'].includes(el.tagName)
}
