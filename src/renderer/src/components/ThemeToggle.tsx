import type { ThemeMode } from '../theme/applyTheme'
import { T } from '../../../shared/text'

export function ThemeToggle({ mode, onChange }: { mode: ThemeMode; onChange: (m: ThemeMode) => void }) {
  // built at render time, so the labels follow the language
  const OPTIONS: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: T.app.theme.light },
    { value: 'dark', label: T.app.theme.dark },
    { value: 'system', label: T.app.theme.system }
  ]
  return (
    <div className="segmented" role="radiogroup" aria-label={T.app.theme.label}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={mode === o.value}
          className={mode === o.value ? 'segmented__item segmented__item--active' : 'segmented__item'}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
