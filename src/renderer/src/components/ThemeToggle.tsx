import type { ThemeMode } from '../theme/applyTheme'
import { T } from '../../../shared/text'
import { Icon, type IconName } from './icons'

/**
 * The colour mode as a pill switch with icons, the way websites show it (the owner, 13 Nov 2026):
 * sun = Light, moon = Dark, flame = Ember (0.23.0), monitor = System. Each icon keeps its word as the
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
  return (
    <div className="switch" role="radiogroup" aria-label={T.app.theme.label}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={mode === o.value}
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
