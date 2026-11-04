// The owner's point on 0.16.0 (4 Nov 2026): warn when a rename leaves a translation behind.
import { describe, expect, it } from 'vitest'
import { staleTranslations } from '../../src/renderer/src/lib/schema'
import type { FieldDef } from '../../src/shared/domain'

describe('translations left behind by a rename (0.16.1)', () => {
  const field: FieldDef = { id: 'priority', name: 'Priority', type: 'enum', options: ['High', 'Low'], labels: { ar: 'الأولوية' }, optionLabels: { High: { ar: 'عالية' }, Low: { ar: 'منخفضة' } } }
  it('warns when a translated field is renamed', () => {
    expect(staleTranslations(field, 'Importance', ['High', 'Low'])).toEqual({ name: true, options: [] })
  })
  it('names the translated choices that are gone', () => {
    expect(staleTranslations(field, 'Priority', ['Highest', 'Low'])).toEqual({ name: false, options: ['High'] })
  })
  it('says nothing for an untranslated or new field', () => {
    expect(staleTranslations({ id: 'x', name: 'X', type: 'text' }, 'Y', [])).toEqual({ name: false, options: [] })
    expect(staleTranslations(undefined, 'Y', [])).toEqual({ name: false, options: [] })
  })
})
