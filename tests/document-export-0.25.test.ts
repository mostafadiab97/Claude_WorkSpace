// 0.25.0 Word / PDF / web page export (P-17…P-19): a Word document from the project's template (or the built-in
// one) with every placeholder filled, the same content as one web page, and the PDF made from its print version.
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { fillPart } from '../src/modules/import-export'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { cacheFileName, createWorkspace, type WorkspaceService } from '../src/modules/workspace'

const quiet = { info: () => {}, warn: () => {}, error: () => {} }

async function setup(): Promise<{ ws: WorkspaceService; root: string; parent: string; child: string }> {
  const base = await mkdtemp(join(tmpdir(), 'rq-doc-'))
  const root = join(base, 'work')
  const userDir = await mkdtemp(join(tmpdir(), 'rq-doc-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: (r: string) => createSqliteIndexCache(join(userDir, 'cache', cacheFileName(r))),
    userDir,
    log: quiet,
    watchFiles: false
  } as Parameters<typeof createWorkspace>[0])
  execFileSync('git', ['init', '-q', '-b', 'main', root])
  execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: root })
  execFileSync('git', ['config', 'user.email', 't@example.invalid'], { cwd: root })
  await ws.initialize(root, 'Spec')
  const p = { ...ws.newItem('system-requirement'), title: 'Door <lock> & key', text: 'The door **locks** within 2 s.\n\n- one\n- two' }
  expect((await ws.saveItem(p, null)).ok).toBe(true)
  const c = { ...ws.newItem('system-requirement', p.id), title: 'Child "quoted"' }
  expect((await ws.saveItem(c, null)).ok).toBe(true)
  expect((await ws.addLink(c.id, 'refines', p.id)).ok).toBe(true)
  expect((await ws.commit('one')).ok).toBe(true)
  expect((await ws.createBaseline({ name: 'SRS-1.0', note: '' })).ok).toBe(true)
  return { ws, root, parent: p.id, child: c.id }
}

const docxText = async (bytes: Uint8Array, part = 'word/document.xml'): Promise<string> => (await (await JSZip.loadAsync(bytes)).file(part)?.async('string')) ?? ''

describe('0.25.0 fillPart', () => {
  it('a block placeholder replaces its whole paragraph; inline ones are escaped text', () => {
    const xml = '<w:body><w:p><w:r><w:t>{{items}}</w:t></w:r></w:p><w:p><w:r><w:t>Name: {{document.name}}</w:t></w:r></w:p></w:body>'
    const out = fillPart(xml, { items: '<w:p>BLOCK</w:p>' }, { 'document.name': 'A & <B>' })
    expect(out).toBe('<w:body><w:p>BLOCK</w:p><w:p><w:r><w:t>Name: A &amp; &lt;B&gt;</w:t></w:r></w:p></w:body>')
  })
  it('keeps fields (page numbers) and other runs when the placeholder is in one run', () => {
    const xml = '<w:p><w:r><w:t xml:space="preserve">{{document.name}} · </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r></w:p>'
    const out = fillPart(xml, {}, { 'document.name': 'Spec' })
    expect(out).toContain('PAGE')
    expect(out).toContain('>Spec · </w:t>')
  })
  it('joins a placeholder Word split over several runs, keeping the first run’s formatting', () => {
    const xml = '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r w:rsidR="1"><w:rPr><w:b/></w:rPr><w:t>{{docu</w:t></w:r><w:r><w:t>ment.name}} &amp; more</w:t></w:r></w:p>'
    const out = fillPart(xml, {}, { 'document.name': 'Spec' })
    expect(out).toBe('<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Spec &amp; more</w:t></w:r></w:p>')
  })
  it('leaves unknown placeholders alone', () => {
    const xml = '<w:p><w:r><w:t>{{unknown}}</w:t></w:r></w:p>'
    expect(fillPart(xml, {}, {})).toBe(xml)
  })
})

describe('0.25.0 document export', () => {
  it('Word with the built-in layout: title page values, headings by level, escaped text, trace table, page numbers', async () => {
    const { ws, parent, child } = await setup()
    expect(await ws.wordTemplates()).toEqual([])
    const r = await ws.exportItems({ scope: 'all', columns: ['id', 'title', 'text'], format: 'docx', title: 'Door spec', traceTable: true })
    expect(r.count).toBe(2)
    const doc = await docxText(r.content as Uint8Array)
    expect(doc).not.toMatch(/\{\{/)
    expect(doc).toContain('Door spec')
    expect(doc).toContain('SRS-1.0') // the baseline at the exported commit
    expect(doc).toContain('Tester')
    expect(doc).toContain('Door &lt;lock&gt; &amp; key')
    expect(doc).toMatch(/w:pStyle w:val="Heading1"\/>[\s\S]*?Door &lt;lock/)
    expect(doc).toMatch(/w:pStyle w:val="Heading2"\/>[\s\S]*?Child/)
    expect(doc).toContain(parent)
    expect(doc).toContain(child)
    expect(doc).toContain('TOC \\o')
    expect(doc).toContain('RMTraceTable')
    const footer = await docxText(r.content as Uint8Array, 'word/footer1.xml')
    expect(footer).toContain('Door spec')
    expect(footer).toContain('NUMPAGES')
    const settings = await docxText(r.content as Uint8Array, 'word/settings.xml')
    expect(settings).toContain('w:updateFields')
  })
  it('a project template is listed and used: its own style ids (by name) and its own text', async () => {
    const { ws, root } = await setup()
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
    const zip = new JSZip()
    zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
    zip.file('word/document.xml', `<w:document ${W}><w:body><w:p><w:r><w:t>Company cover — {{document.name}} ({{baseline}})</w:t></w:r></w:p><w:p><w:r><w:t>{{items}}</w:t></w:r></w:p></w:body></w:document>`)
    zip.file('word/styles.xml', `<w:styles ${W}><w:style w:type="paragraph" w:styleId="berschrift1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="Anf"><w:name w:val="RM Requirement Text"/></w:style></w:styles>`)
    zip.file('word/settings.xml', `<w:settings ${W}></w:settings>`)
    await mkdir(join(root, 'requirements', '.reqochet', 'templates'), { recursive: true })
    await writeFile(join(root, 'requirements', '.reqochet', 'templates', 'Company.docx'), await zip.generateAsync({ type: 'uint8array' }))
    await writeFile(join(root, 'requirements', '.reqochet', 'templates', '~$Company.docx'), 'Word lock file')
    expect(await ws.wordTemplates()).toEqual(['Company'])
    const r = await ws.exportItems({ scope: 'all', columns: ['id', 'title', 'text'], format: 'docx', template: 'Company' })
    const doc = await docxText(r.content as Uint8Array)
    expect(doc).toContain('Company cover — ')
    expect(doc).toContain('(SRS-1.0)')
    expect(doc).toContain('w:pStyle w:val="berschrift1"')
    expect(doc).toContain('w:pStyle w:val="Anf"')
    // no template name = the built-in layout, even when the project has templates
    const plain = await docxText((await ws.exportItems({ scope: 'all', columns: ['id', 'title'], format: 'docx' })).content as Uint8Array)
    expect(plain).not.toContain('Company cover')
    await expect(ws.exportItems({ scope: 'all', columns: ['id'], format: 'docx', template: 'Gone' })).rejects.toThrow(/Gone/)
  })
  it('web page: one file, items escaped, anchors for links, no script from the data', async () => {
    const { ws, parent, child } = await setup()
    const r = await ws.exportItems({ scope: 'all', columns: ['id', 'title', 'text', 'links'], format: 'html', traceTable: true })
    const html = r.content as string
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('Door &lt;lock&gt; &amp; key')
    expect(html).not.toContain('<lock>')
    expect(html).toContain(`id="${parent}"`)
    expect(html).toContain(`href="#${parent}"`)
    expect(html).toContain(child)
    expect(html).toContain('<b>locks</b>')
    expect(html).not.toMatch(/src=["']https?:/) // self-contained
  })
  it('PDF: the core hands the print version of the page (the window prints it)', async () => {
    const { ws } = await setup()
    const r = await ws.exportItems({ scope: 'all', columns: ['id', 'title'], format: 'pdf' })
    const html = r.content as string
    expect(html).toContain('<!doctype html>')
    expect(html).not.toMatch(/<script/i) // printed without scripts
  })
})
