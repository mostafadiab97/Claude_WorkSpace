// 0.14.1 "go back to an earlier version" (the owner, 3 Nov 2026): which published versions can be offered.
import { describe, expect, it } from 'vitest'
import { compareVersions, OLDEST_REVERT_TARGET, parseReleases, revertTargets } from '../src/modules/updater'

const release = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  published_at: '2026-11-03T08:00:00Z',
  draft: false,
  prerelease: false,
  assets: [
    { name: `ReqMan-Setup-${tag.slice(1)}.exe`, browser_download_url: `https://github.com/x/y/releases/download/${tag}/ReqMan-Setup-${tag.slice(1)}.exe` },
    { name: 'latest.yml', browser_download_url: 'https://github.com/x/y/latest.yml' }
  ],
  ...extra
})

describe('versions', () => {
  it('compares versions by number, not as text', () => {
    expect(compareVersions('0.14.10', '0.14.9')).toBeGreaterThan(0)
    expect(compareVersions('v0.15.0', '0.14.1')).toBeGreaterThan(0)
    expect(compareVersions('0.14.1', '0.14.1')).toBe(0)
    expect(compareVersions('0.9.0', '0.10.0')).toBeLessThan(0)
  })
  it('reads published releases with a Windows installer; skips drafts, pre-releases and foreign links', () => {
    const r = parseReleases([
      release('v0.15.0'),
      release('v0.14.2', { draft: true }),
      release('v0.14.3', { prerelease: true }),
      release('v0.14.4', { assets: [{ name: 'latest.yml', browser_download_url: 'https://github.com/x' }] }),
      release('v0.14.5', { assets: [{ name: 'ReqMan-Setup-0.14.5.exe', browser_download_url: 'https://evil.example/ReqMan-Setup-0.14.5.exe' }] }),
      release('v0.14.1')
    ])
    expect(r.map((x) => x.version)).toEqual(['0.15.0', '0.14.1'])
    expect(r[0]?.installerUrl).toBe('https://github.com/x/y/releases/download/v0.15.0/ReqMan-Setup-0.15.0.exe')
    expect(parseReleases({ message: 'rate limited' })).toEqual([])
  })
  it('offers only older versions that know "updates paused", newest first', () => {
    const all = parseReleases(['v0.13.1', 'v0.14.0', 'v0.14.1', 'v0.14.2', 'v0.15.0', 'v0.16.0'].map((t) => release(t)))
    expect(OLDEST_REVERT_TARGET).toBe('0.16.0') // before 0.16 the app was ReqMan, another app identity
    expect(revertTargets(all, '0.15.0', '0.14.1').map((x) => x.version)).toEqual(['0.14.2', '0.14.1'])
    expect(revertTargets(all, '0.14.1', '0.14.1')).toEqual([])
    // from 0.16 on: nothing before the rename (ReqMan) is offered
    expect(revertTargets(all, '0.16.0')).toEqual([])
    expect(revertTargets([...all, ...parseReleases([release('v0.16.1')])], '0.16.1').map((x) => x.version)).toEqual(['0.16.0'])
  })
})
