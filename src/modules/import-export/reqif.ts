// ReqIF (OMG Requirements Interchange Format 1.2) — the exchange format of DOORS, Jama, Polarion, ProR … (0.11.0).
// Reading: a ReqIF file becomes the same table the Excel import uses (one row per object in hierarchy order, one
// column per attribute and per relation type), so the import wizard, the column guessing and re-import matching
// work unchanged. Writing: one specification with ReqMan's hierarchy, every field as an attribute, links as
// relations. Pure: text in, text out (a .reqifz archive is unpacked by the caller).
import { SaxesParser } from 'saxes'
import type { FieldDef, IndexedItem, Schema } from '../../shared/domain'
import { T } from '../../shared/text'

// ---------------------------------------------------------------- a small XML tree

interface XNode {
  name: string
  attrs: Record<string, string>
  children: XNode[]
  text: string
}

const local = (name: string): string => name.slice(name.indexOf(':') + 1)

function parseXml(xml: string): XNode {
  const parser = new SaxesParser({ xmlns: false })
  const rootNode: XNode = { name: '#root', attrs: {}, children: [], text: '' }
  const stack: XNode[] = [rootNode]
  parser.on('opentag', (t) => {
    const n: XNode = { name: t.name, attrs: t.attributes as Record<string, string>, children: [], text: '' }
    ;(stack[stack.length - 1] as XNode).children.push(n)
    stack.push(n)
  })
  parser.on('text', (t) => {
    const top = stack[stack.length - 1] as XNode
    top.text += t
    top.children.push({ name: '#text', attrs: {}, children: [], text: t })
  })
  parser.on('closetag', () => {
    stack.pop()
  })
  parser.write(xml.replace(/^\uFEFF/, '')).close()
  return rootNode
}

const kids = (n: XNode | undefined, name: string): XNode[] => (n ? n.children.filter((c) => local(c.name) === name) : [])
const kid = (n: XNode | undefined, name: string): XNode | undefined => kids(n, name)[0]
/** All descendants with this local name. */
function all(n: XNode, name: string, out: XNode[] = []): XNode[] {
  for (const c of n.children) {
    if (local(c.name) === name) out.push(c)
    all(c, name, out)
  }
  return out
}
/** The text inside a REF element: <TYPE><SPEC-OBJECT-TYPE-REF>id</SPEC-OBJECT-TYPE-REF></TYPE>. */
const refIn = (n: XNode | undefined): string => (n?.children.find((c) => c.name !== '#text')?.text ?? '').trim()

// ---------------------------------------------------------------- XHTML ↔ Markdown (the simple, common parts)

/** XHTML text of an attribute as Markdown: paragraphs, line breaks, lists, bold, italics; tables as text rows. */
export function xhtmlToMarkdown(n: XNode): string {
  const walk = (x: XNode, listDepth: number): string => {
    if (x.name === '#text') return x.text.replace(/\s+/g, ' ')
    const tag = local(x.name).toLowerCase()
    const inner = (): string => x.children.map((c) => walk(c, tag === 'ul' || tag === 'ol' ? listDepth + 1 : listDepth)).join('')
    switch (tag) {
      case 'br':
        return '\n'
      case 'p':
      case 'div':
        return `\n\n${inner().trim()}\n\n`
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
        return `\n\n${'#'.repeat(Number(tag[1]) + 1)} ${inner().trim()}\n\n`
      case 'b':
      case 'strong':
        return `**${inner().trim()}**`
      case 'i':
      case 'em':
        return `_${inner().trim()}_`
      case 'ul':
      case 'ol':
        return `\n${inner()}\n`
      case 'li':
        return `\n${'  '.repeat(Math.max(0, listDepth - 1))}- ${inner().trim()}`
      case 'tr':
        return `\n| ${x.children.filter((c) => c.name !== '#text').map((c) => walk(c, listDepth).trim()).join(' | ')} |`
      case 'object':
      case 'img':
        return x.attrs['name'] ?? x.attrs['alt'] ?? ''
      default:
        return inner()
    }
  }
  return walk(n, 0)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** For attribute values: XML turns raw line breaks and tabs there into spaces, so they are written as references. */
const escAttr = (s: string): string => esc(s).replace(/\r/g, '&#13;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;')

/** Markdown text as XHTML for ReqIF: paragraphs, "- " lists, line breaks, **bold**. */
export function markdownToXhtml(md: string): string {
  const inline = (s: string): string => esc(s).replace(/\*\*(.+?)\*\*/g, '<xhtml:b>$1</xhtml:b>')
  const blocks = md.replace(/\r\n/g, '\n').trim().split(/\n{2,}/)
  const html = blocks.map((b) => {
    const lines = b.split('\n')
    if (lines.every((l) => /^\s*[-*] /.test(l))) return `<xhtml:ul>${lines.map((l) => `<xhtml:li>${inline(l.replace(/^\s*[-*] /, ''))}</xhtml:li>`).join('')}</xhtml:ul>`
    return `<xhtml:p>${lines.map(inline).join('<xhtml:br/>')}</xhtml:p>`
  })
  return `<xhtml:div>${md.trim() ? html.join('') : ''}</xhtml:div>`
}

// ---------------------------------------------------------------- reading

/** Column names of the table a ReqIF file becomes (also what the import guesses from). */
export const REQIF_COLUMNS = { id: 'ReqIF identifier', parent: 'Parent', type: 'Type' }

/**
 * A ReqIF document as tables, one per specification (DOORS: one per module): a row per object in document order
 * with its identifier, parent, type, every attribute value (XHTML as Markdown, enumerations by name) and, per
 * relation type, the objects it points to. Objects in no specification are listed in an extra table.
 */
export function readReqif(xml: string): { name: string; rows: string[][] }[] {
  const doc = parseXml(xml)
  const content = all(doc, 'REQ-IF-CONTENT')[0]
  if (!content) throw new Error(T.importMsg.notReqif)
  const longName = (n: XNode): string => n.attrs['LONG-NAME'] ?? n.attrs['IDENTIFIER'] ?? ''
  // enumeration values: identifier → name
  const enumName = new Map<string, string>()
  for (const v of all(content, 'ENUM-VALUE')) enumName.set(v.attrs['IDENTIFIER'] ?? '', longName(v))
  // attribute definitions: identifier → name (the same name in several object types = one column)
  const attrName = new Map<string, string>()
  const columns: string[] = []
  for (const st of kids(kid(content, 'SPEC-TYPES'), 'SPEC-OBJECT-TYPE')) {
    for (const d of kid(st, 'SPEC-ATTRIBUTES')?.children.filter((c) => c.name !== '#text') ?? []) {
      const name = longName(d)
      attrName.set(d.attrs['IDENTIFIER'] ?? '', name)
      if (!columns.includes(name)) columns.push(name)
    }
  }
  const typeName = new Map<string, string>()
  for (const t of kid(content, 'SPEC-TYPES')?.children.filter((c) => c.name !== '#text') ?? []) typeName.set(t.attrs['IDENTIFIER'] ?? '', longName(t))

  // objects
  interface Obj {
    id: string
    type: string
    values: Map<string, string>
  }
  const objects = new Map<string, Obj>()
  for (const o of kids(kid(content, 'SPEC-OBJECTS'), 'SPEC-OBJECT')) {
    const values = new Map<string, string>()
    for (const v of kid(o, 'VALUES')?.children.filter((c) => c.name !== '#text') ?? []) {
      const def = attrName.get(refIn(kid(v, 'DEFINITION'))) ?? refIn(kid(v, 'DEFINITION'))
      const kind = local(v.name)
      const the = kid(v, 'THE-VALUE')
      const text =
        kind === 'ATTRIBUTE-VALUE-XHTML'
          ? the
            ? xhtmlToMarkdown(the)
            : ''
          : kind === 'ATTRIBUTE-VALUE-ENUMERATION'
            ? kids(kid(v, 'VALUES'), 'ENUM-VALUE-REF')
                .map((r) => enumName.get(r.text.trim()) ?? r.text.trim())
                .join(', ')
            : (v.attrs['THE-VALUE'] ?? '')
      values.set(def, text)
    }
    const id = o.attrs['IDENTIFIER'] ?? ''
    objects.set(id, { id, type: typeName.get(refIn(kid(o, 'TYPE'))) ?? '', values })
  }

  // relations: per relation type, source → targets
  const relTypes: string[] = []
  const rels = new Map<string, Map<string, string[]>>() // type name → source → targets
  for (const r of kids(kid(content, 'SPEC-RELATIONS'), 'SPEC-RELATION')) {
    const type = typeName.get(refIn(kid(r, 'TYPE'))) || longName(r) || 'relation'
    const source = refIn(kid(r, 'SOURCE'))
    const target = refIn(kid(r, 'TARGET'))
    if (!source || !target) continue
    if (!rels.has(type)) {
      rels.set(type, new Map())
      relTypes.push(type)
    }
    const m = rels.get(type) as Map<string, string[]>
    m.set(source, [...(m.get(source) ?? []), target])
  }

  const header = [REQIF_COLUMNS.id, REQIF_COLUMNS.parent, REQIF_COLUMNS.type, ...columns, ...relTypes]
  const row = (o: Obj, parent: string): string[] => [
    o.id,
    parent,
    o.type,
    ...columns.map((c) => o.values.get(c) ?? ''),
    ...relTypes.map((t) => (rels.get(t)?.get(o.id) ?? []).join(', '))
  ]
  const tables: { name: string; rows: string[][] }[] = []
  const placed = new Set<string>()
  for (const spec of kids(kid(content, 'SPECIFICATIONS'), 'SPECIFICATION')) {
    const rows: string[][] = [header]
    const walk = (h: XNode | undefined, parent: string): void => {
      for (const sh of kids(kid(h, 'CHILDREN'), 'SPEC-HIERARCHY')) {
        const id = refIn(kid(sh, 'OBJECT'))
        const o = objects.get(id)
        if (o && !placed.has(id)) {
          placed.add(id)
          rows.push(row(o, parent))
          walk(sh, id)
        } else walk(sh, parent)
      }
    }
    walk(spec, '')
    tables.push({ name: longName(spec) || 'Specification', rows })
  }
  const rest = [...objects.values()].filter((o) => !placed.has(o.id))
  if (rest.length > 0 || tables.length === 0) tables.push({ name: 'Objects outside a specification', rows: [header, ...rest.map((o) => row(o, ''))] })
  return tables
}

// ---------------------------------------------------------------- writing

export interface ReqifItem {
  item: IndexedItem
  /** The item's `source-id` when it came from ReqIF: kept as its identifier, so the other tool recognises it. */
  sourceId?: string
  depth: number
}

/** XML IDs: start with a letter or "_", then letters, digits, "-", "_", "." */
const xmlId = (s: string): string => (/^[A-Za-z_][\w.-]*$/.test(s) ? s : `_${s.replace(/[^\w.-]/g, '_')}`)

/**
 * The items as one ReqIF specification: ReqIF.ForeignID (the ReqMan ID), ReqIF.Name (title), ReqIF.Text (XHTML),
 * the outline number and every field; enumeration fields as ReqIF enumerations; links as relations of their
 * type (source → target, as stored in ReqMan). Items whose parent is not exported hang at the top.
 */
export function writeReqif(schema: Schema, items: ReqifItem[], title: string, now = new Date()): string {
  const time = now.toISOString()
  const idOf = new Map(items.map((x) => [x.item.id, xmlId(x.sourceId ?? x.item.id)]))
  const fieldDefs = schema.fields
  const enumFields = fieldDefs.filter((f) => (f.type === 'enum' || f.type === 'list') && f.options && f.options.length > 0)
  const enumId = (f: FieldDef, i: number): string => xmlId(`reqman-enum-${f.id}-${i}`)
  const out: string[] = []
  const w = (s: string): void => {
    out.push(s)
  }
  w('<?xml version="1.0" encoding="UTF-8"?>')
  w('<REQ-IF xmlns="http://www.omg.org/spec/ReqIF/20110401/reqif.xsd" xmlns:xhtml="http://www.w3.org/1999/xhtml">')
  w(`<THE-HEADER><REQ-IF-HEADER IDENTIFIER="reqman-header"><CREATION-TIME>${time}</CREATION-TIME><REQ-IF-TOOL-ID>ReqMan</REQ-IF-TOOL-ID><REQ-IF-VERSION>1.0</REQ-IF-VERSION><SOURCE-TOOL-ID>ReqMan</SOURCE-TOOL-ID><TITLE>${esc(title)}</TITLE></REQ-IF-HEADER></THE-HEADER>`)
  w('<CORE-CONTENT><REQ-IF-CONTENT>')
  // data types
  w('<DATATYPES>')
  w(`<DATATYPE-DEFINITION-STRING IDENTIFIER="reqman-dt-string" LONG-NAME="String" LAST-CHANGE="${time}" MAX-LENGTH="1000000"/>`)
  w(`<DATATYPE-DEFINITION-XHTML IDENTIFIER="reqman-dt-xhtml" LONG-NAME="Formatted text" LAST-CHANGE="${time}"/>`)
  for (const f of enumFields) {
    w(`<DATATYPE-DEFINITION-ENUMERATION IDENTIFIER="${xmlId(`reqman-dt-${f.id}`)}" LONG-NAME="${esc(f.name)}" LAST-CHANGE="${time}"><SPECIFIED-VALUES>`)
    ;(f.options ?? []).forEach((o, i) => w(`<ENUM-VALUE IDENTIFIER="${enumId(f, i)}" LONG-NAME="${esc(o)}" LAST-CHANGE="${time}"><PROPERTIES><EMBEDDED-VALUE KEY="${i}" OTHER-CONTENT=""/></PROPERTIES></ENUM-VALUE>`))
    w('</SPECIFIED-VALUES></DATATYPE-DEFINITION-ENUMERATION>')
  }
  w('</DATATYPES>')
  // types: one object type with all attributes (item types as an enumeration-like "Type" string)
  const attrs: { id: string; name: string; kind: 'string' | 'xhtml' | 'enum'; field?: FieldDef }[] = [
    { id: 'reqman-ad-foreignid', name: 'ReqIF.ForeignID', kind: 'string' },
    { id: 'reqman-ad-name', name: 'ReqIF.Name', kind: 'string' },
    { id: 'reqman-ad-text', name: 'ReqIF.Text', kind: 'xhtml' },
    { id: 'reqman-ad-type', name: 'ReqMan.Type', kind: 'string' },
    { id: 'reqman-ad-number', name: 'ReqMan.Number', kind: 'string' },
    // the text exactly as ReqMan stores it (Markdown), so a ReqIF round trip through ReqMan loses nothing
    { id: 'reqman-ad-markdown', name: 'ReqMan.Markdown', kind: 'string' },
    ...fieldDefs.map((f) => ({ id: xmlId(`reqman-ad-${f.id}`), name: f.name, kind: enumFields.includes(f) ? ('enum' as const) : ('string' as const), field: f }))
  ]
  w('<SPEC-TYPES>')
  w(`<SPEC-OBJECT-TYPE IDENTIFIER="reqman-type-item" LONG-NAME="Requirement" LAST-CHANGE="${time}"><SPEC-ATTRIBUTES>`)
  for (const a of attrs) {
    if (a.kind === 'xhtml') w(`<ATTRIBUTE-DEFINITION-XHTML IDENTIFIER="${a.id}" LONG-NAME="${esc(a.name)}" LAST-CHANGE="${time}"><TYPE><DATATYPE-DEFINITION-XHTML-REF>reqman-dt-xhtml</DATATYPE-DEFINITION-XHTML-REF></TYPE></ATTRIBUTE-DEFINITION-XHTML>`)
    else if (a.kind === 'enum' && a.field)
      w(
        `<ATTRIBUTE-DEFINITION-ENUMERATION IDENTIFIER="${a.id}" LONG-NAME="${esc(a.name)}" LAST-CHANGE="${time}" MULTI-VALUED="${a.field.type === 'list'}"><TYPE><DATATYPE-DEFINITION-ENUMERATION-REF>${xmlId(`reqman-dt-${a.field.id}`)}</DATATYPE-DEFINITION-ENUMERATION-REF></TYPE></ATTRIBUTE-DEFINITION-ENUMERATION>`
      )
    else w(`<ATTRIBUTE-DEFINITION-STRING IDENTIFIER="${a.id}" LONG-NAME="${esc(a.name)}" LAST-CHANGE="${time}"><TYPE><DATATYPE-DEFINITION-STRING-REF>reqman-dt-string</DATATYPE-DEFINITION-STRING-REF></TYPE></ATTRIBUTE-DEFINITION-STRING>`)
  }
  w('</SPEC-ATTRIBUTES></SPEC-OBJECT-TYPE>')
  for (const l of schema.linkTypes) w(`<SPEC-RELATION-TYPE IDENTIFIER="${xmlId(`reqman-rel-${l.id}`)}" LONG-NAME="${esc(l.name)}" LAST-CHANGE="${time}"/>`)
  w(`<SPECIFICATION-TYPE IDENTIFIER="reqman-type-spec" LONG-NAME="Specification" LAST-CHANGE="${time}"/>`)
  w('</SPEC-TYPES>')
  // objects
  w('<SPEC-OBJECTS>')
  for (const x of items) {
    const it = x.item
    const typeName = schema.itemTypes.find((t) => t.id === it.type)?.name ?? it.type
    w(`<SPEC-OBJECT IDENTIFIER="${idOf.get(it.id) as string}" LONG-NAME="${esc(it.title)}" LAST-CHANGE="${time}"><TYPE><SPEC-OBJECT-TYPE-REF>reqman-type-item</SPEC-OBJECT-TYPE-REF></TYPE><VALUES>`)
    const str = (def: string, v: string): void => {
      if (v !== '') w(`<ATTRIBUTE-VALUE-STRING THE-VALUE="${escAttr(v)}"><DEFINITION><ATTRIBUTE-DEFINITION-STRING-REF>${def}</ATTRIBUTE-DEFINITION-STRING-REF></DEFINITION></ATTRIBUTE-VALUE-STRING>`)
    }
    str('reqman-ad-foreignid', it.id)
    str('reqman-ad-name', it.title)
    w(`<ATTRIBUTE-VALUE-XHTML><DEFINITION><ATTRIBUTE-DEFINITION-XHTML-REF>reqman-ad-text</ATTRIBUTE-DEFINITION-XHTML-REF></DEFINITION><THE-VALUE>${markdownToXhtml(it.text)}</THE-VALUE></ATTRIBUTE-VALUE-XHTML>`)
    str('reqman-ad-type', typeName)
    str('reqman-ad-number', it.number ?? '')
    str('reqman-ad-markdown', it.text)
    for (const a of attrs.filter((y) => y.field)) {
      const f = a.field as FieldDef
      const v = it.fields[f.id]
      if (v === undefined || v === '') continue
      if (a.kind === 'enum') {
        const vals = (Array.isArray(v) ? v : [String(v)]).map((s) => (f.options ?? []).indexOf(s)).filter((i) => i >= 0)
        if (vals.length) w(`<ATTRIBUTE-VALUE-ENUMERATION><DEFINITION><ATTRIBUTE-DEFINITION-ENUMERATION-REF>${a.id}</ATTRIBUTE-DEFINITION-ENUMERATION-REF></DEFINITION><VALUES>${vals.map((i) => `<ENUM-VALUE-REF>${enumId(f, i)}</ENUM-VALUE-REF>`).join('')}</VALUES></ATTRIBUTE-VALUE-ENUMERATION>`)
      } else str(a.id, Array.isArray(v) ? v.join(', ') : String(v))
    }
    w('</VALUES></SPEC-OBJECT>')
  }
  w('</SPEC-OBJECTS>')
  // relations (only between exported items)
  w('<SPEC-RELATIONS>')
  let n = 0
  for (const x of items)
    for (const l of x.item.links) {
      const target = idOf.get(l.target)
      if (!target || !schema.linkTypes.some((t) => t.id === l.type)) continue
      w(
        `<SPEC-RELATION IDENTIFIER="reqman-rel-${++n}" LAST-CHANGE="${time}"><TYPE><SPEC-RELATION-TYPE-REF>${xmlId(`reqman-rel-${l.type}`)}</SPEC-RELATION-TYPE-REF></TYPE><SOURCE><SPEC-OBJECT-REF>${idOf.get(x.item.id) as string}</SPEC-OBJECT-REF></SOURCE><TARGET><SPEC-OBJECT-REF>${target}</SPEC-OBJECT-REF></TARGET></SPEC-RELATION>`
      )
    }
  w('</SPEC-RELATIONS>')
  // the hierarchy: items come in document order with their depth
  w(`<SPECIFICATIONS><SPECIFICATION IDENTIFIER="reqman-spec" LONG-NAME="${esc(title)}" LAST-CHANGE="${time}"><TYPE><SPECIFICATION-TYPE-REF>reqman-type-spec</SPECIFICATION-TYPE-REF></TYPE><CHILDREN>`)
  const open: number[] = [] // depths of the hierarchy elements still open
  const close = (): void => {
    w('</CHILDREN></SPEC-HIERARCHY>')
    open.pop()
  }
  const base = items.length ? Math.min(...items.map((x) => x.depth)) : 0
  items.forEach((x, i) => {
    const depth = Math.min(x.depth - base, (open.length ? (open[open.length - 1] as number) + 1 : 0))
    while (open.length && (open[open.length - 1] as number) >= depth) close()
    w(`<SPEC-HIERARCHY IDENTIFIER="reqman-h-${i + 1}" LAST-CHANGE="${time}"><OBJECT><SPEC-OBJECT-REF>${idOf.get(x.item.id) as string}</SPEC-OBJECT-REF></OBJECT><CHILDREN>`)
    open.push(depth)
  })
  while (open.length) close()
  w('</CHILDREN></SPECIFICATION></SPECIFICATIONS>')
  w('</REQ-IF-CONTENT></CORE-CONTENT></REQ-IF>')
  return `${out.join('\n')}\n`
}

