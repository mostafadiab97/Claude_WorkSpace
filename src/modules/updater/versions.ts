// "Go back to an earlier version" (the owner, 3 Nov 2026): which published versions a user may install instead of the
// current one. Pure functions, unit-tested in tests/versions-0.14.1.test.ts.

/**
 * The oldest version one can go back to. Older versions do not know "updates paused", so they would update
 * themselves straight back to the newest one. Raise this at the rename (an older name installs as another app).
 */
export const OLDEST_REVERT_TARGET = '0.14.1'

export interface ReleaseInfo {
  version: string
  date: string
  /** Download address of the Windows installer. */
  installerUrl: string
}

/** Compares "1.2.3" versions: negative when a < b. Pre-release suffixes are ignored. */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0)
  const pb = b.replace(/^v/, '').split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}

/** Reads the GitHub "list releases" answer: published (not draft, not pre-release) versions with an installer. */
export function parseReleases(json: unknown): ReleaseInfo[] {
  if (!Array.isArray(json)) return []
  const out: ReleaseInfo[] = []
  for (const r of json as Array<Record<string, unknown>>) {
    if (r.draft === true || r.prerelease === true || typeof r.tag_name !== 'string') continue
    const assets = Array.isArray(r.assets) ? (r.assets as Array<Record<string, unknown>>) : []
    const exe = assets.find((a) => typeof a.name === 'string' && /^[\w.-]+-Setup-[\d.]+\.exe$/.test(a.name))
    if (!exe || typeof exe.browser_download_url !== 'string' || !exe.browser_download_url.startsWith('https://github.com/')) continue
    out.push({ version: r.tag_name.replace(/^v/, ''), date: typeof r.published_at === 'string' ? r.published_at : '', installerUrl: exe.browser_download_url })
  }
  return out
}

/** Versions older than `current` and not older than OLDEST_REVERT_TARGET, newest first. */
export function revertTargets(releases: ReleaseInfo[], current: string, oldest = OLDEST_REVERT_TARGET): ReleaseInfo[] {
  return releases
    .filter((r) => compareVersions(r.version, current) < 0 && compareVersions(r.version, oldest) >= 0)
    .sort((a, b) => compareVersions(b.version, a.version))
}
