import { useEffect, useState } from 'react'
import type { RepoInfo } from '../../../shared/api'
import type { ItemTypeDef, LinkTypeDef } from '../../../shared/domain'
import { T } from '../../../shared/text'
import { errorMessage } from '../lib/hooks'

/** A type id from a name: "System Requirement" → "system-requirement" (lower-case letters, digits, dashes). */
const idFrom = (name: string): string =>
  name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(?=[0-9])/, 't-') // an id starts with a letter (CR-19)

type ItemDraft = ItemTypeDef & { key: number; isNew: boolean }
type LinkDraft = LinkTypeDef & { key: number; isNew: boolean }
let nextKey = 1

/**
 * The item and link types of the project (the owner, 5 Nov 2026 — S-04): add, rename, change the short name and
 * "is a heading"; a type can be removed only when nothing uses it (the window shows how many items or links do).
 * Required fields per item type (S-05): an item without them is saved but marked incomplete.
 */
export function TypesDialog({ info, onSaved, onClose }: { info: RepoInfo; onSaved: (i: RepoInfo) => void; onClose: () => void }) {
  const schema = info.schema
  const [items, setItems] = useState<ItemDraft[]>(() => schema.itemTypes.map((t) => ({ ...t, key: nextKey++, isNew: false })))
  const [links, setLinks] = useState<LinkDraft[]>(() => schema.linkTypes.map((t) => ({ ...t, key: nextKey++, isNew: false })))
  const [usage, setUsage] = useState<{ items: Record<string, number>; links: Record<string, number> } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void window.reqochet.getTypeUsage().then(setUsage)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fieldChoices = [{ id: 'title', name: T.columns.title }, { id: 'text', name: T.columns.text }, ...schema.fields.map((f) => ({ id: f.id, name: f.name }))]
  const patchItem = (key: number, p: Partial<ItemDraft>): void => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p, ...(x.isNew && p.name !== undefined ? { id: idFrom(p.name) } : {}) } : x)))
  const patchLink = (key: number, p: Partial<LinkDraft>): void => setLinks((xs) => xs.map((x) => (x.key === key ? { ...x, ...p, ...(x.isNew && p.name !== undefined ? { id: idFrom(p.name) } : {}) } : x)))
  const ids = items.map((x) => x.id)
  const linkIds = links.map((x) => x.id)
  const problem =
    items.some((x) => !x.id || !x.name.trim()) || links.some((x) => !x.id || !x.name.trim() || !x.reverseName.trim())
      ? T.typesDialog.missingName
      : new Set(ids).size !== ids.length || new Set(linkIds).size !== linkIds.length
        ? T.typesDialog.duplicate
        : null

  const save = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const strip = <X extends { key: number; isNew: boolean }>(x: X): Omit<X, 'key' | 'isNew'> => {
        const copy: Partial<X> = { ...x }
        delete copy.key
        delete copy.isNew
        return copy as Omit<X, 'key' | 'isNew'>
      }
      const r = await window.reqochet.saveSchemaTypes(items.map(strip), links.map(strip), info.schemaRevision)
      if (!r.ok) setError(r.message)
      else onSaved(r.info)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__panel" role="dialog" aria-modal="true" aria-label={T.typesDialog.title}>
        <header className="modal__header">
          <div>
            <h2 className="modal__title">{T.typesDialog.title}</h2>
            <p className="muted">{T.typesDialog.intro}</p>
          </div>
          <button type="button" className="icon-btn" aria-label={T.common.close} onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="modal__body scroll">
          <h3 className="types__heading">{T.typesDialog.itemTypes}</h3>
          <div className="fields-table types-table" role="table" aria-label={T.typesDialog.itemTypes}>
            <div className="fields-table__head" role="row">
              <span>{T.typesDialog.name}</span>
              <span>{T.typesDialog.short}</span>
              <span>{T.typesDialog.heading}</span>
              <span>{T.typesDialog.required}</span>
              <span>{T.typesDialog.used}</span>
            </div>
            {items.map((t) => {
              const n = usage?.items[t.id] ?? 0
              return (
                <div key={t.key} className="fields-table__row" role="row">
                  <input className="input" value={t.name} aria-label={T.typesDialog.nameOf(t.name || t.id)} onChange={(e) => patchItem(t.key, { name: e.target.value })} />
                  <input className="input" value={t.short ?? ''} aria-label={T.typesDialog.shortOf(t.name)} onChange={(e) => patchItem(t.key, { short: e.target.value })} />
                  <label className="check">
                    <input type="checkbox" checked={t.requirement === false} onChange={(e) => patchItem(t.key, { requirement: !e.target.checked })} />
                    <span className="sr-only">{T.typesDialog.headingOf(t.name)}</span>
                  </label>
                  <details className="types__required">
                    <summary>{(t.required ?? []).length ? (t.required ?? []).map((r) => fieldChoices.find((f) => f.id === r)?.name ?? r).join(', ') : T.typesDialog.none}</summary>
                    {fieldChoices.map((f) => (
                      <label key={f.id} className="check">
                        <input
                          type="checkbox"
                          checked={(t.required ?? []).includes(f.id)}
                          onChange={(e) => patchItem(t.key, { required: e.target.checked ? [...(t.required ?? []), f.id] : (t.required ?? []).filter((x) => x !== f.id) })}
                        />
                        {f.name}
                      </label>
                    ))}
                  </details>
                  <span className="types__used">
                    {T.typesDialog.count(n)}{' '}
                    <button type="button" className="link-btn" disabled={n > 0 || items.length === 1} title={n > 0 ? T.typesDialog.cannotRemove(n) : T.typesDialog.remove} onClick={() => setItems((xs) => xs.filter((x) => x.key !== t.key))}>
                      {T.typesDialog.remove}
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
          <button type="button" className="btn btn--small" onClick={() => setItems((xs) => [...xs, { key: nextKey++, isNew: true, id: '', name: '', requirement: true }])}>
            {T.typesDialog.addItemType}
          </button>

          <h3 className="types__heading">{T.typesDialog.linkTypes}</h3>
          <div className="fields-table types-table types-table--links" role="table" aria-label={T.typesDialog.linkTypes}>
            <div className="fields-table__head" role="row">
              <span>{T.typesDialog.linkName}</span>
              <span>{T.typesDialog.reverseName}</span>
              <span>{T.typesDialog.used}</span>
            </div>
            {links.map((l) => {
              const n = usage?.links[l.id] ?? 0
              return (
                <div key={l.key} className="fields-table__row" role="row">
                  <input className="input" value={l.name} aria-label={T.typesDialog.nameOf(l.name || l.id)} onChange={(e) => patchLink(l.key, { name: e.target.value })} />
                  <input className="input" value={l.reverseName} aria-label={T.typesDialog.reverseOf(l.name)} onChange={(e) => patchLink(l.key, { reverseName: e.target.value })} />
                  <span className="types__used">
                    {T.typesDialog.linkCount(n)}{' '}
                    <button type="button" className="link-btn" disabled={n > 0} title={n > 0 ? T.typesDialog.cannotRemove(n) : T.typesDialog.remove} onClick={() => setLinks((xs) => xs.filter((x) => x.key !== l.key))}>
                      {T.typesDialog.remove}
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
          <button type="button" className="btn btn--small" onClick={() => setLinks((xs) => [...xs, { key: nextKey++, isNew: true, id: '', name: '', reverseName: '' }])}>
            {T.typesDialog.addLinkType}
          </button>
        </div>
        <footer className="modal__footer">
          {(error ?? problem) && (
            <p className="notice notice--error" role="alert">
              {error ?? problem}
            </p>
          )}
          <div className="actions">
            <button type="button" className="btn btn--primary" disabled={busy || problem !== null} onClick={() => void save()}>
              {T.common.save}
            </button>
            <button type="button" className="btn" onClick={onClose}>
              {T.common.cancel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
