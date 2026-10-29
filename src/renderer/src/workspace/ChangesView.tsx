import { useMemo, useState } from 'react'
import type { CompareEntry, CompareOptions, GitResult, GitState, LinkChange, RevertPart } from '../../../shared/api'
import type { Schema } from '../../../shared/domain'
import { errorMessage } from '../lib/hooks'
import { linkName, typeName } from '../lib/schema'
import { ChangeView } from './ChangeView'
import { describeSchema, numberLabel, WORKING, type Preset } from './compareRange'
import { CommitTools } from './GitPanels'
import type { ChangesState } from './screen/useChanges'
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
 * The Changes view (owner's decision O-06), in the wide middle area: one place for uncommitted changes and for
 * comparing versions. "Show" picks what (uncommitted changes by default, what the last pull brought in, the last
 * commit, any two versions); the changed items are listed on top — per requirement and per link, not file lines —
 * and the selected item's difference is shown below, old and new side by side (O-05). For uncommitted changes
 * every part of the difference can be taken back on its own (↶), or the whole item discarded.
 */
export function ChangesView(props: {
  schema: Schema
  changes: ChangesState
  git: GitState | null
  /** Why files cannot be changed right now (unsaved edit), or null. */
  blocked: string | null
  pulling: boolean
  onPull: () => void
  onRevert: (id: string, part: RevertPart) => Promise<void>
  onDiscard: (entry: CompareEntry) => Promise<void>
  /** Discards these files (several chosen items, or everything) — owner, 0.11.0. */
  onDiscardPaths: (paths: string[]) => Promise<void>
  onOpenItem: (id: string) => void
  onClose: () => void
}) {
  const { schema, changes: c, git } = props
  const { options, data } = c
  const [tab, setTab] = useState<'items' | 'links'>('items')
  const [kinds, setKinds] = useState<Set<Kind>>(new Set())
  const [filter, setFilter] = useState('')
  const [shown, setShown] = useState(SHOW)
  const [working, setWorking] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState<string | null>(null)
  // items ticked for "Discard N chosen" (uncommitted changes only)
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [confirmMany, setConfirmMany] = useState<'picked' | 'all' | null>(null)
  const uncommitted = c.preset === 'uncommitted'

  const counts = useMemo(() => {
    const n: Record<Kind, number> = { added: 0, modified: 0, moved: 0, deleted: 0 }
    for (const e of data?.entries ?? []) n[e.kind]++
    return n
  }, [data])
  const visible = useMemo(() => {
    const words = filter.trim().toLowerCase()
    return (data?.entries ?? []).filter((e) => (kinds.size === 0 || kinds.has(e.kind)) && (!words || `${e.id} ${e.title} ${e.numberAfter ?? ''}`.toLowerCase().includes(words)))
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
  const act = async (op: () => Promise<void>): Promise<void> => {
    setWorking(true)
    try {
      await op()
    } catch (e) {
      c.setError(errorMessage(e))
    } finally {
      setWorking(false)
    }
  }

  const commitLabel = (x: CompareOptions['commits'][number]): string => `${x.hash.slice(0, 7)} ${x.message} — ${x.author}, ${when(x.date)}`
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
          {options.commits.map((x) => (
            <option key={x.hash} value={x.hash}>
              {commitLabel(x)}
            </option>
          ))}
        </optgroup>
      )}
    </>
  )

  const sel = c.selected
  const locked = props.blocked ?? (working ? T.changesView.working : null)
  const offerPull = c.preset === 'lastPull' && git?.hasRemote === true && !c.pullAnswered

  return (
    <section className="compare changes-view" aria-label={T.changesView.label}>
      <div className="compare__head">
        <h2 className="compare__title">{T.changesView.title}</h2>
        <select
          className="input compare__preset"
          aria-label={T.changesView.show}
          value={c.preset}
          onChange={(e) => {
            c.choose(e.target.value as Preset)
            setShown(SHOW)
            setConfirmDiscard(null)
            setPicked(new Set())
            setConfirmMany(null)
          }}
          disabled={!options}
        >
          <option value="uncommitted">{T.changesView.uncommitted(git?.changes.length ?? 0)}</option>
          <option value="lastPull" disabled={!options?.lastPull}>
            {T.compare.lastPull(options?.lastPull ? when(options.lastPull.date) : null)}
          </option>
          <option value="lastCommit" disabled={(options?.commits.length ?? 0) < 2}>
            {T.compare.lastCommit}
          </option>
          <option value="custom">{T.compare.custom}</option>
        </select>
        <span className="toolbar__spacer" />
        <button type="button" className="btn" onClick={props.onClose}>
          {T.changesView.close}
        </button>
      </div>

      {c.preset === 'custom' && options && (
        <div className="compare__custom">
          <label className="field">
            <span className="field__label">{T.compare.from}</span>
            <select className="input" aria-label={T.compare.fromLabel} value={c.custom.from} onChange={(e) => c.setCustom((x) => ({ ...x, from: e.target.value }))}>
              <option value="">{T.compare.choose}</option>
              {refOptions(false)}
            </select>
          </label>
          <label className="field">
            <span className="field__label">{T.compare.to}</span>
            <select className="input" aria-label={T.compare.toLabel} value={c.custom.to} onChange={(e) => c.setCustom((x) => ({ ...x, to: e.target.value }))}>
              {refOptions(true)}
            </select>
          </label>
        </div>
      )}

      {offerPull && (
        <div className="notice compare__offer" role="alertdialog" aria-label={T.git.pullFirstLabel}>
          <span>{T.changesView.pullFirst}</span>
          <span className="actions">
            <button
              type="button"
              className="btn btn--small btn--primary"
              disabled={props.pulling || props.blocked !== null}
              title={props.blocked ?? undefined}
              onClick={() => {
                c.answerPull()
                props.onPull()
              }}
            >
              {props.pulling ? T.compare.pulling : T.changesView.pullFirstButton}
            </button>
            <button type="button" className="btn btn--small" onClick={c.answerPull}>
              {T.changesView.withoutPull}
            </button>
          </span>
        </div>
      )}

      {c.error && <p className="notice notice--error" role="alert">{c.error}</p>}
      {!c.range && options && <p className="muted compare__empty">{T.compare.nothingYet}</p>}
      {c.loading && <p className="muted compare__empty" role="status">{T.compare.comparing}</p>}

      {data && (
        <>
          {!uncommitted && (
            <p className="compare__range">
              <span className="muted-inline">{T.compare.rangeFrom}</span> {data.from.label} <span className="muted-inline">{T.compare.rangeTo}</span> {data.to.label}
            </p>
          )}
          <div className="compare__chips" role="group" aria-label={T.compare.show}>
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <button key={k} type="button" className={kinds.has(k) ? `chip chip--${k} chip--on` : `chip chip--${k}`} aria-pressed={kinds.has(k)} disabled={counts[k] === 0} onClick={() => toggleKind(k)}>
                {KIND_LABEL[k]} {counts[k]}
              </button>
            ))}
            <span className="chip chip--static">{T.compare.linksChip(linksAdded, linksRemoved)}</span>
            {data.schema && <span className="chip chip--static chip--warn">{T.compare.schemaChanged}</span>}
            <span className="toolbar__spacer" />
            <input className="input compare__filter" type="search" placeholder={T.compare.filter} aria-label={T.compare.filterLabel} value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>

          {data.schema && <p className="notice notice--warn compare__schema">{T.compare.schema(describeSchema(data.schema))}</p>}

          {uncommitted && (git?.changes.length ?? 0) > 0 && (
            <div className="changes-view__bulk" role="group" aria-label={T.changesView.bulk}>
              {confirmMany ? (
                <>
                  <span>{confirmMany === 'all' ? T.changesView.discardAllAsk(git?.changes.length ?? 0) : T.changesView.discardPickedAsk(picked.size)}</span>
                  <button
                    type="button"
                    className="btn btn--small btn--danger"
                    disabled={locked !== null}
                    onClick={() =>
                      void act(async () => {
                        const paths =
                          confirmMany === 'all' ? (git?.changes.map((x) => x.path) ?? []) : [...new Set((data.entries ?? []).filter((e) => picked.has(e.id)).flatMap((e) => e.paths))]
                        await props.onDiscardPaths(paths)
                        setPicked(new Set())
                        setConfirmMany(null)
                      })
                    }
                  >
                    {confirmMany === 'all' ? T.changesView.discardAll : T.changesView.discardPicked(picked.size)}
                  </button>
                  <button type="button" className="btn btn--small" onClick={() => setConfirmMany(null)}>
                    {T.changesPanel.keep}
                  </button>
                </>
              ) : (
                <>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={visible.length > 0 && visible.every((e) => picked.has(e.id))}
                      onChange={(e) => setPicked(e.target.checked ? new Set(visible.map((x) => x.id)) : new Set())}
                    />
                    {T.changesView.pickAll}
                  </label>
                  <button type="button" className="btn btn--small" disabled={picked.size === 0 || locked !== null} title={locked ?? undefined} onClick={() => setConfirmMany('picked')}>
                    {T.changesView.discardPicked(picked.size)}
                  </button>
                  <button type="button" className="btn btn--small" disabled={locked !== null} title={locked ?? undefined} onClick={() => setConfirmMany('all')}>
                    {T.changesView.discardAll}
                  </button>
                </>
              )}
            </div>
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
              <p className="muted compare__empty">{uncommitted ? T.changesPanel.none : T.compare.noChange}</p>
            ) : (
              <ul className="compare__list changes-view__list scroll" aria-label={T.compare.changedItems}>
                {visible.slice(0, shown).map((e) => (
                  <li key={e.id} className={uncommitted ? 'changes-view__item' : undefined}>
                    {uncommitted && (
                      <input
                        type="checkbox"
                        className="changes-view__pick"
                        aria-label={T.changesView.pick(e.id)}
                        checked={picked.has(e.id)}
                        onChange={(ev) =>
                          setPicked((p) => {
                            const n = new Set(p)
                            if (ev.target.checked) n.add(e.id)
                            else n.delete(e.id)
                            return n
                          })
                        }
                      />
                    )}
                    <button
                      type="button"
                      className={e.id === sel?.id ? 'compare__row compare__row--selected' : 'compare__row'}
                      aria-pressed={e.id === sel?.id}
                      onClick={() => {
                        c.select(e.id)
                        setConfirmDiscard(null)
                      }}
                    >
                      <span className={`changes__kind changes__kind--${e.kind === 'modified' ? 'modified' : e.kind === 'moved' ? 'renamed' : e.kind}`} title={KIND_LABEL[e.kind]}>
                        {KIND_LETTER[e.kind]}
                      </span>
                      <span className="compare__number">{numberLabel(e)}</span>
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
                    <button type="button" className="link-btn compare__more" onClick={() => setShown((x) => x + SHOW)}>
                      {T.compare.showMore(visible.length - shown)}
                    </button>
                  </li>
                )}
                {visible.length === 0 && <li className="muted compare__empty">{T.compare.noMatch}</li>}
              </ul>
            )
          ) : (
            <LinkList schema={schema} links={data.links} filter={filter} onOpen={(id) => c.select(id)} />
          )}
          {data.otherFiles.length > 0 && <p className="muted-inline compare__other">{T.compare.otherFiles(data.otherFiles.join(', '))}</p>}

          {tab === 'items' && sel && (
            <div className="changes-view__detail scroll" aria-label={T.compare.detailLabel(sel.id)} role="region">
              <header className="changes-view__detail-head">
                <span className="compare__number">{numberLabel(sel)}</span>
                <span className="tree__id">{sel.id}</span>
                <strong className="compare__detail-title">{sel.title || T.common.noTitle}</strong>
                <span className="muted-inline">
                  {typeName(schema, sel.type)} · {KIND_LABEL[sel.kind].toLowerCase()}
                </span>
                <span className="toolbar__spacer" />
                {uncommitted &&
                  (confirmDiscard === sel.id ? (
                    <span className="actions">
                      <button
                        type="button"
                        className="btn btn--small btn--danger"
                        disabled={locked !== null}
                        onClick={() =>
                          void act(async () => {
                            await props.onDiscard(sel)
                            setConfirmDiscard(null)
                          })
                        }
                      >
                        {sel.kind === 'added' ? T.changesPanel.deleteIt : T.changesPanel.undoChange}
                      </button>
                      <button type="button" className="btn btn--small" onClick={() => setConfirmDiscard(null)}>
                        {T.changesPanel.keep}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--small"
                      disabled={locked !== null}
                      title={locked ?? (sel.kind === 'added' ? T.changesPanel.discardNewTooltip : T.changesPanel.discardTooltip)}
                      onClick={() => setConfirmDiscard(sel.id)}
                    >
                      {T.changesView.discardItem}
                    </button>
                  ))}
                {sel.kind !== 'deleted' && (
                  <button type="button" className="btn btn--small" onClick={() => props.onOpenItem(sel.id)}>
                    {T.compare.openItem}
                  </button>
                )}
              </header>
              {sel.kind === 'modified' && sel.contentChanged && sel.incoming > 0 && <p className="notice notice--warn">{T.compare.suspectWarning(sel.incoming)}</p>}
              <ChangeView
                key={`${data.from.ref}..${data.to.ref}:${sel.id}`}
                schema={schema}
                diff={sel.diff}
                unreadable={sel.unreadable}
                revertLocked={locked}
                {...(uncommitted ? { onRevert: (part: RevertPart) => void act(() => props.onRevert(sel.id, part)) } : {})}
              />
            </div>
          )}
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
    <ul className="compare__list changes-view__list scroll" aria-label={T.compare.changedLinks}>
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

/**
 * The side panel next to the Changes view (O-06): commit tools for uncommitted changes; for other comparisons
 * what is compared and the export.
 */
export function ChangesSide(props: { changes: ChangesState; git: GitState; blocked: string | null; onResult: (r: GitResult) => void }) {
  const { changes: c } = props
  const [exported, setExported] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const exportAs = async (format: 'csv' | 'markdown'): Promise<void> => {
    if (!c.data) return
    try {
      const r = await window.reqman.exportCompare(c.data.from.ref, c.data.to.ref, format)
      if (r.ok) setExported(r.path)
      else if (!r.canceled) setError(r.message)
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  const uncommitted = c.preset === 'uncommitted'
  return (
    <aside className="editor changes scroll" aria-label={uncommitted ? T.changesView.commitLabel : T.changesView.compareLabel}>
      <header className="editor__header">
        <div>
          <div className="editor__id">{uncommitted ? T.changesView.commitTitle : T.changesView.compareTitle}</div>
          <div className="editor__type">{uncommitted ? T.changesPanel.subtitle : T.changesView.compareSubtitle}</div>
        </div>
      </header>
      <div className="editor__body">
        {uncommitted && props.git.available ? (
          <CommitTools state={props.git} blockedReason={props.blocked} onResult={props.onResult} />
        ) : (
          <>
            {c.data && (
              <p className="changes-side__range">
                <span className="field__label">{T.compare.from}</span> {c.data.from.label}
                <br />
                <span className="field__label">{T.compare.to}</span> {c.data.to.label}
              </p>
            )}
            <div className="actions">
              <button type="button" className="btn" disabled={!c.data} onClick={() => void exportAs('csv')} title={T.compare.exportCsvTooltip}>
                {T.compare.exportCsv}
              </button>
              <button type="button" className="btn" disabled={!c.data} onClick={() => void exportAs('markdown')} title={T.compare.exportMdTooltip}>
                {T.compare.exportMd}
              </button>
            </div>
            {exported && (
              <p className="compare__pull" role="status">
                {T.compare.exportedTo(exported)}{' '}
                <button type="button" className="link-btn" onClick={() => void window.reqman.showInFolder(exported)}>
                  {T.exportDialog.showInFolder}
                </button>
              </p>
            )}
            {error && <p className="notice notice--error" role="alert">{error}</p>}
          </>
        )}
      </div>
    </aside>
  )
}
