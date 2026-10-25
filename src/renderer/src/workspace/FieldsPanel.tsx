import { useEffect, useRef, useState } from 'react'
import type { RepoInfo } from '../../../shared/api'
import type { FieldDef, FieldType, Schema } from '../../../shared/domain'
import { errorMessage } from '../lib/hooks'
import { optionalColumns, orderColumns, type ColumnPrefs } from './ItemTable'

// ---------------------------------------------------------------- show / hide columns

const storageKey = (root: string): string => `reqman.columns:${root}`
const oldKey = (root: string): string => `reqman.hiddenColumns:${root}`

/** Hidden columns and column order, remembered per repository on this PC (personal, not shared through Git). */
export function useColumnPrefs(root: string): [ColumnPrefs, (next: ColumnPrefs) => void] {
  const [prefs, setPrefs] = useState<ColumnPrefs>(() => {
    try {
      const raw = localStorage.getItem(storageKey(root))
      if (raw) {
        const p = JSON.parse(raw) as { hidden?: string[]; order?: string[] }
        return { hidden: new Set(p.hidden ?? []), order: p.order ?? [] }
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
      localStorage.setItem(storageKey(root), JSON.stringify({ hidden: [...next.hidden], order: next.order }))
    } catch {
      // storage unavailable: the choice lasts until the window closes
    }
  }
  return [prefs, update]
}

/** "Columns" button: tick the columns to show, ↑/↓ to reorder; "Edit fields…" opens the field definitions. */
export function ColumnsMenu({ schema, prefs, onChange, onEditFields }: { schema: Schema; prefs: ColumnPrefs; onChange: (p: ColumnPrefs) => void; onEditFields: () => void }) {
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

  const cols = orderColumns(optionalColumns(schema), prefs.order)
  const { hidden } = prefs
  const shown = cols.filter((c) => !hidden.has(c.key)).length
  const toggle = (key: string): void => {
    const next = new Set(hidden)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange({ ...prefs, hidden: next })
  }
  const move = (index: number, by: number): void => {
    const keys = cols.map((c) => c.key)
    const j = index + by
    if (j < 0 || j >= keys.length) return
    ;[keys[index], keys[j]] = [keys[j] as string, keys[index] as string]
    onChange({ ...prefs, order: keys })
  }

  return (
    <div className="popover" ref={ref}>
      <button type="button" className={open ? 'btn btn--active' : 'btn'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Columns{shown < cols.length ? ` (${shown + 2}/${cols.length + 2})` : ''} ▾
      </button>
      {open && (
        <div className="popover__panel" role="dialog" aria-label="Columns">
          <p className="popover__hint">Shown in the table, in this order after ID and Title:</p>
          <ul className="popover__list">
            {cols.map((c, i) => (
              <li key={c.key} className="popover__row">
                <label className="check">
                  <input type="checkbox" checked={!hidden.has(c.key)} onChange={() => toggle(c.key)} />
                  {c.label}
                  {c.builtIn && <span className="muted-inline"> · built in</span>}
                </label>
                <span className="actions">
                  <button type="button" className="icon-btn icon-btn--small" aria-label={`Move ${c.label} column up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button type="button" className="icon-btn icon-btn--small" aria-label={`Move ${c.label} column down`} disabled={i === cols.length - 1} onClick={() => move(i, 1)}>↓</button>
                </span>
              </li>
            ))}
          </ul>
          <div className="actions actions--spread popover__footer">
            <button type="button" className="link-btn" onClick={() => onChange({ hidden: new Set(), order: [] })} disabled={hidden.size === 0 && prefs.order.length === 0}>
              Reset
            </button>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => {
                setOpen(false)
                onEditFields()
              }}
            >
              Edit fields…
            </button>
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

const TYPES: { id: FieldType; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'enum', label: 'Choice (one value)' },
  { id: 'list', label: 'List (several values)' },
  { id: 'number', label: 'Number' },
  { id: 'date', label: 'Date' }
]

let nextKey = 0

/** Parts of every item that are not schema fields. */
const BUILT_IN = [
  { key: 'id', name: 'ID' },
  { key: 'title', name: 'Title' },
  { key: 'type', name: 'Type' },
  { key: 'parent', name: 'Parent' },
  { key: 'text', name: 'Text' },
  { key: 'links', name: 'Links' }
]

const kebab = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'field'

const splitOptions = (s: string): string[] => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean)

/** Add, rename, reorder and remove the fields every item has. Saved to requirements/.reqman/schema.yaml. */
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
    const label = r.name.trim() || `Field ${i + 1}`
    if (!r.name.trim()) problems.push(`Field ${i + 1} needs a name.`)
    const builtIn = BUILT_IN.find((b) => b.name.toLowerCase() === r.name.trim().toLowerCase() || (!r.isNew && b.key === r.id))
    if (builtIn) problems.push(`“${r.name.trim()}” is a built-in field of every item — it does not need to be added. Show or hide it with Columns.`)
    if (withIds.some((x, k) => k < i && x.name.trim().toLowerCase() === r.name.trim().toLowerCase() && r.name.trim())) problems.push(`Two fields are called “${r.name.trim()}”.`)
    if (r.type === 'enum' && splitOptions(r.options).length === 0) problems.push(`${label}: a choice field needs at least one option.`)
    if (r.type === 'enum' && r.default && !splitOptions(r.options).includes(r.default)) problems.push(`${label}: the default must be one of the options.`)
    if (r.type === 'number' && r.default && Number.isNaN(Number(r.default))) problems.push(`${label}: the default must be a number.`)
  })

  const patch = (key: number, p: Partial<Draft>): void => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)))
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
        ...(r.default.trim() ? { default: r.default.trim() } : {})
      }
    })
    setSaving(true)
    setError(null)
    try {
      const r = await window.reqman.saveSchemaFields(fields, info.schemaRevision)
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
      <div className="modal__panel" role="dialog" aria-modal="true" aria-label="Fields">
        <header className="modal__header">
          <div>
            <h2 className="modal__title">Fields</h2>
            <p className="muted">
              Every item has these fields. Changes are saved to <code>requirements/.reqman/schema.yaml</code> and reach your team through Git
              like any other change.
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="modal__body scroll">
          <p className="fields-builtin">
            <strong>Built in, always there:</strong> {BUILT_IN.map((b) => b.name).join(', ')}. These are not listed below; show or hide them
            in the table with <em>Columns</em>.
          </p>
          <div className="fields-table" role="table" aria-label="Field definitions">
            <div className="fields-table__head" role="row">
              <span>Name</span>
              <span>Kind</span>
              <span>Options (comma separated)</span>
              <span>Default for new items</span>
              <span />
            </div>
            {withIds.map((r, i) => {
              const was = original.get(r.id)
              return (
                <div key={r.key} className="fields-table__row" role="row">
                  <span>
                    <input className="input" aria-label={`Name of field ${i + 1}`} value={r.name} placeholder="e.g. Safety level" onChange={(e) => patch(r.key, { name: e.target.value })} />
                    <span className="fields-table__id" title="Stored in the item files under this key">{r.id ? `key: ${r.id}` : 'key from name'}</span>
                  </span>
                  <span>
                    <select className="input" aria-label={`Kind of field ${i + 1}`} value={r.type} onChange={(e) => patch(r.key, { type: e.target.value as FieldType })}>
                      {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                    {was && was.type !== r.type && <span className="field__error">Existing values are kept as they are; check them after changing the kind.</span>}
                  </span>
                  <span>
                    {r.type === 'enum' || r.type === 'list' ? (
                      <input
                        className="input"
                        aria-label={`Options of field ${i + 1}`}
                        value={r.options}
                        placeholder={r.type === 'list' ? 'optional — empty allows any value' : 'High, Medium, Low'}
                        onChange={(e) => patch(r.key, { options: e.target.value })}
                      />
                    ) : (
                      <span className="muted-inline">—</span>
                    )}
                  </span>
                  <span>
                    {r.type === 'enum' ? (
                      <select className="input" aria-label={`Default of field ${i + 1}`} value={r.default} onChange={(e) => patch(r.key, { default: e.target.value })}>
                        <option value="">(none)</option>
                        {splitOptions(r.options).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        className="input"
                        aria-label={`Default of field ${i + 1}`}
                        type={r.type === 'number' ? 'number' : r.type === 'date' ? 'date' : 'text'}
                        value={r.default}
                        onChange={(e) => patch(r.key, { default: e.target.value })}
                      />
                    )}
                  </span>
                  <span className="actions">
                    <button type="button" className="icon-btn" aria-label={`Move ${r.name || 'field'} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                    <button type="button" className="icon-btn" aria-label={`Move ${r.name || 'field'} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>↓</button>
                    <button type="button" className="icon-btn" aria-label={`Remove ${r.name || 'field'}`} title="Remove" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>✕</button>
                  </span>
                </div>
              )
            })}
          </div>
          <button type="button" className="btn" onClick={add}>
            + Add field
          </button>
          {removed.length > 0 && (
            <p className="notice notice--warn">
              Removing {removed.map((f) => f.name).join(', ')}: values already stored in items are not deleted — they stay in the files
              and come back if a field with the same key is added again.
            </p>
          )}
          {problems.map((p) => (
            <p key={p} className="notice notice--error">{p}</p>
          ))}
          {error && <p className="notice notice--error" role="alert">{error}</p>}
        </div>

        <footer className="modal__footer actions">
          <button type="button" className="btn btn--primary" disabled={saving || problems.length > 0} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save fields'}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  )
}
