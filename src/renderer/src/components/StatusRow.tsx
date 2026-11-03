import type { ReactNode } from 'react'
import { T } from '../../../shared/text'

export type Tone = 'ok' | 'warn' | 'error' | 'neutral'

export function StatusRow({ label, tone, children }: { label: string; tone: Tone; children: ReactNode }) {
  return (
    <div className="status-row">
      <span className={`status-dot status-dot--${tone}`} aria-hidden="true" />
      <span className="status-row__label">{label}</span>
      <span className="status-row__value">
        {/* UI review UX-30: the state in words too, not only by colour */}
        {tone !== 'neutral' && <span className={`status-row__state status-row__state--${tone}`}>{T.settings.env.tone[tone]}</span>}
        {children}
      </span>
    </div>
  )
}
