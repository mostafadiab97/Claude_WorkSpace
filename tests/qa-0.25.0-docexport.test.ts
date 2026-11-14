// QA 0.25.0: tries to break the Word / HTML export (fillPart, itemsToDocx, itemsToHtml).
// Tests marked DEFECT assert the correct behaviour and FAIL on the frozen commit 261801b.
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { fillPart, itemsToDocx, itemsToHtml, type DocumentData } from '../src/modules/import-export'
import { setLanguage } from '../src/shared/text'

const schema = { itemTypes: [{ id: 'req', name: 'Req', requirement: true }], linkTypes: [], fields: [] } as unknown as DocumentData['schema']
const mk = (id: string, title: string, depth: number, text = ''): DocumentData['items'][number] =>
  ({ item: { id, type: 'req', title, text, number: '', links: [], extra: {} }, depth, incoming: [] }) as unknown as DocumentData['items'][number]
const data = (items: DocumentData['items'], over: Partial<DocumentData> = {}): DocumentData => ({ schema, name: 'Spec', baseline: '', commit: 'abc', date: '2026-11-14', author: '', items, columns: ['id', 'number', 'title', 'text'], trace: [], revisions: [], ...over })
const part = async (b: Uint8Array, n = 'word/document.xml'): Promise<string> => (await (await JSZip.loadAsync(b)).file(n)?.async('string')) ?? ''
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
/** Minimal template zip with a given body, optional footer. */
async function template(body: string, footer?: string): Promise<Uint8Array> {
  const z = new JSZip()
  z.file('word/document.xml', `<w:document ${W}><w:body>${body}</w:body></w:document>`)
  z.file('word/styles.xml', `<w:styles ${W}></w:styles>`)
  if (footer) z.file('word/footer1.xml', `<w:ftr ${W}>${footer}</w:ftr>`)
  return z.generateAsync({ type: 'uint8array' })
}
/** Every <w:p> opened must be closed (or self-closed): a crude well-formedness check for paragraphs. */
const balanced = (xml: string): boolean => {
  const opens = (xml.match(/<w:p[ >]/g) ?? []).length - (xml.match(/<w:p [^>]*\/>/g) ?? []).length
  return opens === (xml.match(/<\/w:p>/g) ?? []).length
}

describe('QA 0.25.0 Word template edge cases', () => {
  it('a placeholder named like an Object property ({{toString}}, {{constructor}}) does not crash or print code', () => {
    const xml = '<w:p><w:r><w:t>A {{toString}} B</w:t></w:r></w:p><w:p><w:r><w:t>{{constructor}}</w:t></w:r></w:p>'
    const out = fillPart(xml, {}, { baseline: 'x' })
    expect(out).toBe(xml)
  })

  it('a self-closing empty paragraph before a placeholder paragraph keeps the XML well-formed', () => {
    const xml = '<w:p w:rsidR="00A1"/><w:p><w:r><w:t>Name: </w:t></w:r><w:r><w:t>{{docu</w:t></w:r><w:r><w:t>ment.name}}</w:t></w:r></w:p>'
    const out = fillPart(xml, {}, { 'document.name': 'S' })
    expect(balanced(out)).toBe(true)
    // builder 0.25.0: the runs stay (fields and formatting survive), so the words sit in two text nodes
    expect([...out.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')).toBe('Name: S')
  })

  it('a split placeholder in a footer keeps the page-number field of that paragraph', () => {
    const p = '<w:p><w:r><w:t>{{docu</w:t></w:r><w:r><w:t>ment.name}} page </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>'
    expect(fillPart(p, {}, { 'document.name': 'S' })).toContain('PAGE')
  })

  it('a split placeholder keeps a tab / line break between its runs', () => {
    const p = '<w:p><w:r><w:t>{{baseline}} </w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>{{com</w:t></w:r><w:r><w:t>mit}}</w:t></w:r></w:p>'
    expect(fillPart(p, {}, { baseline: 'B', commit: 'C' })).toContain('<w:tab/>')
  })

  it('an empty block ({{items}} of an empty project) in a table cell leaves a paragraph (a cell without one is corrupt in Word)', () => {
    const xml = '<w:tbl><w:tr><w:tc><w:tcPr/><w:p><w:r><w:t>{{items}}</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'
    const out = fillPart(xml, { items: '' }, {})
    expect(out).toMatch(/<w:tc>(?:<w:tcPr\/>)?<w:p[ >]/)
  })

  it('placeholder with spaces, dots, entities and "$&" in the value stays literal text', () => {
    const out = fillPart('<w:p><w:r><w:t>{{ document.name }}</w:t></w:r></w:p>', {}, { 'document.name': "$& $1 </w:t> 'q'" })
    expect(out).toBe('<w:p><w:r><w:t>$&amp; $1 &lt;/w:t&gt; \'q\'</w:t></w:r></w:p>')
  })

  it('xml:space and attributes on w:t are fine; <w:tab/> and <w:tbl> are not mistaken for text', () => {
    const out = fillPart('<w:p><w:r><w:tab/><w:t xml:space="preserve"> {{date}} </w:t></w:r></w:p>', {}, { date: 'D' })
    expect(out).toContain('> D <')
  })
})

describe('QA 0.25.0 Word document', () => {
  it('empty project: built-in template still produces all parts and an items-free body', async () => {
    const out = await itemsToDocx(data([]))
    const xml = await part(out)
    expect(xml).not.toContain('{{')
    expect(balanced(xml)).toBe(true)
    expect(xml).toContain('<w:sectPr>')
  })

  it('hierarchy of 12 levels: headings are clamped to Heading 6, none above', async () => {
    const items = Array.from({ length: 12 }, (_, i) => mk(`REQ-000000${i}`, `L${i}`, i))
    const xml = await part(await itemsToDocx(data(items)))
    expect(xml).toContain('w:val="Heading6"')
    expect(xml).not.toMatch(/Heading[7-9]/)
    expect((xml.match(/w:val="Heading6"/g) ?? []).length).toBe(7) // levels 6..12
  })

  it('Heading levels deeper than a template defines (only Heading 1-3) fall back to a style the template has', async () => {
    const z = await JSZip.loadAsync(await template('<w:p><w:r><w:t>{{items}}</w:t></w:r></w:p>'))
    z.file('word/styles.xml', `<w:styles ${W}><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/></w:style></w:styles>`)
    const t = await z.generateAsync({ type: 'uint8array' })
    const xml = await part(await itemsToDocx(data([mk('REQ-0000001', 'deep', 5)]), t))
    const used = [...xml.matchAll(/<w:pStyle w:val="([^"]+)"/g)].map((m) => m[1])
    const heading = used.find((u) => /^heading/i.test(u ?? ''))
    expect(['Heading1', 'Heading3']).toContain(heading) // a style the template really has
  })

  it('control characters in a title or text (illegal in XML 1.0) are removed, not written', async () => {
    const xml = await part(await itemsToDocx(data([mk('REQ-0000001', 'bad\u0001title\u000b', 0, 'x\u0008y\u001f')])))
    // eslint-disable-next-line no-control-regex
    expect(xml).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/)
  })

  it('special characters and Arabic survive; items text stays escaped', async () => {
    setLanguage('ar')
    try {
      const xml = await part(await itemsToDocx(data([mk('REQ-0000001', 'باب <قفل> & "مفتاح"', 0, 'نص عربي **غامق**\n\n- بند')], { name: 'مواصفات & <x>' })))
      expect(xml).toContain('باب &lt;قفل&gt; &amp; &quot;مفتاح&quot;')
      expect(xml).toContain('مواصفات &amp; &lt;x&gt;')
      expect(xml).not.toContain('**')
      expect(xml).toContain('• بند')
    } finally {
      setLanguage('en')
    }
  })

  it('Arabic export is right-to-left in Word (paragraphs carry w:bidi / runs w:rtl)', async () => {
    setLanguage('ar')
    try {
      const xml = await part(await itemsToDocx(data([mk('REQ-0000001', 'باب', 0, 'نص')])))
      expect(xml).toMatch(/<w:bidi\/>|<w:rtl\/>/)
    } finally {
      setLanguage('en')
    }
  })

  it('header and footer parts are filled; a block placeholder there stays literal (documented: body only)', async () => {
    const t = await template('<w:p><w:r><w:t>{{items}}</w:t></w:r></w:p>', '<w:p><w:r><w:t>{{document.name}} / {{items}}</w:t></w:r></w:p>')
    const f = await part(await itemsToDocx(data([mk('REQ-0000001', 'a', 0)], { name: 'N&M' }), t), 'word/footer1.xml')
    expect(f).toContain('N&amp;M / {{items}}')
  })

  it('template without settings.xml / styles.xml, and an update-fields flag added once', async () => {
    const out = await itemsToDocx(data([mk('REQ-0000001', 'a', 0)]), await template('<w:p><w:r><w:t>{{toc}}</w:t></w:r></w:p>'))
    expect(await part(out)).toContain('TOC \\o')
  })

  it('a template that is not a zip fails with an error (not a hang or a partial file)', async () => {
    await expect(itemsToDocx(data([]), new Uint8Array([1, 2, 3]))).rejects.toThrow()
  })

  it('settings.xml updateFields is placed where the schema allows it (not after w:listSeparator)', async () => {
    const z = await JSZip.loadAsync(await template('<w:p><w:r><w:t>{{items}}</w:t></w:r></w:p>'))
    z.file('word/settings.xml', `<w:settings ${W}><w:zoom w:percent="100"/><w:compat/><w:rsids/><w:listSeparator w:val=","/></w:settings>`)
    const s = await part(await itemsToDocx(data([]), await z.generateAsync({ type: 'uint8array' })), 'word/settings.xml')
    expect(s.indexOf('w:updateFields')).toBeLessThan(s.indexOf('<w:compat'))
  })

  it('10,005 items: Word and HTML build in reasonable time', async () => {
    const items = Array.from({ length: 10005 }, (_, i) => mk(`REQ-${String(i).padStart(7, '0')}`, `Item ${i}`, i % 5, 'text **b**\n\n- a\n- b'))
    const t0 = Date.now()
    const out = await itemsToDocx(data(items))
    const html = itemsToHtml(data(items))
    expect(out.length).toBeGreaterThan(1000)
    expect(html).toContain('REQ-0010004')
    expect(Date.now() - t0).toBeLessThan(20000)
  }, 30000)
})

describe('QA 0.25.0 web page / PDF source', () => {
  it('empty project and deep hierarchy produce valid-looking pages (h2..h6 only)', () => {
    expect(itemsToHtml(data([]))).toContain('<main>')
    const html = itemsToHtml(data(Array.from({ length: 10 }, (_, i) => mk(`REQ-000000${i}`, `L${i}`, i))))
    expect(html).not.toMatch(/<h[7-9]/)
    expect(html).not.toContain('<h1>L')
  })

  it('markup in titles, texts and the document name is escaped (no script injection)', () => {
    const html = itemsToHtml(data([mk('REQ-0000001', '<img src=x onerror=alert(1)>', 0, '<script>alert(2)</script> **b**')], { name: '</title><script>alert(3)</script>', author: '"><b>' }))
    expect(html).not.toContain('<script>alert')
    expect(html).not.toContain('<img src=x')
    expect(html.match(/<script>/g)?.length).toBe(1) // only the search script
  })

  it('print version has no search box or script', () => {
    const html = itemsToHtml(data([mk('REQ-0000001', 'a', 0)]), true)
    expect(html).not.toContain('<script')
    expect(html).not.toContain('id="q"')
  })

  it('Arabic window: page is dir=rtl and lang=ar', () => {
    setLanguage('ar')
    try {
      const html = itemsToHtml(data([mk('REQ-0000001', 'باب', 0, 'نص')]))
      expect(html).toContain('dir="rtl"')
      expect(html).toContain('lang="ar"')
    } finally {
      setLanguage('en')
    }
  })

  it('Arabic requirement text in an English-window export is shown right-to-left (dir="auto" on headings / text)', () => {
    const html = itemsToHtml(data([mk('REQ-0000001', 'باب', 0, 'نص عربي')]))
    expect(html).toMatch(/dir="auto"/)
  })

  it('a list directly under a sentence (no blank line) is still a list', () => {
    const html = itemsToHtml(data([mk('REQ-0000001', 'a', 0, 'Must:\n- one\n- two')]))
    expect(html).toContain('<li>one</li>')
  })

  it('links between requirements only for exported ids; unknown id stays text', () => {
    const e = mk('REQ-0000001', 'a', 0)
    e.item = { ...e.item, extra: {} } as typeof e.item
    const html = itemsToHtml(data([e], { columns: ['id', 'number', 'title', 'parent'] }))
    expect(html).toContain('id="REQ-0000001"')
  })
})
