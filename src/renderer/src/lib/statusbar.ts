// Small helpers for the status bar (UI review UX-36).

/** Shortens a long path in the middle, so both the drive and the folder name stay visible. Pure. */
export function middleEllipsis(text: string, max: number): string {
  if (text.length <= max) return text
  const keep = max - 1
  const head = Math.ceil(keep * 0.4)
  return `${text.slice(0, head)}…${text.slice(text.length - (keep - head))}`
}

const SESSIONS_KEY = 'reqman.sessions'
let sessions: number | null = null

/** How many times the window has been opened on this PC (counted once per start; 1 = the first time). */
export function sessionNumber(): number {
  if (sessions !== null) return sessions
  let n = 1
  try {
    n = Number(localStorage.getItem(SESSIONS_KEY) ?? '0') + 1
    localStorage.setItem(SESSIONS_KEY, String(n))
  } catch {
    // no storage: treat every start as a new user
  }
  sessions = Number.isFinite(n) && n > 0 ? n : 1
  return sessions
}

/** The drag tip is for newcomers: the first three starts only. */
export const showDragTip = (): boolean => sessionNumber() <= 3
