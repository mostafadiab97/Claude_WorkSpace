// The "Report a problem" file (P-40d, the owner 2 Nov 2026): the user's description, the diagnostics and the end of
// the log in one plain-text file the user saves and sends. Nothing is sent by the app itself.

/** How many log lines go into a report (the newest ones). */
export const REPORT_LOG_LINES = 400

export function buildProblemReport(input: { description: string; diagnostics: string; log: string; olderLog?: string; now?: Date }): string {
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
    input.diagnostics.trim(),
    '',
    `== Log (last ${tail.length} lines) ==`,
    ...tail,
    ''
  ].join('\r\n')
}

/** A file name like "reqochet-problem-2026-11-02-2130.txt". */
export function problemReportName(now = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `reqochet-problem-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.txt`
}
