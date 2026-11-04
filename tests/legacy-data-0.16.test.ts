// 0.16 switch from ReqMan: the first start of reqochet copies the user's own settings, then removes the old folder.
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { moveLegacyUserData } from '../src/main/legacyData'

const log = { info: () => {}, warn: () => {} }

async function oldFolder(): Promise<{ appData: string; old: string; neu: string }> {
  const appData = await mkdtemp(join(tmpdir(), 'rq-appdata-'))
  const old = join(appData, 'ReqMan')
  await mkdir(join(old, 'cache'), { recursive: true })
  await mkdir(join(old, 'logs'), { recursive: true })
  await mkdir(join(old, 'imports'), { recursive: true })
  await mkdir(join(old, 'Local Storage', 'leveldb'), { recursive: true })
  await writeFile(join(old, 'theme.json'), '{"modes":{"light":{"primary":"#123456"}}}')
  await writeFile(join(old, 'recent-repositories.json'), '[{"root":"D:/x"}]')
  await writeFile(join(old, 'export-settings.json'), '{"folder":"D:/out"}')
  await writeFile(join(old, 'company.svg'), '<svg/>')
  await writeFile(join(old, 'imports', 'abc.json'), '{}')
  await writeFile(join(old, 'Local Storage', 'leveldb', '000003.log'), 'prefs')
  await writeFile(join(old, 'cache', 'x.sqlite'), 'cache')
  await writeFile(join(old, 'logs', 'reqman.log'), 'log')
  await writeFile(join(old, 'update-hold.json'), '{"version":"0.15.0"}')
  return { appData, old, neu: join(appData, 'reqochet-dev') }
}

describe('moving settings from ReqMan (0.16)', () => {
  it('copies only the user\'s own settings, then removes the old folder', async () => {
    const { old, neu } = await oldFolder()
    await mkdir(neu, { recursive: true })
    const r = await moveLegacyUserData(old, neu, log)
    expect(r?.copied.sort()).toEqual(['Local Storage', 'company.svg', 'export-settings.json', 'imports', 'recent-repositories.json', 'theme.json'])
    expect(r?.removedOld).toBe(true)
    expect(existsSync(old)).toBe(false)
    expect(await readFile(join(neu, 'theme.json'), 'utf8')).toContain('#123456')
    expect(await readFile(join(neu, 'Local Storage', 'leveldb', '000003.log'), 'utf8')).toBe('prefs')
    const names = await readdir(neu)
    expect(names).not.toContain('cache') // rebuilt on first opening
    expect(names).not.toContain('update-hold.json') // a pause for an old ReqMan version means nothing to the new app
    expect(names).toContain('moved-from-reqman.txt')
  })

  it('runs once: a second start only finishes removing the old folder', async () => {
    const { old, neu } = await oldFolder()
    await mkdir(neu, { recursive: true })
    await writeFile(join(neu, 'theme.json'), '{"mine":true}')
    const r = await moveLegacyUserData(old, neu, log)
    expect(r?.copied).toEqual([])
    expect(await readFile(join(neu, 'theme.json'), 'utf8')).toBe('{"mine":true}')
    expect(existsSync(old)).toBe(false)
  })

  it('does nothing without a ReqMan folder', async () => {
    const appData = await mkdtemp(join(tmpdir(), 'rq-appdata-'))
    expect(await moveLegacyUserData(join(appData, 'ReqMan'), join(appData, 'reqochet-dev'), log)).toBeNull()
  })
})
