import type { Language } from '../../../shared/text'
import { T } from '../../../shared/text'

/** English / العربية, next to the light/dark switch. Each option is written in its own language. */
export function LanguageToggle({ lang, onChange }: { lang: Language; onChange: (l: Language) => void }) {
  const options: { value: Language; label: string }[] = [
    { value: 'en', label: T.app.language.en },
    { value: 'ar', label: T.app.language.ar }
  ]
  return (
    <div className="segmented" role="radiogroup" aria-label={T.app.language.label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          lang={o.value}
          aria-checked={lang === o.value}
          className={lang === o.value ? 'segmented__item segmented__item--active' : 'segmented__item'}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
