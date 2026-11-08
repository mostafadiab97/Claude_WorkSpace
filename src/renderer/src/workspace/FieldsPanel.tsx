import { useEffect, useRef, useState } from 'react'
import type { FieldCheck, RepoInfo } from '../../../shared/api'
import type { FieldDef, FieldType, Schema } from '../../../shared/domain'
import { errorMessage } from '../lib/hooks'
import { staleTranslations } from '../lib/schema'
import { columnOrder, optionalColumns, orderColumns, type ColumnPrefs } from './ItemTable'
import { T } from '../../../shared/text'

// ---------------------------------------------------------------- show / hide columns

const storageKey = (root: string): string => `reqman.columns:${root}`
const oldKey = (root: string): string => `reqman.hiddenColumns:${root}`

/** Hidden columns, column order and widths, remembered per repository on this PC (personal, not shared through Git). */
export function useColumnPrefs(root: string): [ColumnPrefs, (next: ColumnPrefs) => void] {
  const [prefs, setPrefs] = useState<ColumnPrefs>(() => {
    try {
      const raw = localStorage.getItem(storageKey(root))
      if (raw) {
        const p = JSON.parse(raw) as { hidden?: string[]; order?: string[]; widths?: Record<string, number>; oneLine?: boolean }
        return { hidden: new Set(p.hidden ?? []), order: p.order ?? [], widths: p.widths ?? {}, oneLine: p.oneLine === true }
      }
      const old = localStorage.getItem(oldKey(root)) // v0.3.0 kept only the hidden list
      return { hidden: new Set(old ? (JSON.parse(old) as string[]) : []), order: [] }
    } catch {
      return { hidden: new Set(), order: [] }
    }
  })
  const update = (next: ColumnPrefs): void => {
    setPrefs(next)
    try {
      localStorage.setItem(storageKey(root), JSON.stringify({ hidden: [...next.hidden], order: next.order, widths: next.widths ?? {}, oneLine: next.oneLine === true }))
    } catch {
      // storage unavailable: the choice lasts until the window closes
    }
  }
  return [prefs, update]
}

/** "Columns" button: tick the columns to show, ↑/↓ to reorder; "Edit fields…" opens the field definitions. */
export function ColumnsMenu({ schema, prefs, onChange, onEditFields, onEditTypes }: { schema: Schema; prefs: ColumnPrefs; onChange: (p: ColumnPrefs) => void; onEditFields: () => void; onEditTypes?: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const cols = optionalColumns(schema)
  // the order list: every column after No. and Title, ID included (it cannot be hidden, but it can be moved —
  // before 0.15 it was left out, so moving a column sent ID to the end); No. always stays first
  const movable = orderColumns<{ key: string; label: string; builtIn: boolean; fixed?: boolean }>(
    [...cols.filter((c) => c.key !== 'number'), { key: 'id', label: T.columns.id, builtIn: true, fixed: true }],
    columnOrder(schema, prefs.order)
  )
  const numberCol = cols.find((c) => c.key === 'number')
  const { hidden } = prefs
  const shown = cols.filter((c) => !hidden.has(c.key)).length
  const toggle = (key: string): void => {
    const next = new Set(hidden)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange({ ...prefs, hidden: next })
  }
  const move = (index: number, by: number): void => {
    const keys = movable.map((c) => c.key)
    const j = index + by
    if (j < 0 || j >= keys.length) return
    ;[keys[index], keys[j]] = [keys[j] as string, keys[index] as string]
    onChange({ ...prefs, order: keys })
    const label = movable[index]?.label
    if (label) setMoved(T.columnsMenu.moved(label, j + 1))
  }
  // drag and drop a row to its new place, like items in the table (the owner, 5 Nov 2026 — S-11)
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const moveTo = (from: number, to: number): void => {
    if (from === to) return
    const keys = movable.map((c) => c.key)
    const [k] = keys.splice(from, 1)
    if (k !== undefined) keys.splice(to, 0, k)
    onChange({ ...prefs, order: keys })
    const label = movable[from]?.label
    if (label) setMoved(T.columnsMenu.moved(label, to + 1))
  }
  const [moved, setMoved] = useState('')

  return (
    <div className="popover" ref={ref}>
      <button type="button" className={open ? 'btn btn--active' : 'btn'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {T.columnsMenu.button(shown < cols.length ? shown + 2 : null, cols.length + 2)}
      </button>
      {open && (
        <div className="popover__panel" role="dialog" aria-label={T.columnsMenu.label}>
          <p className="popover__hint">{T.columnsMenu.hint}</p>
          <p className="sr-only" aria-live="polite">
            {moved}
          </p>
          <ul className="popover__list">
            {numberCol && (
              <li className="popover__row">
                <label className="check">
                  <input type="checkbox" checked={!hidden.has(numberCol.key)} onChange={() => toggle(numberCol.key)} />
                  {numberCol.label}
                  <span className="muted-inline">{T.columnsMenu.builtIn}</span>
                </label>
              </li>
            )}
            {/* Title is always shown and always comes right after No. — listed so the list is complete (the owner, 8 Nov) */}
            <li className="popover__row">
              <label className="check">
                <input type="checkbox" checked disabled />
                {T.columns.title}
                <span className="muted-inline">{T.columnsMenu.alwaysFirst}</span>
              </label>
            </li>
            {movable.map((c, i) => (
              <li
                key={c.key}
                className={`popover__row popover__row--drag${dragging === i ? ' is-dragging' : ''}${over === i && dragging !== null && dragging !== i ? (dragging < i ? ' is-drop-target is-drop-after' : ' is-drop-target') : ''}`}
                draggable
                onDragStart={(e) => {
                  setDragging(i)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', c.key)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOver(i)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragging !== null) moveTo(dragging, i)
                  setDragging(null)
                  setOver(null)
                }}
                onDragEnd={() => {
                  setDragging(null)
                  setOver(null)
                }}
              >
                <span className="drag-handle" aria-hidden="true" title={T.columnsMenu.dragHint}>
                  ⋮⋮
                </span>
                <label className="check">
                  <input type="checkbox" checked={c.fixed === true || !hidden.has(c.key)} disabled={c.fixed || (c.key === 'text' && prefs.oneLine !== true)} onChange={() => toggle(c.key)} />
                  {c.label}
                  {c.key === 'text' && prefs.oneLine !== true ? <span className="muted-inline">{T.columnsMenu.textInMain}</span> : c.builtIn && <span className="muted-inline">{T.columnsMenu.builtIn}</span>}
                </label>
                <span className="actions">
                  <button type="button" className="icon-btn icon-btn--small" aria-label={T.columnsMenu.up(c.label)} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button type="button" className="icon-btn icon-btn--small" aria-label={T.columnsMenu.down(c.label)} disabled={i === movable.length - 1} onClick={() => move(i, 1)}>↓</button>
                </span>
              </li>
            ))}
          </ul>
          <div className="actions actions--spread popover__footer">
            <button type="button" className="link-btn" onClick={() => onChange({ hidden: new Set(), order: [], widths: {}, oneLine: prefs.oneLine === true })} disabled={hidden.size === 0 && prefs.order.length === 0 && Object.keys(prefs.widths ?? {}).length === 0}>
              {T.columnsMenu.reset}
            </button>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => {
                setOpen(false)
                onEditFields()
              }}
            >
              {T.columnsMenu.editFields}
            </button>
            {onEditTypes && (
              <button
                type="button"
                className="btn btn--small"
                onClick={() => {
                  setOpen(false)
                  onEditTypes()
                }}
              >
                {T.columnsMenu.editTypes}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- edit field definitions (schema.yaml)

interface Draft {
  key: number
  /** Existing fields keep their ID (item files refer to it); new ones get one from the name. */
  id: string
  isNew: boolean
  name: string
  type: FieldType
  options: string
  default: string
}

const fieldTypes = (): { id: FieldType; label: string }[] => (['text', 'enum', 'list', 'number', 'date'] as const).map((id) => ({ id, label: T.fields.kinds[id] }))

let nextKey = 0

/** Parts of every item that are not schema fields. */
const builtInFields = () => ['id', 'title', 'type', 'parent', 'text', 'links'].map((key) => ({ key, name: T.fields.builtInNames[key] ?? key }))

const kebab = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'field'

const splitOptions = (s: string): string[] => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean)

/** Add, rename, reorder and remove the fields every item has. Saved to requirements/.reqochet/schema.yaml. */
export function FieldsDialog({ info, onSaved, onClose }: { info: RepoInfo; onSaved: (i: RepoInfo) => void; onClose: () => void }) {
  const toDraft = (f: FieldDef): Draft => ({
    key: nextKey++,
    id: f.id,
    isNew: false,
    name: f.name,
    type: f.type,
    options: (f.options ?? []).join(', '),
    default: f.default ?? ''
  })
  const [rows, setRows] = useState<Draft[]>(() => info.schema.fields.map(toDraft))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // D-08: items whose values a changed definition would no longer allow; null = not checked for this version
  const [check, setCheck] = useState<FieldCheck[] | null>(null)

  const original = new Map(info.schema.fields.map((f) => [f.id, f]))
  const removed = info.schema.fields.filter((f) => !rows.some((r) => !r.isNew && r.id === f.id))
  const fixedIds = new Set(['id', 'type', 'title', 'parent', 'order', 'links', 'text'])

  // Keys of new fields follow their names; duplicates get -2, -3…
  const taken = new Set([...fixedIds, ...rows.filter((r) => !r.isNew).map((r) => r.id)])
  const withIds = rows.map((r) => {
    if (!r.isNew) return r
    const base = kebab(r.name)
    let id = base
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
    taken.add(id)
    return { ...r, id }
  })

  const problems: string[] = []
  withIds.forEach((r, i) => {
    const label = r.name.trim() || T.fields.fieldN(i + 1)
    if (!r.name.trim()) problems.push(T.fields.needsName(i + 1))
    const builtIn = builtInFields().find((b) => b.name.toLowerCase() === r.name.trim().toLowerCase() || (!r.isNew && b.key === r.id))
    if (builtIn) problems.push(T.fields.isBuiltIn(r.name.trim()))
    if (withIds.some((x, k) => k < i && x.name.trim().toLowerCase() === r.name.trim().toLowerCase() && r.name.trim())) problems.push(T.fields.duplicate(r.name.trim()))
    if (r.type === 'enum' && splitOptions(r.options).length === 0) problems.push(T.fields.needsOption(label))
    if (r.type === 'enum' && r.default && !splitOptions(r.options).includes(r.default)) problems.push(T.fields.defaultNotOption(label))
    if (r.type === 'number' && r.default && Number.isNaN(Number(r.default))) problems.push(T.fields.defaultNotNumber(label))
  })

  // translations a rename leaves behind: a warning only (owner, 4 Nov 2026)
  const stale: string[] = []
  withIds.forEach((r) => {
    if (r.isNew) return
    const found = staleTranslations(original.get(r.id), r.name, r.type === 'enum' || r.type === 'list' ? splitOptions(r.options) : [])
    if (found.name) stale.push(T.fields.staleName(r.name.trim()))
    if (found.options.length > 0) stale.push(T.fields.staleOptions(r.name.trim(), found.options.join(', ')))
  })

  const patch = (key: number, p: Partial<Draft>): void => {
    setCheck(null)
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)))
  }
  const move = (index: number, by: number): void =>
    setRows((rs) => {
      const j = index + by
      if (j < 0 || j >= rs.length) return rs
      const copy = [...rs]
      const [x] = copy.splice(index, 1)
      if (x) copy.splice(j, 0, x)
      return copy
    })
  const add = (): void => setRows((rs) => [...rs, { key: nextKey++, id: '', isNew: true, name: '', type: 'text', options: '', default: '' }])

  const save = async (): Promise<void> => {
    if (problems.length > 0) return
    const fields: FieldDef[] = withIds.map((r) => {
      const options = splitOptions(r.options)
      return {
        id: r.id,
        name: r.name.trim(),
        type: r.type,
        ...((r.type === 'enum' || r.type === 'list') && options.length > 0 ? { options } : {}),
        ...(r.default.trim() ? { default: r.default.trim() } : {}),
        // translated names (UX-22) are not edited here yet, but must survive a save
        ...(original.get(r.id)?.labels ? { labels: original.get(r.id)?.labels } : {}),
        ...(original.get(r.id)?.optionLabels ? { optionLabels: original.get(r.id)?.optionLabels } : {})
      }
    })
    setSaving(true)
    setError(null)
    try {
      // First press: check the items; if some would hold values the new definitions do not allow, say so and
      // let the user decide (press again = save anyway).
      if (check === null) {
        const found = await window.reqochet.checkFields(fields)
        setCheck(found)
        if (found.length > 0) return
      }
      const r = await window.reqochet.saveSchemaFields(fields, info.schemaRevision)
      if (r.ok) onSaved(r.info)
      else setError(r.message)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__panel" role="dialog" aria-modal="true" aria-label={T.fields.label}>
        <header className="modal__header">
          <div>
            <h2 className="modal__title">{T.fields.title}</h2>
            <p className="muted">
              {T.fields.introBefore}
              <code>{info.legacyFolder ? 'requirements/.reqman/schema.yaml' : 'requirements/.reqochet/schema.yaml'}</code>
              {T.fields.introAfter}
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label={T.common.close} onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="modal__body scroll">
          <p className="fields-builtin">
            <strong>{T.fields.builtInLead}</strong> {builtInFields().map((b) => b.name).join(', ')}
            {T.fields.builtInAfter}
            <em>{T.fields.builtInColumns}</em>.
          </p>
          <div className="fields-table" role="table" aria-label={T.fields.table}>
            <div className="fields-table__head" role="row">
              <span>{T.fields.name}</span>
              <span>{T.fields.kind}</span>
              <span>{T.fields.options}</span>
              <span>{T.fields.default}</span>
              <span />
            </div>
            {withIds.map((r, i) => {
              const was = original.get(r.id)
              return (
                <div key={r.key} className="fields-table__row" role="row">
                  <span>
                    <input className="input" aria-label={T.fields.nameOf(i + 1)} value={r.name} placeholder={T.fields.namePlaceholder} onChange={(e) => patch(r.key, { name: e.target.value })} />
                    <span className="fields-table__id" title={T.fields.keyTooltip}>{r.id ? T.fields.key(r.id) : T.fields.keyFromName}</span>
                  </span>
                  <span>
                    <select className="input" aria-label={T.fields.kindOf(i + 1)} value={r.type} onChange={(e) => patch(r.key, { type: e.target.value as FieldType })}>
                      {fieldTypes().map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                    {was && was.type !== r.type && <span className="field__error">{T.fields.kindChanged}</span>}
                  </span>
                  <span>
                    {r.type === 'enum' || r.type === 'list' ? (
                      <input
                        className="input"
                        aria-label={T.fields.optionsOf(i + 1)}
                        value={r.options}
                        placeholder={r.type === 'list' ? T.fields.listPlaceholder : T.fields.enumPlaceholder}
                        onChange={(e) => patch(r.key, { options: e.target.value })}
                      />
                    ) : (
                      <span className="muted-inline">—</span>
                    )}
                  </span>
                  <span>
                    {r.type === 'enum' ? (
                      <select className="input" aria-label={T.fields.defaultOf(i + 1)} value={r.default} onChange={(e) => patch(r.key, { default: e.target.value })}>
                        <option value="">{T.fields.none}</option>
                        {splitOptions(r.options).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        className="input"
                        aria-label={T.fields.defaultOf(i + 1)}
                        type={r.type === 'number' ? 'number' : r.type === 'date' ? 'date' : 'text'}
                        value={r.default}
                        onChange={(e) => patch(r.key, { default: e.target.value })}
                      />
                    )}
                  </span>
                  <span className="actions">
                    <button type="button" className="icon-btn" aria-label={T.fields.up(r.name)} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                    <button type="button" className="icon-btn" aria-label={T.fields.down(r.name)} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>↓</button>
                    <button type="button" className="icon-btn" aria-label={T.fields.remove(r.name)} title={T.fields.removeTooltip} onClick={() => {
                      setCheck(null)
                      setRows((rs) => rs.filter((x) => x.key !== r.key))
                    }}>✕</button>
                  </span>
                </div>
              )
            })}
          </div>
          <button type="button" className="btn" onClick={add}>
            {T.fields.add}
          </button>
          {removed.length > 0 && (
            <p className="notice notice--warn">{T.fields.removing(removed.map((f) => f.name).join(', '))}</p>
          )}
          {stale.map((w) => (
            <p key={w} className="notice notice--warn">{w}</p>
          ))}
          {problems.map((p) => (
            <p key={p} className="notice notice--error">{p}</p>
          ))}
          {check?.map((c) => (
            <p key={c.fieldId} className="notice notice--warn" role="alert">
              {T.fields.invalidAfter(c.count, c.name, c.examples.join(', '))}
            </p>
          ))}
          {error && <p className="notice notice--error" role="alert">{error}</p>}
        </div>

        <footer className="modal__footer actions">
          <button type="button" className="btn btn--primary" disabled={saving || problems.length > 0} onClick={() => void save()}>
            {saving ? T.editor.saving : check && check.length > 0 ? T.fields.saveAnyway : T.fields.save}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            {T.common.cancel}
          </button>
        </footer>
      </div>
    </div>
  )
}
