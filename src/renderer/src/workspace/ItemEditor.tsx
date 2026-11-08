import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ItemDetails, LinkInfo } from '../../../shared/api'
import type { FieldDef, FieldValue, Item, ItemIssue, Schema } from '../../../shared/domain'
import { errorMessage } from '../lib/hooks'
import { renderItemText } from '../lib/markdown'
import { ImpactView } from './ImpactView'
import { focusUsesArrows, workspaceHasKeyboard } from '../lib/shortcuts'
import { fieldLabel, optionLabel, typeLabel, typeName } from '../lib/schema'
import { HistoryView } from './HistoryView'
import { LinksSection } from './LinksSection'
import { ParentPicker } from './ParentPicker'
import { SuspectLinksDialog } from './SuspectLinksDialog'
import { T } from '../../../shared/text'

/** askDelete: opened from the row menu's Delete — the editor shows its delete question at once (UX-W03). */
export type EditorTarget = { kind: 'item'; id: string; askDelete?: boolean; /** Open on this tab (Changes → Impact, T-06). */ tab?: 'impact' } | { kind: 'draft'; item: Item }

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
  /** Filled with a function that saves the open edit and tells whether it worked ("Save and continue", UX-09). */
  /** Hands the parent this editor's save function (null when the editor goes away) — for "Save and continue". */
  onSaveReady?: (save: (() => Promise<boolean>) | null) => void
  /** An old version is shown (D-19b): everything visible, nothing can be changed. */
  readOnly?: boolean
}) {
  const { schema, target, onDirtyChange, reloadToken, onMoved } = props
  // The editor is re-created (keyed) for every target, so a draft can start its state directly.
  const [details, setDetails] = useState<ItemDetails | null>(null)
  const [base, setBase] = useState<Item | null>(null)
  const [form, setForm] = useState<Item | null>(target.kind === 'draft' ? target.item : null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [issues, setIssues] = useState<ItemIssue[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tab, setTab] = useState<'details' | 'history' | 'impact'>(target.kind === 'item' && target.tab === 'impact' ? 'impact' : 'details')
  const [removeIncoming, setRemoveIncoming] = useState(true)
  /** Links from other items to review after a save changed the type, title or text (O-04). */
  const [review, setReview] = useState<{ incoming: LinkInfo[]; before: Item; after: Item } | null>(null)
  const rootRef = useRef<HTMLElement>(null)
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
    const d = await window.reqochet.getItem(target.id)
    setDetails(d)
    setBase(d?.item ?? null)
    setForm(d?.item ?? null)
    setIssues(d?.issues ?? [])
  }, [target])

  useEffect(() => {
    if (target.kind !== 'item') return
    let live = true
    void window.reqochet.getItem(target.id).then((d) => {
      if (!live) return
      setDetails(d)
      setBase(d?.item ?? null)
      setForm(d?.item ?? null)
      setIssues(d?.issues ?? [])
      if (d && target.askDelete) setConfirmDelete(true)
    })
    return () => {
      live = false
    }
  }, [target])

  const dirty = form !== null && (isNew || !same(form, base))
  // the Text field: formatted while the saved text is shown and nobody is typing in it (UX-08)
  const [editingText, setEditingText] = useState(false)
  const caretAt = useRef<number | null>(null)
  const textPreview = form !== null && base !== null && !editingText && form.text.trim() !== '' && form.text === base.text
  // formatted once per text, not on every keystroke in another field (code review CR-09)
  const previewText = textPreview ? form.text : ''
  const previewHtml = useMemo(() => (previewText ? renderItemText(previewText) : ''), [previewText])
  const dirtyRef = useRef(dirty)
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  const onCloseRef = useRef(props.onClose)
  useEffect(() => {
    onCloseRef.current = props.onClose
  })
  // Data changed elsewhere (e.g. this item was dragged to a new parent): show the current version.
  const firstToken = useRef(reloadToken)
  useEffect(() => {
    if (reloadToken === firstToken.current || target.kind !== 'item') return
    let live = true
    void window.reqochet.getItem(target.id).then((d) => {
      if (!live) return
      // the item is gone (a pull, a revert in Changes): close it — or, with typed edits, say so (CR2-02)
      if (!d) {
        if (dirtyRef.current) setStatus({ kind: 'error', message: T.editor.goneWhileEditing })
        else onCloseRef.current()
        return
      }
      if (dirtyRef.current) return
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
  // "Saved ✓" shows for 2 seconds, then the button is plain "Save" again (UX-15)
  useEffect(() => {
    if (status.kind !== 'saved') return
    const t = window.setTimeout(() => setStatus((st) => (st.kind === 'saved' ? { kind: 'idle' } : st)), 2000)
    return () => window.clearTimeout(t)
  }, [status.kind])

  const save = useCallback(async (): Promise<boolean> => {
    if (!form || status.kind === 'saving') return false
    setStatus({ kind: 'saving' })
    try {
      const r = await window.reqochet.saveItem(form, isNew ? null : (details?.revision ?? null))
      if (r.ok) {
        const before = base
        const saved = r.details.item
        const content = before !== null && (before.title !== saved.title || before.text !== saved.text || before.type !== saved.type)
        const asks = !isNew && content && before !== null && r.details.incoming.length > 0
        if (asks) setReview({ incoming: r.details.incoming, before, after: saved })
        setDetails(r.details)
        setBase(r.details.item)
        setForm(r.details.item)
        setIssues(r.details.issues)
        setStatus({ kind: 'saved' })
        props.onSaved(r.details.item.id)
        // saved; but when the links check opens, "Save and continue" waits for it (code review CR-03)
        return !asks
      } else {
        setIssues(r.issues ?? [])
        setStatus({ kind: 'error', message: r.message, conflict: r.reason === 'conflict' })
        return false
      }
    } catch (e) {
      setStatus({ kind: 'error', message: errorMessage(e) })
      return false
    }
  }, [form, status.kind, isNew, details, base, props])
  const { onSaveReady } = props
  useEffect(() => {
    if (!onSaveReady) return
    onSaveReady(save)
    return () => onSaveReady(null)
  }, [onSaveReady, save])

  // Ctrl+S saves.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (dirty) void save()
      } else if (e.altKey && !e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !dirty && !isNew && !focusUsesArrows() && workspaceHasKeyboard(rootRef.current)) {
        // Alt+↑ / Alt+↓ moves the open item among its siblings (UX-25)
        e.preventDefault()
        if (!form) return
        void window.reqochet.moveItem(form.id, e.key === 'ArrowUp' ? 'up' : 'down').then(async (r) => {
          if (!r.ok) return setStatus({ kind: 'error', message: r.message })
          await load()
          onMoved()
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dirty, save, isNew, form, load, onMoved])

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
    const r = await window.reqochet.deleteItem(form.id, details.revision, { removeIncomingLinks: removeIncoming && details.incoming.length > 0 })
    if (r.ok) props.onDeleted()
    else setStatus({ kind: 'error', message: r.message })
  }
  const move = async (direction: 'up' | 'down'): Promise<void> => {
    const r = await window.reqochet.moveItem(form.id, direction)
    if (!r.ok) setStatus({ kind: 'error', message: r.message })
    else {
      await load()
      props.onMoved()
    }
  }

  return (
    <aside className="editor scroll" aria-label={T.editor.labelFor(form.id)} ref={rootRef}>
      <header className="editor__header">
        <div>
          <div className="editor__heading">
            {details?.number && <span className="editor__number" title={T.editor.number(details.number)}>{details.number}</span>}
            <span className="editor__id">{form.id}</span>
            {dirty && !isNew && (
              <span className="editor__dirty" title={T.editor.unsavedMark} aria-label={T.editor.unsavedMark}>
                •
              </span>
            )}
          </div>
          <div className="editor__type">
            {typeName(schema, form.type)}
            {isNew && T.editor.newNotSaved}
          </div>
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
          {/* theme 1b (T-06): what depends on this item */}
          <button type="button" role="tab" aria-selected={tab === 'impact'} className={tab === 'impact' ? 'tabs__tab tabs__tab--active' : 'tabs__tab'} onClick={() => setTab('impact')}>
            {T.trace.impactTab}
          </button>
        </div>
      )}

      {tab === 'history' && !isNew ? (
        <div className="editor__body">
          <HistoryView schema={schema} itemId={form.id} reloadToken={reloadToken} />
        </div>
      ) : tab === 'impact' && !isNew ? (
        <div className="editor__body">
          <ImpactView schema={schema} itemId={form.id} reloadToken={reloadToken} onOpen={props.onOpen} />
        </div>
      ) : (
      <fieldset className="editor__body editor__fieldset" disabled={props.readOnly === true}>
        <label className="field">
          <span className="field__label">{T.editor.title}</span>
          <input className="input" dir="auto" value={form.title} autoFocus={isNew} onChange={(e) => set({ title: e.target.value })} placeholder={T.editor.titlePlaceholder} />
        </label>

        <div className="field-grid">
          <label className="field">
            <span className="field__label">{T.editor.type}</span>
            <select className="input" aria-label={T.editor.type} value={form.type} title={T.editor.typeTooltip} onChange={(e) => set({ type: e.target.value })}>
              {schema.itemTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {typeLabel(t)}
                </option>
              ))}
              {!schema.itemTypes.some((t) => t.id === form.type) && <option value={form.type}>{form.type}</option>}
            </select>
          </label>
          {schema.fields.map((f) => (
            <FieldInput key={f.id} def={f} value={form.fields[f.id]} error={issueFor(`fields.${f.id}`)} onChange={(v) => setField(f.id, v)} />
          ))}
        </div>

        <div className="field">
          <span className="field__label">{T.editor.parent}</span>
          <ParentPicker schema={schema} value={form.parent} selfId={form.id} onChange={(p) => set(p ? { parent: p } : { parent: undefined })} onShow={props.onOpen} />
          {issueFor('parent') && <span className="field__error">{issueFor('parent')}</span>}
        </div>

        {/* UX-08: saved text is shown formatted; a click (or Enter) on it, or "Edit", opens the plain text */}
        {textPreview ? (
          <div className="field">
            <span className="field__label field__label--row">
              {T.editor.text}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  caretAt.current = form.text.length
                  setEditingText(true)
                }}
              >
                {T.editor.editText}
              </button>
            </span>
            <div
              className="input text-preview markdown"
              role="button"
              tabIndex={0}
              title={T.editor.editTextTooltip}
              aria-label={T.editor.editTextTooltip}
              onClick={(e) => {
                // a click on a link (or on bold text inside one) opens the link, not the text box (CR-06)
                if (e.target instanceof Element && e.target.closest('a')) return
                // the cursor goes where the user clicked (the owner, 0.16.3 step 2), or to the end
                caretAt.current = caretFromClick(e.clientX, e.clientY, form.text)
                setEditingText(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target === e.currentTarget) {
                  e.preventDefault()
                  caretAt.current = form.text.length
                  setEditingText(true)
                }
              }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        ) : (
          <div className="field">
            {/* the label names only the text box; the button sits beside it (CR-06) */}
            <span className="field__label--row">
              <label className="field__label" htmlFor="editor-text">
                {T.editor.text}
              </label>
              {form.text.trim() !== '' && base !== null && form.text === base.text && (
                <button type="button" className="link-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => setEditingText(false)}>
                  {T.editor.previewText}
                </button>
              )}
            </span>
            <textarea
              id="editor-text"
              dir="auto"
              className="input textarea"
              value={form.text}
              autoFocus={editingText}
              onFocus={(e) => {
                const at = caretAt.current
                caretAt.current = null
                if (at !== null) e.currentTarget.setSelectionRange(at, at)
              }}
              onChange={(e) => set({ text: e.target.value })}
              onBlur={() => setEditingText(false)}
              placeholder={T.editor.textPlaceholder}
              rows={8}
            />
          </div>
        )}

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
      </fieldset>
      )}

      {props.readOnly ? null : (
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
                    <option key={t.id} value={t.id}>{typeLabel(t)}</option>
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
      )}
      {review && (
        <SuspectLinksDialog
          schema={schema}
          itemId={form.id}
          incoming={review.incoming}
          before={review.before}
          after={review.after}
          onOpen={props.onOpen}
          onDone={(changed) => {
            setReview(null)
            if (!changed) return
            void window.reqochet.getItem(form.id).then((d) => {
              if (d && !dirtyRef.current) {
                setDetails(d)
                setBase(d.item)
                setForm(d.item)
              }
            })
            props.onLinksChanged()
          }}
        />
      )}
    </aside>
  )
}

function FieldInput({ def, value, error, onChange }: { def: FieldDef; value: FieldValue | undefined; error: string | undefined; onChange: (v: FieldValue | undefined) => void }) {
  const str = value === undefined ? '' : Array.isArray(value) ? value.join(', ') : String(value)
  const [suggestions, setSuggestions] = useState<string[] | null>(null)
  const loadSuggestions = (): void => {
    if (suggestions) return
    void window.reqochet.getFieldValues(def.id).then(setSuggestions, () => setSuggestions([]))
  }
  let control
  switch (def.type) {
    case 'enum':
      control = (
        <select className="input" value={str} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">—</option>
          {def.options?.map((o) => <option key={o} value={o}>{optionLabel(def, o)}</option>)}
          {str && !def.options?.includes(str) && <option value={str}>{T.editor.notAllowed(str)}</option>}
        </select>
      )
      break
    case 'list':
      control = (
        <ListInput value={str} onChange={onChange} />
      )
      break
    case 'number':
      control = <input className="input" type="number" value={str} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
      break
    case 'date':
      control = <input className="input" type="date" value={str} onChange={(e) => onChange(e.target.value || undefined)} />
      break
    default:
      // UX-27: suggest the values this field already has in the repository (owners, components…)
      control = (
        <>
          <input className="input" list={`values-${def.id}`} value={str} onFocus={loadSuggestions} onChange={(e) => onChange(e.target.value)} />
          {suggestions && (
            <datalist id={`values-${def.id}`}>
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
        </>
      )
  }
  return (
    <label className={def.type === 'list' ? 'field field--wide' : 'field'}>
      <span className="field__label">{fieldLabel(def)}</span>
      {control}
      {error && <span className="field__error">{error}</span>}
    </label>
  )
}

/** A list field typed as "a, b, c": every keystroke counts (Ctrl+S saves what is typed — CR2-05). */
function ListInput({ value, onChange }: { value: string; onChange: (v: string[]) => void }) {
  const [raw, setRaw] = useState(value)
  const parse = (t: string): string[] => t.split(',').map((x) => x.trim()).filter(Boolean)
  // a new value from outside (another item, a reload) replaces the text; the user's own typing does not jump
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    if (parse(raw).join(', ') !== value) setRaw(value)
  }
  return (
    <input
      className="input"
      value={raw}
      placeholder={T.editor.listPlaceholder}
      onChange={(e) => {
        setRaw(e.target.value)
        onChange(parse(e.target.value))
      }}
    />
  )
}

/**
 * Where in the Markdown source a click on the formatted preview landed: the clicked word's text is looked up in the
 * source (formatting marks differ, the words do not); not found → the end of the text.
 */
function caretFromClick(x: number, y: number, source: string): number {
  const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }
  const range = doc.caretRangeFromPoint?.(x, y)
  const node = range?.startContainer
  if (!range || !node || node.nodeType !== Node.TEXT_NODE) return source.length
  const text = node.textContent ?? ''
  const at = source.indexOf(text)
  return at < 0 || source.indexOf(text, at + 1) >= 0 ? source.length : at + range.startOffset
}
