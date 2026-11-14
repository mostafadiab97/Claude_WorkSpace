// Word, PDF and HTML documents (0.25.0; decisions P-17 … P-19, P-39): one specification document out of the items.
//  - HTML: one self-contained file (styles inside, clickable links between requirements, a search box) — also the
//    source the main process prints to PDF.
//  - Word: the team's template (requirements/.reqochet/templates/<name>.docx, built e.g. with
//    docs/guides/word-template-prompt.md) or a plain built-in one; the placeholders {{document.name}}, {{toc}},
//    {{items}}, … are filled in and the template's own styles ("Heading 1" … "Heading 6", "RM Requirement Text",
//    "RM Attribute Table", "RM Trace Table") give the look.
import JSZip from 'jszip'
import type { Schema } from '../../shared/domain'
import { getLanguage, T } from '../../shared/text'
import { cell, header, type ExportColumn, type ExportItem } from './items'

/** One row of the traceability table: a link from an exported item. */
export interface TraceRow {
  source: string
  sourceTitle: string
  type: string
  target: string
  targetTitle: string
  suspect: boolean
}

export interface DocumentData {
  schema: Schema
  /** The document's (specification's) name. */
  name: string
  /** Baseline name, or empty for the working copy. */
  baseline: string
  commit: string
  date: string
  author: string
  items: ExportItem[]
  columns: ExportColumn[]
  /** The traceability table at the end; empty = none. */
  trace: TraceRow[]
  /** Baselines of the project, newest first (revision history). */
  revisions: { name: string; date: string; commit: string }[]
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const isRequirement = (d: DocumentData, type: string): boolean => d.schema.itemTypes.find((t) => t.id === type)?.requirement !== false
/** The attribute rows of one item: the chosen columns except title, number and text (they are the heading and body). */
const facts = (d: DocumentData, e: ExportItem): [string, string][] =>
  d.columns
    .filter((c) => c !== 'title' && c !== 'number' && c !== 'text' && c !== 'level' && c !== 'parent')
    .map((c) => [header(d.schema, c) ?? c, cell(d.schema, e, c)] as [string, string])
    .filter(([, v]) => v !== '')
const headingText = (d: DocumentData, e: ExportItem): string => `${e.item.number ? `${e.item.number} ` : ''}${e.item.title || T.docExport.noTitle}`

// ───────────────────────── HTML (and PDF) ─────────────────────────

/** Markdown of an item's text to safe HTML: paragraphs, "- " lists, **bold**; raw HTML is shown as text. */
function mdToHtml(md: string): string {
  const inline = (s: string): string => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>')
  return md
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .filter((b) => b.trim() !== '')
    .map((b) => {
      const lines = b.split('\n')
      if (lines.every((l) => /^\s*[-*] /.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ''))}</li>`).join('')}</ul>`
      return `<p>${lines.map(inline).join('<br>')}</p>`
    })
    .join('')
}

/**
 * One self-contained HTML document. With `print` (the source of the PDF) there is no search box and links stay as text
 * styling only; otherwise requirement IDs in the attribute table and the trace table jump to the item.
 */
export function itemsToHtml(d: DocumentData, print = false): string {
  const t = T.docExport
  const ids = new Set(d.items.map((e) => e.item.id))
  const linkIds = (text: string): string => esc(text).replace(/\b([A-Z][A-Z0-9]*-[0-9A-Z]{4,})\b/g, (m) => (ids.has(m) && !print ? `<a href="#${m}">${m}</a>` : m))
  const toc = d.items
    .filter((e) => e.depth < 3)
    .map((e) => `<li class="toc${e.depth}"><a href="#${esc(e.item.id)}">${esc(headingText(d, e))}</a></li>`)
    .join('')
  const body = d.items
    .map((e) => {
      const h = Math.min(6, e.depth + 2)
      const rows = isRequirement(d, e.item.type) ? facts(d, e) : []
      const table = rows.length > 0 ? `<table class="attrs">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${linkIds(v)}</td></tr>`).join('')}</table>` : ''
      const text = d.columns.includes('text') && e.item.text.trim() ? `<div class="text">${mdToHtml(e.item.text)}</div>` : ''
      return `<section class="item" id="${esc(e.item.id)}"><h${h}>${esc(headingText(d, e))}</h${h}>${text}${table}</section>`
    })
    .join('\n')
  const trace =
    d.trace.length > 0
      ? `<h2 class="break">${esc(t.trace)}</h2><table class="trace"><thead><tr><th>${esc(t.item)}</th><th>${esc(t.link)}</th><th>${esc(t.target)}</th><th>${esc(t.suspect)}</th></tr></thead><tbody>${d.trace
          .map((r) => `<tr><td>${linkIds(r.source)} ${esc(r.sourceTitle)}</td><td>${esc(r.type)}</td><td>${linkIds(r.target)} ${esc(r.targetTitle)}</td><td>${r.suspect ? esc(t.yes) : ''}</td></tr>`)
          .join('')}</tbody></table>`
      : ''
  const search = print
    ? ''
    : `<input id="q" type="search" placeholder="${esc(t.search)}" aria-label="${esc(t.search)}"><script>document.getElementById('q').addEventListener('input',function(){var q=this.value.toLowerCase();document.querySelectorAll('section.item').forEach(function(s){s.style.display=!q||s.textContent.toLowerCase().indexOf(q)>=0?'':'none'})})</script>`
  return `<!doctype html>
<html lang="${esc(langOf())}" dir="${langOf() === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(d.name)}</title>
<style>
body{font-family:"Segoe UI",system-ui,sans-serif;color:#1b1f27;max-width:900px;margin:0 auto;padding:24px;line-height:1.45}
.title{border-bottom:2px solid #2f5bd3;padding-bottom:12px;margin-bottom:24px}.title h1{margin:0 0 8px;font-size:28px}
.meta{color:#566070;font-size:14px}.meta span{margin-inline-end:16px}
#q{width:100%;padding:8px 10px;font:inherit;border:1px solid #7f8898;border-radius:6px;margin:8px 0 16px}
nav ul{list-style:none;padding:0}nav li{margin:2px 0}.toc1{padding-inline-start:16px}.toc2{padding-inline-start:32px}
a{color:#2f5bd3;text-decoration:none}a:hover{text-decoration:underline}
h2{font-size:22px;margin-top:28px}h3{font-size:18px}h4,h5,h6{font-size:16px}
.item{break-inside:avoid-page}.text p{margin:6px 0}
table{border-collapse:collapse;width:100%;margin:8px 0 16px;font-size:13px}th,td{border:1px solid #d5dae2;padding:4px 8px;text-align:start;vertical-align:top}
.attrs th{width:28%;background:#f2f4f7;font-weight:600}.trace thead th{background:#f2f4f7}
@media print{#q,nav{display:none}.break{break-before:page}a{color:inherit}}
</style></head><body>
<header class="title"><h1>${esc(d.name)}</h1><div class="meta"><span>${esc(t.baseline)}: ${esc(d.baseline || t.workingCopy)}</span><span>${esc(t.commit)}: ${esc(d.commit || '—')}</span><span>${esc(t.date)}: ${esc(d.date)}</span>${d.author ? `<span>${esc(t.author)}: ${esc(d.author)}</span>` : ''}</div></header>
${search}
${print ? '' : `<nav aria-label="${esc(t.contents)}"><h2>${esc(t.contents)}</h2><ul>${toc}</ul></nav>`}
<main>
${body}
${trace}
</main>
<footer class="meta"><p>${esc(t.madeWith(d.date))}</p></footer>
</body></html>
`
}

/** The language the words are in (the document follows the window language). */
function langOf(): string {
  return getLanguage()
}

// ───────────────────────── Word ─────────────────────────

const xmlEsc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** Styles by their (language-independent) name → the template's style id ("heading 1" → "Heading1" or "berschrift1"). */
type StyleIds = (name: string) => string

function run(text: string, rPr = ''): string {
  // Word keeps line breaks inside a run as <w:br/>
  return text
    .split('\n')
    .map((part, i) => `${i > 0 ? '<w:br/>' : ''}<w:r>${rPr}<w:t xml:space="preserve">${xmlEsc(part)}</w:t></w:r>`)
    .join('')
}
const para = (style: string | null, inner: string): string => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${xmlEsc(style)}"/></w:pPr>` : ''}${inner}</w:p>`

function table(ids: StyleIds, styleName: string, rows: string[][], headerRow: boolean): string {
  const cols = Math.max(1, ...rows.map((r) => r.length))
  const grid = Array.from({ length: cols }, () => `<w:gridCol w:w="${Math.floor(9000 / cols)}"/>`).join('')
  const trs = rows
    .map((r, i) => `<w:tr>${i === 0 && headerRow ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${r.map((c, j) => `<w:tc><w:tcPr><w:tcW w:w="${Math.floor(9000 / cols)}" w:type="dxa"/></w:tcPr>${para(null, run(c, (i === 0 && headerRow) || (!headerRow && j === 0) ? '<w:rPr><w:b/></w:rPr>' : ''))}</w:tc>`).join('')}</w:tr>`)
    .join('')
  return `<w:tbl><w:tblPr><w:tblStyle w:val="${xmlEsc(ids(styleName))}"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="BFC5CF"/><w:left w:val="single" w:sz="4" w:color="BFC5CF"/><w:bottom w:val="single" w:sz="4" w:color="BFC5CF"/><w:right w:val="single" w:sz="4" w:color="BFC5CF"/><w:insideH w:val="single" w:sz="4" w:color="BFC5CF"/><w:insideV w:val="single" w:sz="4" w:color="BFC5CF"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${trs}</w:tbl>${para(null, '')}`
}

/** Markdown of an item's text to Word paragraphs in the "RM Requirement Text" style (lists as "• "). */
function mdToDocx(ids: StyleIds, md: string): string {
  return md
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .filter((b) => b.trim() !== '')
    .flatMap((b) => {
      const lines = b.split('\n')
      if (lines.every((l) => /^\s*[-*] /.test(l))) return lines.map((l) => para(ids('RM Requirement Text'), run(`• ${l.replace(/^\s*[-*] /, '').replace(/\*\*/g, '')}`)))
      return [para(ids('RM Requirement Text'), run(lines.join('\n').replace(/\*\*/g, '')))]
    })
    .join('')
}

/** The block placeholders: each fills a whole paragraph of the template. */
function blocks(d: DocumentData, ids: StyleIds): Record<string, string> {
  const t = T.docExport
  const items = d.items
    .map((e) => {
      const level = Math.min(6, e.depth + 1)
      const rows = isRequirement(d, e.item.type) ? facts(d, e) : []
      const text = d.columns.includes('text') && e.item.text.trim() ? mdToDocx(ids, e.item.text) : ''
      return para(ids(`heading ${level}`), run(headingText(d, e))) + text + (rows.length > 0 ? table(ids, 'RM Attribute Table', rows, false) : '')
    })
    .join('')
  const toc = `<w:p><w:pPr><w:pStyle w:val="${xmlEsc(ids('TOC Heading'))}"/></w:pPr>${run(t.contents)}</w:p><w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-6" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${run(t.tocHint)}<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`
  const trace = d.trace.length > 0 ? para(ids('heading 1'), run(t.trace)) + table(ids, 'RM Trace Table', [[t.item, t.link, t.target, t.suspect], ...d.trace.map((r) => [`${r.source} ${r.sourceTitle}`, r.type, `${r.target} ${r.targetTitle}`, r.suspect ? t.yes : ''])], true) : ''
  const revisions = d.revisions.length > 0 ? table(ids, 'RM Trace Table', [[t.baseline, t.date, t.commit], ...d.revisions.map((r) => [r.name, r.date, r.commit])], true) : ''
  return { toc, items, 'trace.table': trace, 'revision.history': revisions }
}

/** The inline placeholders, as text. */
function inlines(d: DocumentData): Record<string, string> {
  return { 'document.name': d.name, 'document.number': '', baseline: d.baseline || T.docExport.workingCopy, commit: d.commit || '—', date: d.date, author: d.author }
}

/** Fills one XML part (body, header or footer): block placeholders replace their paragraph, inline ones their text. */
export function fillPart(xml: string, block: Record<string, string>, inline: Record<string, string>): string {
  return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (p) => {
    const texts = [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1] ?? '')
    const text = texts.join('')
    if (!text.includes('{{')) return p
    const only = /^\s*\{\{\s*([\w.]+)\s*\}\}\s*$/.exec(text)
    if (only && only[1] && only[1] in block) return block[only[1]] ?? ''
    const fill = (x: string): string => x.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key: string) => (key in inline ? xmlEsc(inline[key] ?? '') : m))
    // a placeholder inside one run: replace it there, so fields (page numbers) and other runs stay as they are
    const inPlace = p.replace(/(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)/g, (_m, o: string, x: string, c: string) => o + fill(x) + c)
    const left = [...inPlace.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1] ?? '').join('')
    if (![...left.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].some((m) => (m[1] ?? '') in inline)) return inPlace
    // Word split a placeholder over several runs: put the filled text into the first run (keeping its formatting)
    const plain = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    const filled = plain.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key: string) => (key in inline ? (inline[key] ?? '') : m))
    const pPr = /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(p)?.[0] ?? ''
    const rPr = /<w:r(?:\s[^>]*)?>\s*(<w:rPr>[\s\S]*?<\/w:rPr>)/.exec(p)?.[1] ?? ''
    const open = /^<w:p[^>]*>/.exec(p)?.[0] ?? '<w:p>'
    return `${open}${pPr}${run(filled, rPr)}</w:p>`
  })
}

/** Style name → id from the template's styles.xml (built-in names are lower-case English in every Word language). */
function styleIds(stylesXml: string): StyleIds {
  const map = new Map<string, string>()
  for (const m of stylesXml.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>[\s\S]*?<w:name w:val="([^"]+)"/g)) if (m[1] && m[2]) map.set(m[2].toLowerCase(), m[1])
  return (name) => map.get(name.toLowerCase()) ?? name.replace(/\s+/g, '')
}

/**
 * The Word document: the template (or the built-in one) with every placeholder filled. Word is asked to update the
 * table of contents when the file opens (settings.xml updateFields).
 */
export async function itemsToDocx(d: DocumentData, template?: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(template ?? (await defaultTemplate()))
  const styles = (await zip.file('word/styles.xml')?.async('string')) ?? ''
  const ids = styleIds(styles)
  const block = blocks(d, ids)
  const inline = inlines(d)
  for (const name of Object.keys(zip.files)) {
    if (!/^word\/(document|header\d*|footer\d*)\.xml$/.test(name)) continue
    const xml = await zip.file(name)?.async('string')
    if (xml !== undefined) zip.file(name, fillPart(xml, name === 'word/document.xml' ? block : {}, inline))
  }
  const settings = await zip.file('word/settings.xml')?.async('string')
  if (settings !== undefined && !settings.includes('w:updateFields')) zip.file('word/settings.xml', settings.replace(/<\/w:settings>\s*$/, '<w:updateFields w:val="true"/></w:settings>'))
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}

/** reqochet's plain built-in template: title page, contents, the items, the trace table; page numbers in the footer. */
async function defaultTemplate(): Promise<Uint8Array> {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
  const t = T.docExport
  const style = (id: string, name: string, extra: string, type = 'paragraph'): string => `<w:style w:type="${type}" w:styleId="${id}"><w:name w:val="${name}"/>${type === 'paragraph' ? '<w:basedOn w:val="Normal"/>' : ''}${extra}</w:style>`
  const heading = (n: number, size: number): string => style(`Heading${n}`, `heading ${n}`, `<w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${n === 1 ? 360 : 240}" w:after="120"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:color w:val="1B1F27"/><w:sz w:val="${size}"/></w:rPr>`)
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>${style('Normal', 'Normal', '<w:qFormat/>').replace('<w:basedOn w:val="Normal"/>', '')}${style('Title', 'Title', '<w:rPr><w:b/><w:sz w:val="48"/></w:rPr>')}${heading(1, 32)}${heading(2, 28)}${heading(3, 24)}${heading(4, 22)}${heading(5, 22)}${heading(6, 22)}${style('TOCHeading', 'TOC Heading', '<w:rPr><w:b/><w:sz w:val="32"/></w:rPr>')}${style('RMRequirementText', 'RM Requirement Text', '<w:pPr><w:ind w:left="0"/></w:pPr>')}${style('RMAttributeTable', 'RM Attribute Table', '<w:rPr><w:sz w:val="18"/></w:rPr>', 'table')}${style('RMTraceTable', 'RM Trace Table', '<w:rPr><w:sz w:val="18"/></w:rPr>', 'table')}</w:styles>`
  const p = (style: string, text: string): string => `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`
  const brk = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${p('Title', '{{document.name}}')}${p('Normal', `${t.baseline}: {{baseline}}`)}${p('Normal', `${t.commit}: {{commit}}`)}${p('Normal', `${t.date}: {{date}}`)}${p('Normal', `${t.author}: {{author}}`)}${brk}${p('Normal', '{{toc}}')}${brk}${p('Normal', '{{items}}')}${p('Normal', '{{trace.table}}')}<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`
  const [before, after] = t.pageOf('\u0001', '\u0002').split('\u0001') as [string, string]
  const [middle, end] = after.split('\u0002') as [string, string]
  const field = (code: string): string => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${code} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`
  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${W}><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t xml:space="preserve">{{document.name}} · ${xmlEsc(before)}</w:t></w:r>${field('PAGE')}<w:r><w:t xml:space="preserve">${xmlEsc(middle)}</w:t></w:r>${field('NUMPAGES')}<w:r><w:t xml:space="preserve">${xmlEsc(end)}</w:t></w:r></w:p></w:ftr>`
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>')
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>')
  zip.file('word/document.xml', documentXml)
  zip.file('word/styles.xml', stylesXml)
  zip.file('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings ${W}></w:settings>`)
  zip.file('word/footer1.xml', footerXml)
  return zip.generateAsync({ type: 'uint8array' })
}
