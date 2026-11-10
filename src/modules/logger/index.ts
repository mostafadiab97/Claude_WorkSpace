// PUBLIC ENTRY of the logger module. Other code may import only from this file.
// Responsibility: write a plain-text log file the user can open and send when reporting a bug.
// Location on Windows: %APPDATA%\<product>\logs\reqochet.log (rotated to reqochet.old.log at 1 MB).
import { createFileLogger } from './fileLogger'

export type LogLevel = 'INFO' | 'WARN' | 'ERROR'

export interface Logger {
  info(message: string): void
  warn(message: string): void
  error(message: string, error?: unknown): void
  /** Absolute path of the current log file. */
  readonly filePath: string
}

export { createFileLogger }
export { buildProblemReport, maskHome, problemReportName, REPORT_LOG_LINES } from './report'
