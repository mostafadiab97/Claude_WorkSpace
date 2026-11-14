// QA 0.24.0: theme editor core (layers / saveUser) and the window input check, with hostile user files.
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createFileThemeService } from '../src/modules/theme'
import { themeOverrides } from '../src/main/validate'

let cfg: string, res: string, usr: string
beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'qa024-'))
  cfg = join(root, 'cfg'); res = join(root, 'res'); usr = join(root, 'usr')
  for (const d of [cfg, res, usr]) mkdirSync(d)
  writeFileSync(join(cfg, 'theme.json'), JSON.stringify({ modes: { light: { primary: '#111111' } } }))
})
const svc = () => createFileThemeService(cfg, res, usr)
const put = (s: string) => writeFileSync(join(usr, 'theme.json'), s)
// 0.24.0 after review: saves carry the revision read by layers() (conflict check)
const save = async (o: Parameters<ReturnType<typeof svc>['saveUser']>[0]) => {
  const s = svc()
  return s.saveUser(o, (await s.layers()).revision)
}

describe('layers() with a hostile user file', () => {
  it('invalid JSON: user layer empty, load() warns, and saveUser refuses to overwrite it (review 0.24.0 C1)', async () => {
    put('{ not json')
    expect((await svc().layers()).user).toEqual({})
    expect((await svc().load()).warnings.join(' ')).toMatch(/could not be read/)
    await expect(save({ shape: { buttonRadius: '3px' } })).rejects.toThrow('THEME_FILE_BROKEN')
    expect(readFileSync(join(usr, 'theme.json'), 'utf8')).toBe('{ not json')
  })
  it('a JSON array, null, a number: ignored by layers, never overwritten by saveUser', async () => {
    for (const s of ['[1,2]', 'null', '42', '"x"']) {
      put(s)
      expect((await svc().layers()).user).toEqual({})
      await expect(save({ spacing: { lg: '9px' } })).rejects.toThrow('THEME_FILE_BROKEN')
    }
  })
  it('comment-like keys survive saveUser; unknown modes and groups are not shown by layers', async () => {
    put(JSON.stringify({ '//': 'note', _help: 'h', brand: { name: 'X' }, extra: { a: '1' }, modes: { neon: { primary: '#fff' }, light: { text: '#222222' } } }))
    expect((await svc().layers()).user).toEqual({ modes: { light: { text: '#222222' } } })
    await save({ modes: { dark: { text: '#eeeeee' } } })
    const f = JSON.parse(readFileSync(join(usr, 'theme.json'), 'utf8'))
    expect(f['//']).toBe('note'); expect(f.brand.name).toBe('X'); expect(f.extra).toEqual({ a: '1' })
    expect(f.modes).toEqual({ neon: { primary: '#fff' }, dark: { text: '#eeeeee' } }) // modes it does not know are kept (review C2)
  })
  it('a 6 MB user file is read without failing', async () => {
    put(JSON.stringify({ junk: 'x'.repeat(6_000_000), modes: { light: { text: '#333333' } } }))
    expect((await svc().layers()).user.modes?.light?.text).toBe('#333333')
  })
  it('non-string and empty values are dropped in layers', async () => {
    put(JSON.stringify({ spacing: { a: 1, b: '', c: '  ', d: '4px', e: ['x'] } }))
    expect((await svc().layers()).user).toEqual({ spacing: { d: '4px' } })
  })
})

describe('saveUser()', () => {
  it('values with } ; url(...) are refused (QA Q2 fixed)', async () => {
    const evil = 'red;} body{background:url(http://x/y)'
    await expect(save({ modes: { light: { primary: evil } } })).rejects.toThrow()
  })
  it('a value with url(...) should be refused (it would make the window fetch a remote file)', async () => {
    await expect(save({ modes: { light: { primary: 'url(http://example.invalid/a.png)' } } })).rejects.toThrow()
  })
  it('two saves in parallel: one at a time; the one that read an older file is refused as a conflict, the file stays valid (Q1 fixed)', async () => {
    const results = await Promise.allSettled([
      save({ spacing: { lg: '1px' } }),
      save({ spacing: { lg: '2px' } })
    ])
    expect(results.some((x) => x.status === 'fulfilled')).toBe(true)
    for (const r of results) if (r.status === 'rejected') expect(String(r.reason)).toMatch(/THEME_FILE_CHANGED/)
    expect(['1px', '2px']).toContain(JSON.parse(readFileSync(join(usr, 'theme.json'), 'utf8')).spacing.lg)
    expect(readdirSync(usr).filter((n) => n.endsWith('.tmp'))).toEqual([])
  })
  it('many parallel saves never leave a broken file', async () => {
    const r = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => save({ spacing: { lg: `${i}px` } })))
    expect(r.every((x) => x.status === 'fulfilled')).toBe(true)
    JSON.parse(readFileSync(join(usr, 'theme.json'), 'utf8'))
  })
  it('user folder impossible to create: rejects and leaves the old file', async () => {
    put(JSON.stringify({ spacing: { lg: '7px' } }))
    const s = createFileThemeService(cfg, res, join(usr, 'theme.json', 'sub'))
    await expect(s.saveUser({ spacing: { lg: '1px' } }, 'none')).rejects.toThrow()
    expect(JSON.parse(readFileSync(join(usr, 'theme.json'), 'utf8')).spacing.lg).toBe('7px')
  })
  it('read-only folder: rejects, old file intact, no tmp left (skipped as root)', async () => {
    if (process.getuid?.() === 0) return
    put(JSON.stringify({ spacing: { lg: '7px' } }))
    chmodSync(usr, 0o500)
    try {
      await expect(save({ spacing: { lg: '1px' } })).rejects.toThrow()
    } finally { chmodSync(usr, 0o700) }
    expect(JSON.parse(readFileSync(join(usr, 'theme.json'), 'utf8')).spacing.lg).toBe('7px')
    expect(existsSync(join(usr, 'theme.json'))).toBe(true)
  })
  it('empty overrides write a file with no groups; the old groups are removed (reset to default)', async () => {
    put(JSON.stringify({ spacing: { lg: '7px' }, _help: 'k' }))
    await save({})
    expect(JSON.parse(readFileSync(join(usr, 'theme.json'), 'utf8'))).toEqual({ _help: 'k' })
  })
  it('a leftover .tmp from a crashed save does not block the next save', async () => {
    writeFileSync(join(usr, `theme.json.${process.pid}.tmp`), 'garbage')
    await save({ spacing: { lg: '3px' } })
    expect((await svc().layers()).user.spacing?.lg).toBe('3px')
  })
})

describe('window input check themeOverrides', () => {
  it('accepts empty groups and the three modes', () => {
    expect(themeOverrides({})).toEqual({})
    expect(themeOverrides({ modes: { light: {}, dark: {}, ember: {} }, shape: {} })).toEqual({ modes: { light: {}, dark: {}, ember: {} }, shape: {} })
  })
  it.each([null, [], 'x', 5, { modes: [] }, { modes: { neon: {} } }, { brand: {} }, { shape: [] }, { shape: { a: 1 } }, { shape: { a: '' } },
    { shape: { 'a b': 'x' } }, { shape: { '1a': 'x' } }, { shape: { __proto__x: 'x' } }, { shape: { a: 'x'.repeat(201) } }])('rejects %j', (v) => {
    expect(() => themeOverrides(v)).toThrow()
  })
  it('limits: 200 values ok, 201 refused; value 200 chars ok; key 64 chars ok, 65 refused', () => {
    const mk = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, 'v']))
    expect(Object.keys(themeOverrides({ shape: mk(200) }).shape ?? {}).length).toBe(200)
    expect(() => themeOverrides({ shape: mk(201) })).toThrow(/too many/)
    expect(themeOverrides({ shape: { a: 'x'.repeat(200) } }).shape?.['a']?.length).toBe(200)
    expect(() => themeOverrides({ shape: { ['a' + 'b'.repeat(63)]: 'x' } })).not.toThrow()
    expect(() => themeOverrides({ shape: { ['a' + 'b'.repeat(64)]: 'x' } })).toThrow()
  })
  it('a JSON-parsed __proto__ key does not pollute', () => {
    const v = JSON.parse('{"shape":{"__proto__":"x"}}')
    expect(() => themeOverrides(v)).toThrow()
    expect(({} as Record<string, unknown>)['x']).toBeUndefined()
  })
  it('an editor value cleared to empty is refused (the editor must not send empty strings)', () => {
    expect(() => themeOverrides({ spacing: { lg: '' } })).toThrow()
  })
  it('only one key checked: a mode key duplicated cannot exist; unknown key in modes object rejected', () => {
    expect(() => themeOverrides({ modes: { light: {}, extra: {} } })).toThrow(/unknown mode/)
  })
})
