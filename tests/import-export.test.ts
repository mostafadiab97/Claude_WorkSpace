import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'
import { createSqliteIndexCache } from '../src/modules/index-cache'
import { csvCell, parseCsv, toCsv } from '../src/modules/import-export'
import { createFileRepositoryStore } from '../src/modules/repository-store'
import { createWorkspace, type WorkspaceService } from '../src/modules/workspace'

describe('CSV', () => {
  it('quotes what Excel needs quoted, and protects against formulas', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a, b')).toBe('"a, b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
    expect(csvCell(' padded')).toBe('" padded"')
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('- a list item')).toBe('- a list item') // Markdown bullets stay as they are
  })

  it('writes UTF-8 with BOM and CRLF, and reads its own output back', () => {
    const rows = [
      ['ID', 'Title', 'Text'],
      ['SYS-1', 'Température ±0.5 °C, "exact"', 'line 1\nline 2'],
      ['SYS-2', 'نص عربي', '']
    ]
    const csv = toCsv(rows)
    expect(csv.startsWith('﻿ID,Title,Text\r\n')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(parseCsv(csv)).toEqual(rows)
  })
})

const quietLog = { info: () => {}, warn: () => {}, error: () => {} }

async function workspace(): Promise<WorkspaceService> {
  const root = await mkdtemp(join(tmpdir(), 'reqman-exp-'))
  const userDir = await mkdtemp(join(tmpdir(), 'reqman-exp-user-'))
  const ws = createWorkspace({
    store: createFileRepositoryStore(join(__dirname, '..', 'config', 'default-schema.yaml')),
    git: createSystemGitAdapter(),
    openIndex: () => createSqliteIndexCache(join(userDir, 'i.sqlite')),
    userDir,
    log: quietLog
  })
  await ws.initialize(root)
  return ws
}

const create = async (ws: WorkspaceService, type: string, title: string, opts: { parent?: string; text?: string; status?: string } = {}): Promise<string> => {
  const it = ws.newItem(type, opts.parent)
  it.title = title
  it.text = opts.text ?? ''
  if (opts.status) it.fields.status = opts.status
  const r = await ws.saveItem(it, null)
  if (!r.ok) throw new Error(r.message)
  return it.id
}

describe('exporting items', () => {
  it('exports every item in document order with level, parent, fields, text and links both ways', async () => {
    const ws = await workspace()
    const ch2 = await create(ws, 'information', 'Chapter 2')
    const ch1 = await create(ws, 'information', 'Chapter 1')
    expect(await ws.reparentItem(ch1, null, ch2)).toEqual({ ok: true }) // Chapter 1 before Chapter 2
    const sys = await create(ws, 'system-requirement', 'Accuracy, ±0.5 °C', { parent: ch1, text: 'The thermostat shall\n- measure "room" temperature', status: 'Approved' })
    const tc = await create(ws, 'test-case', 'Check accuracy', { parent: ch2 })
    await ws.addLink(tc, 'verifies', sys)

    const { content, count } = await ws.exportItems({ scope: 'all', columns: ['id', 'level', 'title', 'type', 'field:status', 'parent', 'text', 'links', 'linkedFrom'], format: 'csv' })
    expect(count).toBe(4)
    const rows = parseCsv(content)
    expect(rows[0]).toEqual(['ID', 'Level', 'Title', 'Type', 'Status', 'Parent', 'Text', 'Links', 'Linked from'])
    expect(rows.slice(1).map((r) => [r[0], r[1]])).toEqual([
      [ch1, '1'],
      [sys, '2'],
      [ch2, '1'],
      [tc, '2']
    ])
    expect(rows[2]).toEqual([sys, '2', 'Accuracy, ±0.5 °C', 'System Requirement', 'Approved', ch1, 'The thermostat shall\n- measure "room" temperature', '', `verified by ${tc}`])
    expect(rows[4]?.[7]).toBe(`verifies ${sys}`)

    // only the filtered result, in the table's sort
    const f = await ws.exportItems({ scope: 'filtered', query: { types: ['system-requirement', 'test-case'], sort: { by: 'title' } }, columns: ['id', 'title'], format: 'csv' })
    expect(parseCsv(f.content).slice(1).map((r) => r[1])).toEqual(['Accuracy, ±0.5 °C', 'Check accuracy'])

    // Markdown: headings follow the hierarchy
    const md = await ws.exportItems({ scope: 'all', columns: ['id', 'title', 'type', 'field:status', 'text', 'links'], format: 'markdown' })
    expect(md.content).toContain(`## ${ch1} — Chapter 1`)
    expect(md.content).toContain(`### ${sys} — Accuracy, ±0.5 °C`)
    expect(md.content).toContain('**Type:** System Requirement · **Status:** Approved')
    expect(md.content).toContain(`Linked from: verified by ${tc}`)
  })

  it('lists items whose parent is missing at the end instead of dropping them', async () => {
    const ws = await workspace()
    const a = await create(ws, 'system-requirement', 'A')
    const info = await ws.refresh()
    const orphanPath = join(info.root, 'requirements', 'items', 'SYS-ORPHAN.md')
    await writeFile(orphanPath, '---\nid: SYS-ORPHAN\ntype: system-requirement\ntitle: Orphan\nparent: SYS-NOPE\n---\n')
    await ws.refresh()
    const rows = parseCsv((await ws.exportItems({ scope: 'all', columns: ['id'], format: 'csv' })).content)
    expect(rows.slice(1).map((r) => r[0])).toEqual([a, 'SYS-ORPHAN'])
  })
})

describe('exporting a comparison', () => {
  it('writes one CSV row per item plus one per change, and a Markdown report', async () => {
    const { compareToCsv, compareToMarkdown } = await import('../src/modules/import-export')
    const schema = {
      version: 1,
      itemTypes: [{ id: 'system-requirement', name: 'System Requirement', prefix: 'SYS', requirement: true }],
      fields: [{ id: 'status', name: 'Status', type: 'enum' as const, options: ['Draft', 'Review'] }],
      linkTypes: [{ id: 'verifies', name: 'verifies', reverseName: 'verified by' }]
    }
    const result = {
      from: { ref: 'a', label: 'a1 Start' },
      to: { ref: 'WORKING', label: 'Your working folder' },
      entries: [
        {
          id: 'SYS-1',
          title: 'Accuracy',
          type: 'system-requirement',
          kind: 'modified' as const,
          summary: 'Text, Status · 1 link added',
          contentChanged: true,
          incoming: 2,
          diff: {
            kind: 'modified' as const,
            rows: [{ key: 'field:status', label: 'Status', before: 'Draft', after: 'Review' }],
            text: { before: 'Within 0.5 °C.', after: 'Within 0.3 °C.' },
            linksAdded: [{ type: 'verifies', target: 'SYS-2' }],
            linksRemoved: []
          }
        }
      ],
      links: [{ source: 'SYS-1', type: 'verifies', target: 'SYS-2', change: 'added' as const }],
      schema: null,
      otherFiles: [],
      durationMs: 1
    }
    const rows = parseCsv(compareToCsv(schema, result))
    expect(rows).toEqual([
      ['ID', 'Title', 'Type', 'Change', 'What', 'Before', 'After'],
      ['SYS-1', 'Accuracy', 'System Requirement', 'Changed', 'Text, Status · 1 link added', '', ''],
      ['SYS-1', 'Accuracy', 'System Requirement', 'Changed', 'Status', 'Draft', 'Review'],
      ['SYS-1', 'Accuracy', 'System Requirement', 'Changed', 'Text', 'Within 0.5 °C.', 'Within 0.3 °C.'],
      ['SYS-1', 'Accuracy', 'System Requirement', 'Changed', 'Link added', '', 'verifies SYS-2']
    ])
    const md = compareToMarkdown(schema, result)
    expect(md).toContain('From **a1 Start** to **Your working folder**')
    expect(md).toContain('| Status | Draft | Review |')
    expect(md).toContain('> Within 0.3 °C.')
    expect(md).toContain('- link added: verifies SYS-2')
  })
})
