// Which two versions Compare shows (pure, unit-tested — review T-02).
import type { CompareOptions, CompareResult } from '../../../shared/api'
import { T } from '../../../shared/text'

export const WORKING = 'WORKING'
export type Preset = 'lastPull' | 'uncommitted' | 'lastCommit' | 'custom'

/** The default comparison: what the last pull brought in; otherwise uncommitted changes; otherwise the last commit. */
export function defaultPreset(o: CompareOptions): Preset {
  if (o.lastPull) return 'lastPull'
  if (o.hasUncommitted && o.head) return 'uncommitted'
  if (o.commits.length >= 2) return 'lastCommit'
  return 'custom'
}

/** The two versions of a preset; null when the preset is not possible (yet). */
export function rangeOf(preset: Preset, o: CompareOptions, custom: { from: string; to: string }): { from: string; to: string } | null {
  switch (preset) {
    case 'lastPull':
      return o.lastPull ? { from: o.lastPull.from, to: o.lastPull.to } : null
    case 'uncommitted':
      return o.head ? { from: o.head, to: WORKING } : null
    case 'lastCommit':
      return o.commits[1] && o.commits[0] ? { from: o.commits[1].hash, to: o.commits[0].hash } : null
    default:
      return custom.from && custom.to ? custom : null
  }
}

/** "2.3", or "1.2 → 3.5.1" when the item moved between the two versions. */
export function numberLabel(e: { numberBefore?: string; numberAfter?: string }): string {
  if (e.numberBefore && e.numberAfter && e.numberBefore !== e.numberAfter) return `${e.numberBefore} → ${e.numberAfter}`
  return e.numberAfter ?? e.numberBefore ?? ''
}

/** "fields added: Safety; link types removed: mitigates" */
export function describeSchema(s: NonNullable<CompareResult['schema']>): string {
  const t = T.compare.schemaParts
  const parts: string[] = []
  if (s.fieldsAdded.length) parts.push(t.fieldsAdded(s.fieldsAdded.join(', ')))
  if (s.fieldsRemoved.length) parts.push(t.fieldsRemoved(s.fieldsRemoved.join(', ')))
  if (s.typesAdded.length) parts.push(t.typesAdded(s.typesAdded.join(', ')))
  if (s.typesRemoved.length) parts.push(t.typesRemoved(s.typesRemoved.join(', ')))
  if (s.linkTypesAdded.length) parts.push(t.linkTypesAdded(s.linkTypesAdded.join(', ')))
  if (s.linkTypesRemoved.length) parts.push(t.linkTypesRemoved(s.linkTypesRemoved.join(', ')))
  return parts.join('; ')
}
