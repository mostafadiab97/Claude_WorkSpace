import { generateId, keyBetween, type Item } from '../items'
import type { Schema } from '../schema'

export interface SampleOptions {
  /** Total number of items to generate. */
  count: number
  /** Same seed → same titles, texts, structure (IDs are still random). */
  seed?: number
}

/** Small deterministic random generator (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SUBJECTS = ['thermostat', 'control unit', 'display', 'mobile app', 'temperature sensor', 'heating relay', 'scheduler', 'firmware', 'Wi-Fi module', 'power supply', 'cloud service', 'enclosure']
const VERBS = ['measure', 'report', 'store', 'display', 'switch', 'validate', 'encrypt', 'log', 'restore', 'limit', 'synchronise', 'detect']
const OBJECTS = ['the room temperature', 'the set point', 'schedule entries', 'relay events', 'firmware packages', 'user preferences', 'connection status', 'error conditions', 'energy usage', 'sensor readings', 'safety limits', 'the operating mode']
const QUALIFIERS = ['within 200 ms', 'with an accuracy of ±0.5 °C', 'at least once per minute', 'after a power loss', 'without user interaction', 'in under 3 seconds', 'for at least 10 years', 'when the network is unavailable', 'using AES-256', 'below 0.5 W in standby']
const OWNERS = ['A. Hassan', 'M. Farouk', 'S. Adel', 'N. Kamal', 'Y. Saber', 'R. Nabil', 'H. Mostafa', 'L. Samir']
const TAGS = ['safety', 'ux', 'connectivity', 'power', 'security', 'performance', 'regulatory']
const STATUSES = ['Draft', 'Draft', 'Review', 'Approved', 'Approved', 'Approved', 'Obsolete']
const PRIORITIES = ['High', 'Medium', 'Medium', 'Low']

/** Share of each type in the generated set, in creation order (parents before children). */
const MIX: [type: string, share: number][] = [
  ['information', 0.03],
  ['stakeholder-need', 0.05],
  ['system-requirement', 0.2],
  ['software-requirement', 0.3],
  ['hardware-requirement', 0.1],
  ['test-case', 0.25],
  ['risk', 0.05],
  ['change-request', 0.02]
]

const PARENT_TYPE: Record<string, string> = {
  'system-requirement': 'stakeholder-need',
  'software-requirement': 'system-requirement',
  'hardware-requirement': 'system-requirement'
}

export function generateItems(schema: Schema, { count, seed = 1 }: SampleOptions): Item[] {
  const rand = rng(seed)
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T
  const knownTypes = new Set(schema.itemTypes.map((t) => t.id))
  const taken = new Set<string>()
  const byType = new Map<string, Item[]>()
  const items: Item[] = []
  const orderCounter = new Map<string, string>()

  const sentence = (): string => `The ${pick(SUBJECTS)} shall ${pick(VERBS)} ${pick(OBJECTS)} ${pick(QUALIFIERS)}.`
  const nextOrder = (parent: string): string => {
    const k = keyBetween(orderCounter.get(parent) ?? null, null)
    orderCounter.set(parent, k)
    return k
  }

  let made = 0
  MIX.forEach(([type, share], idx) => {
    if (!knownTypes.has(type)) return
    const n = idx === MIX.length - 1 ? count - made : Math.round(count * share)
    for (let i = 0; i < n && made < count; i++, made++) {
      const id = generateId((x) => taken.has(x))
      taken.add(id)
      const text = type === 'information' ? `Overview of the ${pick(SUBJECTS)}.` : `${sentence()}${rand() < 0.4 ? `\n\nRationale: ${sentence()}` : ''}`
      const subject = pick(SUBJECTS)
      const action = `${pick(VERBS)}s ${pick(OBJECTS)}`
      const item: Item = {
        id,
        type,
        title: type === 'test-case' ? `Verify ${subject} ${action}` : `${subject.charAt(0).toUpperCase()}${subject.slice(1)} ${action}`,
        fields: {
          status: pick(STATUSES),
          priority: pick(PRIORITIES),
          owner: pick(OWNERS),
          ...(rand() < 0.6 ? { tags: [...new Set([pick(TAGS), pick(TAGS)])] } : {})
        },
        links: [],
        text,
        extra: {}
      }
      const parentType = PARENT_TYPE[type]
      const parents = parentType ? byType.get(parentType) : undefined
      if (parents && parents.length > 0) {
        const parent = pick(parents)
        item.parent = parent.id
        item.order = nextOrder(parent.id)
        item.links.push({ type: 'refines', target: parent.id })
      } else {
        item.order = nextOrder('')
      }
      if (type === 'test-case') {
        const targets = [...(byType.get('software-requirement') ?? []), ...(byType.get('system-requirement') ?? [])]
        const k = 1 + Math.floor(rand() * 2)
        for (let j = 0; j < k && targets.length > 0; j++) {
          const t = pick(targets).id
          if (!item.links.some((l) => l.target === t)) item.links.push({ type: 'verifies', target: t })
        }
      }
      if (type === 'risk') {
        const sys = byType.get('system-requirement') ?? []
        if (sys.length > 0) item.links.push({ type: 'relates-to', target: pick(sys).id })
      }
      if (!byType.has(type)) byType.set(type, [])
      byType.get(type)?.push(item)
      items.push(item)
    }
  })
  return items
}
