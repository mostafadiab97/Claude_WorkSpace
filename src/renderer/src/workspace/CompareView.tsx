import { useEffect, useMemo, useState } from 'react'
import type { CompareEntry, CompareOptions, CompareResult, LinkChange } from '../../../shared/api'
import type { Schema } from '../../../shared/domain'
import { errorMessage } from '../lib/hooks'
import { linkName, typeName } from '../lib/schema'
import { ChangeView } from './ChangeView'

const WORKING = 'WORKING'
const SHOW = 400

type Preset = 'lastPull' | 'uncommitted' | 'lastCommit' | 'custom'
type Kind = CompareEntry['kind']

const KIND_LABEL: Record<Kind, string> = { added: 'Added', modified: 'Changed', moved: 'Moved', deleted: 'Deleted' }
const KIND_LETTER: Record<Kind, string> = { added: 'A', modified: 'M', moved: 'P', deleted: 'D' }

const when = (iso: string): string => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/** The default comparison: what the last pull brought in; otherwise uncommitted changes; otherwise the last commit. */
function defaultPreset(o: CompareOptions): Preset {
  if (o.lastPull) return 'lastPull'
  if (o.hasUncommitted && o.head) return 'uncommitted'
  if (o.commits.length >= 2) return 'lastCommit'
  return 'custom'
}

function rangeOf(preset: Preset, o: CompareOptions, custom: { from: string; to: string }): { from: string; to: string } | null {
  switch (preset) {
    case 'lastPull':
      return o.lastPull ? { from: o.lastPull.from, to: o.lastPull.to } : null
    case 'uncommitted':
      return o.head ? { from: o.head, to: WORKING } : null
    case 'lastCommit':
      return o.commits[1] && o.commits[0] ? { from: o.commits[1].hash, to: o.commits[0].hash } : null
    default:
      return custom.from && custom.to ? custom : null
  }
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
      {withWorking && <option value={WORKING}>Your working folder (all saved changes)</option>}
      {options && options.refs.length > 0 && (
        <optgroup label="Branches and tags">
          {options.refs.map((r) => (
            <option key={`${r.kind}-${r.name}`} value={r.hash}>
              {r.kind === 'tag' ? 'Tag' : r.kind === 'remote' ? 'Remote' : 'Branch'} {r.name}
            </option>
          ))}
        </optgroup>
      )}
      {options && options.commits.length > 0 && (
        <optgroup label="Commits that changed requirements">
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
    <section className="compare" aria-label="Compare">
      <div className="compare__head">
        <h2 className="compare__title">Compare</h2>
        <select
          className="input compare__preset"
          aria-label="What to compare"
          value={preset ?? ''}
          onChange={(e) => {
            setPreset(e.target.value as Preset)
            setShown(SHOW)
            props.onSelect(null)
          }}
          disabled={!options}
        >
          <option value="lastPull" disabled={!options?.lastPull}>
            What the last pull brought in{options?.lastPull ? ` (${when(options.lastPull.date)})` : ' (no pull on this PC yet)'}
          </option>
          <option value="uncommitted" disabled={!options?.head}>
            Uncommitted changes (last commit → working folder)
          </option>
          <option value="lastCommit" disabled={(options?.commits.length ?? 0) < 2}>
            The last commit that changed requirements
          </option>
          <option value="custom">Choose two versions…</option>
        </select>
        <span className="toolbar__spacer" />
        {data && (
          <>
            <button type="button" className="btn" onClick={() => void exportAs('csv')} title="One row per changed item and per change — opens in Excel">
              Export CSV
            </button>
            <button type="button" className="btn" onClick={() => void exportAs('markdown')} title="A readable report, e.g. for an AI tool or a pull request">
              Export Markdown
            </button>
          </>
        )}
        <button type="button" className="btn" onClick={props.onPullAgain} disabled={props.pulling}>
          {props.pulling ? 'Pulling…' : 'Pull and refresh'}
        </button>
        <button type="button" className="btn" onClick={props.onClose}>
          Close compare
        </button>
      </div>

      {preset === 'custom' && options && (
        <div className="compare__custom">
          <label className="field">
            <span className="field__label">From (older)</span>
            <select className="input" aria-label="Compare from" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}>
              <option value="">Choose…</option>
              {refOptions(false)}
            </select>
          </label>
          <label className="field">
            <span className="field__label">To (newer)</span>
            <select className="input" aria-label="Compare to" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}>
              {refOptions(true)}
            </select>
          </label>
        </div>
      )}

      {props.pullNote && (
        <p className={props.pullNote.ok ? 'compare__pull' : 'compare__pull compare__pull--error'} role="status">
          {props.pullNote.ok ? 'Pulled first: ' : 'Could not pull first — comparing what is on this PC. '}
          {props.pullNote.ok ? props.pullNote.message.replace(/^Pulled:\s*/, '') : props.pullNote.message}
        </p>
      )}

      {error && <p className="notice notice--error" role="alert">{error}</p>}
      {exported && (
        <p className="compare__pull" role="status">
          Exported to {exported}{' '}
          <button type="button" className="link-btn" onClick={() => void window.reqman.showInFolder(exported)}>
            Show in folder
          </button>
        </p>
      )}
      {!range && options && <p className="muted compare__empty">Nothing to compare yet — choose two versions.</p>}
      {loading && <p className="muted compare__empty" role="status">Comparing…</p>}

      {data && (
        <>
          <p className="compare__range">
            <span className="muted-inline">From</span> {data.from.label} <span className="muted-inline">to</span> {data.to.label}
          </p>
          <div className="compare__chips" role="group" aria-label="Show">
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
              Links +{linksAdded} −{linksRemoved}
            </span>
            {data.schema && <span className="chip chip--static chip--warn">Schema changed</span>}
            <span className="toolbar__spacer" />
            <input className="input compare__filter" type="search" placeholder="Filter by ID or title…" aria-label="Filter changes" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>

          {data.schema && (
            <p className="notice notice--warn compare__schema">
              Schema: {describeSchema(data.schema) || 'names, options or defaults changed'}
            </p>
          )}

          <div className="tabs compare__tabs" role="tablist" aria-label="Compare view">
            <button type="button" role="tab" aria-selected={tab === 'items'} className={tab === 'items' ? 'tabs__tab tabs__tab--active' : 'tabs__tab'} onClick={() => setTab('items')}>
              Items ({data.entries.length})
            </button>
            <button type="button" role="tab" aria-selected={tab === 'links'} className={tab === 'links' ? 'tabs__tab tabs__tab--active' : 'tabs__tab'} onClick={() => setTab('links')}>
              Links ({data.links.length})
            </button>
          </div>

          {tab === 'items' ? (
            data.entries.length === 0 ? (
              <p className="muted compare__empty">No requirement changed between these two versions.</p>
            ) : (
              <ul className="compare__list scroll" aria-label="Changed items">
                {visible.slice(0, shown).map((e) => (
                  <li key={e.id}>
                    <button type="button" className={e.id === selected ? 'compare__row compare__row--selected' : 'compare__row'} aria-pressed={e.id === selected} onClick={() => props.onSelect(e)}>
                      <span className={`changes__kind changes__kind--${e.kind === 'modified' ? 'modified' : e.kind === 'moved' ? 'renamed' : e.kind}`} title={KIND_LABEL[e.kind]}>
                        {KIND_LETTER[e.kind]}
                      </span>
                      <span className="tree__id">{e.id}</span>
                      <span className="compare__name">{e.title || '(no title)'}</span>
                      <span className="compare__type">{typeName(schema, e.type)}</span>
                      <span className="compare__summary">{e.summary}</span>
                      {e.kind === 'modified' && e.contentChanged && e.incoming > 0 && (
                        <span className="compare__impact" title="Links from these items become suspect: they may need review">
                          ⚠ {e.incoming === 1 ? '1 item links' : `${e.incoming} items link`} here
                        </span>
                      )}
                    </button>
                  </li>
                ))}
                {visible.length > shown && (
                  <li>
                    <button type="button" className="link-btn compare__more" onClick={() => setShown((n) => n + SHOW)}>
                      Show more ({(visible.length - shown).toLocaleString('en')} hidden)
                    </button>
                  </li>
                )}
                {visible.length === 0 && <li className="muted compare__empty">Nothing matches the filter.</li>}
              </ul>
            )
          ) : (
            <LinkList schema={schema} links={data.links} filter={filter} onOpen={openEntry} />
          )}
          {data.otherFiles.length > 0 && <p className="muted-inline compare__other">Other files changed: {data.otherFiles.join(', ')}</p>}
        </>
      )}
    </section>
  )
}

function describeSchema(s: NonNullable<CompareResult['schema']>): string {
  const parts: string[] = []
  if (s.fieldsAdded.length) parts.push(`fields added: ${s.fieldsAdded.join(', ')}`)
  if (s.fieldsRemoved.length) parts.push(`fields removed: ${s.fieldsRemoved.join(', ')}`)
  if (s.typesAdded.length) parts.push(`item types added: ${s.typesAdded.join(', ')}`)
  if (s.typesRemoved.length) parts.push(`item types removed: ${s.typesRemoved.join(', ')}`)
  if (s.linkTypesAdded.length) parts.push(`link types added: ${s.linkTypesAdded.join(', ')}`)
  if (s.linkTypesRemoved.length) parts.push(`link types removed: ${s.linkTypesRemoved.join(', ')}`)
  return parts.join('; ')
}

function LinkList({ schema, links, filter, onOpen }: { schema: Schema; links: LinkChange[]; filter: string; onOpen: (id: string) => void }) {
  const words = filter.trim().toLowerCase()
  const shown = links.filter((l) => !words || `${l.source} ${l.target}`.toLowerCase().includes(words))
  if (links.length === 0) return <p className="muted compare__empty">No link was added or removed.</p>
  return (
    <ul className="compare__list scroll" aria-label="Changed links">
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
          <span className="muted-inline">— {l.change === 'added' ? 'added' : 'removed'}</span>
        </li>
      ))}
    </ul>
  )
}

/** Right-hand panel in compare mode: what changed in the selected item. */
export function CompareDetail({ schema, entry, onOpenItem, onClose }: { schema: Schema; entry: CompareEntry; onOpenItem: (id: string) => void; onClose: () => void }) {
  return (
    <aside className="editor scroll" aria-label={`Change ${entry.id}`}>
      <header className="editor__header">
        <div>
          <div className="editor__id">{entry.id}</div>
          <div className="editor__type">
            {typeName(schema, entry.type)} · {KIND_LABEL[entry.kind].toLowerCase()}
          </div>
        </div>
        <button type="button" className="icon-btn" aria-label="Close change" title="Close" onClick={onClose}>
          ✕
        </button>
      </header>
      <div className="editor__body">
        <h3 className="compare__detail-title">{entry.title || '(no title)'}</h3>
        {entry.kind === 'modified' && entry.contentChanged && entry.incoming > 0 && (
          <p className="notice notice--warn">
            Type, title or text changed: links from {entry.incoming} item{entry.incoming === 1 ? '' : 's'} to it are now suspect and may need review.
          </p>
        )}
        <ChangeView schema={schema} diff={entry.diff} unreadable={entry.unreadable} />
        {entry.kind !== 'deleted' && (
          <button type="button" className="btn" onClick={() => onOpenItem(entry.id)}>
            Open the item
          </button>
        )}
      </div>
    </aside>
  )
}
