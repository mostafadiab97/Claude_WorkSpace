import type { ThemeMode } from '../theme/applyTheme'

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
]

export function ThemeToggle({ mode, onChange }: { mode: ThemeMode; onChange: (m: ThemeMode) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Colour theme">
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
