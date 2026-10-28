// PUBLIC ENTRY of the safe-files module. Other code may import only from this file.
// Responsibility: writing, renaming and deleting files so that a crash never leaves a half-written file
// (write to a temporary file, then rename it over the target) and so that the short locks Windows often
// puts on files (antivirus scanners, the search indexer, OneDrive, an editor) do not make an operation fail.
import { randomBytes } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/** Error codes Windows returns while another program briefly holds a file. */
const TRANSIENT = new Set(['EPERM', 'EBUSY', 'EACCES', 'EAGAIN', 'ENOTEMPTY'])
/** Waits between attempts (ms): about 1.5 s in total before giving up. */
const BACKOFF = [10, 20, 40, 80, 150, 250, 400, 600]

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export const isTransient = (e: unknown): boolean => TRANSIENT.has(String((e as NodeJS.ErrnoException)?.code))

/** Runs `fn`, retrying with a short back-off while the error looks like a temporary Windows lock. */
export async function withRetry<T>(fn: () => Promise<T>, waits: readonly number[] = BACKOFF): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (e) {
      const wait = waits[attempt]
      if (wait === undefined || !isTransient(e)) throw e
      await sleep(wait)
    }
  }
}

export interface AtomicWriteOptions {
  /** Create the parent folder if needed. */
  mkdir?: boolean
  /** For tests: the retry waits. */
  waits?: readonly number[]
}

/**
 * Writes `content` to `file` atomically: first to `<file>.<random>.tmp` in the same folder, then renames it
 * over the target (retried while Windows holds a lock). If the final rename still fails, the temporary file
 * is KEPT so nothing typed is lost, and the error message names it.
 */
export async function writeFileAtomic(file: string, content: string, options: AtomicWriteOptions = {}): Promise<void> {
  if (options.mkdir) await mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.${randomBytes(4).toString('hex')}.tmp`
  try {
    await writeFile(tmp, content, 'utf8')
  } catch (e) {
    await rm(tmp, { force: true }).catch(() => {})
    throw e
  }
  try {
    await withRetry(() => rename(tmp, file), options.waits)
  } catch (e) {
    const err = new Error(`${(e as Error).message} — the new content was kept in ${tmp}`)
    ;(err as NodeJS.ErrnoException).code = (e as NodeJS.ErrnoException).code
    throw err
  }
}

/** Deletes a file (no error if it does not exist), retried while Windows holds a lock. */
export const removeFile = (file: string, waits?: readonly number[]): Promise<void> => withRetry(() => rm(file, { force: true }), waits)

/** Renames a file, retried while Windows holds a lock. */
export const renameFile = (from: string, to: string, waits?: readonly number[]): Promise<void> => withRetry(() => rename(from, to), waits)
