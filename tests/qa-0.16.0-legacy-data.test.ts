// QA 0.16.0 (helper agent, docs/AGENT-WORKFLOW.md): tries to break the move of the user's settings from %APPDATA%\ReqMan
// to the new app's folder (src/main/legacyData.ts). Rule under test: never lose the user's settings, never touch
// anything but the two folders. A failing test here shows a product bug — see docs/reviews/agents/0.16.0-qa.md.
import { existsSync, lstatSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, readdir, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { moveLegacyUserData } from '../src/main/legacyData'

const quiet = { info: () => {}, warn: () => {} }
function recording(): { info(m: string): void; warn(m: string): void; warnings: string[] } {
  const warnings: string[] = []
  return { info: () => {}, warn: (m) => warnings.push(m), warnings }
}

/** %APPDATA% with a typical ReqMan folder: settings worth keeping plus things that are not. */
async function appData(): Promise<{ root: string; old: string; neu: string }> {
  const root = await mkdtemp(join(tmpdir(), 'qa016-appdata-'))
  const old = join(root, 'ReqMan')
  await mkdir(join(old, 'imports'), { recursive: true })
  await mkdir(join(old, 'Local Storage', 'leveldb'), { recursive: true })
  await mkdir(join(old, 'cache'), { recursive: true })
  await writeFile(join(old, 'theme.json'), '{"modes":{"light":{"primary":"#abcdef"}}}')
  await writeFile(join(old, 'recent-repositories.json'), '[{"root":"D:/work/spec"}]')
  await writeFile(join(old, 'export-settings.json'), '{"folder":"D:/out"}')
  await writeFile(join(old, 'imports', 'k.json'), '{"file":"D:/in.xlsx"}')
  await writeFile(join(old, 'Local Storage', 'leveldb', '000003.log'), 'column prefs')
  await writeFile(join(old, 'cache', 'x.sqlite'), 'cache')
  return { root, old, neu: join(root, 'reqochet-dev') }
}

describe('QA legacy settings move — partial or interrupted earlier move', () => {
  it('QA-01: a first start that stopped half way (recent list copied, theme not yet) still brings the theme over', async () => {
    // readdir order copies "recent-repositories.json" before "theme.json"; a crash / power cut between the two copies
    // leaves exactly this: the recent list in the new folder, no marker, and the old folder still complete.
    const { old, neu } = await appData()
    await mkdir(neu, { recursive: true })
    await writeFile(join(neu, 'recent-repositories.json'), '[{"root":"D:/work/spec"}]')
    await moveLegacyUserData(old, neu, quiet)
    // the user's own theme must survive somewhere: either copied now or the old folder kept
    const themeKept = existsSync(join(neu, 'theme.json')) || existsSync(join(old, 'theme.json'))
    expect(themeKept).toBe(true)
  })

  it('QA-02: a copy that fails must not be followed by deleting the only remaining copy', async () => {
    // "imports" cannot be copied (the new folder holds a plain file of that name — any copy error does the same,
    // e.g. a file locked by antivirus on Windows). The old folder is then the only place the import memory lives.
    const { old, neu } = await appData()
    await mkdir(neu, { recursive: true })
    await writeFile(join(neu, 'imports'), 'not a folder')
    const log = recording()
    const r = await moveLegacyUserData(old, neu, log)
    expect(log.warnings.some((w) => w.includes('imports'))).toBe(true) // the failure is noticed …
    const importsKept = existsSync(join(old, 'imports', 'k.json')) || existsSync(join(neu, 'imports', 'k.json'))
    expect(importsKept, `removedOld=${String(r?.removedOld)}`).toBe(true) // … but the data must not be gone
  })
})

describe('QA legacy settings move — odd folders', () => {
  it('a folder called "theme.json" does not stop the other settings from moving', async () => {
    const { old, neu } = await appData()
    await mkdir(neu, { recursive: true })
    await writeFile(join(old, 'theme.json.bak'), 'x')
    const { rm } = await import('node:fs/promises')
    await rm(join(old, 'theme.json'))
    await mkdir(join(old, 'theme.json'))
    const r = await moveLegacyUserData(old, neu, quiet)
    expect(r).not.toBeNull()
    expect(await readFile(join(neu, 'recent-repositories.json'), 'utf8')).toContain('D:/work/spec')
  })

  it('QA-03: a folder called "theme.json" is not copied as a folder (the theme service then cannot read or create theme.json)', async () => {
    const { old, neu } = await appData()
    await mkdir(neu, { recursive: true })
    const { rm } = await import('node:fs/promises')
    await rm(join(old, 'theme.json'))
    await mkdir(join(old, 'theme.json'))
    await moveLegacyUserData(old, neu, quiet)
    const s = await stat(join(neu, 'theme.json')).catch(() => null)
    expect(s === null || s.isFile()).toBe(true)
  })

  it('the new folder does not exist yet: it is created and everything moves', async () => {
    const { old, neu } = await appData()
    const r = await moveLegacyUserData(old, neu, quiet)
    expect(r?.copied.sort()).toEqual(['Local Storage', 'export-settings.json', 'imports', 'recent-repositories.json', 'theme.json'])
    expect(existsSync(join(neu, 'moved-from-reqman.txt'))).toBe(true)
    expect(existsSync(old)).toBe(false)
  })

  it('an old folder with only some pieces moves those pieces', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qa016-appdata-'))
    const old = join(root, 'ReqMan')
    await mkdir(join(old, 'logs'), { recursive: true })
    await writeFile(join(old, 'export-settings.json'), '{"folder":"E:/"}')
    const neu = join(root, 'reqochet-dev')
    await mkdir(neu)
    const r = await moveLegacyUserData(old, neu, quiet)
    expect(r?.copied).toEqual(['export-settings.json'])
    expect(await readFile(join(neu, 'export-settings.json'), 'utf8')).toContain('E:/')
  })

  it('an empty old folder: marker written, old folder removed, no settings invented', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qa016-appdata-'))
    const old = join(root, 'ReqMan')
    await mkdir(old)
    const neu = join(root, 'reqochet-dev')
    await mkdir(neu)
    const r = await moveLegacyUserData(old, neu, quiet)
    expect(r?.copied).toEqual([])
    expect(await readdir(neu)).toEqual(['moved-from-reqman.txt'])
  })

  it('the new folder already has the user\'s own settings: they are never overwritten', async () => {
    const { old, neu } = await appData()
    await mkdir(neu, { recursive: true })
    await writeFile(join(neu, 'theme.json'), '{"mine":1}')
    await writeFile(join(neu, 'recent-repositories.json'), '[{"root":"C:/new"}]')
    await moveLegacyUserData(old, neu, quiet)
    expect(await readFile(join(neu, 'theme.json'), 'utf8')).toBe('{"mine":1}')
    expect(await readFile(join(neu, 'recent-repositories.json'), 'utf8')).toBe('[{"root":"C:/new"}]')
  })

  it('a large Local Storage (2,000 files, ~20 MB) moves completely and in reasonable time', async () => {
    const { old, neu } = await appData()
    await mkdir(neu, { recursive: true })
    const dir = join(old, 'Local Storage', 'leveldb')
    const chunk = 'x'.repeat(10_000)
    await Promise.all(Array.from({ length: 2000 }, (_, i) => writeFile(join(dir, `${String(i).padStart(6, '0')}.ldb`), chunk)))
    const t0 = Date.now()
    const r = await moveLegacyUserData(old, neu, quiet)
    expect(Date.now() - t0).toBeLessThan(20_000)
    expect(r?.copied).toContain('Local Storage')
    expect((await readdir(join(neu, 'Local Storage', 'leveldb'))).length).toBe(2001)
  })
})

describe('QA legacy settings move — touches nothing but the two folders', () => {
  it('neighbours in %APPDATA% with similar names are left alone', async () => {
    const { root, old, neu } = await appData()
    await mkdir(neu, { recursive: true })
    for (const n of ['ReqMan-backup', 'ReqMan2', 'reqochet', 'Code']) {
      await mkdir(join(root, n))
      await writeFile(join(root, n, 'keep.txt'), n)
    }
    await moveLegacyUserData(old, neu, quiet)
    for (const n of ['ReqMan-backup', 'ReqMan2', 'reqochet', 'Code']) expect(await readFile(join(root, n, 'keep.txt'), 'utf8')).toBe(n)
  })

  it('a link inside the old folder pointing elsewhere: the target stays untouched after the old folder is removed', async () => {
    const { root, old, neu } = await appData()
    await mkdir(neu, { recursive: true })
    const outside = join(root, 'Shared logos')
    await mkdir(outside)
    await writeFile(join(outside, 'acme.svg'), '<svg id="acme"/>')
    await writeFile(join(outside, 'other.txt'), 'other')
    await symlink(join(outside, 'acme.svg'), join(old, 'company.svg'))
    const { rm } = await import('node:fs/promises')
    await rm(join(old, 'imports'), { recursive: true })
    await symlink(outside, join(old, 'imports'), 'dir')
    await moveLegacyUserData(old, neu, quiet)
    expect(existsSync(old)).toBe(false)
    expect(await readFile(join(outside, 'acme.svg'), 'utf8')).toBe('<svg id="acme"/>')
    expect(await readFile(join(outside, 'other.txt'), 'utf8')).toBe('other')
    // the logo is usable from the new folder (as a file or a link that still resolves)
    expect(await readFile(join(neu, 'company.svg'), 'utf8')).toBe('<svg id="acme"/>')
  })

  it('the old folder itself is a link (a redirected AppData): only the link goes, the real folder\'s files stay', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qa016-appdata-'))
    const real = join(root, 'real-settings')
    await mkdir(real)
    await writeFile(join(real, 'theme.json'), '{"a":1}')
    await writeFile(join(real, 'unrelated.docx'), 'user document')
    const old = join(root, 'ReqMan')
    await symlink(real, old, 'dir')
    const neu = join(root, 'reqochet-dev')
    await mkdir(neu)
    await moveLegacyUserData(old, neu, quiet)
    expect(await readFile(join(neu, 'theme.json'), 'utf8')).toBe('{"a":1}')
    expect(await readFile(join(real, 'unrelated.docx'), 'utf8')).toBe('user document')
    expect(existsSync(old) && lstatSync(old).isSymbolicLink() ? 'link kept' : 'ok').toBe('ok')
  })

  it('never throws, whatever the folders look like (old path is a file)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qa016-appdata-'))
    const old = join(root, 'ReqMan')
    await writeFile(old, 'a file, not a folder')
    const neu = join(root, 'reqochet-dev')
    await mkdir(neu)
    await expect(moveLegacyUserData(old, neu, quiet)).resolves.toBeDefined()
  })
})
