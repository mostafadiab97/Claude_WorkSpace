// Builds a rich, fictional test repository for manual testing of ReqMan ("Smart Home Climate System").
//   npx tsx tools/generate-scenario-repo.mts <repo-folder> [count=10000]
// Unlike gen:repo (uniform data for performance tests), this covers as many scenarios as possible:
// every item type, field and link type; deep and wide hierarchies; long Markdown texts, tables, code,
// non-English text and special characters; plus a small, labelled set of deliberately broken items.
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { contentFingerprint, generateId, keyBetween, type Item } from '../src/modules/items/index.ts'
import { createFileRepositoryStore } from '../src/modules/repository-store/index.ts'

const [folderArg, countArg] = process.argv.slice(2)
if (!folderArg) {
  console.error('Usage: npx tsx tools/generate-scenario-repo.mts <repo-folder> [count]')
  process.exit(1)
}
const root = resolve(folderArg)
const TARGET = Number(countArg ?? 10_000)

// ---------- deterministic randomness
let seed = 20261025
const rand = (): number => {
  seed = (seed + 0x6d2b79f5) >>> 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T
const chance = (p: number): boolean => rand() < p
const some = <T,>(xs: readonly T[], max: number): T[] => [...new Set(Array.from({ length: 1 + Math.floor(rand() * max) }, () => pick(xs)))]

// ---------- vocabulary
const AREAS = [
  { key: 'heat', name: 'Heating Control', subjects: ['heating controller', 'boiler interface', 'zone valve', 'regulation loop', 'heat pump driver'] },
  { key: 'app', name: 'Mobile App', subjects: ['mobile app', 'login screen', 'schedule editor', 'notification service', 'home dashboard'] },
  { key: 'cloud', name: 'Cloud Service', subjects: ['cloud backend', 'device registry', 'telemetry pipeline', 'user account service', 'OTA server'] },
  { key: 'ui', name: 'Device Display & Controls', subjects: ['touch display', 'rotary knob', 'status LED', 'backlight', 'menu system'] },
  { key: 'power', name: 'Power & Hardware', subjects: ['power supply', 'battery backup', 'main PCB', 'relay board', 'enclosure'] },
  { key: 'conn', name: 'Connectivity', subjects: ['Wi-Fi module', 'Bluetooth LE link', 'Zigbee radio', 'local API', 'pairing process'] },
  { key: 'safe', name: 'Safety & Security', subjects: ['over-temperature monitor', 'watchdog', 'secure boot', 'encryption layer', 'tamper detection'] }
] as const
const VERBS = ['measure', 'report', 'store', 'display', 'switch', 'validate', 'encrypt', 'log', 'restore', 'limit', 'synchronise', 'detect', 'notify', 'calibrate', 'authenticate']
const OBJECTS = ['the room temperature', 'the set point', 'schedule entries', 'relay events', 'firmware images', 'user preferences', 'the connection state', 'error conditions', 'energy consumption', 'sensor readings', 'safety limits', 'the operating mode', 'humidity values', 'access tokens', 'audit records']
const QUALIFIERS = ['within 200 ms', 'with an accuracy of ±0.5 °C', 'at least once per minute', 'after a power loss', 'without user interaction', 'in under 3 s', 'for at least 10 years', 'when the network is unavailable', 'using AES-256-GCM', 'below 0.5 W in standby', 'for up to 8 zones', 'in all supported languages']
const OWNERS = ['A. Hassan', 'M. Farouk', 'S. Adel', 'N. Kamal', 'Y. Saber', 'R. Nabil', 'H. Mostafa', 'L. Samir', 'J. Müller', 'É. Laurent', 'محمد علي', 'K. Tanaka']
const TAGS = ['safety', 'security', 'ux', 'performance', 'connectivity', 'power', 'regulatory', 'EMC', 'accessibility', 'i18n', 'cost', 'release-1.0', 'release-2.0', 'customer-request']
const STATUS_WEIGHTED = ['Draft', 'Draft', 'Draft', 'Review', 'Review', 'Approved', 'Approved', 'Approved', 'Approved', 'Obsolete']
const PRIORITY_WEIGHTED = ['High', 'High', 'Medium', 'Medium', 'Medium', 'Low', '']

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** Many text shapes: one-liners, rationale, acceptance criteria, lists, tables, code, other languages. */
function textFor(kind: string, subject: string): string {
  const shall = `The ${subject} shall ${pick(VERBS)} ${pick(OBJECTS)} ${pick(QUALIFIERS)}.`
  const r = rand()
  if (kind === 'test-case') {
    return [
      `**Objective:** verify that the ${subject} behaves as specified.`,
      '',
      '**Preconditions**',
      `- Device powered and paired with the test account`,
      `- Ambient temperature ${18 + Math.floor(rand() * 8)} °C ± 1 °C`,
      '',
      '**Steps**',
      `1. Configure the ${subject} with default settings.`,
      `2. ${cap(pick(VERBS))} ${pick(OBJECTS)} and record the result.`,
      '3. Repeat 10 times.',
      '',
      '**Expected result:** all 10 runs pass the acceptance criteria of the verified requirement.'
    ].join('\n')
  }
  if (kind === 'risk') {
    return `**Hazard:** the ${subject} could fail to ${pick(VERBS)} ${pick(OBJECTS)}.\n\n| Severity | Probability | Risk level |\n| --- | --- | --- |\n| ${pick(['Minor', 'Major', 'Critical'])} | ${pick(['Rare', 'Occasional', 'Frequent'])} | ${pick(['Low', 'Medium', 'High'])} |\n\n**Mitigation:** see linked requirements.`
  }
  if (kind === 'defect') {
    return `Found during regression testing of build 2.${Math.floor(rand() * 9)}.${Math.floor(rand() * 40)}.\n\n**Observed:** the ${subject} did not ${pick(VERBS)} ${pick(OBJECTS)}.\n**Expected:** ${shall}\n\n\`\`\`\nERR 0x${Math.floor(rand() * 0xffff).toString(16).padStart(4, '0')} at ${subject.replace(/ /g, '_')}.c:${100 + Math.floor(rand() * 800)}\n\`\`\``
  }
  if (kind === 'use-case') {
    return `**Actor:** home owner\n\n**Main flow**\n1. The user opens the ${subject}.\n2. The user changes ${pick(OBJECTS)}.\n3. The system confirms the change within 2 s.\n\n**Alternative flow:** if the device is offline, the change is queued and applied on reconnection.`
  }
  if (kind === 'change-request') {
    return `Requested by customer support (ticket #${10000 + Math.floor(rand() * 9000)}).\n\nChange: the ${subject} should also ${pick(VERBS)} ${pick(OBJECTS)}.\nImpact: affects the linked requirements; estimated effort ${1 + Math.floor(rand() * 10)} person-days.`
  }
  if (r < 0.35) return shall
  if (r < 0.6) return `${shall}\n\n**Rationale:** ${cap(pick(OBJECTS))} must stay consistent for the user ${pick(QUALIFIERS)}.`
  if (r < 0.8) {
    return `${shall}\n\n**Acceptance criteria**\n- Measured on 3 production samples\n- ${cap(pick(VERBS))}s correctly ${pick(QUALIFIERS)}\n- No error entries in the device log`
  }
  if (r < 0.9) {
    return `${shall}\n\n| Mode | Limit | Unit |\n| --- | --- | --- |\n| Comfort | ${20 + Math.floor(rand() * 4)} | °C |\n| Eco | ${16 + Math.floor(rand() * 3)} | °C |\n| Frost protection | 7 | °C |`
  }
  if (r < 0.95) return `${shall}\n\nNote (Arabic UI text): «يجب أن يعرض الجهاز درجة الحرارة الحالية» — must be shown right-to-left.`
  return Array.from({ length: 6 }, () => `The ${subject} shall ${pick(VERBS)} ${pick(OBJECTS)} ${pick(QUALIFIERS)}.`).join('\n\n')
}

// ---------- build
const store = createFileRepositoryStore(join(import.meta.dirname, '..', 'config', 'default-schema.yaml'))
await mkdir(root, { recursive: true })
const repo = await store.initialize(root)
const taken = new Set<string>()
const items: Item[] = []
const orderOf = new Map<string, string>()

function add(type: string, title: string, opts: { parent?: Item; text?: string; links?: Item['links']; fields?: Item['fields'] } = {}): Item {
  const id = generateId((x) => taken.has(x))
  taken.add(id)
  const parentKey = opts.parent?.id ?? ''
  const order = keyBetween(orderOf.get(parentKey) ?? null, null)
  orderOf.set(parentKey, order)
  const status = pick(STATUS_WEIGHTED)
  const priority = pick(PRIORITY_WEIGHTED)
  const fields: Item['fields'] = opts.fields ?? {
    status,
    ...(priority ? { priority } : {}),
    ...(chance(0.85) ? { owner: pick(OWNERS) } : {}),
    ...(chance(0.6) ? { tags: some(TAGS, 3) } : {})
  }
  const item: Item = { id, type, title, fields, links: opts.links ?? [], text: opts.text ?? '', extra: {}, order }
  if (opts.parent) {
    item.parent = opts.parent.id
  }
  items.push(item)
  return item
}
const link = (from: Item, type: string, to: Item): void => {
  if (from.id !== to.id && !from.links.some((l) => l.type === type && l.target === to.id)) from.links.push({ type, target: to.id })
}

// Document start
const intro = add('information', 'Smart Home Climate System — Requirements Specification', {
  fields: {},
  text: '# Purpose\n\nFictional test data for ReqMan. Every item in this repository is invented.\n\n# Structure\n\nOne chapter per product area: stakeholder needs → system → software / hardware / interface requirements → design elements, with use cases, test cases, risks, defects and change requests.'
})
add('information', 'Glossary', { parent: intro, fields: {}, text: '| Term | Meaning |\n| --- | --- |\n| Set point | Target temperature chosen by the user |\n| Zone | Area of the home heated independently |\n| OTA | Over-the-air firmware update |' })
add('information', 'Revision history', { parent: intro, fields: {}, text: '- 0.1 — first draft\n- 0.2 — added safety chapter\n- 1.0 — baseline for release 1.0' })

// Budget per area, leaving room for the edge-case chapters
const perArea = Math.floor((TARGET - 900) / AREAS.length)
const allSys: Item[] = []
const allSw: Item[] = []
const allTc: Item[] = []

for (const area of AREAS) {
  const start = items.length
  const chapter = add('information', area.name, { fields: {}, text: `Requirements for the ${area.name.toLowerCase()}.` })
  const needs = add('information', 'Stakeholder needs', { parent: chapter, fields: {} })
  const sysSection = add('information', 'System requirements', { parent: chapter, fields: {} })
  const verif = add('information', 'Verification', { parent: chapter, fields: {} })
  const riskSec = add('information', 'Risks', { parent: chapter, fields: {} })
  const issues = add('information', 'Defects and change requests', { parent: chapter, fields: {} })

  const stks: Item[] = []
  for (let i = 0; i < 12; i++) {
    const s = pick(area.subjects)
    stks.push(add('stakeholder-need', `${cap(s)} must ${pick(VERBS)} ${pick(OBJECTS)}`, { parent: needs, text: `As a home owner I want the ${s} to ${pick(VERBS)} ${pick(OBJECTS)}, so that my home stays comfortable.` }))
  }
  for (let i = 0; i < 5; i++) {
    const s = pick(area.subjects)
    const uc = add('use-case', `UC: ${cap(pick(VERBS))} ${pick(OBJECTS)} with the ${s}`, { parent: needs, text: textFor('use-case', s) })
    link(uc, 'relates-to', pick(stks))
  }

  const risks: Item[] = []
  for (let i = 0; i < 10; i++) {
    const s = pick(area.subjects)
    risks.push(add('risk', `Risk: ${s} fails to ${pick(VERBS)} ${pick(OBJECTS)}`, { parent: riskSec, text: textFor('risk', s) }))
  }

  while (items.length - start < perArea) {
    // a system requirement under the system section, refining one stakeholder need
    const s = pick(area.subjects)
    const sys = add('system-requirement', `${cap(s)} ${pick(VERBS)}s ${pick(OBJECTS)}`, { parent: sysSection, text: textFor('system-requirement', s) })
    link(sys, 'refines', pick(stks))
    if (chance(0.25)) link(sys, 'mitigates', pick(risks))
    allSys.push(sys)

    // 2–4 software / hardware / interface requirements beneath it, some with deeper children
    const nChildren = 2 + Math.floor(rand() * 3)
    for (let c = 0; c < nChildren; c++) {
      const kind = area.key === 'power' ? pick(['hardware-requirement', 'hardware-requirement', 'interface-requirement']) : pick(['software-requirement', 'software-requirement', 'software-requirement', 'hardware-requirement', 'interface-requirement'])
      const child = add(kind, `${cap(pick(area.subjects))} ${pick(VERBS)}s ${pick(OBJECTS)}`, { parent: sys, text: textFor(kind, s) })
      link(child, 'refines', sys)
      if (kind === 'software-requirement') allSw.push(child)
      // some go deeper: a chain of refinements up to 4 levels below the system requirement
      let cur = child
      while (chance(0.18)) {
        const deeper = add(kind, `${cap(pick(VERBS))} ${pick(OBJECTS)} — detail`, { parent: cur, text: textFor(kind, s) })
        link(deeper, 'refines', cur)
        cur = deeper
        if (chance(0.5)) break
      }
      if (kind === 'software-requirement' && chance(0.35)) {
        const de = add('design-element', `Module ${s.replace(/\s/g, '_')}_${Math.floor(rand() * 99)}`, { parent: child, text: `Implemented in \`src/${area.key}/${s.replace(/\s/g, '_')}.c\`.` })
        link(de, 'implements', child)
      }
    }

    // a test case verifying the system requirement (and sometimes a software requirement)
    if (chance(0.75)) {
      const tc = add('test-case', `Verify: ${sys.title}`, { parent: verif, text: textFor('test-case', s) })
      link(tc, 'verifies', sys)
      if (allSw.length && chance(0.4)) link(tc, 'verifies', pick(allSw))
      allTc.push(tc)
    }
    if (chance(0.05)) {
      const def = add('defect', `Defect: ${s} does not ${pick(VERBS)} ${pick(OBJECTS)}`, { parent: issues, text: textFor('defect', s) })
      if (allTc.length) link(def, 'relates-to', pick(allTc))
      link(def, 'relates-to', sys)
    }
    if (chance(0.03)) {
      const cr = add('change-request', `CR: extend ${s} to ${pick(VERBS)} ${pick(OBJECTS)}`, { parent: issues, text: textFor('change-request', s) })
      link(cr, 'relates-to', sys)
    }
  }
}

// ---------- edge-case chapter: things a requirements tool must cope with
const edge = add('information', 'Edge cases for testing ReqMan', { fields: {}, text: 'Items with unusual content. All valid — they should show and save normally.' })
add('system-requirement', 'Title with "quotes", a colon: and a # hash', { parent: edge, text: 'YAML-sensitive characters in the title must round-trip unchanged.' })
add('system-requirement', 'A very long title that keeps going to test truncation in the table, the tree and the editor header — it should be cut with an ellipsis in narrow places but stay complete in the editor field itself, even at 200+ characters', { parent: edge, text: 'Long title.' })
add('system-requirement', 'Unicode: Ünïcödé, 日本語, العربية, émojis 🌡️🔥, µs, ±, ≤, °C', { parent: edge, text: 'Mixed scripts and symbols: «العربية» — 温度 — Größe — ≤ 0.5 °C.' })
add('software-requirement', 'Requirement with an empty text', { parent: edge, text: '' })
add('software-requirement', 'Requirement with every field filled', { parent: edge, fields: { status: 'Approved', priority: 'High', owner: 'محمد علي', tags: [...TAGS] }, text: 'All fourteen tags are set.' })
add('software-requirement', 'Requirement with no fields at all', { parent: edge, fields: {}, text: 'No status, priority, owner or tags.' })
const longText = Array.from({ length: 120 }, (_, i) => `${i + 1}. The firmware shall ${pick(VERBS)} ${pick(OBJECTS)} ${pick(QUALIFIERS)}.`).join('\n')
add('software-requirement', 'Requirement with a very long text (120 lines)', { parent: edge, text: longText })
add('design-element', 'Design element with a code block', { parent: edge, text: '```c\nint regulate(float setpoint, float measured) {\n  return setpoint - measured > 0.5f ? HEAT_ON : HEAT_OFF;\n}\n```' })
const hub = add('system-requirement', 'Hub requirement linked by many test cases', { parent: edge, text: 'At least 40 test cases verify this one requirement — the "verified by" list must stay usable.' })
for (let i = 0; i < 40; i++) {
  const tc = add('test-case', `Hub verification ${i + 1}`, { parent: edge, text: textFor('test-case', 'thermostat') })
  link(tc, 'verifies', hub)
}
const many = add('software-requirement', 'Requirement with links of every type', { parent: edge, text: 'Outgoing links use all six link types.' })
for (const t of ['refines', 'satisfies', 'implements', 'verifies', 'mitigates', 'relates-to']) link(many, t, pick(allSys))

// deep hierarchy: 10 levels
let deep: Item = add('system-requirement', 'Deep hierarchy — level 1', { parent: edge, text: 'Expand ten levels down.' })
for (let lvl = 2; lvl <= 10; lvl++) deep = add('software-requirement', `Deep hierarchy — level ${lvl}`, { parent: deep, text: `Level ${lvl} of 10.` })

// wide hierarchy: 650 children (more than the 500 the tree loads at once → "Show more")
const wide = add('information', 'Wide section with 650 children', { parent: edge, fields: {}, text: 'The tree shows 500, then "Show more".' })
for (let i = 1; i <= 650; i++) add('interface-requirement', `Signal ${String(i).padStart(3, '0')}: ${pick(OBJECTS)}`, { parent: wide, text: `Interface signal number ${i}.` })

// fill any remaining budget with more test cases so the total hits TARGET (minus the broken files below)
const BROKEN_FILES = 2
while (items.length < TARGET - BROKEN_FILES) {
  const sys = pick(allSys)
  const tc = add('test-case', `Regression: ${sys.title}`, { parent: edge, text: textFor('test-case', 'device') })
  link(tc, 'verifies', sys)
}

// ---------- deliberately broken items (problems ReqMan must report, not crash on)
const broken = add('information', 'Deliberately broken test data', { fields: {}, text: 'Each item below contains one known problem. ReqMan should list them under "problems" in the status bar.' })
const problems: Item[] = []
problems.push(add('system-requirement', 'PROBLEM: link to an item that does not exist', { parent: broken, links: [{ type: 'verifies', target: 'SYS-ZZZZZZ' }], text: 'Expected: "link to SYS-ZZZZZZ, which does not exist".' }))
problems.push(add('system-requirement', 'PROBLEM: parent that does not exist', { text: 'Expected: "Parent SYS-YYYYYY does not exist". Appears nowhere in the tree.' }))
problems[1]!.parent = 'SYS-YYYYYY'
problems.push(add('system-requirement', 'PROBLEM: status value not in the schema', { parent: broken, fields: { status: 'Done' }, text: 'Expected: "Done" is not an allowed Status — shown when the item is opened.' }))
problems.push(add('system-requirement', 'PROBLEM: unknown link type', { parent: broken, links: [{ type: 'blocks', target: allSys[0]!.id }], text: 'Expected: unknown link type "blocks" — shown when opened.' }))
problems.push(add('test-case', 'NOTE: header key unknown to ReqMan (kept, not a problem)', { parent: broken, text: 'This file has "x-imported-from: DOORS"; ReqMan must keep it when saving.' }))
problems[4]!.extra = { 'x-imported-from': 'DOORS', 'x-legacy-id': 'REQ-00421' }

// ---------- link confirmations (suspect links)
// Every link records the fingerprint of its target as it was when the link was confirmed. Most are current;
// a few are not, as if the target was edited afterwards: those links show as "suspect" (⚠).
// Scenario: the hub requirement was reworded after 12 of its 40 test cases were confirmed.
hub.text += ' Reworded after 12 of its test cases were confirmed — those 12 links are suspect.'
const byId = new Map(items.map((i) => [i.id, i]))
let suspect = 0
for (const it of items) {
  for (const l of it.links) {
    const t = byId.get(l.target)
    if (!t) continue
    const stale = t === hub ? it.title.startsWith('Hub verification ') && Number(it.title.slice(17)) <= 12 : chance(0.015)
    // a stale confirmation = the fingerprint of an earlier wording of the target
    l.confirmed = contentFingerprint(stale ? { ...t, text: `${t.text} (earlier wording)` } : t)
    if (stale) suspect++
  }
}

// ---------- write
let written = 0
let next = 0
await Promise.all(
  Array.from({ length: 32 }, async () => {
    while (next < items.length) {
      const it = items[next++]
      if (!it) continue
      await repo.writeItem(it)
      if (++written % 2000 === 0) console.log(`${written} / ${items.length}`)
    }
  })
)
// two files ReqMan cannot read at all, and one renamed by hand
const itemsDir = join(repo.folder, 'items')
await writeFile(join(itemsDir, 'SYS-BROKEN.md'), 'This file has no YAML header — someone overwrote it by mistake.\n')
await writeFile(join(itemsDir, 'SW-BADYML.md'), '---\nid: SW-BADYML\ntype: software-requirement\ntitle: [unclosed\n---\nBroken YAML in the header.\n')
const renamed = items.find((i) => i.type === 'risk')
if (renamed) await rename(join(itemsDir, `${renamed.id}.md`), join(itemsDir, 'RSK-RENAMD.md'))

const byType = new Map<string, number>()
for (const i of items) byType.set(i.type, (byType.get(i.type) ?? 0) + 1)
console.log(`Wrote ${items.length} items + ${BROKEN_FILES} unreadable files to ${repo.folder}`)
console.log([...byType].sort((a, b) => b[1] - a[1]).map(([t, n]) => `  ${t}: ${n}`).join('\n'))
console.log(`  links: ${items.reduce((n, i) => n + i.links.length, 0)} (${suspect} suspect)`)
