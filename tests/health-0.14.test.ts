// 0.14.0 health tools (P-40, the owner 2 Nov 2026): feature switches (personal + team), team switches in schema.yaml,
// and the "Report a problem" file.
import { describe, expect, it } from 'vitest'
import { FEATURE_IDS, featureOn, isFeatureId } from '../src/shared/features'
import { parseSchema } from '../src/modules/schema'
import { buildProblemReport, problemReportName, REPORT_LOG_LINES } from '../src/modules/logger'

const base = 'version: 1\nitemTypes:\n  - id: system-requirement\n    name: System Requirement\n'

describe('feature switches (P-40a)', () => {
  it('a feature is on unless this PC or the team turned it off', () => {
    expect(featureOn('export', {}, undefined)).toBe(true)
    expect(featureOn('export', { export: false }, undefined)).toBe(false)
    expect(featureOn('export', {}, { export: false })).toBe(false)
    expect(featureOn('export', { export: true }, { export: false })).toBe(false) // the team's "off" wins
    expect(featureOn('export', {}, { export: true, branches: false })).toBe(true)
  })
  it('knows its features', () => {
    expect(FEATURE_IDS).toEqual(['branches', 'import', 'export'])
    expect(isFeatureId('branches')).toBe(true)
    expect(isFeatureId('teleport')).toBe(false)
  })
})

describe('team switches in schema.yaml', () => {
  it('reads true/false and on/off, keeps unknown names, reports bad values', () => {
    const r = parseSchema(`${base}features:\n  branches: false\n  export: on\n  future-thing: off\n  import: maybe\n`)
    expect(r.schema.features).toEqual({ branches: false, export: true, 'future-thing': false })
    expect(r.problems).toEqual([{ path: 'features.import', message: 'Must be true or false.' }])
  })
  it('no features section: nothing set, no problem', () => {
    const r = parseSchema(base)
    expect(r.schema.features).toBeUndefined()
    expect(r.problems).toEqual([])
  })
  it('a features section that is not a mapping is a problem', () => {
    expect(parseSchema(`${base}features: [branches]\n`).problems[0]?.path).toBe('features')
  })
})

describe('problem report (P-40d)', () => {
  const now = new Date(2026, 10, 2, 21, 5)
  it('holds the description, the diagnostics and the newest log lines', () => {
    const log = Array.from({ length: REPORT_LOG_LINES + 50 }, (_, i) => `line ${i}`).join('\n')
    const r = buildProblemReport({ description: '  Push failed after a pull.  ', diagnostics: 'ReqMan 0.14.0\nGit: 2.47', log, now })
    expect(r).toContain('== What happened ==\r\nPush failed after a pull.\r\n')
    expect(r).toContain('ReqMan 0.14.0\nGit: 2.47')
    expect(r).toContain(`== Log (last ${REPORT_LOG_LINES} lines) ==`)
    expect(r).toContain(`line ${REPORT_LOG_LINES + 49}`)
    expect(r).not.toContain('line 49\r\n')
    expect(r.startsWith('ReqMan problem report\r\nCreated: ')).toBe(true)
  })
  it('takes the older log first when the current one is short, and says when there is no description', () => {
    const r = buildProblemReport({ description: ' ', diagnostics: 'd', log: 'new 1\nnew 2', olderLog: 'old 1\n', now })
    expect(r).toContain('(no description)')
    expect(r.indexOf('old 1')).toBeLessThan(r.indexOf('new 1'))
    expect(r).toContain('== Log (last 3 lines) ==')
  })
  it('names the file with date and time', () => {
    expect(problemReportName(now)).toBe('ReqMan-problem-2026-11-02-2105.txt')
  })
})
