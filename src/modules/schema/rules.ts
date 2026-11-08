// The starter coverage rules (the owner, 8 Nov 2026 — T-02): offered to every project once, written into new ones.
import type { CoverageRule, Schema } from '../../shared/domain'

const REQUIREMENTS = ['system-requirement', 'software-requirement', 'hardware-requirement', 'interface-requirement']

/** The starter set, limited to the item and link types this schema has. */
export function starterRules(schema: Schema): CoverageRule[] {
  const has = (t: string): boolean => schema.itemTypes.some((x) => x.id === t)
  const link = (l: string): boolean => schema.linkTypes.some((x) => x.id === l)
  const out: CoverageRule[] = []
  if (has('stakeholder-need') && has('system-requirement') && link('refines'))
    out.push({ id: 'need-refined', type: 'stakeholder-need', link: 'refines', direction: 'incoming', from: ['system-requirement'], min: 1, level: 'warning' })
  if (has('test-case') && link('verifies'))
    for (const r of REQUIREMENTS.filter(has)) out.push({ id: `${r.replace('-requirement', '')}-verified`, type: r, link: 'verifies', direction: 'incoming', from: ['test-case'], min: 1, level: 'warning' })
  const reqs = REQUIREMENTS.filter(has)
  if (has('risk') && link('mitigates') && reqs.length) out.push({ id: 'risk-mitigated', type: 'risk', link: 'mitigates', direction: 'incoming', from: reqs, min: 1, level: 'warning' })
  return out
}
