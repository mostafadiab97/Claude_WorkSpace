import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFileLogger } from '../src/modules/logger'

describe('logger', () => {
  it('writes timestamped lines with level', () => {
    const dir = mkdtempSync(join(tmpdir(), 'reqman-log-'))
    const log = createFileLogger(dir)
    log.info('started')
    log.warn('careful')
    log.error('failed', new Error('boom'))
    const text = readFileSync(log.filePath, 'utf8')
    expect(text).toMatch(/^\d{4}-\d\d-\d\dT[\d:.]+Z INFO {2}started$/m)
    expect(text).toContain('WARN  careful')
    expect(text).toContain('ERROR failed: boom')
  })

  it('rotates the log when it grows past the limit', () => {
    const dir = mkdtempSync(join(tmpdir(), 'reqman-log-'))
    const log = createFileLogger(dir, 200)
    for (let i = 0; i < 20; i++) log.info(`line ${i} with some padding text`)
    expect(existsSync(join(dir, 'reqman.old.log'))).toBe(true)
    expect(readFileSync(log.filePath, 'utf8').length).toBeLessThan(400)
  })

  it('never throws when the log file cannot be written', () => {
    const dir = mkdtempSync(join(tmpdir(), 'reqman-log-'))
    // A folder where the log file should be makes every write fail.
    mkdirSync(join(dir, 'reqman.log'))
    const log = createFileLogger(dir)
    expect(() => log.error('still fine')).not.toThrow()
  })
})
