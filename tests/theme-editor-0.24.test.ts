// 0.24.0 theme editor (the owner, 13 Nov 2026): the core reads the layers and writes only the user's values — checked,
// atomic, other keys of the user's file kept, and the window input check refuses anything else.
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFileThemeService } from '../src/modules/theme'
import { themeOverrides } from '../src/main/validate'

const service = () => {
  const dir = mkdtempSync(join(tmpdir(), 'rq-theme-'))
  return { dir, svc: createFileThemeService(join(process.cwd(), 'config'), join(process.cwd(), 'resources'), dir) }
}

describe('theme editor core (0.24.0)', () => {
  it('layers: the app theme without the user values, and the user values alone', async () => {
    const { dir, svc } = service()
    writeFileSync(join(dir, 'theme.json'), JSON.stringify({ brand: { name: 'Acme' }, modes: { light: { primary: '#123456' } } }))
    const l = await svc.layers()
    expect(l.base.modes.light['primary']).not.toBe('#123456')
    expect(l.user).toEqual({ modes: { light: { primary: '#123456' } } })
  })

  it('saveUser writes only the token groups, keeps brand and notes, and the loaded theme uses the values', async () => {
    const { dir, svc } = service()
    writeFileSync(join(dir, 'theme.json'), JSON.stringify({ _help: 'note', brand: { name: 'Acme' }, spacing: { md: '9px' } }))
    const loaded = await svc.saveUser({ modes: { ember: { primary: '#ff0000' } }, typography: { fontSizeBase: '15px' } })
    const file = JSON.parse(readFileSync(join(dir, 'theme.json'), 'utf8')) as Record<string, unknown>
    expect(file['_help']).toBe('note')
    expect(file['brand']).toEqual({ name: 'Acme' })
    expect(file['spacing']).toBeUndefined() // the editor's set replaces the groups (it sent no spacing change)
    expect(file['modes']).toEqual({ ember: { primary: '#ff0000' } })
    expect(loaded.source).toBe('user')
    expect(loaded.config.modes.ember['primary']).toBe('#ff0000')
    expect(loaded.config.typography['fontSizeBase']).toBe('15px')
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]) // atomic: no leftover temporary file
  })

  it('saveUser with nothing makes the user file follow the app theme again (Reset everything)', async () => {
    const { dir, svc } = service()
    await svc.saveUser({ modes: { dark: { text: '#eeeeee' } } })
    const loaded = await svc.saveUser({})
    expect(existsSync(join(dir, 'theme.json'))).toBe(true)
    const base = (await svc.layers()).base
    expect(loaded.config.modes.dark['text']).toBe(base.modes.dark['text'])
  })

  it('the window input check refuses unknown groups, modes, bad keys and long values', () => {
    expect(themeOverrides({ modes: { light: { primary: '#fff' } } })).toEqual({ modes: { light: { primary: '#fff' } } })
    expect(() => themeOverrides({ brand: { name: 'x' } })).toThrow()
    expect(() => themeOverrides({ modes: { neon: {} } })).toThrow()
    expect(() => themeOverrides({ shape: { 'a b': '1px' } })).toThrow()
    expect(() => themeOverrides({ shape: { radius: 'x'.repeat(500) } })).toThrow()
    expect(() => themeOverrides({ spacing: { md: 5 } })).toThrow()
  })
})
