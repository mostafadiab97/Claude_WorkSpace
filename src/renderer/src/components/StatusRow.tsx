import type { ReactNode } from 'react'

export type Tone = 'ok' | 'warn' | 'error' | 'neutral'

export function StatusRow({ label, tone, children }: { label: string; tone: Tone; children: ReactNode }) {
  return (
    <div className="status-row">
      <span className={`status-dot status-dot--${tone}`} aria-hidden="true" />
      <span className="status-row__label">{label}</span>
      <span className="status-row__value">{children}</span>
    </div>
  )
}
