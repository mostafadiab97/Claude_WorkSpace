import { useState } from 'react'
import type { ItemDetails, LinkInfo } from '../../../shared/api'
import type { Schema } from '../../../shared/domain'
import { errorMessage } from '../lib/hooks'
import { ItemSearch } from './ItemSearch'
import { T } from '../../../shared/text'

type Direction = 'out' | 'in'
interface Entry {
  dir: Direction
  link: LinkInfo
}

/**
 * The links of one item, both directions: "verifies SYS-1" (stored in this item) and "verified by TC-1"
 * (stored in the other item). Adding, removing and confirming links is saved straight away.
 * A link is suspect when the item it points to changed (title, text or type) after the link was confirmed.
 */
export function LinksSection(props: {
  schema: Schema
  itemId: string
  details: ItemDetails | null
  /** Why links cannot be changed right now (unsaved changes, new item), or null. */
  lockedReason: string | null
  onChanged: () => Promise<void> | void
  onOpen: (id: string) => void
}) {
  const { schema, itemId, details, lockedReason } = props
  const [adding, setAdding] = useState(false)
  const [relation, setRelation] = useState(() => `out:${schema.linkTypes[0]?.id ?? ''}`)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const linkType = (id: string) => schema.linkTypes.find((t) => t.id === id)
  const label = (dir: Direction, type: string): string => {
    const t = linkType(type)
    return t ? (dir === 'out' ? t.name : t.reverseName) : T.links.unknownType(type)
  }
  const entries: Entry[] = [
    ...(details?.outgoing ?? []).map((link) => ({ dir: 'out' as const, link })),
    ...(details?.incoming ?? []).map((link) => ({ dir: 'in' as const, link }))
  ]
  // Group by relation, in the order the schema lists link types (outgoing first).
  const order = (e: Entry): number => {
    const k = schema.linkTypes.findIndex((t) => t.id === e.link.type)
    return (e.dir === 'out' ? 0 : 1000) + (k < 0 ? 999 : k)
  }
  entries.sort((a, b) => order(a) - order(b) || a.link.id.localeCompare(b.link.id))
  const suspects = entries.filter((e) => e.link.suspect)
  const [askUnlinkAll, setAskUnlinkAll] = useState(false)
  // Keep = the link still holds (confirmed against the item as it is now); Unlink = remove it (O-04)
  const decision = (e: Entry, keep: boolean) =>
    e.dir === 'out' ? { source: itemId, type: e.link.type, target: e.link.id, keep } : { source: e.link.id, type: e.link.type, target: itemId, keep }
  const decideAll = (keep: boolean): void => {
    setAskUnlinkAll(false)
    void run(async () => {
      const r = await window.reqman.decideLinks(suspects.map((e) => decision(e, keep)))
      return r.ok ? { ok: true } : r
    })
  }

  const run = async (op: () => Promise<{ ok: true } | { ok: false; message: string }>): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const r = await op()
      if (!r.ok) setError(r.message)
      await props.onChanged()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const [dir, type] = relation.split(':') as [Direction, string]
  const add = (target: string): void => {
    setAdding(false)
    void run(() => (dir === 'out' ? window.reqman.addLink(itemId, type, target) : window.reqman.addLink(target, type, itemId)))
  }
  const remove = (e: Entry): void =>
    void run(() => (e.dir === 'out' ? window.reqman.removeLink(itemId, e.link.type, e.link.id) : window.reqman.removeLink(e.link.id, e.link.type, itemId)))
  const decide = (e: Entry, keep: boolean): void =>
    void run(async () => {
      const r = await window.reqman.decideLinks([decision(e, keep)])
      return r.ok ? { ok: true } : r
    })

  const locked = lockedReason !== null || busy

  return (
    <section className="links" aria-label={T.links.section}>
      <div className="links__head">
        <h3 className="links__title">{T.links.title(entries.length)}</h3>
        {suspects.length > 1 &&
          (askUnlinkAll ? (
            <span className="actions">
              <span className="muted-inline">{T.links.unlinkAllAsk(suspects.length)}</span>
              <button type="button" className="btn btn--small btn--danger" disabled={locked} onClick={() => decideAll(false)}>
                {T.links.unlinkAll(suspects.length)}
              </button>
              <button type="button" className="btn btn--small" onClick={() => setAskUnlinkAll(false)}>
                {T.suspect.back}
              </button>
            </span>
          ) : (
            <span className="actions">
              <button type="button" className="link-btn" disabled={locked} onClick={() => decideAll(true)} title={T.links.confirmTooltip}>
                {T.links.keepAll(suspects.length)}
              </button>
              <button type="button" className="link-btn" disabled={locked} onClick={() => setAskUnlinkAll(true)}>
                {T.links.unlinkAll(suspects.length)}
              </button>
            </span>
          ))}
        {!adding && (
          <button type="button" className="btn btn--small" disabled={locked || schema.linkTypes.length === 0} onClick={() => setAdding(true)} title={lockedReason ?? undefined}>
            {T.links.add}
          </button>
        )}
      </div>

      {lockedReason && <p className="muted-inline">{lockedReason}</p>}

      {adding && (
        <div className="links__add">
          <select className="input" aria-label={T.links.linkType} value={relation} onChange={(e) => setRelation(e.target.value)}>
            <optgroup label={T.links.thisItem}>
              {schema.linkTypes.map((t) => <option key={`out-${t.id}`} value={`out:${t.id}`}>{t.name}</option>)}
            </optgroup>
            <optgroup label={T.links.thisItemIs}>
              {schema.linkTypes.map((t) => <option key={`in-${t.id}`} value={`in:${t.id}`}>{t.reverseName}</option>)}
            </optgroup>
          </select>
          <ItemSearch
            schema={schema}
            label={T.links.searchLabel}
            placeholder={T.links.searchPlaceholder}
            blocked={(item) =>
              item.id === itemId
                ? T.links.self
                : entries.some((e) => e.dir === dir && e.link.type === type && e.link.id === item.id)
                  ? T.links.already
                  : null
            }
            onPick={(item) => add(item.id)}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {entries.length === 0 && !adding && !lockedReason && <p className="muted-inline">{T.links.none}</p>}
      <ul className="links__list">
        {entries.map((e, i) => {
          const groupStart = i === 0 || order(entries[i - 1] as Entry) !== order(e)
          return (
            <li key={`${e.dir}-${e.link.type}-${e.link.id}`} className={e.link.suspect ? 'links__item links__item--suspect' : 'links__item'}>
              <span className="links__rel">{groupStart ? label(e.dir, e.link.type) : ''}</span>
              <span className="links__target">
                <button type="button" className="link-btn links__id" onClick={() => props.onOpen(e.link.id)}>{e.link.id}</button>
                <span className="links__name" title={e.link.title}>
                  {e.link.exists ? e.link.title || T.common.noTitle : <span className="field__error">{T.links.missing}</span>}
                </span>
                {e.link.suspect && (
                  <span className="links__suspect">
                    <span title={e.dir === 'out' ? T.links.suspectOutTooltip(e.link.id) : T.links.suspectInTooltip(e.link.id)}>
                      ⚠ {e.dir === 'out' ? T.links.changed : T.links.thisChanged}
                    </span>
                    <button type="button" className="link-btn" disabled={locked} onClick={() => decide(e, true)} title={T.links.confirmTooltip}>
                      {T.links.keep}
                    </button>
                    <button type="button" className="link-btn" disabled={locked} onClick={() => decide(e, false)} title={T.links.unlinkTooltip}>
                      {T.links.unlink}
                    </button>
                  </span>
                )}
              </span>
              <button
                type="button"
                className="icon-btn icon-btn--small"
                disabled={locked}
                aria-label={T.links.removeLabel(label(e.dir, e.link.type), e.link.id)}
                title={e.dir === 'in' ? T.links.removeInTooltip(e.link.id) : T.links.removeTooltip}
                onClick={() => remove(e)}
              >
                ✕
              </button>
            </li>
          )
        })}
      </ul>
      {error && <p className="notice notice--error" role="alert">{error}</p>}
    </section>
  )
}
