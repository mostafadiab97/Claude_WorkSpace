import { useEffect, useMemo, useState } from 'react'
import type { CompareEntry, CompareOptions, CompareResult, LinkChange } from '../../../shared/api'
import type { Schema } from '../../../shared/domain'
import { errorMessage } from '../lib/hooks'
import { linkName, typeName } from '../lib/schema'
import { ChangeView } from './ChangeView'
import { defaultPreset, describeSchema, rangeOf, WORKING, type Preset } from './compareRange'
import { T } from '../../../shared/text'

const SHOW = 400

type Kind = CompareEntry['kind']

const KIND_LABEL: Record<Kind, string> = T.compare.kinds
const KIND_LETTER: Record<Kind, string> = { added: 'A', modified: 'M', moved: 'P', deleted: 'D' }

const when = (iso: string): string => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Compare (journey step 6): two versions of the whole requirements set, listed per requirement and per link —
 * "SYS-12 text changed", "TC-4 verifies SYS-7 added" — instead of changed file lines.
 * The workspace pulls right before opening it, so "what the last pull brought in" is up to date.
 */
export function CompareView(props: {
  schema: Schema
  /** Result of the pull made just before (shown at the top), or null if none was possible. */
  pullNote: { ok: boolean; message: string } | null
  pulling: boolean
  onPullAgain: () => void
  selected: string | null
  onSelect: (entry: CompareEntry | null) => void
  onClose: () => void
}) {
  const { schema, selected } = props
  const [options, setOptions] = useState<CompareOptions | null>(null)
  const [preset, setPreset] = useState<Preset | null>(null)
  const [custom, setCustom] = useState({ from: '', to: WORKING })
  const [result, setResult] = useState<{ key: string; data: CompareResult } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'items' | 'links'>('items')
  const [kinds, setKinds] = useState<Set<Kind>>(new Set())
  const [filter, setFilter] = useState('')
  const [shown, setShown] = useState(SHOW)

  // Options are (re)loaded after the pull finished.
  useEffect(() => {
    if (props.pulling) return
    let live = true
    void window.reqman
      .getCompareOptions()
      .then((o) => {
        if (!live) return
        setOptions(o)
        setPreset((p) => p ?? defaultPreset(o))
        setCustom((c) => (c.from ? c : { from: o.commits[1]?.hash ?? o.commits[0]?.hash ?? '', to: WORKING }))
      })
      .catch((e: unknown) => live && setError(errorMessage(e)))
    return () => {
      live = false
    }
  }, [props.pulling])

  const range = options && preset ? rangeOf(preset, options, custom) : null
  const key = range ? `${range.from}..${range.to}` : ''
  useEffect(() => {
    if (!range) return
    let live = true
    void window.reqman
      .compareVersions(range.from, range.to)
      .then((data) => {
        if (!live) return
        setResult({ key: `${range.from}..${range.to}`, data })
        setError(null)
      })
      .catch((e: unknown) => live && setError(errorMessage(e)))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key stands for range
  }, [key])

  const data = result && result.key === key ? result.data : null
  const loading = range !== null && !data && !error

  const counts = useMemo(() => {
    const c: Record<Kind, number> = { added: 0, modified: 0, moved: 0, deleted: 0 }
    for (const e of data?.entries ?? []) c[e.kind]++
    return c
  }, [data])
  const visible = useMemo(() => {
    const words = filter.trim().toLowerCase()
    return (data?.entries ?? []).filter((e) => (kinds.size === 0 || kinds.has(e.kind)) && (!words || `${e.id} ${e.title}`.toLowerCase().includes(words)))
  }, [data, kinds, filter])
  const linksAdded = data?.links.filter((l) => l.change === 'added').length ?? 0
  const linksRemoved = (data?.links.length ?? 0) - linksAdded

  const toggleKind = (k: Kind): void => {
    setShown(SHOW)
    setKinds((prev) => {
      const s = new Set(prev)
      if (s.has(k)) s.delete(k)
      else s.add(k)
      return s
    })
  }
  const openEntry = (id: string): void => {
    const e = data?.entries.find((x) => x.id === id)
    if (e) props.onSelect(e)
  }

  const [exported, setExported] = useState<string | null>(null)
  const exportAs = async (format: 'csv' | 'markdown'): Promise<void> => {
    if (!data) return
    try {
      const r = await window.reqman.exportCompare(data.from.ref, data.to.ref, format)
      if (r.ok) setExported(r.path)
      else if (!r.canceled) setError(r.message)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const commitLabel = (c: CompareOptions['commits'][number]): string => `${c.hash.slice(0, 7)} ${c.message} — ${c.author}, ${when(c.date)}`
  const refOptions = (withWorking: boolean) => (
    <>
      {withWorking && <option value={WORKING}>{T.compare.working}</option>}
      {options && options.refs.length > 0 && (
        <optgroup label={T.compare.refsGroup}>
          {options.refs.map((r) => (
            <option key={`${r.kind}-${r.name}`} value={r.hash}>
              {T.compare.refKinds[r.kind]} {r.name}
            </option>
          ))}
        </optgroup>
      )}
      {options && options.commits.length > 0 && (
        <optgroup label={T.compare.commitsGroup}>
          {options.commits.map((c) => (
            <option key={c.hash} value={c.hash}>
              {commitLabel(c)}
            </option>
          ))}
        </optgroup>
      )}
    </>
  )

  return (
    <section className="compare" aria-label={T.compare.label}>
      <div className="compare__head">
        <h2 className="compare__title">{T.compare.title}</h2>
        <select
          className="input compare__preset"
          aria-label={T.compare.what}
          value={preset ?? ''}
          onChange={(e) => {
            setPreset(e.target.value as Preset)
            setShown(SHOW)
            props.onSelect(null)
          }}
          disabled={!options}
        >
          <option value="lastPull" disabled={!options?.lastPull}>
            {T.compare.lastPull(options?.lastPull ? when(options.lastPull.date) : null)}
          </option>
          <option value="uncommitted" disabled={!options?.head}>
            {T.compare.uncommitted}
          </option>
          <option value="lastCommit" disabled={(options?.commits.length ?? 0) < 2}>
            {T.compare.lastCommit}
          </option>
          <option value="custom">{T.compare.custom}</option>
        </select>
        <span className="toolbar__spacer" />
        {data && (
          <>
            <button type="button" className="btn" onClick={() => void exportAs('csv')} title={T.compare.exportCsvTooltip}>
              {T.compare.exportCsv}
            </button>
            <button type="button" className="btn" onClick={() => void exportAs('markdown')} title={T.compare.exportMdTooltip}>
              {T.compare.exportMd}
            </button>
          </>
        )}
        <button type="button" className="btn" onClick={props.onPullAgain} disabled={props.pulling}>
          {props.pulling ? T.compare.pulling : T.compare.pullAgain}
        </button>
        <button type="button" className="btn" onClick={props.onClose}>
          {T.compare.close}
        </button>
      </div>

      {preset === 'custom' && options && (
        <div className="compare__custom">
          <label className="field">
            <span className="field__label">{T.compare.from}</span>
            <select className="input" aria-label={T.compare.fromLabel} value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}>
              <option value="">{T.compare.choose}</option>
              {refOptions(false)}
            </select>
          </label>
          <label className="field">
            <span className="field__label">{T.compare.to}</span>
            <select className="input" aria-label={T.compare.toLabel} value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}>
              {refOptions(true)}
            </select>
          </label>
        </div>
      )}

      {props.pullNote && (
        <p className={props.pullNote.ok ? 'compare__pull' : 'compare__pull compare__pull--error'} role="status">
          {props.pullNote.ok ? T.compare.pulledFirst : T.compare.couldNotPull}
          {props.pullNote.ok ? props.pullNote.message.replace(/^Pulled:\s*/, '') : props.pullNote.message}
        </p>
      )}

      {error && <p className="notice notice--error" role="alert">{error}</p>}
      {exported && (
        <p className="compare__pull" role="status">
          {T.compare.exportedTo(exported)}{' '}
          <button type="button" className="link-btn" onClick={() => void window.reqman.showInFolder(exported)}>
            {T.exportDialog.showInFolder}
          </button>
        </p>
      )}
      {!range && options && <p className="muted compare__empty">{T.compare.nothingYet}</p>}
      {loading && <p className="muted compare__empty" role="status">{T.compare.comparing}</p>}

      {data && (
        <>
          <p className="compare__range">
            <span className="muted-inline">{T.compare.rangeFrom}</span> {data.from.label} <span className="muted-inline">{T.compare.rangeTo}</span> {data.to.label}
          </p>
          <div className="compare__chips" role="group" aria-label={T.compare.show}>
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                className={kinds.has(k) ? `chip chip--${k} chip--on` : `chip chip--${k}`}
                aria-pressed={kinds.has(k)}
                disabled={counts[k] === 0}
                onClick={() => toggleKind(k)}
              >
                {KIND_LABEL[k]} {counts[k]}
              </button>
            ))}
            <span className="chip chip--static">
              {T.compare.linksChip(linksAdded, linksRemoved)}
            </span>
            {data.schema && <span className="chip chip--static chip--warn">{T.compare.schemaChanged}</span>}
            <span className="toolbar__spacer" />
            <input className="input compare__filter" type="search" placeholder={T.compare.filter} aria-label={T.compare.filterLabel} value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>

          {data.schema && (
            <p className="notice notice--warn compare__schema">
              {T.compare.schema(describeSchema(data.schema))}
            </p>
          )}

          <div className="tabs compare__tabs" role="tablist" aria-label={T.compare.view}>
            <button type="button" role="tab" aria-selected={tab === 'items'} className={tab === 'items' ? 'tabs__tab tabs__tab--active' : 'tabs__tab'} onClick={() => setTab('items')}>
              {T.compare.itemsTab(data.entries.length)}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'links'} className={tab === 'links' ? 'tabs__tab tabs__tab--active' : 'tabs__tab'} onClick={() => setTab('links')}>
              {T.compare.linksTab(data.links.length)}
            </button>
          </div>

          {tab === 'items' ? (
            data.entries.length === 0 ? (
              <p className="muted compare__empty">{T.compare.noChange}</p>
            ) : (
              <ul className="compare__list scroll" aria-label={T.compare.changedItems}>
                {visible.slice(0, shown).map((e) => (
                  <li key={e.id}>
                    <button type="button" className={e.id === selected ? 'compare__row compare__row--selected' : 'compare__row'} aria-pressed={e.id === selected} onClick={() => props.onSelect(e)}>
                      <span className={`changes__kind changes__kind--${e.kind === 'modified' ? 'modified' : e.kind === 'moved' ? 'renamed' : e.kind}`} title={KIND_LABEL[e.kind]}>
                        {KIND_LETTER[e.kind]}
                      </span>
                      <span className="tree__id">{e.id}</span>
                      <span className="compare__name">{e.title || T.common.noTitle}</span>
                      <span className="compare__type">{typeName(schema, e.type)}</span>
                      <span className="compare__summary">{e.summary}</span>
                      {e.kind === 'modified' && e.contentChanged && e.incoming > 0 && (
                        <span className="compare__impact" title={T.compare.impactTooltip}>
                          {T.compare.impact(e.incoming)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
                {visible.length > shown && (
                  <li>
                    <button type="button" className="link-btn compare__more" onClick={() => setShown((n) => n + SHOW)}>
                      {T.compare.showMore(visible.length - shown)}
                    </button>
                  </li>
                )}
                {visible.length === 0 && <li className="muted compare__empty">{T.compare.noMatch}</li>}
              </ul>
            )
          ) : (
            <LinkList schema={schema} links={data.links} filter={filter} onOpen={openEntry} />
          )}
          {data.otherFiles.length > 0 && <p className="muted-inline compare__other">{T.compare.otherFiles(data.otherFiles.join(', '))}</p>}
        </>
      )}
    </section>
  )
}

function LinkList({ schema, links, filter, onOpen }: { schema: Schema; links: LinkChange[]; filter: string; onOpen: (id: string) => void }) {
  const words = filter.trim().toLowerCase()
  const shown = links.filter((l) => !words || `${l.source} ${l.target}`.toLowerCase().includes(words))
  if (links.length === 0) return <p className="muted compare__empty">{T.compare.noLinks}</p>
  return (
    <ul className="compare__list scroll" aria-label={T.compare.changedLinks}>
      {shown.map((l) => (
        <li key={`${l.change}-${l.source}-${l.type}-${l.target}`} className="compare__link">
          <span className={l.change === 'added' ? 'changes__kind changes__kind--added' : 'changes__kind changes__kind--deleted'} title={l.change}>
            {l.change === 'added' ? '+' : '−'}
          </span>
          <button type="button" className="link-btn tree__id" onClick={() => onOpen(l.source)}>
            {l.source}
          </button>
          <span className="muted-inline">{linkName(schema, l.type)}</span>
          <span className="tree__id">{l.target}</span>
          <span className="muted-inline">— {l.change === 'added' ? T.compare.linkAdded : T.compare.linkRemoved}</span>
        </li>
      ))}
    </ul>
  )
}

/** Right-hand panel in compare mode: what changed in the selected item. */
export function CompareDetail({ schema, entry, onOpenItem, onClose }: { schema: Schema; entry: CompareEntry; onOpenItem: (id: string) => void; onClose: () => void }) {
  return (
    <aside className="editor scroll" aria-label={T.compare.detailLabel(entry.id)}>
      <header className="editor__header">
        <div>
          <div className="editor__id">{entry.id}</div>
          <div className="editor__type">
            {typeName(schema, entry.type)} · {KIND_LABEL[entry.kind].toLowerCase()}
          </div>
        </div>
        <button type="button" className="icon-btn" aria-label={T.compare.closeChange} title={T.common.close} onClick={onClose}>
          ✕
        </button>
      </header>
      <div className="editor__body">
        <h3 className="compare__detail-title">{entry.title || T.common.noTitle}</h3>
        {entry.kind === 'modified' && entry.contentChanged && entry.incoming > 0 && (
          <p className="notice notice--warn">
            {T.compare.suspectWarning(entry.incoming)}
          </p>
        )}
        <ChangeView schema={schema} diff={entry.diff} unreadable={entry.unreadable} />
        {entry.kind !== 'deleted' && (
          <button type="button" className="btn" onClick={() => onOpenItem(entry.id)}>
            {T.compare.openItem}
          </button>
        )}
      </div>
    </aside>
  )
}
