// QA 0.16.0 (helper agent, docs/AGENT-WORKFLOW.md): the rename to reqochet in ReqIF/Excel, theme, updater version list
// and Git messages. A failing test shows a product bug — see docs/reviews/agents/0.16.0-qa.md.
import { readdirSync, readFileSync } from 'node:fs'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateXML } from 'xmllint-wasm'
import { guessMapping, planImport, readReqif, readXlsx, writeReqif, writeXlsx } from '../src/modules/import-export'
import { generateId, isValidId } from '../src/modules/items'
import { parseSchema } from '../src/modules/schema'
import { createFileThemeService } from '../src/modules/theme'
import { compareVersions, OLDEST_REVERT_TARGET, parseReleases, revertTargets } from '../src/modules/updater'
import { GitError } from '../src/modules/git-adapter'
import { explainGitError } from '../src/modules/workspace'
import type { IndexedItem } from '../src/shared/domain'

const root = join(__dirname, '..')
const { schema } = parseSchema(readFileSync(join(root, 'config', 'default-schema.yaml'), 'utf8'))

const mk = (id: string, type: string, title: string, extra: Partial<IndexedItem> = {}): IndexedItem => ({
  id, type, title, fields: {}, links: [], text: '', path: `items/${id}.md`, childCount: 0, incomingCount: 0, suspectCount: 0, ...extra
})
const items = (): { item: IndexedItem; depth: number }[] => {
  const ch = mk('REQ-AAAAAAA', 'information', 'Chapter', { number: '1' })
  const req = mk('REQ-BBBBBBB', 'system-requirement', 'Accuracy', { parent: ch.id, number: '1.1', text: 'The system **shall** measure.\n\n- a\n- b', fields: { status: 'Approved', tags: ['safety'] } })
  const tc = mk('REQ-CCCCCCC', 'test-case', 'Check', { number: '2', links: [{ type: 'verifies', target: req.id, confirmed: 'x' }] })
  return [{ item: ch, depth: 0 }, { item: req, depth: 1 }, { item: tc, depth: 0 }]
}

/** What 0.15.x (ReqMan) wrote: same file, old identifiers and attribute names. */
const asReqMan = (xml: string): string =>
  xml.replaceAll('reqochet-', 'reqman-').replaceAll('reqochet.', 'ReqMan.').replaceAll('<REQ-IF-TOOL-ID>reqochet<', '<REQ-IF-TOOL-ID>ReqMan<').replaceAll('<SOURCE-TOOL-ID>reqochet<', '<SOURCE-TOOL-ID>ReqMan<')

const planOf = (rows: string[][]) => {
  const [headers, ...data] = rows as [string[], ...string[][]]
  const taken = new Set<string>()
  return planImport({
    rows: data, firstRow: 2, headers, mapping: guessMapping(headers, schema), schema, defaultType: 'system-requirement',
    existing: { byId: new Map(), bySource: new Map() },
    newId: () => { const id = generateId((x) => taken.has(x)); taken.add(id); return id },
    isValidId
  })
}
const comparable = (p: ReturnType<typeof planOf>) =>
  p.items.map((x) => ({ id: x.item.id, type: x.item.type, title: x.item.title, text: x.item.text, fields: x.item.fields, parent: x.item.parent ?? null, links: x.item.links.map((l) => `${l.type}>${l.target}`) }))

describe('QA ReqIF across the rename', () => {
  it('new exports carry only reqochet names (no "reqman" left in the file)', () => {
    const xml = writeReqif(schema, items(), 'T')
    expect(xml).toContain('reqochet.Type')
    expect(xml).toContain('<REQ-IF-TOOL-ID>reqochet</REQ-IF-TOOL-ID>')
    expect(xml.toLowerCase()).not.toContain('reqman')
  })

  it('a ReqMan 0.15 file imports exactly like the same file written by reqochet', () => {
    const xml = writeReqif(schema, items(), 'T')
    const neu = planOf(readReqif(xml)[0]!.rows)
    const old = planOf(readReqif(asReqMan(xml))[0]!.rows)
    expect(old.problems).toEqual([])
    expect(comparable(old)).toEqual(comparable(neu))
    expect(old.items.find((x) => x.item.id === 'REQ-BBBBBBB')?.item.text).toBe('The system **shall** measure.\n\n- a\n- b')
  })

  it('header case and a mix of old and new names are read the same way', () => {
    for (const headers of [
      ['ReqIF.ForeignID', 'ReqIF.Name', 'ReqIF.Text', 'REQMAN.TYPE', 'reqman.number', 'Reqman.Markdown'],
      ['ReqIF.ForeignID', 'ReqIF.Name', 'ReqIF.Text', 'reqochet.Type', 'ReqMan.Number', 'ReqMan.Markdown'],
      ['ReqIF.ForeignID', 'ReqIF.Name', 'ReqIF.Text', 'ReqMan.Type', 'reqochet.Number', 'Reqochet.Markdown']
    ]) {
      const m = guessMapping(headers, schema)
      expect(m[3], headers.join()).toBe('type')
      expect(m[5], headers.join()).toBe('text')
      expect(m[2], headers.join()).toBe('ignore')
      expect(m[4], headers.join()).toBe('ignore')
    }
  })

  it('both the new export and the old-named file still validate against the ReqIF schema', async () => {
    const dir = join(root, 'tests', 'fixtures', 'reqif-schema')
    const xsd = readdirSync(dir).filter((f) => f.endsWith('.xsd'))
    const xml = writeReqif(schema, items(), 'Title & "more"')
    for (const [name, contents] of [['new.reqif', xml], ['old.reqif', asReqMan(xml)]] as const) {
      const r = await validateXML({
        xml: [{ fileName: name, contents }],
        schema: [{ fileName: 'reqif.xsd', contents: readFileSync(join(dir, 'reqif.xsd'), 'utf8') }],
        preload: xsd.filter((f) => f !== 'reqif.xsd').map((f) => ({ fileName: f, contents: readFileSync(join(dir, f), 'utf8') }))
      })
      expect(r.errors.map((e) => e.rawMessage), name).toEqual([])
    }
  })

  it('a field whose id starts with "reqman" or "reqochet" does not collide with the tool attributes', () => {
    const custom = parseSchema(readFileSync(join(root, 'config', 'default-schema.yaml'), 'utf8').replace(/^fields:\n/m, 'fields:\n  - id: type\n    name: Kind\n    type: text\n')).schema
    const xml = writeReqif(custom, items(), 'T')
    const ids = [...xml.matchAll(/IDENTIFIER="([^"]+)"/g)].map((m) => m[1])
    expect(new Set(ids).size).toBe(ids.length) // every IDENTIFIER unique (ReqIF requires it)
  })
})

describe('QA Excel across the rename', () => {
  it('the workbook says reqochet and reads back unchanged', async () => {
    const bytes = await writeXlsx([{ name: 'Items', header: ['ID', 'Title', 'Type'], rows: [['REQ-AAAAAAA', 'Á & <b>', 'System requirement']] }])
    const book = await readXlsx(bytes)
    const sheet = book[0]!
    expect(sheet.rows[0]).toEqual(['ID', 'Title', 'Type'])
    expect(sheet.rows[1]).toEqual(['REQ-AAAAAAA', 'Á & <b>', 'System requirement'])
    expect(Buffer.from(bytes).toString('latin1')).not.toMatch(/ReqMan/)
  })
})

describe('QA rename leftovers in files copied into projects', () => {
  it('QA-09: the default schema copied into every new project does not name ReqMan or the old .reqman folder', () => {
    const text = readFileSync(join(root, 'config', 'default-schema.yaml'), 'utf8')
    expect(text).not.toMatch(/ReqMan|\.reqman/)
  })
})

describe('QA theme across the rename', () => {
  const shippedConfig = join(root, 'config')
  const shippedResources = join(root, 'resources')
  const userDir = async (theme: unknown, files: Record<string, string> = {}): Promise<string> => {
    const d = await mkdtemp(join(tmpdir(), 'qa016-theme-'))
    await writeFile(join(d, 'theme.json'), JSON.stringify(theme))
    for (const [n, c] of Object.entries(files)) await writeFile(join(d, n), c)
    return d
  }

  it('a company logo that happens to be called logo.svg in the user folder is still shown', async () => {
    const t = await createFileThemeService(shippedConfig, shippedResources, await userDir({ brand: { name: 'ACME', logo: 'logo.svg' } }, { 'logo.svg': '<svg id="acme"/>' })).load()
    expect(t.config.brand.name).toBe('ACME')
    expect(t.logoDataUrl.startsWith('data:image/svg+xml;base64,')).toBe(true)
  })

  it('old default name with a real company logo: the logo stays, the name falls back to reqochet', async () => {
    const t = await createFileThemeService(shippedConfig, shippedResources, await userDir({ brand: { name: 'ReqMan', logo: 'acme.png' } }, { 'acme.png': 'png' })).load()
    expect(t.config.brand.name).toBe('reqochet')
    expect(t.logoDataUrl.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('an old theme with only colours keeps its colours and gets the reqochet brand without warnings', async () => {
    const t = await createFileThemeService(shippedConfig, shippedResources, await userDir({ brand: { name: 'ReqMan', logo: 'logo.svg' }, modes: { light: { primary: '#123456' } } })).load()
    expect(t.config.brand).toEqual({ name: 'reqochet', logo: 'logo.svg' })
    expect(t.logoDataUrl).toBe('')
    expect(t.warnings).toEqual([])
    expect(JSON.stringify(t.config.modes.light)).toContain('#123456')
  })

  it('a logo path trying to leave the folders, or blank, never reads outside', async () => {
    for (const logo of ['../../etc/passwd', '   ', 'C:\\Windows\\win.ini']) {
      const t = await createFileThemeService(shippedConfig, shippedResources, await userDir({ brand: { logo } })).load()
      expect(t.logoDataUrl).toBe('')
    }
  })
})

describe('QA versions list after the rename', () => {
  const rel = (tag: string, exe: string) => ({
    tag_name: tag, published_at: '2026-11-04T08:00:00Z', draft: false, prerelease: false,
    assets: [{ name: exe, browser_download_url: `https://github.com/o/r/releases/download/${tag}/${exe}` }, { name: `${exe}.blockmap`, browser_download_url: `https://github.com/o/r/releases/download/${tag}/${exe}.blockmap` }]
  })
  it('reads reqochet-dev installers and old ReqMan installers; only 0.16.0 and later can be gone back to', () => {
    expect(OLDEST_REVERT_TARGET).toBe('0.16.0')
    const list = parseReleases([
      rel('v0.16.2', 'reqochet-dev-Setup-0.16.2.exe'),
      rel('v0.16.1', 'reqochet-dev-Setup-0.16.1.exe'),
      rel('v0.16.0', 'reqochet-dev-Setup-0.16.0.exe'),
      rel('v0.15.2', 'ReqMan-Setup-0.15.2.exe'),
      rel('v0.14.1', 'ReqMan-Setup-0.14.1.exe')
    ])
    expect(list.map((r) => r.version)).toEqual(['0.16.2', '0.16.1', '0.16.0', '0.15.2', '0.14.1'])
    expect(list[0]!.installerUrl.endsWith('reqochet-dev-Setup-0.16.2.exe')).toBe(true) // never the .blockmap
    expect(revertTargets(list, '0.16.2').map((r) => r.version)).toEqual(['0.16.1', '0.16.0'])
    expect(revertTargets(list, '0.16.0')).toEqual([])
    expect(compareVersions('0.16.0', '0.15.10')).toBeGreaterThan(0)
  })
  it('a release with only a blockmap or a zip offers nothing to install', () => {
    const r = parseReleases([{ tag_name: 'v0.16.3', draft: false, prerelease: false, assets: [{ name: 'reqochet-dev-Setup-0.16.3.exe.blockmap', browser_download_url: 'https://github.com/o/r/x' }, { name: 'reqochet-dev-Setup-0.16.3.zip', browser_download_url: 'https://github.com/o/r/y' }] }])
    expect(r).toEqual([])
  })
})

describe('QA Git messages: server errors vs pull first vs hooks', () => {
  const push = (stderr: string): GitError => new GitError('git push failed', ['push'], 1, '', stderr)
  it('server errors in the usual shapes', () => {
    for (const s of ['remote: Internal Server Error\nfatal: the remote end hung up unexpectedly', 'error: RPC failed; HTTP 500 curl 22 The requested URL returned error: 500', "fatal: unable to access 'https://github.com/o/r.git/': The requested URL returned error: 503"])
      expect(explainGitError(push(s)), s).toMatch(/GitHub had a problem/)
  })
  it('pull first still wins over "error: failed to push some refs"', () => {
    expect(explainGitError(push("To https://github.com/o/r.git\n ! [rejected]        feature -> feature (fetch first)\nerror: failed to push some refs to 'https://github.com/o/r.git'"))).toMatch(/Pull first/)
  })
  it('QA-10: a server-side hook whose message contains a number like 503 is a hook, not a GitHub outage', () => {
    const s = 'remote: Ticket ABC-503 is closed\nTo https://github.com/o/r.git\n ! [remote rejected] main -> main (pre-receive hook declined: ticket 503 closed)\nerror: failed to push some refs'
    expect(explainGitError(push(s))).toMatch(/hook/i)
  })
  it('QA-11: a hook naming an item whose ID contains "403" is not a sign-in problem', () => {
    const s = 'remote: REQ-K403QXT has no verifies link\nTo https://github.com/o/r.git\n ! [remote rejected] main -> main (pre-receive hook declined)\nerror: failed to push some refs'
    expect(explainGitError(push(s))).toMatch(/hook/i)
  })
  it('GitHub branch protection is not called a server error or pull first', () => {
    const s = 'remote: error: GH006: Protected branch update failed for refs/heads/main.\n ! [remote rejected] main -> main (protected branch hook declined)'
    const m = explainGitError(push(s))
    expect(m).not.toMatch(/GitHub had a problem|Pull first/)
    expect(m).toMatch(/hook/i)
  })
  it('a real 403 is still sign-in', () => {
    expect(explainGitError(push("remote: Permission to o/r.git denied to someone.\nfatal: unable to access 'https://github.com/o/r.git/': The requested URL returned error: 403"))).toMatch(/sign in/)
  })
})
