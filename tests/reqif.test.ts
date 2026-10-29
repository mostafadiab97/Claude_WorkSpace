// ReqIF (0.11.0): reading a file written by another tool (DOORS-style attributes, XHTML, enumerations, nested
// hierarchy, relations) into the import table, and a full round trip ReqMan → ReqIF → ReqMan.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { guessMapping, planImport, readReqif, writeReqif } from '../src/modules/import-export'
import { generateId, isValidId, type Item } from '../src/modules/items'
import { parseSchema } from '../src/modules/schema'
import type { IndexedItem } from '../src/shared/domain'

const { schema } = parseSchema(readFileSync(join(__dirname, '..', 'config', 'default-schema.yaml'), 'utf8'))

// what a DOORS module export looks like (shortened)
const DOORS = `<?xml version="1.0" encoding="UTF-8"?>
<REQ-IF xmlns="http://www.omg.org/spec/ReqIF/20110401/reqif.xsd" xmlns:xhtml="http://www.w3.org/1999/xhtml">
<THE-HEADER><REQ-IF-HEADER IDENTIFIER="h"><TITLE>Climate</TITLE></REQ-IF-HEADER></THE-HEADER>
<CORE-CONTENT><REQ-IF-CONTENT>
<DATATYPES>
  <DATATYPE-DEFINITION-STRING IDENTIFIER="dt-s" MAX-LENGTH="255"/>
  <DATATYPE-DEFINITION-XHTML IDENTIFIER="dt-x"/>
  <DATATYPE-DEFINITION-ENUMERATION IDENTIFIER="dt-status"><SPECIFIED-VALUES>
    <ENUM-VALUE IDENTIFIER="ev-1" LONG-NAME="Draft"/><ENUM-VALUE IDENTIFIER="ev-2" LONG-NAME="Approved"/>
  </SPECIFIED-VALUES></DATATYPE-DEFINITION-ENUMERATION>
</DATATYPES>
<SPEC-TYPES>
  <SPEC-OBJECT-TYPE IDENTIFIER="ot" LONG-NAME="Requirement"><SPEC-ATTRIBUTES>
    <ATTRIBUTE-DEFINITION-STRING IDENTIFIER="ad-fid" LONG-NAME="ReqIF.ForeignID"><TYPE><DATATYPE-DEFINITION-STRING-REF>dt-s</DATATYPE-DEFINITION-STRING-REF></TYPE></ATTRIBUTE-DEFINITION-STRING>
    <ATTRIBUTE-DEFINITION-XHTML IDENTIFIER="ad-ch" LONG-NAME="ReqIF.ChapterName"><TYPE><DATATYPE-DEFINITION-XHTML-REF>dt-x</DATATYPE-DEFINITION-XHTML-REF></TYPE></ATTRIBUTE-DEFINITION-XHTML>
    <ATTRIBUTE-DEFINITION-XHTML IDENTIFIER="ad-tx" LONG-NAME="ReqIF.Text"><TYPE><DATATYPE-DEFINITION-XHTML-REF>dt-x</DATATYPE-DEFINITION-XHTML-REF></TYPE></ATTRIBUTE-DEFINITION-XHTML>
    <ATTRIBUTE-DEFINITION-ENUMERATION IDENTIFIER="ad-st" LONG-NAME="Status"><TYPE><DATATYPE-DEFINITION-ENUMERATION-REF>dt-status</DATATYPE-DEFINITION-ENUMERATION-REF></TYPE></ATTRIBUTE-DEFINITION-ENUMERATION>
  </SPEC-ATTRIBUTES></SPEC-OBJECT-TYPE>
  <SPEC-RELATION-TYPE IDENTIFIER="rt" LONG-NAME="verifies"/>
  <SPECIFICATION-TYPE IDENTIFIER="st"/>
</SPEC-TYPES>
<SPEC-OBJECTS>
  <SPEC-OBJECT IDENTIFIER="_o1"><TYPE><SPEC-OBJECT-TYPE-REF>ot</SPEC-OBJECT-TYPE-REF></TYPE><VALUES>
    <ATTRIBUTE-VALUE-STRING THE-VALUE="1"><DEFINITION><ATTRIBUTE-DEFINITION-STRING-REF>ad-fid</ATTRIBUTE-DEFINITION-STRING-REF></DEFINITION></ATTRIBUTE-VALUE-STRING>
    <ATTRIBUTE-VALUE-XHTML><DEFINITION><ATTRIBUTE-DEFINITION-XHTML-REF>ad-ch</ATTRIBUTE-DEFINITION-XHTML-REF></DEFINITION><THE-VALUE><xhtml:div>Temperature</xhtml:div></THE-VALUE></ATTRIBUTE-VALUE-XHTML>
  </VALUES></SPEC-OBJECT>
  <SPEC-OBJECT IDENTIFIER="_o2"><TYPE><SPEC-OBJECT-TYPE-REF>ot</SPEC-OBJECT-TYPE-REF></TYPE><VALUES>
    <ATTRIBUTE-VALUE-XHTML><DEFINITION><ATTRIBUTE-DEFINITION-XHTML-REF>ad-tx</ATTRIBUTE-DEFINITION-XHTML-REF></DEFINITION><THE-VALUE><xhtml:div><xhtml:p>The system <xhtml:b>shall</xhtml:b> measure within 0.5 &#176;C.</xhtml:p><xhtml:ul><xhtml:li>every second</xhtml:li><xhtml:li>in every room</xhtml:li></xhtml:ul></xhtml:div></THE-VALUE></ATTRIBUTE-VALUE-XHTML>
    <ATTRIBUTE-VALUE-ENUMERATION><DEFINITION><ATTRIBUTE-DEFINITION-ENUMERATION-REF>ad-st</ATTRIBUTE-DEFINITION-ENUMERATION-REF></DEFINITION><VALUES><ENUM-VALUE-REF>ev-2</ENUM-VALUE-REF></VALUES></ATTRIBUTE-VALUE-ENUMERATION>
  </VALUES></SPEC-OBJECT>
  <SPEC-OBJECT IDENTIFIER="_o3"><TYPE><SPEC-OBJECT-TYPE-REF>ot</SPEC-OBJECT-TYPE-REF></TYPE><VALUES>
    <ATTRIBUTE-VALUE-XHTML><DEFINITION><ATTRIBUTE-DEFINITION-XHTML-REF>ad-tx</ATTRIBUTE-DEFINITION-XHTML-REF></DEFINITION><THE-VALUE><xhtml:div>Check it with a reference thermometer.</xhtml:div></THE-VALUE></ATTRIBUTE-VALUE-XHTML>
  </VALUES></SPEC-OBJECT>
</SPEC-OBJECTS>
<SPEC-RELATIONS>
  <SPEC-RELATION IDENTIFIER="r1"><TYPE><SPEC-RELATION-TYPE-REF>rt</SPEC-RELATION-TYPE-REF></TYPE><SOURCE><SPEC-OBJECT-REF>_o3</SPEC-OBJECT-REF></SOURCE><TARGET><SPEC-OBJECT-REF>_o2</SPEC-OBJECT-REF></TARGET></SPEC-RELATION>
</SPEC-RELATIONS>
<SPECIFICATIONS><SPECIFICATION IDENTIFIER="s1" LONG-NAME="System requirements"><TYPE><SPECIFICATION-TYPE-REF>st</SPECIFICATION-TYPE-REF></TYPE><CHILDREN>
  <SPEC-HIERARCHY IDENTIFIER="h1"><OBJECT><SPEC-OBJECT-REF>_o1</SPEC-OBJECT-REF></OBJECT><CHILDREN>
    <SPEC-HIERARCHY IDENTIFIER="h2"><OBJECT><SPEC-OBJECT-REF>_o2</SPEC-OBJECT-REF></OBJECT></SPEC-HIERARCHY>
    <SPEC-HIERARCHY IDENTIFIER="h3"><OBJECT><SPEC-OBJECT-REF>_o3</SPEC-OBJECT-REF></OBJECT></SPEC-HIERARCHY>
  </CHILDREN></SPEC-HIERARCHY>
</CHILDREN></SPECIFICATION></SPECIFICATIONS>
</REQ-IF-CONTENT></CORE-CONTENT></REQ-IF>`

const plan = (rows: string[][], byId = new Map<string, Item>(), bySource = new Map<string, string>()) => {
  const [headers, ...data] = rows as [string[], ...string[][]]
  const taken = new Set<string>()
  return planImport({
    rows: data,
    firstRow: 2,
    headers,
    mapping: guessMapping(headers, schema),
    schema,
    defaultType: 'system-requirement',
    existing: { byId, bySource },
    newId: () => {
      const id = generateId((x) => taken.has(x))
      taken.add(id)
      return id
    },
    isValidId
  })
}

describe('ReqIF', () => {
  it('reads a DOORS-style file into the import table: hierarchy, XHTML as Markdown, enumerations, relations', () => {
    const [spec] = readReqif(DOORS)
    expect(spec!.name).toBe('System requirements')
    expect(spec!.rows[0]).toEqual(['ReqIF identifier', 'Parent', 'Type', 'ReqIF.ForeignID', 'ReqIF.ChapterName', 'ReqIF.Text', 'Status', 'verifies'])
    expect(spec!.rows[2]).toEqual(['_o2', '_o1', 'Requirement', '', '', 'The system **shall** measure within 0.5 °C.\n\n- every second\n- in every room', 'Approved', ''])
    expect(spec!.rows[3]![7]).toBe('_o2')
    expect(guessMapping(spec!.rows[0]!, schema)).toEqual(['id', 'parent', 'type', 'ignore', 'title', 'text', 'field:status', 'link:verifies'])
    const p = plan(spec!.rows)
    expect(p.counts.create).toBe(3)
    const [heading, req, test] = p.items.map((x) => x.item)
    expect(heading!.title).toBe('Temperature')
    expect(req!.parent).toBe(heading!.id)
    expect(req!.title).toBe('The system **shall** measure within 0.5 °C.')
    expect(req!.fields.status).toBe('Approved')
    expect(test!.links).toEqual([{ type: 'verifies', target: req!.id }])
    expect(req!.extra['source-id']).toBe('_o2') // a re-import of the same file updates these items
  })

  it('round trip: ReqMan → ReqIF → ReqMan keeps IDs, types, fields, text, hierarchy and links', () => {
    const it = (id: string, type: string, title: string, extra: Partial<IndexedItem> = {}): IndexedItem => ({
      id, type, title, fields: {}, links: [], text: '', path: `items/${id}.md`, childCount: 0, incomingCount: 0, suspectCount: 0, ...extra
    })
    const ch = it('REQ-AAAAAAA', 'information', 'Chapter <1> & "more"', { number: '1' })
    const req = it('REQ-BBBBBBB', 'system-requirement', 'Accuracy', { parent: ch.id, number: '1.1', text: 'Line one\nline two\n\n| a | b |\n| --- | --- |\n\n```\ncode\n```', fields: { status: 'Approved', tags: ['safety', 'ux'], owner: 'A. Hassan' } })
    const tc = it('REQ-CCCCCCC', 'test-case', 'Check', { number: '2', links: [{ type: 'verifies', target: req.id, confirmed: 'x' }] })
    const xml = writeReqif(schema, [{ item: ch, depth: 0 }, { item: req, depth: 1 }, { item: tc, depth: 0 }], 'Test')
    const [spec] = readReqif(xml)
    const p = plan(spec!.rows)
    expect(p.problems).toEqual([])
    const byTitle = new Map(p.items.map((x) => [x.item.title, x.item]))
    const r = byTitle.get('Accuracy')!
    expect(p.items.map((x) => x.item.id)).toEqual([ch.id, req.id, tc.id]) // ReqMan IDs survive
    expect(byTitle.get('Chapter <1> & "more"')!.type).toBe('information')
    expect(r).toMatchObject({ parent: ch.id, type: 'system-requirement', text: 'Line one\nline two\n\n| a | b |\n| --- | --- |\n\n```\ncode\n```', fields: { status: 'Approved', tags: ['safety', 'ux'], owner: 'A. Hassan' } })
    expect(byTitle.get('Check')!.links).toEqual([{ type: 'verifies', target: req.id }])
  })
})
