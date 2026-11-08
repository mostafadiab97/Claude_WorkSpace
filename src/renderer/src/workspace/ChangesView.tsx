import { useEffect, useMemo, useRef, useState } from 'react'
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
/** Changes rendered at a time in the continuous list (D-19c). */
const PAGE = 25
/** At most this many changes are drawn at once while scrolling (CR19-08). */
const MAX_CARDS = 150

type Kind = CompareEntry['kind']
const KIND_LABEL: Record<Kind, string> = T.compare.kinds
const KIND_LETTER: Record<Kind, string> = { added: 'A', modified: 'M', moved: 'P', deleted: 'D' }

const when = (iso: string): string => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * The Changes view (the owner's decision O-06), in the wide middle area: one place for uncommitted changes and for
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
  /** Discards these files (several chosen items, or everything) — the owner, 0.11.0. */
  onDiscardPaths: (paths: string[]) => Promise<void>
  onOpenItem: (id: string) => void
  /** Opens the item on its Impact tab (theme 1b, T-06). */
  onOpenImpact?: (id: string) => void
  onClose: () => void
}) {
  const { schema, changes: c, git } = props
  const { options, data } = c
  const [tab, setTab] = useState<'items' | 'links'>('items')
  const [kinds, setKinds] = useState<Set<Kind>>(new Set())
  const [filter, setFilter] = useState('')
  const [showReviewed, setShowReviewed] = useState(false)
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

  const locked = props.blocked ?? (working ? T.changesView.working : null)
  const offerPull = c.preset === 'lastPull' && git?.hasRemote === true && !c.pullAnswered

  // the continuous list shows a window of the changes (10,000 cards at once would freeze the window): more load as the
  // end scrolls into view, earlier ones with a button; picking an item on the left moves the window to it
  const [range, setRange] = useState({ from: 0, to: PAGE })
  const [current, setCurrent] = useState<string | null>(null)
  const scrollTo = useRef<string | null>(null)
  const diffsRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLParagraphElement | null>(null)
  // a new comparison or filter starts at the top; a Discard or ↶ (fewer entries) keeps the place (CR19-09)
  const listKey = `${data?.from.ref ?? ''}..${data?.to.ref ?? ''}|${filter}|${[...kinds].join()}`
  const [shownKey, setShownKey] = useState(listKey)
  if (shownKey !== listKey) {
    setShownKey(listKey)
    setRange({ from: 0, to: PAGE })
    setCurrent(null)
  } else if (range.from > 0 && range.from >= visible.length) {
    setRange({ from: Math.max(0, visible.length - PAGE), to: visible.length })
  }
  // the change at the top of the right side is marked on the left; before any scrolling, the first one (UX-05)
  const shownCurrent = current ?? visible[range.from]?.id ?? null
  const goTo = (id: string): void => {
    const k = visible.findIndex((e) => e.id === id)
    if (k < 0) return
    setCurrent(id)
    c.select(id)
    if (k < range.from || k >= range.to) setRange({ from: k, to: Math.min(visible.length, k + PAGE) })
    scrollTo.current = id
  }
  // after the render that shows the picked card
  useEffect(() => {
    const id = scrollTo.current
    if (!id) return
    const el = diffsRef.current?.querySelector(`[data-id="${CSS.escape(id)}"]`)
    if (el) {
      el.scrollIntoView({ block: 'start' })
      scrollTo.current = null
    }
  })
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver((seen) => {
      if (!seen.some((x) => x.isIntersecting)) return
      // at most MAX_CARDS are drawn: the oldest leave at the top ("Show earlier changes" brings them back) — CR19-08
      setRange((r) => {
        const to = Math.min(visible.length, r.to + PAGE)
        return { from: Math.max(r.from, to - MAX_CARDS), to }
      })
    }, { root: diffsRef.current, rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [range, visible.length, tab])
  // the left list follows the scrolling: the first card at the top is marked there
  useEffect(() => {
    const box = diffsRef.current
    if (!box) return
    const onScroll = (): void => {
      const top = box.getBoundingClientRect().top
      for (const card of box.querySelectorAll<HTMLElement>('.compare__card')) {
        if (card.getBoundingClientRect().bottom > top + 8) {
          setCurrent(card.dataset['id'] ?? null)
          return
        }
      }
    }
    box.addEventListener('scroll', onScroll, { passive: true })
    return () => box.removeEventListener('scroll', onScroll)
  }, [range, tab])

  const [exported, setExported] = useState<string | null>(null)
  const exportAs = async (format: 'csv' | 'markdown'): Promise<void> => {
    if (!data) return
    try {
      const r = await window.reqochet.exportCompare(data.from.ref, data.to.ref, format)
      if (r.ok) setExported(r.path)
      else if (!r.canceled) c.setError(r.message)
    } catch (e) {
      c.setError(errorMessage(e))
    }
  }

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
          <option value="branch">{T.compare.branch}</option>
        </select>
        <span className="toolbar__spacer" />
        {!uncommitted && data && (
          <>
            <button type="button" className="btn" onClick={() => void exportAs('csv')} title={T.compare.exportCsvTooltip}>
              {T.compare.exportCsv}
            </button>
            <button type="button" className="btn" onClick={() => void exportAs('markdown')} title={T.compare.exportMdTooltip}>
              {T.compare.exportMd}
            </button>
          </>
        )}
        <button type="button" className="btn" onClick={props.onClose}>
          {T.changesView.close}
        </button>
      </div>
      {exported && (
        <p className="compare__pull" role="status">
          {T.compare.exportedTo(exported)}{' '}
          <button type="button" className="link-btn" onClick={() => void window.reqochet.showInFolder(exported)}>
            {T.exportDialog.showInFolder}
          </button>
        </p>
      )}

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

      {c.preset === 'branch' && options && (
        <div className="compare__custom">
          <label className="field">
            <span className="field__label">{T.compare.branchLabel}</span>
            <select className="input" aria-label={T.compare.branchLabel} value={c.branch?.name ?? ''} onChange={(e) => void c.chooseBranch(e.target.value)}>
              <option value="">{T.compare.choose}</option>
              {options.refs
                .filter((r) => r.kind !== 'tag' && !(r.kind === 'branch' && r.name === git?.branch))
                .map((r) => (
                  <option key={`${r.kind}-${r.name}`} value={r.name}>
                    {T.compare.refKinds[r.kind]} {r.name}
                  </option>
                ))}
            </select>
          </label>
          {c.branch && <p className="muted-inline">{T.compare.branchRange(c.branch.name)}</p>}
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
            {/* UX-17: only the kinds that occur (no "Added 0") */}
            {(Object.keys(KIND_LABEL) as Kind[]).filter((k) => counts[k] > 0).map((k) => (
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
                  {picked.size > 0 && (
                    <button type="button" className="btn btn--small btn--danger-outline" disabled={locked !== null} title={locked ?? undefined} onClick={() => setConfirmMany('picked')}>
                      {T.changesView.discardPicked(picked.size)}
                    </button>
                  )}
                  <span className="toolbar__spacer" />
                  <button type="button" className="btn btn--small btn--danger-outline" disabled={locked !== null} title={locked ?? undefined} onClick={() => setConfirmMany('all')}>
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
            data.entries.length === 0 && data.reviewedOnly.length === 0 ? (
              <p className="muted compare__empty">{uncommitted ? T.changesPanel.none : T.compare.noChange}</p>
            ) : (
              // D-19c (the owner, 8 Nov 2026): the changed items on the left like the files of a GitHub pull request,
              // every change one after another on the right
              <div className="compare__body">
                <ul className="compare__list compare__files scroll" aria-label={T.compare.changedItems}>
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
                        className={e.id === shownCurrent ? 'compare__file compare__row--selected' : 'compare__file'}
                        aria-current={e.id === shownCurrent ? 'true' : undefined}
                        title={e.summary}
                        onClick={() => goTo(e.id)}
                      >
                        <span className={`changes__kind changes__kind--${e.kind === 'modified' ? 'modified' : e.kind === 'moved' ? 'renamed' : e.kind}`} title={KIND_LABEL[e.kind]}>
                          {KIND_LETTER[e.kind]}
                        </span>
                        <span className="compare__number">{numberLabel(e)}</span>
                        <span className="compare__file-text">
                          <span className="compare__name" dir="auto">
                            {e.title || T.common.noTitle}
                          </span>
                          <span className="compare__file-id">{e.id}</span>
                        </span>
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
                  {visible.length === 0 && data.reviewedOnly.length === 0 && <li className="muted compare__empty">{T.compare.noMatch}</li>}
                  {/* items whose file changed only by a link review: one row in the list, like the others (owner, 0.15.1 step 3) */}
                  {data.reviewedOnly.length > 0 && (
                    <li className="compare__reviewed">
                      <button type="button" className="compare__file compare__row--reviewed" aria-expanded={showReviewed} onClick={() => setShowReviewed((v) => !v)}>
                        <span className="changes__kind changes__kind--reviewed" title={T.compare.reviewedTooltip}>
                          L
                        </span>
                        <span className="compare__name">
                          {showReviewed ? '▾' : '▸'} {T.compare.reviewedOnly(data.reviewedOnly.length)}
                        </span>
                      </button>
                      {showReviewed && (
                        <span className="compare__reviewed-ids">
                          <span className="muted-inline">{T.compare.reviewedWhy}</span>
                          {data.reviewedOnly.slice(0, 500).map((id) => (
                            <button key={id} type="button" className="link-btn tree__id" title={T.compare.openTooltip} onClick={() => props.onOpenItem(id)}>
                              {id}
                            </button>
                          ))}
                          {data.reviewedOnly.length > 500 && T.common.ellipsis}
                        </span>
                      )}
                    </li>
                  )}
                </ul>

                <div className="compare__diffs scroll" ref={diffsRef} role="region" aria-label={T.compare.allChanges}>
                  {range.from > 0 && (
                    <button type="button" className="btn btn--small compare__earlier" onClick={() => setRange((r) => ({ from: Math.max(0, r.from - PAGE), to: r.to }))}>
                      {T.compare.showEarlier(range.from)}
                    </button>
                  )}
                  {visible.slice(range.from, range.to).map((e) => (
                    <section key={e.id} className="compare__card" data-id={e.id} aria-label={T.compare.detailLabel(e.id)}>
                      <header className="changes-view__detail-head compare__card-head">
                        <span className={`changes__kind changes__kind--${e.kind === 'modified' ? 'modified' : e.kind === 'moved' ? 'renamed' : e.kind}`} title={KIND_LABEL[e.kind]}>
                          {KIND_LETTER[e.kind]}
                        </span>
                        <span className="compare__number">{numberLabel(e)}</span>
                        <span className="tree__id">{e.id}</span>
                        <strong className="compare__detail-title" dir="auto">
                          {e.title || T.common.noTitle}
                        </strong>
                        <span className="muted-inline">
                          {typeName(schema, e.type)} · {e.summary}
                        </span>
                        <span className="toolbar__spacer" />
                        {uncommitted &&
                          (confirmDiscard === e.id ? (
                            <span className="actions">
                              <button
                                type="button"
                                className="btn btn--small btn--danger"
                                disabled={locked !== null}
                                onClick={() =>
                                  void act(async () => {
                                    await props.onDiscard(e)
                                    setConfirmDiscard(null)
                                  })
                                }
                              >
                                {e.kind === 'added' ? T.changesPanel.deleteIt : T.changesPanel.undoChange}
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
                              title={locked ?? (e.kind === 'added' ? T.changesPanel.discardNewTooltip : T.changesPanel.discardTooltip)}
                              onClick={() => setConfirmDiscard(e.id)}
                            >
                              {T.changesView.discardItem}
                            </button>
                          ))}
                        {e.kind !== 'deleted' && (
                          <button type="button" className="btn btn--small" onClick={() => props.onOpenItem(e.id)}>
                            {T.compare.openItem}
                          </button>
                        )}
                        {e.kind !== 'deleted' && props.onOpenImpact && (
                          <button type="button" className="btn btn--small" title={T.trace.impactHint} onClick={() => props.onOpenImpact?.(e.id)}>
                            {T.trace.impactTab}
                          </button>
                        )}
                      </header>
                      {e.kind === 'modified' && e.contentChanged && e.incoming > 0 && <p className="notice notice--warn">{T.compare.suspectWarning(e.incoming)}</p>}
                      <ChangeView
                        key={`${data.from.ref}..${data.to.ref}:${e.id}`}
                        schema={schema}
                        diff={e.diff}
                        unreadable={e.unreadable}
                        revertLocked={locked}
                        {...(uncommitted ? { onRevert: (part: RevertPart) => void act(() => props.onRevert(e.id, part)) } : {})}
                      />
                    </section>
                  ))}
                  {range.to < visible.length && (
                    <p className="muted-inline compare__sentinel" ref={sentinelRef}>
                      {T.compare.loadingMore}
                    </p>
                  )}
                </div>
              </div>
            )
          ) : (
            <LinkList schema={schema} links={data.links} filter={filter} onOpen={(id) => {
              setTab('items')
              goTo(id)
            }} />
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
 * The commit panel next to the Changes view when it shows uncommitted changes (O-06). Comparing other versions has
 * no side panel since 0.19.0 (D-19c): what is compared and the export sit at the top of the Changes view.
 */
export function ChangesSide(props: { git: GitState; blocked: string | null; onResult: (r: GitResult) => void; onPush: () => void }) {
  return (
    <aside className="editor changes scroll" aria-label={T.changesView.commitLabel}>
      <header className="editor__header">
        <div>
          <h2 className="editor__heading">{T.changesView.commitTitle}</h2>
          <div className="editor__type">{T.changesPanel.subtitle}</div>
        </div>
      </header>
      <div className="editor__body">
        <CommitTools state={props.git} blockedReason={props.blocked} onResult={props.onResult} onPush={props.onPush} />
      </div>
    </aside>
  )
}
