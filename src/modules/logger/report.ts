// The "Report a problem" file (P-40d, the owner 2 Nov 2026): the user's description, the diagnostics and the end of
// the log in one plain-text file the user saves and sends. Nothing is sent by the app itself.

/**
 * Removes the sign-in part of addresses ("https://name:token@host" → "https://***@host") so a password or token in a
 * Git remote never reaches the log or a problem report (SEC-02).
 */
export const maskSecrets = (text: string): string => text.replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, '$1***@')

/**
 * Replaces the user's home folder with %USERPROFILE% — every path in the log carries the Windows user name, which is
 * personal data in a file meant for someone else (W-33, the owner's decision O-7, 10 Nov 2026).
 */
export function maskHome(text: string, home?: string): string {
  let out = text
  if (home && home.length > 3) {
    // the same folder written with \ or /, any letter case (Windows paths are not case-sensitive)
    const pattern = home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\\|\//g, '[\\\\/]')
    out = out.replace(new RegExp(pattern, 'gi'), '%USERPROFILE%')
  }
  // any other C:\Users\<name> (another profile, a path written differently)
  return out.replace(/\b([A-Za-z]:[\\/]+Users[\\/]+)(?!%USERPROFILE%)[^\\/\s"'<>|]+/gi, '%USERPROFILE%')
}

/** How many log lines go into a report (the newest ones). */
export const REPORT_LOG_LINES = 400

export function buildProblemReport(input: { description: string; diagnostics: string; log: string; olderLog?: string; now?: Date; home?: string }): string {
  const clean = (t: string): string => maskHome(maskSecrets(t), input.home)
  const lines = [...(input.olderLog ?? '').split(/\r?\n/), ...input.log.split(/\r?\n/)].filter((l) => l !== '')
  const tail = lines.slice(-REPORT_LOG_LINES)
  const when = (input.now ?? new Date()).toISOString()
  return [
    'reqochet problem report',
    `Created: ${when}`,
    '',
    '== What happened ==',
    input.description.trim() || '(no description)',
    '',
    '== Diagnostics ==',
    clean(input.diagnostics.trim()),
    '',
    `== Log (last ${tail.length} lines) ==`,
    ...tail.map(clean),
    ''
  ].join('\r\n')
}

/** A file name like "reqochet-problem-2026-11-02-2130.txt". */
export function problemReportName(now = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `reqochet-problem-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.txt`
}
