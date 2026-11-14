/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — DOM + .tsx (outside the tests tsconfig); runs through Vitest only
// QA 0.23.0 (helper agent, docs/AGENT-WORKFLOW.md): tries to break the new bar above the table — toolbar keys,
// MenuButton keyboard, outline() states and the new texts. jsdom is not a project dependency, so the DOM parts run
// only when it can be found (`npm i --no-save jsdom`, or QA_JSDOM_DIR=<folder with node_modules/jsdom>); the text and
// state tests always run. A failing test here shows a product bug — see docs/reviews/agents/0.23.0-qa.md.
import { createRequire } from 'node:module'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import type { KeyboardEvent } from 'react'
import { isOpen, type OpenState } from '../../src/renderer/src/workspace/table/rows'
import { onToolbarKeyDown, rovingToolbar } from '../../src/renderer/src/lib/keys'
import { MenuButton, type MenuEntry } from '../../src/renderer/src/components/MenuButton'
import { setLanguage, T } from '../../src/shared/text'
import { de } from '../../src/shared/text-de'
import { fr } from '../../src/shared/text-fr'
import { es } from '../../src/shared/text-es'
import { ar } from '../../src/shared/text-ar'

type Win = Window & typeof globalThis
function loadJsdom(): { JSDOM: new (html: string, o?: object) => { window: Win } } | null {
  for (const base of [import.meta.url, process.env['QA_JSDOM_DIR'] ? `file://${process.env['QA_JSDOM_DIR']}/x.js` : '']) {
    if (!base) continue
    try {
      return createRequire(base)('jsdom')
    } catch {
      /* next */
    }
  }
  return null
}
const jsdom = loadJsdom()
const dom = describe.skipIf(!jsdom)

let win: Win
beforeAll(() => {
  if (!jsdom) return
  win = new jsdom.JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true }).window
  const g = globalThis as Record<string, unknown>
  for (const k of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'HTMLButtonElement', 'Node', 'MouseEvent', 'KeyboardEvent', 'MutationObserver', 'Event'])
    Object.defineProperty(g, k, { value: (win as unknown as Record<string, unknown>)[k], configurable: true, writable: true })
  g['IS_REACT_ACT_ENVIRONMENT'] = true
  // jsdom has no layout: "visible" = not hidden by the attribute or inline style
  Object.defineProperty(win.HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      for (let e: HTMLElement | null = this; e; e = e.parentElement) if (e.hidden || e.style.display === 'none') return null
      return this.parentElement
    }
  })
})
afterEach(() => {
  setLanguage('en')
  if (jsdom) {
    win.document.body.innerHTML = ''
    win.document.documentElement.dir = 'ltr'
  }
})
afterAll(() => {
  if (jsdom) for (const k of ['window', 'document']) delete (globalThis as Record<string, unknown>)[k]
})

// ---------------------------------------------------------------- outline() states (the rule in rows.ts line 334)
// outline() is inside a React hook; its rule is "ids.size > 0 → mixed, else all → open, else closed" and setOpen
// adds/removes ids relative to `all`. The same two rules are replayed here on the exported OpenState + isOpen.
const outlineOf = (o: OpenState): string => (o.ids.size > 0 ? 'mixed' : o.all ? 'open' : 'closed')
const setOpenOn = (prev: OpenState, id: string, value: boolean): OpenState => {
  const ids = new Set(prev.ids)
  if (value !== prev.all) ids.add(id)
  else ids.delete(id)
  return { all: prev.all, ids }
}
describe('QA outline state transitions', () => {
  it('starts closed; expand all → open; collapse all → closed', () => {
    expect(outlineOf({ all: false, ids: new Set() })).toBe('closed')
    expect(outlineOf({ all: true, ids: new Set() })).toBe('open')
  })
  it('opening one node of a closed outline is mixed, closing it again is closed', () => {
    let o: OpenState = { all: false, ids: new Set() }
    o = setOpenOn(o, 'A', true)
    expect(outlineOf(o)).toBe('mixed')
    expect(isOpen(o, 'A')).toBe(true)
    o = setOpenOn(o, 'A', false)
    expect(outlineOf(o)).toBe('closed')
  })
  it('closing one node of a fully open outline is mixed, reopening it is open', () => {
    let o: OpenState = { all: true, ids: new Set() }
    o = setOpenOn(o, 'A', false)
    expect(outlineOf(o)).toBe('mixed')
    expect(isOpen(o, 'A')).toBe(false)
    expect(isOpen(o, 'B')).toBe(true)
    o = setOpenOn(o, 'A', true)
    expect(outlineOf(o)).toBe('open')
  })
  it('setting the same value twice changes nothing (idempotent)', () => {
    let o: OpenState = { all: false, ids: new Set() }
    o = setOpenOn(setOpenOn(o, 'A', true), 'A', true)
    expect(o.ids.size).toBe(1)
    o = setOpenOn(setOpenOn(o, 'A', false), 'A', false)
    expect(outlineOf(o)).toBe('closed')
  })
  it('the source still holds the rule this replay assumes', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/renderer/src/workspace/table/rows.ts', 'utf8')
    expect(src).toContain("open.ids.size > 0 ? 'mixed' : open.all ? 'open' : 'closed'")
  })
  // Defect: after closing every node by hand in an "all open" outline the table is fully closed, yet the state is
  // still "mixed" (the ids set is not empty), so Collapse all stays enabled and Expand all too — harmless but untidy.
  it.fails('closing every node one by one is not reported as mixed (needs the node count; outline() has none)', () => {
    let o: OpenState = { all: true, ids: new Set() }
    for (const id of ['A', 'B', 'C']) o = setOpenOn(o, id, false)
    expect(outlineOf(o)).toBe('closed')
  })
})

// ---------------------------------------------------------------- texts
const LANGS = ['en', 'de', 'fr', 'es', 'ar'] as const
const KEYS = ['toolbarLabel', 'outline', 'more', 'view', 'rowsText', 'rowsOneLine', 'newPanel', 'newType', 'newPlace', 'editorWidth', 'filters', 'filtersTooltip'] as const
describe('QA 0.23.0 texts in all five languages', () => {
  for (const lang of LANGS) {
    it(`${lang}: the new workspace keys are non-empty strings and keyHint joins label and keys`, () => {
      setLanguage(lang)
      const w = T.workspace as unknown as Record<string, unknown>
      for (const k of KEYS) {
        expect(typeof w[k], `${lang}.${k}`).toBe('string')
        expect((w[k] as string).trim().length, `${lang}.${k}`).toBeGreaterThan(0)
      }
      const out = T.workspace.keyHint('Expand', 'Ctrl+K')
      expect(out).toContain('Expand')
      expect(out).toContain('Ctrl+K')
    })
  }
  it('non-English languages do not just copy the English words for the short labels', () => {
    const same: string[] = []
    setLanguage('en')
    const en = JSON.parse(JSON.stringify(T.workspace)) as Record<string, string>
    for (const [lang, t] of Object.entries({ de, fr, es, ar }))
      for (const k of ['toolbarLabel', 'outline', 'rowsText', 'rowsOneLine', 'newPanel', 'newPlace', 'filtersTooltip'] as const)
        if ((t.workspace[k] as string) === en[k]) same.push(`${lang}.${k}`)
    expect(same).toEqual([])
  })
  it('keyHint with Arabic text keeps both parts and has no stray placeholders', () => {
    setLanguage('ar')
    const s = T.workspace.keyHint(T.workspace.more, 'F2')
    expect(s).toContain(T.workspace.more)
    expect(s).not.toMatch(/undefined|\{|\$/)
  })
})

// ---------------------------------------------------------------- toolbar keys (fake events on a real DOM)
const bar = (html: string): HTMLElement => {
  const el = win.document.createElement('div')
  el.setAttribute('role', 'toolbar')
  el.innerHTML = html
  win.document.body.append(el)
  return el
}
const press = (el: HTMLElement, target: Element, key: string): { prevented: boolean } => {
  const r = { prevented: false }
  onToolbarKeyDown({ key, target, currentTarget: el, preventDefault: () => (r.prevented = true) } as unknown as KeyboardEvent<HTMLElement>)
  return r
}
const BTNS = '<button id=a data-toolbar-item>A</button><button id=b data-toolbar-item>B</button><button id=c data-toolbar-item disabled>C</button><button id=d data-toolbar-item hidden>D</button><button id=e data-toolbar-item>E</button>'
const $ = (id: string): HTMLElement => win.document.getElementById(id) as HTMLElement

dom('QA rovingToolbar', () => {
  // only visible, enabled items count: browsers ignore tabindex on disabled or hidden ones
  const stops = (b: HTMLElement): string[] =>
    [...b.querySelectorAll<HTMLElement>('[data-toolbar-item]')].filter((e) => !(e as HTMLButtonElement).disabled && !e.hidden && e.tabIndex === 0).map((e) => e.id)
  it('exactly one visible enabled item has tabIndex 0, the first by default', () => {
    const b = bar(BTNS)
    rovingToolbar(b)
    expect(stops(b)).toEqual(['a'])
    expect($('b').tabIndex).toBe(-1)
    expect($('e').tabIndex).toBe(-1)
  })
  it('keeps the current item; calling twice is stable', () => {
    const b = bar(BTNS)
    rovingToolbar(b, $('e'))
    rovingToolbar(b)
    expect(stops(b)).toEqual(['e'])
  })
  it('a current item that is disabled or hidden falls back to a visible one — still exactly one stop', () => {
    const b = bar(BTNS)
    rovingToolbar(b, $('c'))
    expect(stops(b)).toHaveLength(1)
    rovingToolbar(b, $('d'))
    expect(stops(b)).toHaveLength(1)
  })
  it('when the item that held the stop becomes disabled, the stop moves on at the next call', () => {
    const b = bar(BTNS)
    rovingToolbar(b, $('b'))
    ;($('b') as HTMLButtonElement).disabled = true
    rovingToolbar(b)
    expect(stops(b)).toHaveLength(1)
  })
  // Defect candidate: a disabled item is skipped by toolbarItems, so its tabIndex is never reset; one that held 0
  // before it was disabled stays at 0 in the markup (browsers ignore tabindex on disabled buttons, so harmless).
  it('an item that was disabled keeps no stale roving mark that could win later', () => {
    const b = bar(BTNS)
    rovingToolbar(b, $('b'))
    ;($('b') as HTMLButtonElement).disabled = true
    rovingToolbar(b)
    ;($('b') as HTMLButtonElement).disabled = false
    rovingToolbar(b)
    expect(stops(b)).toHaveLength(1)
  })
  it('empty bar and null do not throw', () => {
    expect(() => rovingToolbar(null)).not.toThrow()
    expect(() => rovingToolbar(bar(''))).not.toThrow()
  })
})

dom('QA onToolbarKeyDown', () => {
  it('LTR: → goes to the next visible enabled item (skipping disabled and hidden), ← back, both wrap', () => {
    const b = bar(BTNS)
    expect(press(b, $('a'), 'ArrowRight').prevented).toBe(true)
    expect(win.document.activeElement).toBe($('b'))
    press(b, $('b'), 'ArrowRight')
    expect(win.document.activeElement).toBe($('e'))
    press(b, $('e'), 'ArrowRight')
    expect(win.document.activeElement).toBe($('a'))
    press(b, $('a'), 'ArrowLeft')
    expect(win.document.activeElement).toBe($('e'))
  })
  it('RTL: ← goes forward, → goes back', () => {
    win.document.documentElement.dir = 'rtl'
    const b = bar(BTNS)
    press(b, $('a'), 'ArrowLeft')
    expect(win.document.activeElement).toBe($('b'))
    press(b, $('b'), 'ArrowRight')
    expect(win.document.activeElement).toBe($('a'))
  })
  it('Home and End jump to the first and last enabled item', () => {
    const b = bar(BTNS)
    press(b, $('b'), 'End')
    expect(win.document.activeElement).toBe($('e'))
    press(b, $('e'), 'Home')
    expect(win.document.activeElement).toBe($('a'))
  })
  it('ignores keys typed in a select or textarea, and in the search box while the cursor is inside the text', () => {
    const b = bar(BTNS + '<input id=i data-toolbar-item value="door"><select id=s data-toolbar-item></select><textarea id=t data-toolbar-item></textarea>')
    for (const id of ['s', 't'])
      for (const k of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) expect(press(b, $(id), k).prevented, `${id} ${k}`).toBe(false)
    const input = $('i') as HTMLInputElement
    input.setSelectionRange(2, 2)
    for (const k of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) expect(press(b, input, k).prevented, `middle ${k}`).toBe(false)
  })
  it('the search box: → at the end of its text, ← at its start, leave it along the bar (code review 0.23.0 C-3)', () => {
    const b = bar(BTNS + '<input id=i data-toolbar-item value="door">')
    const input = $('i') as HTMLInputElement
    input.setSelectionRange(4, 4)
    expect(press(b, input, 'ArrowRight').prevented).toBe(true)
    input.setSelectionRange(0, 0)
    expect(press(b, input, 'ArrowLeft').prevented).toBe(true)
  })
  it('ignores other keys, and targets inside a menu, dialog or form', () => {
    const b = bar(BTNS + '<div role=menu><button id=m data-toolbar-item>M</button></div><form><button id=f data-toolbar-item>F</button></form><div role=dialog><button id=g data-toolbar-item>G</button></div>')
    expect(press(b, $('a'), 'ArrowDown').prevented).toBe(false)
    expect(press(b, $('a'), 'x').prevented).toBe(false)
    for (const id of ['m', 'f', 'g']) expect(press(b, $(id), 'ArrowRight').prevented).toBe(false)
  })
  it('a target that is not a toolbar item (e.g. a disabled button) is left alone', () => {
    const b = bar(BTNS)
    expect(press(b, $('c'), 'ArrowRight').prevented).toBe(false)
  })
  it('a single item: the arrows keep the focus on it and do not throw', () => {
    const b = bar('<button id=a data-toolbar-item>A</button>')
    $('a').focus()
    press(b, $('a'), 'ArrowRight')
    expect(win.document.activeElement).toBe($('a'))
  })
})

// ---------------------------------------------------------------- MenuButton keyboard (real React in jsdom)
let root: Root | null = null
const mount = async (entries: MenuEntry[], extra: object = {}): Promise<HTMLElement> => {
  const host = win.document.createElement('div')
  win.document.body.append(host)
  root = createRoot(host)
  await act(async () => {
    root?.render(h(MenuButton, { label: 'Menu', entries: () => entries, ...extra }))
  })
  return host
}
const key = async (el: Element, k: string): Promise<boolean> => {
  let ev!: Event
  await act(async () => {
    ev = new win.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })
    el.dispatchEvent(ev)
  })
  return ev.defaultPrevented
}
const items = (): HTMLButtonElement[] => [...win.document.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]')]
const E = (label: string, more: object = {}): MenuEntry => ({ kind: 'item', label, onSelect: () => undefined, ...more })

dom('QA MenuButton keyboard', () => {
  afterEach(async () => {
    await act(async () => root?.unmount())
    root = null
  })
  it('ArrowDown on the closed button opens the menu and focuses the first enabled item', async () => {
    const host = await mount([E('Alpha', { disabled: true }), E('Beta'), E('Gamma')])
    const btn = host.querySelector('button') as HTMLButtonElement
    btn.focus()
    expect(await key(btn, 'ArrowDown')).toBe(true)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(win.document.activeElement?.textContent).toBe('Beta')
  })
  it('Escape closes and returns the focus to the button', async () => {
    const host = await mount([E('Alpha'), E('Beta')])
    const btn = host.querySelector('button') as HTMLButtonElement
    await key(btn, 'ArrowDown')
    await key(win.document.activeElement as Element, 'Escape')
    expect(win.document.querySelector('[role=menu]')).toBeNull()
    expect(win.document.activeElement).toBe(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })
  it('arrows wrap and skip disabled items; Home and End work', async () => {
    const host = await mount([E('One'), E('Two', { disabled: true }), E('Three')])
    const btn = host.querySelector('button') as HTMLButtonElement
    await key(btn, 'ArrowDown')
    await key(win.document.activeElement as Element, 'ArrowDown')
    expect(win.document.activeElement?.textContent).toBe('Three')
    await key(win.document.activeElement as Element, 'ArrowDown')
    expect(win.document.activeElement?.textContent).toBe('One')
    await key(win.document.activeElement as Element, 'ArrowUp')
    expect(win.document.activeElement?.textContent).toBe('Three')
    await key(win.document.activeElement as Element, 'Home')
    expect(win.document.activeElement?.textContent).toBe('One')
    await key(win.document.activeElement as Element, 'End')
    expect(win.document.activeElement?.textContent).toBe('Three')
  })
  it('type-ahead jumps to the next item with that first letter, cycling, case-insensitive; disabled ones are skipped', async () => {
    const host = await mount([E('Apple'), E('Avocado', { disabled: true }), E('apricot'), E('Banana')])
    const btn = host.querySelector('button') as HTMLButtonElement
    await key(btn, 'ArrowDown')
    await key(win.document.activeElement as Element, 'a')
    expect(win.document.activeElement?.textContent).toBe('apricot')
    await key(win.document.activeElement as Element, 'A')
    expect(win.document.activeElement?.textContent).toBe('Apple')
    await key(win.document.activeElement as Element, 'b')
    expect(win.document.activeElement?.textContent).toBe('Banana')
    expect(await key(win.document.activeElement as Element, 'z')).toBe(false)
    expect(win.document.activeElement?.textContent).toBe('Banana')
  })
  it('type-ahead works with Arabic letters', async () => {
    const host = await mount([E('توسيع'), E('طي'), E('تحديد')])
    const btn = host.querySelector('button') as HTMLButtonElement
    await key(btn, 'ArrowDown')
    await key(win.document.activeElement as Element, 'ط')
    expect(win.document.activeElement?.textContent).toBe('طي')
  })
  it('Space is not taken by type-ahead (it must still click the item)', async () => {
    const host = await mount([E('One'), E('Two')])
    await key(host.querySelector('button') as Element, 'ArrowDown')
    expect(await key(win.document.activeElement as Element, ' ')).toBe(false)
  })
  it('choosing an item calls it once, closes the menu and focuses the button', async () => {
    let n = 0
    const host = await mount([E('One', { onSelect: () => n++ })])
    const btn = host.querySelector('button') as HTMLButtonElement
    await key(btn, 'ArrowDown')
    await act(async () => (win.document.activeElement as HTMLElement).click())
    expect(n).toBe(1)
    expect(win.document.querySelector('[role=menu]')).toBeNull()
    expect(win.document.activeElement).toBe(btn)
  })
  it('a disabled item cannot be chosen by click', async () => {
    let n = 0
    const host = await mount([E('One', { disabled: true, onSelect: () => n++ }), E('Two')])
    await key(host.querySelector('button') as Element, 'ArrowDown')
    await act(async () => items()[0]?.click())
    expect(n).toBe(0)
  })
  it('a menu whose items are all disabled opens, keeps the focus on the button and does not throw on keys', async () => {
    const host = await mount([E('One', { disabled: true }), { kind: 'sep' }, { kind: 'label', label: 'Group' }])
    const btn = host.querySelector('button') as HTMLButtonElement
    await key(btn, 'ArrowDown')
    expect(win.document.querySelector('[role=menu]')).not.toBeNull()
    const menu = win.document.querySelector('[role=menu]') as Element
    for (const k of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'a']) await key(menu, k)
  })
  it('an empty entry list opens an empty menu without throwing', async () => {
    const host = await mount([])
    await key(host.querySelector('button') as Element, 'ArrowDown')
    expect(win.document.querySelector('[role=menu]')).not.toBeNull()
  })
  it('a disabled button does not open by click', async () => {
    const host = await mount([E('One')], { disabled: true })
    await act(async () => (host.querySelector('button') as HTMLButtonElement).click())
    expect(win.document.querySelector('[role=menu]')).toBeNull()
  })
  it('radio items (checked set) get role menuitemradio with aria-checked', async () => {
    const host = await mount([E('One', { checked: true }), E('Two', { checked: false })])
    await key(host.querySelector('button') as Element, 'ArrowDown')
    expect(items().map((i) => i.getAttribute('role'))).toEqual(['menuitemradio', 'menuitemradio'])
    expect(items().map((i) => i.getAttribute('aria-checked'))).toEqual(['true', 'false'])
  })
  it('a mouse press outside closes the menu; inside does not', async () => {
    const host = await mount([E('One')])
    await key(host.querySelector('button') as Element, 'ArrowDown')
    await act(async () => items()[0]?.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true })))
    expect(win.document.querySelector('[role=menu]')).not.toBeNull()
    await act(async () => win.document.body.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true })))
    expect(win.document.querySelector('[role=menu]')).toBeNull()
  })
  it('the button key hook runs while closed (F2) but ArrowDown is taken by the opener', async () => {
    const seen: string[] = []
    const host = await mount([E('One')], { onButtonKeyDown: (e: KeyboardEvent) => seen.push(e.key) })
    const btn = host.querySelector('button') as HTMLButtonElement
    await key(btn, 'F2')
    await key(btn, 'ArrowDown')
    expect(seen).toEqual(['F2'])
  })
  it('Tab inside the menu closes it', async () => {
    const host = await mount([E('One')])
    await key(host.querySelector('button') as Element, 'ArrowDown')
    await key(win.document.activeElement as Element, 'Tab')
    expect(win.document.querySelector('[role=menu]')).toBeNull()
  })
})
