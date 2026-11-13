import type { Language } from '../../../shared/text'
import { LANGUAGES, T } from '../../../shared/text'

/**
 * The window's language as a small drop-down (0.22.0, the owner, 13 Nov 2026: five languages, so no longer a switch).
 * Each language is written in its own language, so anyone can find theirs.
 */
export function LanguageToggle({ lang, onChange }: { lang: Language; onChange: (l: Language) => void }) {
  return (
    <select className="input lang-picker" aria-label={T.app.language.label} title={T.app.language.label} value={lang} onChange={(e) => onChange(e.target.value as Language)}>
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code} lang={l.code}>
          {l.name}
        </option>
      ))}
    </select>
  )
}
