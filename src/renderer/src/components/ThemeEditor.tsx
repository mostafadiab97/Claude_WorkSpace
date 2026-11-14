import { useEffect, useMemo, useState } from 'react'
import type { LoadedTheme, ThemeConfig, ThemeLayers, ThemeOverrides } from '../../../shared/api'
import { T } from '../../../shared/text'
import { contrastRatio, isHexColour } from '../lib/contrast'
import { onTabListKeyDown } from '../lib/keys'

type Group = 'colours' | 'typography' | 'shape' | 'spacing'
type Mode = 'light' | 'dark' | 'ember'

/** "textMuted" → "text muted": the theme file's own key, readable (the names are the same in every language). */
const keyName = (k: string): string => k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()

/** Colour keys under readable headings (UI review 0.24.0 U1); a key not listed goes under "Other". */
const COLOUR_GROUPS: [keyof typeof T.settings.themeEditor.groups, string[]][] = [
  ['surfaces', ['background', 'surface', 'surfaceAlt', 'border', 'borderStrong']],
  ['text', ['text', 'textMuted']],
  ['accents', ['primary', 'primaryHover', 'primaryText', 'focus']],
  ['status', ['success', 'warning', 'danger', 'gap', 'successBg', 'warningBg', 'dangerBg', 'infoBg']],
  ['table', ['rowHover', 'selection', 'scrollbarThumb', 'scrollbarThumbHover']],
  ['changes', ['diffOldBg', 'diffNewBg', 'diffOldMark', 'diffNewMark']]
]

/** Text pairs that must stay readable (front, back, needed ratio) — the same pairs the contrast test checks. */
const PAIRS: [string, string, number][] = [
  ['text', 'background', 4.5],
  ['text', 'surface', 4.5],
  ['textMuted', 'surface', 4.5],
  ['primaryText', 'primary', 4.5],
  ['primary', 'surface', 3],
  ['danger', 'surface', 4.5],
  ['success', 'surface', 3],
  ['borderStrong', 'surface', 3]
]

/** The theme as shown: the app theme with the user's values on top. */
function merged(base: ThemeConfig, user: ThemeOverrides): ThemeConfig {
  return {
    ...base,
    typography: { ...base.typography, ...user.typography },
    shape: { ...base.shape, ...user.shape },
    spacing: { ...base.spacing, ...user.spacing },
    modes: {
      light: { ...base.modes.light, ...user.modes?.light },
      dark: { ...base.modes.dark, ...user.modes?.dark },
      ember: { ...base.modes.ember, ...user.modes?.ember }
    }
  }
}

/** Is this a value the window can use? (colours checked by the browser itself, sizes by CSS). */
function valid(group: Group, value: string): boolean {
  if (value.trim() === '') return false
  // nothing that loads files or ends the declaration (QA 0.24.0 Q2; the core refuses it too)
  if (/url\s*\(|@import|[;{}<>]|\\/i.test(value)) return false
  if (group === 'colours') return CSS.supports('color', value)
  if (group === 'typography') return true
  return CSS.supports('width', value) || CSS.supports('box-shadow', value) || /^\d+(\.\d+)?$/.test(value)
}

/**
 * Settings → Theme editor (0.24.0, the owner's request of 13 Nov 2026): every value of the theme file in four groups,
 * colours per mode (Light, Dark, Ember). Every change shows in the whole window at once (onPreview); Save writes only
 * what differs from the app theme to the user's theme.json (the core checks it and writes atomically); Reset per value
 * and for everything. Leaving without saving shows the saved theme again.
 */
export function ThemeEditor(props: { onPreview: (config: ThemeConfig | null) => void; onSaved: (theme: LoadedTheme) => void; startMode: Mode }) {
  const tx = T.settings.themeEditor
  const [layers, setLayers] = useState<ThemeLayers | null>(null)
  const [user, setUser] = useState<ThemeOverrides>({})
  const [group, setGroup] = useState<Group>('colours')
  const [mode, setMode] = useState<Mode>(props.startMode)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const { onPreview } = props

  const [loadFailed, setLoadFailed] = useState(false)
  useEffect(() => {
    window.reqochet.getThemeLayers().then(
      (l) => {
        setLayers(l)
        setUser(l.user)
      },
      () => setLoadFailed(true) // code review 0.24.0 C7: not "Loading…" forever
    )
    // leaving the editor shows the saved theme again
    return () => onPreview(null)
  }, [onPreview])

  const shown = useMemo(() => (layers ? merged(layers.base, user) : null), [layers, user])
  useEffect(() => {
    if (shown) onPreview(shown)
  }, [shown, onPreview])

  if (loadFailed) return <p className="notice notice--error">{tx.loadFailed}</p>
  if (!layers || !shown) return <p className="muted">{T.common.loading}</p>

  const saved = JSON.stringify(layers.user)
  const dirty = JSON.stringify(user) !== saved
  const unsavedCount = countDiff(layers.user, user)
  const baseOf = (k: string): string => (group === 'colours' ? layers.base.modes[mode][k] : layers.base[group][k]) ?? ''
  const userOf = (k: string): string | undefined => (group === 'colours' ? user.modes?.[mode]?.[k] : user[group]?.[k])
  const keys = Object.keys(group === 'colours' ? layers.base.modes[mode] : layers.base[group])

  const set = (k: string, value: string | undefined): void => {
    setNote(null)
    setUser((u) => {
      const next: ThemeOverrides = structuredClone(u)
      const target: Record<string, string> =
        group === 'colours' ? ((next.modes ??= {})[mode] ??= {}) : (next[group] ??= {})
      // a value equal to the app's is not a change (the file keeps only real changes)
      if (value === undefined || value === baseOf(k)) delete target[k]
      else target[k] = value
      return prune(next)
    })
  }

  const save = async (): Promise<void> => {
    setBusy(true)
    try {
      const loaded = await window.reqochet.saveUserTheme(cleanForSave(user, layers.base), layers.revision)
      // what the file now holds becomes "saved" (code review 0.24.0 C4)
      const fresh = await window.reqochet.getThemeLayers()
      setLayers(fresh)
      setUser(fresh.user)
      props.onSaved(loaded)
      setNote({ ok: true, text: tx.saved })
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      setNote({ ok: false, text: m.includes('THEME_FILE_CHANGED') ? tx.changedOutside : m.includes('THEME_FILE_BROKEN') ? tx.fileBroken : tx.saveFailed(m) })
    } finally {
      setBusy(false)
    }
  }

  const groups: { id: Group; label: string }[] = [
    { id: 'colours', label: tx.colours },
    { id: 'typography', label: tx.fonts },
    { id: 'shape', label: tx.shape },
    { id: 'spacing', label: tx.spacing }
  ]
  const modes: { id: Mode; label: string }[] = [
    { id: 'light', label: T.app.theme.light },
    { id: 'dark', label: T.app.theme.dark },
    { id: 'ember', label: T.app.theme.ember }
  ]
  const colours = shown.modes[mode]
  const problems =
    group === 'colours'
      ? PAIRS.flatMap(([f, b, need]) => {
          const fc = colours[f]
          const bc = colours[b]
          if (!fc || !bc || !isHexColour(fc) || !isHexColour(bc)) return []
          const r = contrastRatio(fc, bc)
          return r < need ? [tx.contrast(keyName(f), keyName(b), r.toFixed(1), String(need))] : []
        })
      : []

  const sections: [string, string[]][] =
    group === 'colours'
      ? [
          ...COLOUR_GROUPS.map(([g, list]) => [tx.groups[g], list.filter((k) => keys.includes(k))] as [string, string[]]),
          [tx.groups.other, keys.filter((k) => !COLOUR_GROUPS.some(([, list]) => list.includes(k)))] as [string, string[]]
        ].filter(([, list]) => list.length > 0)
      : [['', keys]]

  return (
    <section className="card theme-editor" aria-label={T.settings.nav.theme}>
      <p className="hint hint--flush">{tx.intro}</p>
      <div className="tabs" role="tablist" aria-label={T.settings.nav.theme} onKeyDown={onTabListKeyDown}>
        {groups.map((g) => (
          <button key={g.id} type="button" role="tab" id={`theme-tab-${g.id}`} aria-controls="theme-panel" aria-selected={group === g.id} tabIndex={group === g.id ? 0 : -1} className={group === g.id ? 'tab tab--active' : 'tab'} onClick={() => setGroup(g.id)}>
            {g.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="theme-panel" aria-labelledby={`theme-tab-${group}`} className="theme-editor__panel">
        {group === 'colours' && (
          <div className="theme-editor__modes" role="radiogroup" aria-label={tx.mode}>
            <span className="field__label">{tx.mode}</span>
            {modes.map((m) => (
              <label key={m.id} className="check">
                <input type="radio" name="theme-editor-mode" checked={mode === m.id} onChange={() => setMode(m.id)} />
                {m.label}
              </label>
            ))}
          </div>
        )}
        {/* the contrast warning above the list, where it is seen (UI review 0.24.0 U2) */}
        {group === 'colours' && (
          <p className={problems.length > 0 ? 'notice notice--warn' : 'hint'} role={problems.length > 0 ? 'alert' : undefined}>
            {problems.length > 0 ? problems.join(' · ') : tx.contrastOk}
          </p>
        )}
        {sections.map(([title, list]) => (
          <div key={title || 'all'} className="theme-editor__section">
            {title && <h3 className="theme-editor__heading">{title}</h3>}
            <div className="theme-editor__grid">
              {list.map((k) => {
            const mine = userOf(k)
            const value = mine ?? baseOf(k)
            const ok = valid(group, value)
            return (
              <div key={k} className={mine !== undefined ? 'theme-row theme-row--changed' : 'theme-row'}>
                <label className="theme-row__name" htmlFor={`theme-${group}-${k}`}>
                  {keyName(k)}
                  {mine !== undefined && <span className="theme-row__changed">{tx.changed}</span>}
                </label>
                {group === 'colours' && isHexColour(value) && (
                  <input type="color" className="theme-row__swatch" aria-label={keyName(k)} value={value.length === 4 ? expand(value) : value.slice(0, 7)} onChange={(e) => set(k, e.target.value)} />
                )}
                <input
                  id={`theme-${group}-${k}`}
                  className="input theme-row__value"
                  value={value}
                  spellCheck={false}
                  aria-invalid={ok ? undefined : true}
                  aria-describedby={ok ? undefined : `theme-${group}-${k}-error`}
                  onChange={(e) => set(k, e.target.value)}
                  dir="ltr"
                />
                {!ok && <span className="theme-row__invalid" id={`theme-${group}-${k}-error`}>{tx.invalid}</span>}
                <button type="button" className="btn btn--small" disabled={mine === undefined} title={tx.resetTooltip(baseOf(k))} onClick={() => set(k, undefined)}>
                  {tx.reset}
                </button>
              </div>
            )
          })}
            </div>
          </div>
        ))}
        <div className="theme-editor__sample" aria-hidden="true">
          <strong>{tx.sample}</strong>
          <span className="theme-editor__sample-text">{tx.sampleText}</span>
          <span className="actions">
            <button type="button" className="btn btn--primary" tabIndex={-1}>
              {tx.save}
            </button>
            <button type="button" className="btn" tabIndex={-1}>
              {T.common.cancel}
            </button>
            <input className="input" tabIndex={-1} readOnly value={tx.sampleId} aria-hidden="true" />
          </span>
        </div>
      </div>
      <div className="actions actions--wrap">
        <button type="button" className="btn btn--primary" disabled={busy || !dirty} onClick={() => void save()}>
          {tx.save}
        </button>
        <button type="button" className="btn" disabled={busy || !dirty} onClick={() => setUser(layers.user)}>
          {tx.discard}
        </button>
        <button type="button" className="btn btn--danger-outline" disabled={busy || Object.keys(user).length === 0} onClick={() => setUser({})}>
          {tx.resetAll}
        </button>
        <button type="button" className="link-btn" onClick={() => void window.reqochet.openThemeFolder()}>
          {T.settings.diag.editTheme}
        </button>
      </div>
      {dirty && <p className="hint">{tx.unsaved(unsavedCount)}</p>}
      {note && (
        <p className={note.ok ? 'notice notice--ok' : 'notice notice--error'} role={note.ok ? 'status' : 'alert'}>
          {note.text}
        </p>
      )}
    </section>
  )
}

/** #abc → #aabbcc (the colour picker wants six digits). */
function expand(v: string): string {
  return '#' + v.slice(1).split('').map((c) => c + c).join('')
}

/** Drops empty groups and modes. */
function prune(o: ThemeOverrides): ThemeOverrides {
  const out: ThemeOverrides = {}
  for (const g of ['typography', 'shape', 'spacing'] as const) if (o[g] && Object.keys(o[g]).length > 0) out[g] = o[g]
  if (o.modes) {
    const m: NonNullable<ThemeOverrides['modes']> = {}
    for (const k of ['light', 'dark', 'ember'] as const) if (o.modes[k] && Object.keys(o.modes[k]).length > 0) m[k] = o.modes[k]
    if (Object.keys(m).length > 0) out.modes = m
  }
  return out
}

/** Only valid values are saved (an invalid one would be ignored by the app anyway, so the app value stays). */
function cleanForSave(user: ThemeOverrides, base: ThemeConfig): ThemeOverrides {
  const out: ThemeOverrides = structuredClone(user)
  const filter = (rec: Record<string, string> | undefined, group: Group, baseRec: Record<string, string>): void => {
    if (!rec) return
    for (const [k, v] of Object.entries(rec)) if (!valid(group, v) || v === baseRec[k]) delete rec[k]
  }
  filter(out.typography, 'typography', base.typography)
  filter(out.shape, 'shape', base.shape)
  filter(out.spacing, 'spacing', base.spacing)
  for (const m of ['light', 'dark', 'ember'] as const) filter(out.modes?.[m], 'colours', base.modes[m])
  return prune(out)
}

/** How many values differ between two override sets. */
function countDiff(a: ThemeOverrides, b: ThemeOverrides): number {
  const flat = (o: ThemeOverrides): Map<string, string> => {
    const m = new Map<string, string>()
    for (const g of ['typography', 'shape', 'spacing'] as const) for (const [k, v] of Object.entries(o[g] ?? {})) m.set(`${g}.${k}`, v)
    for (const md of ['light', 'dark', 'ember'] as const) for (const [k, v] of Object.entries(o.modes?.[md] ?? {})) m.set(`${md}.${k}`, v)
    return m
  }
  const fa = flat(a)
  const fb = flat(b)
  let n = 0
  for (const k of new Set([...fa.keys(), ...fb.keys()])) if (fa.get(k) !== fb.get(k)) n++
  return n
}
