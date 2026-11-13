import type { ThemeMode } from '../theme/applyTheme'
import { T } from '../../../shared/text'
import type { KeyboardEvent } from 'react'
import { arrowDirection } from '../lib/keys'
import { Icon, type IconName } from './icons'

/**
 * The colour mode as a pill switch with icons, the way websites show it (the owner, 13 Nov 2026):
 * sun = Light, moon = Dark, flame = Ember (0.22.0), monitor = System. Each icon keeps its word as the
 * accessible name and the tooltip.
 */
export function ThemeToggle({ mode, onChange }: { mode: ThemeMode; onChange: (m: ThemeMode) => void }) {
  // built at render time, so the labels follow the language
  const OPTIONS: { value: ThemeMode; label: string; icon: IconName }[] = [
    { value: 'light', label: T.app.theme.light, icon: 'sun' },
    { value: 'dark', label: T.app.theme.dark, icon: 'moon' },
    { value: 'ember', label: T.app.theme.ember, icon: 'flame' },
    { value: 'system', label: T.app.theme.system, icon: 'monitor' }
  ]
  // one Tab stop; the arrows (in the reading direction), Home and End move the choice (UI review UX-23-01)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const at = OPTIONS.findIndex((o) => o.value === mode)
    const dir = arrowDirection(e.key)
    const to = dir === 'forward' ? (at + 1) % OPTIONS.length : dir === 'back' ? (at - 1 + OPTIONS.length) % OPTIONS.length : e.key === 'Home' ? 0 : e.key === 'End' ? OPTIONS.length - 1 : -1
    if (to < 0) return
    e.preventDefault()
    const next = OPTIONS[to]
    if (!next) return
    onChange(next.value)
    e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[to]?.focus()
  }
  return (
    <div className="switch" role="radiogroup" aria-label={T.app.theme.label} onKeyDown={onKeyDown}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={mode === o.value}
          tabIndex={mode === o.value ? 0 : -1}
          aria-label={o.label}
          title={o.label}
          className={mode === o.value ? 'switch__item switch__item--active' : 'switch__item'}
          onClick={() => onChange(o.value)}
        >
          <Icon name={o.icon} />
        </button>
      ))}
    </div>
  )
}
