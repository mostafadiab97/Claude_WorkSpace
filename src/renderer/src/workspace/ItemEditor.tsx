import { useCallback, useEffect, useRef, useState } from 'react'
import type { ItemDetails } from '../../../shared/api'
import type { FieldDef, FieldValue, Item, ItemIssue, Schema } from '../../../shared/domain'
import { errorMessage } from '../lib/hooks'
import { typeName } from '../lib/schema'
import { HistoryView } from './HistoryView'
import { LinksSection } from './LinksSection'
import { ParentPicker } from './ParentPicker'
import { T } from '../../../shared/text'

export type EditorTarget = { kind: 'item'; id: string } | { kind: 'draft'; item: Item }

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string; conflict?: boolean }

const same = (a: Item | null, b: Item | null): boolean => JSON.stringify(a) === JSON.stringify(b)

/** Edits one item: its schema fields, parent, order and text; links are changed straight away in their own section. */
export function ItemEditor(props: {
  schema: Schema
  target: EditorTarget
  onSaved: (id: string) => void
  onDeleted: () => void
  onMoved: () => void
  /** Links were added, removed or confirmed (this item's file or another one changed). */
  onLinksChanged: () => void
  onNewChild: (type: string, parent: string) => void
  onOpen: (id: string) => void
  onDirtyChange: (dirty: boolean) => void
  onClose: () => void
  /** Changes when items changed elsewhere (moved in the table, outside edits); reloads unless there are unsaved changes. */
  reloadToken: number
}) {
  const { schema, target, onDirtyChange, reloadToken } = props
  // The editor is re-created (keyed) for every target, so a draft can start its state directly.
  const [details, setDetails] = useState<ItemDetails | null>(null)
  const [base, setBase] = useState<Item | null>(null)
  const [form, setForm] = useState<Item | null>(target.kind === 'draft' ? target.item : null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [issues, setIssues] = useState<ItemIssue[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tab, setTab] = useState<'details' | 'history'>('details')
  const [removeIncoming, setRemoveIncoming] = useState(true)
  const isNew = target.kind === 'draft'

  const load = useCallback(async () => {
    setStatus({ kind: 'idle' })
    setConfirmDelete(false)
    if (target.kind === 'draft') {
      setDetails(null)
      setBase(null)
      setForm(target.item)
      setIssues([])
      return
    }
    const d = await window.reqman.getItem(target.id)
    setDetails(d)
    setBase(d?.item ?? null)
    setForm(d?.item ?? null)
    setIssues(d?.issues ?? [])
  }, [target])

  useEffect(() => {
    if (target.kind !== 'item') return
    let live = true
    void window.reqman.getItem(target.id).then((d) => {
      if (!live) return
      setDetails(d)
      setBase(d?.item ?? null)
      setForm(d?.item ?? null)
      setIssues(d?.issues ?? [])
    })
    return () => {
      live = false
    }
  }, [target])

  const dirty = form !== null && (isNew || !same(form, base))
  const dirtyRef = useRef(dirty)
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  // Data changed elsewhere (e.g. this item was dragged to a new parent): show the current version.
  const firstToken = useRef(reloadToken)
  useEffect(() => {
    if (reloadToken === firstToken.current || target.kind !== 'item' || dirtyRef.current) return
    let live = true
    void window.reqman.getItem(target.id).then((d) => {
      if (!live || dirtyRef.current || !d) return
      setDetails(d)
      setBase(d.item)
      setForm(d.item)
      setIssues(d.issues)
    })
    return () => {
      live = false
    }
  }, [reloadToken, target])
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

  const save = useCallback(async () => {
    if (!form || status.kind === 'saving') return
    setStatus({ kind: 'saving' })
    try {
      const r = await window.reqman.saveItem(form, isNew ? null : (details?.revision ?? null))
      if (r.ok) {
        setDetails(r.details)
        setBase(r.details.item)
        setForm(r.details.item)
        setIssues(r.details.issues)
        setStatus({ kind: 'saved' })
        props.onSaved(r.details.item.id)
      } else {
        setIssues(r.issues ?? [])
        setStatus({ kind: 'error', message: r.message, conflict: r.reason === 'conflict' })
      }
    } catch (e) {
      setStatus({ kind: 'error', message: errorMessage(e) })
    }
  }, [form, status.kind, isNew, details, props])

  // Ctrl+S saves.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (dirty) void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dirty, save])

  if (target.kind === 'item' && details === null && form === null) {
    return (
      <aside className="editor" aria-label={T.editor.label}>
        <p className="muted">{T.editor.unreadable}</p>
      </aside>
    )
  }
  if (!form) return <aside className="editor" aria-label={T.editor.label} />

  const set = (patch: Partial<Item>): void => {
    setForm({ ...form, ...patch })
    if (status.kind === 'saved') setStatus({ kind: 'idle' })
  }
  const setField = (id: string, v: FieldValue | undefined): void => {
    const fields = { ...form.fields }
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) delete fields[id]
    else fields[id] = v
    set({ fields })
  }
  const issueFor = (path: string): string | undefined => issues.find((i) => i.path === path)?.message

  const remove = async (): Promise<void> => {
    if (!details) return
    const r = await window.reqman.deleteItem(form.id, details.revision, { removeIncomingLinks: removeIncoming && details.incoming.length > 0 })
    if (r.ok) props.onDeleted()
    else setStatus({ kind: 'error', message: r.message })
  }
  const move = async (direction: 'up' | 'down'): Promise<void> => {
    const r = await window.reqman.moveItem(form.id, direction)
    if (!r.ok) setStatus({ kind: 'error', message: r.message })
    else {
      await load()
      props.onMoved()
    }
  }

  return (
    <aside className="editor scroll" aria-label={T.editor.labelFor(form.id)}>
      <header className="editor__header">
        <div>
          <div className="editor__id">{form.id}</div>
          <div className="editor__type">{typeName(schema, form.type)}{isNew && T.editor.newNotSaved}</div>
        </div>
        <button type="button" className="icon-btn" aria-label={T.common.close} title={T.common.close} onClick={props.onClose}>
          ✕
        </button>
      </header>

      {!isNew && (
        <div className="tabs" role="tablist" aria-label={T.editor.tabs}>
          <button type="button" role="tab" aria-selected={tab === 'details'} className={tab === 'details' ? 'tabs__tab tabs__tab--active' : 'tabs__tab'} onClick={() => setTab('details')}>
            {T.editor.details}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'tabs__tab tabs__tab--active' : 'tabs__tab'} onClick={() => setTab('history')}>
            {T.editor.history}
          </button>
        </div>
      )}

      {tab === 'history' && !isNew ? (
        <div className="editor__body">
          <HistoryView schema={schema} itemId={form.id} reloadToken={reloadToken} />
        </div>
      ) : (
      <div className="editor__body">
        <label className="field">
          <span className="field__label">{T.editor.title}</span>
          <input className="input" value={form.title} autoFocus={isNew} onChange={(e) => set({ title: e.target.value })} placeholder={T.editor.titlePlaceholder} />
        </label>

        <div className="field-grid">
          <label className="field">
            <span className="field__label">{T.editor.type}</span>
            <input className="input" value={typeName(schema, form.type)} readOnly title={T.editor.typeTooltip} />
          </label>
          {schema.fields.map((f) => (
            <FieldInput key={f.id} def={f} value={form.fields[f.id]} error={issueFor(`fields.${f.id}`)} onChange={(v) => setField(f.id, v)} />
          ))}
        </div>

        <div className="field">
          <span className="field__label">{T.editor.parent}</span>
          <ParentPicker schema={schema} value={form.parent} selfId={form.id} onChange={(p) => set(p ? { parent: p } : { parent: undefined })} />
          {issueFor('parent') && <span className="field__error">{issueFor('parent')}</span>}
        </div>

        <label className="field">
          <span className="field__label">{T.editor.text}</span>
          <textarea className="input textarea" value={form.text} onChange={(e) => set({ text: e.target.value })} placeholder={T.editor.textPlaceholder} rows={8} />
        </label>

        <LinksSection
          schema={schema}
          itemId={form.id}
          details={details}
          lockedReason={isNew ? T.editor.linksAfterSave : dirty ? T.editor.linksLocked : null}
          onChanged={async () => {
            await load()
            props.onLinksChanged()
          }}
          onOpen={props.onOpen}
        />

        {issues.filter((i) => !i.path.startsWith('fields.') && i.path !== 'parent').map((i) => (
          <p key={`${i.path}-${i.message}`} className={i.severity === 'error' ? 'notice notice--error' : 'notice notice--warn'}>
            {i.message}
          </p>
        ))}
      </div>
      )}

      <footer className="editor__footer">
        {status.kind === 'error' && (
          <p className="notice notice--error" role="alert">
            {status.message}{' '}
            {status.conflict && (
              <button type="button" className="link-btn" onClick={() => void load()}>
                {T.editor.reload}
              </button>
            )}
          </p>
        )}
        {confirmDelete ? (
          <div className="actions">
            <span>
              {T.editor.deleteAsk(form.id)}
              {(details?.incoming.length ?? 0) > 0 && (
                <label className="check">
                  <input type="checkbox" checked={removeIncoming} onChange={(e) => setRemoveIncoming(e.target.checked)} />
                  {T.editor.removeIncoming(details?.incoming.length ?? 0)}
                </label>
              )}
            </span>
            <button type="button" className="btn btn--danger" onClick={() => void remove()}>{T.editor.delete}</button>
            <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>{T.common.cancel}</button>
          </div>
        ) : (
          <div className="actions actions--spread">
            <div className="actions">
              <button type="button" className="btn btn--primary" onClick={() => void save()} disabled={!dirty || status.kind === 'saving'} title={T.editor.saveTooltip}>
                {status.kind === 'saving' ? T.editor.saving : status.kind === 'saved' && !dirty ? T.editor.saved : T.common.save}
              </button>
              {dirty && !isNew && (
                <button type="button" className="btn" onClick={() => { setForm(base); setStatus({ kind: 'idle' }) }}>
                  {T.editor.discard}
                </button>
              )}
            </div>
            {!isNew && (
              <div className="actions">
                <button type="button" className="icon-btn" title={T.editor.moveUpTooltip} aria-label={T.editor.moveUp} disabled={dirty} onClick={() => void move('up')}>↑</button>
                <button type="button" className="icon-btn" title={T.editor.moveDownTooltip} aria-label={T.editor.moveDown} disabled={dirty} onClick={() => void move('down')}>↓</button>
                <select
                  className="select-btn"
                  value=""
                  disabled={dirty}
                  aria-label={T.editor.addChild}
                  onChange={(e) => e.target.value && props.onNewChild(e.target.value, form.id)}
                >
                  <option value="">{T.editor.addChildOption}</option>
                  {schema.itemTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button type="button" className="btn btn--quiet-danger" onClick={() => setConfirmDelete(true)} disabled={dirty}>
                  {T.editor.delete}
                </button>
              </div>
            )}
          </div>
        )}
      </footer>
    </aside>
  )
}

function FieldInput({ def, value, error, onChange }: { def: FieldDef; value: FieldValue | undefined; error: string | undefined; onChange: (v: FieldValue | undefined) => void }) {
  const str = value === undefined ? '' : Array.isArray(value) ? value.join(', ') : String(value)
  let control
  switch (def.type) {
    case 'enum':
      control = (
        <select className="input" value={str} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">—</option>
          {def.options?.map((o) => <option key={o} value={o}>{o}</option>)}
          {str && !def.options?.includes(str) && <option value={str}>{T.editor.notAllowed(str)}</option>}
        </select>
      )
      break
    case 'list':
      control = (
        <input
          className="input"
          defaultValue={str}
          key={str}
          placeholder={T.editor.listPlaceholder}
          onBlur={(e) => onChange(e.target.value.split(',').map((x) => x.trim()).filter(Boolean))}
        />
      )
      break
    case 'number':
      control = <input className="input" type="number" value={str} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
      break
    case 'date':
      control = <input className="input" type="date" value={str} onChange={(e) => onChange(e.target.value || undefined)} />
      break
    default:
      control = <input className="input" value={str} onChange={(e) => onChange(e.target.value)} />
  }
  return (
    <label className="field">
      <span className="field__label">{def.name}</span>
      {control}
      {error && <span className="field__error">{error}</span>}
    </label>
  )
}
