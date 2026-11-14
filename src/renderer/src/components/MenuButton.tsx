import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Icon, type IconName } from './icons'

/** One line of a menu. */
export type MenuEntry =
  | { kind: 'item'; label: string; onSelect: () => void; disabled?: boolean; danger?: boolean; icon?: IconName; checked?: boolean; hint?: string }
  | { kind: 'sep' }
  | { kind: 'label'; label: string }

/**
 * A button that opens a small menu under it (0.23.0, the owner's bar above the table and Fable's review): the
 * document menu, the outline menu, "More". Keyboard as menus are used everywhere: ↑ ↓ Home End move, the first letters
 * jump, Enter or Space chooses, Esc closes and gives the focus back to the button, Tab closes. A click elsewhere closes.
 */
export function MenuButton(props: {
  /** The accessible name of the button (and its tooltip when it shows only an icon). */
  label: string
  /** What the button shows; an icon alone when omitted. */
  children?: ReactNode
  icon?: IconName
  className?: string
  title?: string
  entries: () => MenuEntry[]
  menuLabel?: string
  disabled?: boolean
  buttonRef?: RefObject<HTMLButtonElement | null>
  /** The button's own keys while the menu is closed (e.g. F2 to rename the document). */
  onButtonKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const ownRef = useRef<HTMLButtonElement>(null)
  const btn = props.buttonRef ?? ownRef
  const entries = open ? props.entries() : []

  useEffect(() => {
    if (!open) return
    box.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)')?.focus()
    const onDown = (e: MouseEvent): void => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const close = (focusButton: boolean): void => {
    setOpen(false)
    if (focusButton) btn.current?.focus()
  }
  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    const items = [...(box.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)') ?? [])]
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    const go = (i: number): void => {
      e.preventDefault()
      items[(i + items.length) % items.length]?.focus()
    }
    if (e.key === 'ArrowDown') go(at + 1)
    else if (e.key === 'ArrowUp') go(at - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(items.length - 1)
    else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close(true)
    } else if (e.key === 'Tab') setOpen(false)
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      // type-ahead: the next item starting with the letter
      const k = e.key.toLocaleLowerCase()
      const order = [...items.slice(at + 1), ...items.slice(0, at + 1)]
      const hit = order.find((b) => (b.textContent ?? '').trim().toLocaleLowerCase().startsWith(k))
      if (hit) {
        e.preventDefault()
        hit.focus()
      }
    }
  }
  const choose = (fn: () => void) => (): void => {
    close(true)
    fn()
  }

  return (
    <div className="menu-btn" ref={box}>
      <button
        ref={btn}
        type="button"
        className={`${props.className ?? 'icon-btn'}${open ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={props.label}
        title={props.title ?? props.label}
        disabled={props.disabled}
        data-toolbar-item=""
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          // Enter and Space click the button by themselves; ↓ opens the menu too
          if (!open && e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            return
          }
          props.onButtonKeyDown?.(e)
        }}
      >
        {props.icon && <Icon name={props.icon} />}
        {props.children}
      </button>
      {open && (
        <div className="menu-btn__panel" role="menu" aria-label={props.menuLabel ?? props.label} onKeyDown={onMenuKey}>
          {entries.map((m, i) =>
            m.kind === 'sep' ? (
              <div key={i} className="menu-btn__sep" role="separator" />
            ) : m.kind === 'label' ? (
              <div key={i} className="menu-btn__label" role="presentation">
                {m.label}
              </div>
            ) : (
              <button
                key={i}
                type="button"
                role={m.checked === undefined ? 'menuitem' : 'menuitemradio'}
                aria-checked={m.checked}
                className={`menu-btn__item${m.danger ? ' menu-btn__item--danger' : ''}${m.checked ? ' is-checked' : ''}`}
                disabled={m.disabled}
                title={m.hint}
                onClick={choose(m.onSelect)}
              >
                <span className="menu-btn__mark" aria-hidden="true">
                  {m.checked ? <Icon name="check" /> : m.icon ? <Icon name={m.icon} /> : null}
                </span>
                <span className="menu-btn__text">{m.label}</span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
