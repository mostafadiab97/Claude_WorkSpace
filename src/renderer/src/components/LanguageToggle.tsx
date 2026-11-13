import type { Language } from '../../../shared/text'
import { T } from '../../../shared/text'

/**
 * En / ع, next to the colour switch (the owner, 13 Nov 2026: short, as other tools show it). Each option is
 * written in its own language; the full name is its accessible name and tooltip.
 */
export function LanguageToggle({ lang, onChange }: { lang: Language; onChange: (l: Language) => void }) {
  const options: { value: Language; label: string; short: string }[] = [
    { value: 'en', label: T.app.language.en, short: T.app.language.enShort },
    { value: 'ar', label: T.app.language.ar, short: T.app.language.arShort }
  ]
  return (
    <div className="switch" role="radiogroup" aria-label={T.app.language.label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          lang={o.value}
          aria-checked={lang === o.value}
          aria-label={o.label}
          title={o.label}
          className={lang === o.value ? 'switch__item switch__item--active switch__item--text' : 'switch__item switch__item--text'}
          onClick={() => onChange(o.value)}
        >
          {o.short}
        </button>
      ))}
    </div>
  )
}
