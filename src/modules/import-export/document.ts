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
/** The heading: outline number and title; without the number when the Word template numbers its headings itself (C4). */
const headingText = (d: DocumentData, e: ExportItem, numbered = true): string => `${numbered && e.item.number ? `${e.item.number} ` : ''}${e.item.title || T.docExport.noTitle}`

// ───────────────────────── HTML (and PDF) ─────────────────────────

const LIST = /^\s*[-*] /
const TABLE_ROW = /^\s*\|.*\|\s*$/
type Kind = 'text' | 'list' | 'table'
/**
 * Lines split into runs of list lines, table lines and other lines (a list may follow a sentence without a blank line —
 * QA Q9; Markdown tables "| a | b |" become real tables — the owner, 0.25.0 test 4).
 */
function groups(lines: string[]): { kind: Kind; lines: string[] }[] {
  const out: { kind: Kind; lines: string[] }[] = []
  for (const l of lines) {
    const kind: Kind = LIST.test(l) ? 'list' : TABLE_ROW.test(l) ? 'table' : 'text'
    const last = out[out.length - 1]
    if (last && last.kind === kind) last.lines.push(l)
    else out.push({ kind, lines: [l] })
  }
  // a single "| … |" line is text, not a table
  return out.map((g) => (g.kind === 'table' && g.lines.length < 2 ? { ...g, kind: 'text' } : g))
}

/** A Markdown table: its rows of cells, and whether the first row is a header (a "| --- |" line under it). */
function tableRows(lines: string[]): { rows: string[][]; header: boolean } {
  const cells = (l: string): string[] => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
  const isRule = (l: string): boolean => cells(l).every((c) => /^:?-{3,}:?$/.test(c))
  const header = lines.length > 1 && isRule(lines[1] ?? '')
  const rows = lines.filter((l) => !isRule(l)).map(cells)
  const width = Math.max(...rows.map((r) => r.length))
  return { rows: rows.map((r) => [...r, ...Array<string>(Math.max(0, width - r.length)).fill('')]), header }
}

/** How many heading levels the contents list shows: three, or fewer for a big document (the owner, 0.25.0 test 4). */
const TOC_MAX_LINES = 400
function tocLevels(d: DocumentData): number {
  for (const k of [3, 2]) if (d.items.filter((e) => e.depth < k).length <= TOC_MAX_LINES) return k
  return 1
}

/** Markdown of an item's text to safe HTML: paragraphs, "- " lists, **bold**; raw HTML is shown as text. */
function mdToHtml(md: string): string {
  const inline = (s: string): string => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>')
  return md
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .filter((b) => b.trim() !== '')
    .flatMap((b) => groups(b.split('\n')))
    .map(({ kind, lines }) => {
      if (kind === 'list') return `<ul>${lines.map((l) => `<li>${inline(l.replace(LIST, ''))}</li>`).join('')}</ul>`
      if (kind === 'text') return `<p>${lines.map(inline).join('<br>')}</p>`
      const { rows, header } = tableRows(lines)
      const [head, ...rest] = rows
      const th = header && head ? `<thead><tr>${head.map((c) => `<th scope="col">${inline(c)}</th>`).join('')}</tr></thead>` : ''
      const tds = (header ? rest : rows).map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')
      return `<table class="md">${th}<tbody>${tds}</tbody></table>`
    })
    .join('')
}

/**
 * One self-contained HTML document; requirement IDs in the attribute and trace tables jump to the item. With `print`
 * (the source of the PDF) there is no search box and no script, and the title and contents get pages of their own, like
 * the Word document (UI review 0.25.0 U1); the PDF keeps the links.
 */
export function itemsToHtml(d: DocumentData, print = false): string {
  const t = T.docExport
  const ids = new Set(d.items.map((e) => e.item.id))
  const linkIds = (text: string): string => esc(text).replace(/\b([A-Z][A-Z0-9]*-[0-9A-Z]{4,})\b/g, (m) => (ids.has(m) ? `<a href="#${m}">${m}</a>` : m))
  const levels = tocLevels(d)
  const toc = d.items
    .filter((e) => e.depth < levels)
    .map((e) => `<li class="toc${e.depth}"><a href="#${esc(e.item.id)}">${esc(headingText(d, e))}</a></li>`)
    .join('')
  const body = d.items
    .map((e) => {
      const h = Math.min(6, e.depth + 2)
      const rows = isRequirement(d, e.item.type) ? facts(d, e) : []
      const table = rows.length > 0 ? `<table class="attrs">${rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${linkIds(v)}</td></tr>`).join('')}</table>` : ''
      const text = d.columns.includes('text') && e.item.text.trim() ? `<div class="text" dir="auto">${mdToHtml(e.item.text)}</div>` : ''
      return `<section class="item" id="${esc(e.item.id)}"><h${h} dir="auto">${esc(headingText(d, e))}</h${h}>${text}${table}</section>`
    })
    .join('\n')
  const trace =
    d.trace.length > 0
      ? `<h2 class="break">${esc(t.trace)}</h2><table class="trace"><thead><tr><th scope="col">${esc(t.item)}</th><th scope="col">${esc(t.link)}</th><th scope="col">${esc(t.target)}</th><th scope="col">${esc(t.suspect)}</th></tr></thead><tbody>${d.trace
          .map((r) => `<tr><td>${linkIds(r.source)} ${esc(r.sourceTitle)}</td><td>${esc(r.type)}</td><td>${linkIds(r.target)} ${esc(r.targetTitle)}</td><td>${r.suspect ? esc(t.yes) : ''}</td></tr>`)
          .join('')}</tbody></table>`
      : ''
  const search = print
    ? ''
    : `<input id="q" type="search" placeholder="${esc(t.search)}" aria-label="${esc(t.search)}"><p id="n" class="meta" aria-live="polite"></p><script>var F=${JSON.stringify(t.found('{n}')).replace(/</g, '\\u003c')},N=${JSON.stringify(t.nothingFound).replace(/</g, '\\u003c')};document.getElementById('q').addEventListener('input',function(){var q=this.value.toLowerCase(),c=0;document.querySelectorAll('section.item').forEach(function(s){var on=!q||s.textContent.toLowerCase().indexOf(q)>=0;s.style.display=on?'':'none';if(on)c++});document.getElementById('n').textContent=q?(c?F.replace('{n}',c):N):''})</script>`
  return `<!doctype html>
<html lang="${esc(langOf())}" dir="${langOf() === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(d.name)}</title>
<style>
body{font-family:"Segoe UI",system-ui,sans-serif;color:#1b1f27;max-width:900px;margin:0 auto;padding:24px;line-height:1.45}
.title{border-bottom:2px solid #2f5bd3;padding-bottom:12px;margin-bottom:24px}.title h1{margin:0 0 8px;font-size:28px}
.meta{color:#566070;font-size:14px}.meta span{margin-inline-end:16px}
#q{width:100%;padding:8px 10px;font:inherit;border:1px solid #7f8898;border-radius:6px;margin:8px 0 16px}
nav ul{list-style:none;padding:0}nav li{margin:2px 0}.toc1{padding-inline-start:16px}.toc2{padding-inline-start:32px}
a{color:#2f5bd3;text-decoration:underline;text-underline-offset:2px}nav a{text-decoration:none}nav a:hover,nav a:focus{text-decoration:underline}
h2{font-size:22px;margin-top:28px}h3{font-size:18px}h4,h5,h6{font-size:16px}
.item{break-inside:avoid-page}.text p{margin:6px 0}
table{border-collapse:collapse;width:100%;margin:8px 0 16px;font-size:13px}th,td{border:1px solid #d5dae2;padding:4px 8px;text-align:start;vertical-align:top}
.md th{background:#f2f4f7;font-weight:600}.attrs th{width:28%;background:#f2f4f7;font-weight:600}.trace thead th{background:#f2f4f7}
@media print{.break{break-before:page}a{color:inherit}.title{border:0;padding-top:30vh}.title h1{font-size:34px}nav{break-before:page;break-after:page}}
</style></head><body>
<header class="title"><h1>${esc(d.name)}</h1><div class="meta"><span>${esc(t.baseline)}: ${esc(d.baseline || t.workingCopy)}</span><span>${esc(t.commit)}: ${esc(d.commit || '—')}</span><span>${esc(t.date)}: ${esc(d.date)}</span>${d.author ? `<span>${esc(t.author)}: ${esc(d.author)}</span>` : ''}</div></header>
${search}
<nav aria-label="${esc(t.contents)}"><h2>${esc(t.contents)}</h2><ul>${toc}</ul>${
    d.revisions.length > 0
      ? `<h2>${esc(t.revisionHistory)}</h2><table class="trace"><thead><tr><th scope="col">${esc(t.baseline)}</th><th scope="col">${esc(t.date)}</th><th scope="col">${esc(t.commit)}</th></tr></thead><tbody>${d.revisions.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.date)}</td><td>${esc(r.commit)}</td></tr>`).join('')}</tbody></table>`
      : ''
  }</nav>
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

// characters XML 1.0 forbids are dropped (Word would call the file corrupt — security review 0.25.0 S-05, as in ReqIF)
// eslint-disable-next-line no-control-regex -- the characters XML 1.0 forbids
const xmlEsc = (s: string): string => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** Styles by their (language-independent) name → the template's style id ("heading 1" → "Heading1" or "berschrift1"). */
type StyleIds = ((name: string) => string) & { has?: (name: string) => boolean }

function run(text: string, rPr = ''): string {
  // Word keeps line breaks inside a run as <w:br/>
  return text
    .split('\n')
    // the break belongs inside a run: <w:br/> directly in a paragraph makes Word refuse the file (the owner, 0.25.0 test 3)
    .map((part, i) => `<w:r>${rPr}${i > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${xmlEsc(part)}</w:t></w:r>`)
    .join('')
}
/** Arabic: paragraphs and tables run right to left (Arabic review 0.25.0 A-01); the window language decides. */
const rtl = (): boolean => getLanguage() === 'ar'
const para = (style: string | null, inner: string): string => {
  const pPr = `${style ? `<w:pStyle w:val="${xmlEsc(style)}"/>` : ''}${rtl() ? '<w:bidi/>' : ''}`
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${inner}</w:p>`
}

function table(ids: StyleIds, styleName: string, rows: string[][], headerRow: boolean, boldFirstColumn = !headerRow): string {
  const cols = Math.max(1, ...rows.map((r) => r.length))
  const grid = Array.from({ length: cols }, () => `<w:gridCol w:w="${Math.floor(9000 / cols)}"/>`).join('')
  const trs = rows
    .map((r, i) => `<w:tr>${i === 0 && headerRow ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${r.map((c, j) => `<w:tc><w:tcPr><w:tcW w:w="${Math.floor(9000 / cols)}" w:type="dxa"/></w:tcPr>${para(null, run(c, (i === 0 && headerRow) || (boldFirstColumn && j === 0) ? '<w:rPr><w:b/><w:bCs/></w:rPr>' : ''))}</w:tc>`).join('')}</w:tr>`)
    .join('')
  return `<w:tbl><w:tblPr><w:tblStyle w:val="${xmlEsc(ids(styleName))}"/>${rtl() ? '<w:bidiVisual/>' : ''}<w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="BFC5CF"/><w:left w:val="single" w:sz="4" w:color="BFC5CF"/><w:bottom w:val="single" w:sz="4" w:color="BFC5CF"/><w:right w:val="single" w:sz="4" w:color="BFC5CF"/><w:insideH w:val="single" w:sz="4" w:color="BFC5CF"/><w:insideV w:val="single" w:sz="4" w:color="BFC5CF"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${trs}</w:tbl>${para(null, '')}`
}

/** **bold** markers are dropped in Word (plain text first, O-2); a lone "**" ("2 ** 3") stays. */
const bold = (s: string): string => s.replace(/\*\*(.+?)\*\*/g, '$1')

/** Markdown of an item's text to Word paragraphs in the "RM Requirement Text" style (lists as "• "). */
function mdToDocx(ids: StyleIds, md: string): string {
  return md
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .filter((b) => b.trim() !== '')
    .flatMap((b) => groups(b.split('\n')))
    .flatMap(({ kind, lines }) => {
      if (kind === 'list') return lines.map((l) => para(ids('RM Requirement Text'), run(`• ${bold(l.replace(LIST, ''))}`)))
      if (kind === 'text') return [para(ids('RM Requirement Text'), run(bold(lines.join('\n'))))]
      const { rows, header } = tableRows(lines)
      return [table(ids, 'RM Attribute Table', rows.map((r) => r.map(bold)), header, false)]
    })
    .join('')
}

/** A company template is a few hundred KB; these limits only stop broken or hostile files. */
const MAX_TEMPLATE_BYTES = 20_000_000
const MAX_TEMPLATE_UNPACKED = 100_000_000

/** The block placeholders: each fills a whole paragraph of the template. */
function blocks(d: DocumentData, ids: StyleIds, ownNumbers = true): Record<string, string> {
  const t = T.docExport
  const items = d.items
    .map((e) => {
      const level = Math.min(6, e.depth + 1)
      const rows = isRequirement(d, e.item.type) ? facts(d, e) : []
      const text = d.columns.includes('text') && e.item.text.trim() ? mdToDocx(ids, e.item.text) : ''
      // deeper than the template's headings go: its deepest heading (QA Q6)
      let use = level
      while (use > 1 && ids.has && !ids.has(`heading ${use}`)) use--
      if (ids.has && !ids.has(`heading ${use}`)) use = level
      return para(ids(`heading ${use}`), run(headingText(d, e, ownNumbers))) + text + (rows.length > 0 ? table(ids, 'RM Attribute Table', rows, false) : '')
    })
    .join('')
  const toc = `${para(ids('TOC Heading'), run(t.contents))}<w:p>${rtl() ? '<w:pPr><w:bidi/></w:pPr>' : ''}<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-${tocLevels(d)}" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${run(t.tocHint)}<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`
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
  return eachParagraph(xml, (p) => {
    const texts = [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1] ?? '')
    const text = texts.join('')
    if (!text.includes('{{')) return p
    const has = (o: Record<string, string>, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k) // not "toString" (QA Q1)
    const only = /^\s*\{\{\s*([\w.]+)\s*\}\}\s*$/.exec(text)
    // an empty block keeps an empty paragraph: a table cell must hold one (QA Q4)
    if (only && only[1] && has(block, only[1])) return block[only[1]] || '<w:p></w:p>'
    // Word splits text into runs freely: a placeholder spread over several text nodes is first moved into the first of
    // them, so every other run — fields (page numbers), tabs, pictures, hyperlinks — stays as it is (QA Q3)
    const nodes = [...p.matchAll(/(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)/g)].map((m) => ({ at: m.index ?? 0, whole: m[0], open: m[1] ?? '', text: m[2] ?? '' }))
    const starts: number[] = []
    let pos = 0
    for (const n of nodes) {
      starts.push(pos)
      pos += n.text.length
    }
    const nodeAt = (c: number): number => {
      let k = 0
      while (k + 1 < nodes.length && (starts[k + 1] ?? Infinity) <= c) k++
      return k
    }
    const spans = [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].filter((m) => has(inline, m[1] ?? '')).reverse()
    for (const m of spans) {
      const a = m.index ?? 0
      const b = a + m[0].length
      const first = nodeAt(a)
      const last = nodeAt(b - 1)
      if (first === last) continue
      const f = nodes[first]
      const l = nodes[last]
      if (!f || !l) continue
      f.text = f.text.slice(0, a - (starts[first] ?? 0)) + m[0]
      for (let k = first + 1; k < last; k++) {
        const n = nodes[k]
        if (n) n.text = ''
      }
      l.text = l.text.slice(b - (starts[last] ?? 0))
    }
    const fill = (x: string): string => x.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key: string) => (has(inline, key) ? xmlEsc(inline[key] ?? '') : m))
    let out = ''
    let at = 0
    for (const n of nodes) {
      const filled = fill(n.text)
      const same = filled === n.whole.slice(n.open.length, -6)
      const open = n.open.includes('xml:space') || !/^\s|\s$/.test(filled) ? n.open : n.open.replace(/>$/, ' xml:space="preserve">')
      out += p.slice(at, n.at) + (same ? n.whole : `${open}${filled}</w:t>`)
      at = n.at + n.whole.length
    }
    return out + p.slice(at)
  })
}

/**
 * Calls `fill` for every paragraph (<w:p …>…</w:p>) and keeps the rest. A plain scan, not a lazy regex: a hostile
 * template with opening tags but no closing ones must not take quadratic time (security review 0.25.0 S-01).
 */
function eachParagraph(xml: string, fill: (p: string) => string): string {
  /** The next opening (not self-closing) <w:p> or closing </w:p> from `from`, or -1. */
  const nextTag = (from: number): { at: number; open: boolean; end: number } | null => {
    for (let k = xml.indexOf('<', from); k >= 0; k = xml.indexOf('<', k + 1)) {
      if (xml.startsWith('</w:p>', k)) return { at: k, open: false, end: k + 6 }
      if (xml.startsWith('<w:p', k) && (xml[k + 4] === ' ' || xml[k + 4] === '>' || xml[k + 4] === '/')) {
        const close = xml.indexOf('>', k)
        if (close < 0) return null
        if (xml[close - 1] !== '/') return { at: k, open: true, end: close + 1 }
      }
    }
    return null
  }
  let out = ''
  let at = 0
  for (;;) {
    let first = nextTag(at)
    while (first && !first.open) first = nextTag(first.end) // a stray </w:p>: keep it as it is
    if (!first) break
    // find the matching </w:p>: a text box holds paragraphs inside a paragraph (code review 0.25.0 C1)
    let depth = 1
    let nested = false
    let tag = nextTag(first.end)
    while (tag && depth > 0) {
      depth += tag.open ? 1 : -1
      if (tag.open) nested = true
      if (depth > 0) tag = nextTag(tag.end)
    }
    if (!tag) break
    const whole = xml.slice(first.at, tag.end)
    // a paragraph holding a text box: fill the text box's own paragraphs, leave the outer one's runs alone
    out += xml.slice(at, first.at) + (nested ? xml.slice(first.at, first.end) + eachParagraph(xml.slice(first.end, tag.at), fill) + '</w:p>' : fill(whole))
    at = tag.end
  }
  return out + xml.slice(at)
}

/** Style name → id from the template's styles.xml (built-in names are lower-case English in every Word language). */
function styleIds(stylesXml: string): StyleIds {
  const map = new Map<string, string>()
  // one style at a time (split, not a lazy regex over the whole file — S-01)
  for (const part of stylesXml.split('<w:style ').slice(1)) {
    const body = part.slice(0, Math.max(0, part.indexOf('</w:style>')) || part.length)
    const id = /^[^>]*w:styleId="([^"]+)"/.exec(body)?.[1]
    const name = /<w:name w:val="([^"]+)"/.exec(body)?.[1]
    if (id && name) map.set(name.toLowerCase(), id)
  }
  // a style the template lacks: Word's own id for the built-in style ("heading 6" → "Heading6") — QA Q6
  const ids: StyleIds = (name) => map.get(name.toLowerCase()) ?? name.replace(/(^|\s+)(\w)/g, (_m, _s: string, c: string) => c.toUpperCase())
  ids.has = (name) => map.has(name.toLowerCase())
  return ids
}

/**
 * The Word document: the template (or the built-in one) with every placeholder filled. Word is asked to update the
 * table of contents when the file opens (settings.xml updateFields).
 */
export async function itemsToDocx(d: DocumentData, template?: Uint8Array): Promise<Uint8Array> {
  if (template && template.length > MAX_TEMPLATE_BYTES) throw new Error(T.docExport.templateTooBig(MAX_TEMPLATE_BYTES / 1_000_000))
  const zip = await JSZip.loadAsync(template ?? (await defaultTemplate()))
  // a part may unpack to far more than the file (zip bomb, S-02): the sizes written in the archive are checked first
  let total = 0
  for (const f of Object.values(zip.files)) total += (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0
  if (total > MAX_TEMPLATE_UNPACKED) throw new Error(T.docExport.templateTooBig(MAX_TEMPLATE_BYTES / 1_000_000))
  // a template's link to a file elsewhere (attachedTemplate, linked pictures) would leak into every shared export (S-03)
  for (const name of Object.keys(zip.files)) {
    if (!name.endsWith('.rels')) continue
    const rels = await zip.file(name)?.async('string')
    if (rels?.includes('TargetMode="External"')) zip.file(name, rels.replace(/<Relationship\b[^>]*TargetMode="External"[^>]*\/>/g, (r) => (/\/hyperlink"/.test(r) ? r : '')))
  }
  const styles = (await zip.file('word/styles.xml')?.async('string')) ?? ''
  const ids = styleIds(styles)
  // a template whose Heading 1 has Word's own numbering: no outline number in front of the title (no "1.2 1.2 …")
  const h1 = styles.split('<w:style ').find((x) => /<w:name w:val="heading 1"/i.test(x.slice(0, Math.max(0, x.indexOf('</w:style>')) || x.length)))
  const block = blocks(d, ids, !(h1 && /<w:numPr>/.test(h1.slice(0, Math.max(0, h1.indexOf('</w:style>')) || h1.length))))
  const inline = inlines(d)
  for (const name of Object.keys(zip.files)) {
    if (!/^word\/(document|header\d*|footer\d*)\.xml$/.test(name)) continue
    const xml = await zip.file(name)?.async('string')
    if (xml !== undefined) zip.file(name, fillPart(xml, name === 'word/document.xml' ? block : {}, inline))
  }
  const settings = await zip.file('word/settings.xml')?.async('string')
  if (settings !== undefined && !settings.includes('w:updateFields')) {
    // in the place the schema gives it: before the first of the elements that must follow it (QA Q7)
    const after = ['<w:hdrShapeDefaults', '<w:footnotePr', '<w:endnotePr', '<w:compat', '<w:docVars', '<w:rsids', '<m:mathPr', '<w:attachedSchema', '<w:themeFontLang', '<w:clrSchemeMapping', '<w:doNotIncludeSubdocsInStats', '<w:doNotAutoCompressPictures', '<w:forceUpgrade', '<w:captions', '<w:readModeInkLockDown', '<w:smartTagType', '<sl:schemaLibrary', '<w:shapeDefaults', '<w:doNotEmbedSmartTags', '<w:decimalSymbol', '<w:listSeparator']
      .map((tag) => settings.indexOf(tag))
      .filter((n) => n >= 0)
    const at = after.length > 0 ? Math.min(...after) : settings.lastIndexOf('</w:settings>')
    if (at >= 0) zip.file('word/settings.xml', `${settings.slice(0, at)}<w:updateFields w:val="true"/>${settings.slice(at)}`)
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}

/** reqochet's plain built-in template: title page, contents, the items, the trace table; page numbers in the footer. */
async function defaultTemplate(): Promise<Uint8Array> {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
  const t = T.docExport
  const style = (id: string, name: string, extra: string, type = 'paragraph'): string => `<w:style w:type="${type}" w:styleId="${id}"><w:name w:val="${name}"/>${type === 'paragraph' ? '<w:basedOn w:val="Normal"/>' : ''}${extra}</w:style>`
  const heading = (n: number, size: number): string => style(`Heading${n}`, `heading ${n}`, `<w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${n === 1 ? 360 : 240}" w:after="120"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="1B1F27"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>`)
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>${rtl() ? '<w:bidi/>' : ''}<w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>${style('Normal', 'Normal', '<w:qFormat/>').replace('<w:basedOn w:val="Normal"/>', '')}${style('Title', 'Title', '<w:rPr><w:b/><w:bCs/><w:sz w:val="48"/><w:szCs w:val="48"/></w:rPr>')}${heading(1, 32)}${heading(2, 28)}${heading(3, 24)}${heading(4, 22)}${heading(5, 22)}${heading(6, 22)}${style('TOCHeading', 'TOC Heading', '<w:rPr><w:b/><w:bCs/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>')}${style('RMRequirementText', 'RM Requirement Text', '<w:pPr><w:ind w:left="0"/></w:pPr>')}${style('RMAttributeTable', 'RM Attribute Table', '<w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>', 'table')}${style('RMTraceTable', 'RM Trace Table', '<w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>', 'table')}</w:styles>`
  const p = (style: string, text: string): string => `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`
  const brk = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${p('Title', '{{document.name}}')}${p('Normal', `${t.baseline}: {{baseline}}`)}${p('Normal', `${t.commit}: {{commit}}`)}${p('Normal', `${t.date}: {{date}}`)}${p('Normal', `${t.author}: {{author}}`)}${brk}${p('Normal', '{{toc}}')}${brk}${p('Normal', '{{items}}')}${p('Normal', '{{trace.table}}')}<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`
  const [before, after] = t.pageOf('\u0001', '\u0002').split('\u0001') as [string, string]
  const [middle, end] = after.split('\u0002') as [string, string]
  const field = (code: string): string => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${code} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`
  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${W}><w:p><w:pPr>${rtl() ? '<w:bidi/><w:jc w:val="left"/>' : '<w:jc w:val="right"/>'}</w:pPr><w:r><w:t xml:space="preserve">{{document.name}} · ${xmlEsc(before)}</w:t></w:r>${field('PAGE')}<w:r><w:t xml:space="preserve">${xmlEsc(middle)}</w:t></w:r>${field('NUMPAGES')}<w:r><w:t xml:space="preserve">${xmlEsc(end)}</w:t></w:r></w:p></w:ftr>`
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
