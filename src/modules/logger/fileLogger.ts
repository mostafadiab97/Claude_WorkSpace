import { appendFileSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { Logger, LogLevel } from './index'

const MAX_BYTES = 1_000_000

/**
 * Synchronous appends keep the log complete even if the app crashes right after writing.
 * Logging must never break the app, so every file error is swallowed.
 */
export function createFileLogger(dir: string, maxBytes = MAX_BYTES): Logger {
  const filePath = join(dir, 'reqman.log')
  const oldPath = join(dir, 'reqman.old.log')
  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    /* ignore */
  }

  const write = (level: LogLevel, message: string): void => {
    const line = `${new Date().toISOString()} ${level.padEnd(5)} ${message.replace(/\r?\n/g, '\n    ')}\n`
    try {
      const size = statSync(filePath, { throwIfNoEntry: false })?.size ?? 0
      if (size > maxBytes) {
        rmSync(oldPath, { force: true })
        renameSync(filePath, oldPath)
      }
      appendFileSync(filePath, line, 'utf8')
    } catch {
      /* never let logging crash the app */
    }
  }

  return {
    filePath,
    info: (m) => write('INFO', m),
    warn: (m) => write('WARN', m),
    error: (m, e) => {
      const detail = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : e === undefined ? '' : String(e)
      write('ERROR', detail ? `${m}: ${detail}` : m)
    }
  }
}
