import { useCallback, useEffect, useRef, useState } from 'react'
import type { GitResult, GitState, RepoInfo } from '../../../shared/api'
import type { ItemQuery, SortKey } from '../../../shared/domain'
import { errorMessage, useDebounced } from '../lib/hooks'
import { ItemEditor, type EditorTarget } from '../workspace/ItemEditor'
import { ColumnsMenu, FieldsDialog, useColumnPrefs } from '../workspace/FieldsPanel'
import { ChangesPanel, GitBar, type GitNotice } from '../workspace/GitPanels'
import { ItemTable, type TreeControls } from '../workspace/ItemTable'

/**
 * The open repository: the item table (document hierarchy, or a flat list while searching/filtering)
 * and the editor on the right.
 */
export function WorkspaceScreen({ info, onInfo }: { info: RepoInfo; onInfo: (i: RepoInfo) => void }) {
  const schema = info.schema
  const [text, setText] = useState('')
  const search = useDebounced(text, 200)
  const [types, setTypes] = useState<string>('')
  const [linkFilter, setLinkFilter] = useState<'' | 'suspect' | 'none'>('')
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({})
  // 'order' = document order (the hierarchy as arranged); column headers sort by that column instead.
  const [sort, setSort] = useState<{ by: SortKey; descending: boolean }>({ by: 'order', descending: false })
  const [columnPrefs, setColumnPrefs] = useColumnPrefs(info.root)
  const [editFields, setEditFields] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const tree = useRef<TreeControls | null>(null)
  const [revealNonce, setRevealNonce] = useState(0)
  const [gitState, setGitState] = useState<GitState | null>(null)
  const [gitBusy, setGitBusy] = useState<string | null>(null)
  const [gitNotice, setGitNotice] = useState<GitNotice | null>(null)
  const [showChanges, setShowChanges] = useState(false)
  const [target, setTarget] = useState<EditorTarget | null>(null)
  const [pending, setPending] = useState<EditorTarget | null | undefined>(undefined)
  const [dirty, setDirty] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)
  const [total, setTotal] = useState(info.itemCount)
  const [showProblems, setShowProblems] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const filtered = Boolean(search.trim() || types || linkFilter || Object.entries(fieldFilters).some(([k, v]) => v && schema.fields.some((f) => f.id === k)))
  const query: Omit<ItemQuery, 'limit' | 'offset'> = {
    ...(search.trim() ? { text: search } : {}),
    ...(types ? { types: [types] } : {}),
    ...(linkFilter ? { links: linkFilter } : {}),
    fields: Object.fromEntries(Object.entries(fieldFilters).filter(([k, v]) => v && schema.fields.some((f) => f.id === k)).map(([k, v]) => [k, [v]])),
    // a search without a chosen column sorts by best match
    sort: search.trim() && sort.by === 'order' ? { by: 'relevance' } : sort
  }

  // Switching items with unsaved changes asks first.
  // Opening an item (or a new one) shows the editor again in place of the Changes panel.
  const request = (next: EditorTarget | null): void => {
    if (next) setShowChanges(false)
    if (dirty) setPending(next)
    else setTarget(next)
  }
  const select = (id: string): void => {
    setShowChanges(false)
    if (target?.kind === 'item' && target.id === id) return
    request({ kind: 'item', id })
  }

  const refresh = useCallback(async () => {
    try {
      onInfo(await window.reqman.refreshRepository())
      setRefreshError(null)
      setDataVersion((v) => v + 1)
    } catch (e) {
      setRefreshError(errorMessage(e))
    }
  }, [onInfo])

  // Pick up changes made outside ReqMan (Git pull, editor) when the window gets focus again.
  useEffect(() => {
    const onFocus = (): void => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  // Warn before the window closes with unsaved changes.
  useEffect(() => {
    if (!dirty) return
    const onUnload = (e: BeforeUnloadEvent): void => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [dirty])

  // Git status follows every change of the data (saves, moves, links, refresh on window focus).
  useEffect(() => {
    let live = true
    const t = window.setTimeout(() => {
      void window.reqman
        .getGitState()
        .then((st) => live && setGitState(st))
        .catch(() => {})
    }, 250)
    return () => {
      live = false
      window.clearTimeout(t)
    }
  }, [dataVersion])

  const gitBlocked = dirty ? 'Save or discard your edit first.' : null
  const runGit = async (action: 'pull' | 'push'): Promise<void> => {
    setGitBusy(action === 'pull' ? 'Pulling' : 'Pushing')
    setGitNotice(null)
    try {
      const r = await window.reqman[action]()
      setGitState(r.state)
      setGitNotice({ ok: r.ok, message: r.message, ...(!r.ok && r.items ? { items: r.items } : {}) })
      if (action === 'pull' && r.ok) await afterChange()
    } catch (e) {
      setGitNotice({ ok: false, message: errorMessage(e) })
    } finally {
      setGitBusy(null)
    }
  }
  const onPanelResult = (r: GitResult): void => {
    setGitState(r.state)
    if (r.ok) {
      setGitNotice({ ok: true, message: r.message })
      void afterChange()
    }
  }
  const openFromGit = (id: string): void => select(id)

  const afterChange = async (): Promise<void> => {
    setDataVersion((v) => v + 1)
    onInfo(await window.reqman.refreshRepository())
  }

  const newItem = async (type: string, parent?: string): Promise<void> => {
    if (!type) return
    const item = await window.reqman.newItem(type, parent)
    request({ kind: 'draft', item })
  }

  // Header clicks: ascending → descending → back to document order.
  const onSort = (key: SortKey): void =>
    setSort((s) => (s.by !== key ? { by: key, descending: false } : !s.descending ? { by: key, descending: true } : { by: 'order', descending: false }))

  const onMove = async (id: string, parent: string | null, before: string | null): Promise<void> => {
    if (dirty && target?.kind === 'item' && target.id === id) {
      setNotice(`Save or discard your changes to ${id} before moving it.`)
      return
    }
    const r = await window.reqman.reparentItem(id, parent, before)
    setNotice(r.ok ? null : `Could not move ${id}: ${r.message}`)
    if (r.ok) {
      await afterChange()
      setRevealNonce((n) => n + 1)
      if (!(target?.kind === 'item' && target.id === id)) request({ kind: 'item', id })
    }
  }

  const expandAll = async (): Promise<void> => {
    setBusy(true)
    try {
      await tree.current?.expandAll()
    } finally {
      setBusy(false)
    }
  }

  const enumFields = schema.fields.filter((f) => f.type === 'enum' || f.type === 'list')
  const selectedId = target?.kind === 'item' ? target.id : null
  const problems: { key: string; text: string; id?: string }[] = [
    ...info.schemaProblems.map((p) => ({ key: `s-${p.path}`, text: `schema.yaml ${p.path}: ${p.message}` })),
    // File problems carry the file path instead of an ID; only real IDs are clickable.
    ...info.issues.map((i) => ({ key: `i-${i.itemId}-${i.path}-${i.message}`, text: `${i.itemId}: ${i.message}`, ...(i.path === 'file' ? {} : { id: i.itemId }) }))
  ]

  return (
    <div className="workspace">
      <section className="workspace__main" aria-label="Items">
        <GitBar
          state={gitState}
          busy={gitBusy}
          blockedReason={gitBlocked}
          changesOpen={showChanges}
          onToggleChanges={() => {
            if (!showChanges) void window.reqman.getGitState().then(setGitState)
            setShowChanges((v) => !v)
          }}
          onRun={(a) => void runGit(a)}
          notice={gitNotice}
          onDismiss={() => setGitNotice(null)}
          onOpenItem={openFromGit}
        />
        <div className="toolbar">
          <input className="input toolbar__search" type="search" placeholder="Search ID, title, text…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search" />
          <select className="input toolbar__filter" value={types} onChange={(e) => setTypes(e.target.value)} aria-label="Type filter">
            <option value="">All types</option>
            {schema.itemTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {enumFields.map((f) => (
            <select
              key={f.id}
              className="input toolbar__filter"
              value={fieldFilters[f.id] ?? ''}
              aria-label={f.name}
              onChange={(e) => setFieldFilters((ff) => ({ ...ff, [f.id]: e.target.value }))}
              disabled={f.type === 'list' && !f.options}
              hidden={f.type === 'list' && !f.options}
            >
              <option value="">{f.name}: any</option>
              {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
          <select className="input toolbar__filter" value={linkFilter} onChange={(e) => setLinkFilter(e.target.value as '' | 'suspect' | 'none')} aria-label="Links filter">
            <option value="">Links: any</option>
            <option value="suspect">With suspect links</option>
            <option value="none">Without any links</option>
          </select>
          {filtered && (
            <button type="button" className="btn" onClick={() => { setText(''); setTypes(''); setLinkFilter(''); setFieldFilters({}) }}>
              Clear filters
            </button>
          )}
          <ColumnsMenu schema={schema} prefs={columnPrefs} onChange={setColumnPrefs} onEditFields={() => setEditFields(true)} />
          <span className="toolbar__spacer" />
          {!filtered && (
            <>
              <button type="button" className="btn" disabled={busy} onClick={() => void expandAll()} title="Open every level of the hierarchy">
                {busy ? 'Expanding…' : 'Expand all'}
              </button>
              <button type="button" className="btn" onClick={() => tree.current?.collapseAll()} title="Show only the top-level items">
                Collapse all
              </button>
            </>
          )}
          <select className="select-btn select-btn--primary" value="" onChange={(e) => void newItem(e.target.value)} aria-label="New item">
            <option value="">+ New item…</option>
            {schema.itemTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {filtered && <div className="table-mode">Search results — the hierarchy is shown again when the search and filters are cleared.</div>}
        <ItemTable
          schema={schema}
          prefs={columnPrefs}
          mode={filtered ? 'flat' : 'tree'}
          query={query}
          dataVersion={dataVersion}
          selectedId={selectedId}
          onSelect={select}
          onSort={onSort}
          onTotal={setTotal}
          onMove={(id, parent, before) => void onMove(id, parent, before)}
          controlsRef={tree}
          revealNonce={revealNonce}
          emptyText={info.itemCount === 0 ? 'No items yet. Use “New item” to add the first one.' : 'No items match the filters.'}
        />
        {notice && (
          <div className="notice notice--warn table-notice" role="alert">
            {notice}{' '}
            <button type="button" className="link-btn" onClick={() => setNotice(null)}>Dismiss</button>
          </div>
        )}

        {showProblems && problems.length > 0 && (
          <ul className="problems scroll" aria-label="Problems">
            {problems.map((p) => (
              <li key={p.key}>
                {p.id ? (
                  <button type="button" className="link-btn" onClick={() => p.id && select(p.id)}>{p.text}</button>
                ) : (
                  p.text
                )}
              </li>
            ))}
          </ul>
        )}
        <footer className="statusbar">
          <span>
            {filtered
              ? `${total.toLocaleString('en')} of ${info.itemCount.toLocaleString('en')} items`
              : `${info.itemCount.toLocaleString('en')} item${info.itemCount === 1 ? '' : 's'}`}
          </span>
          {problems.length > 0 ? (
            <button type="button" className="link-btn statusbar__problems" onClick={() => setShowProblems((s) => !s)}>
              {problems.length} problem{problems.length === 1 ? '' : 's'} {showProblems ? '▾' : '▸'}
            </button>
          ) : (
            <span className="statusbar__ok">No problems</span>
          )}
          {!filtered && info.itemCount > 1 && <span className="statusbar__hint">Drag a row onto another row to move it there, with everything below it</span>}
          {!info.isGitRepository && <span className="statusbar__warn">Not a Git repository</span>}
          {refreshError && <span className="statusbar__warn">Refresh failed: {refreshError}</span>}
          <span className="toolbar__spacer" />
          <span className="statusbar__path" title={info.root}>{info.root}</span>
        </footer>
      </section>

      {showChanges && gitState?.available && (
        <ChangesPanel state={gitState} blockedReason={gitBlocked} onResult={onPanelResult} onOpenItem={openFromGit} onClose={() => setShowChanges(false)} />
      )}

      {target && (
        <div className={showChanges && gitState?.available ? 'is-hidden' : 'contents'}>
        <ItemEditor
          // Same key for a draft and the saved item, so the editor stays in place when a new item is saved.
          key={target.kind === 'item' ? target.id : target.item.id}
          schema={schema}
          target={target}
          onDirtyChange={setDirty}
          onSaved={(id) => {
            setTarget({ kind: 'item', id })
            void afterChange().then(() => setRevealNonce((n) => n + 1))
          }}
          onDeleted={() => {
            setDirty(false)
            setTarget(null)
            void afterChange()
          }}
          onMoved={() => setDataVersion((v) => v + 1)}
          reloadToken={dataVersion}
          onLinksChanged={() => void afterChange()}
          onNewChild={(type, parent) => void newItem(type, parent)}
          onOpen={select}
          onClose={() => request(null)}
        />
        </div>
      )}

      {editFields && (
        <FieldsDialog
          info={info}
          onClose={() => setEditFields(false)}
          onSaved={(i) => {
            setEditFields(false)
            onInfo(i)
            setDataVersion((v) => v + 1)
          }}
        />
      )}

      {pending !== undefined && (
        <div className="guard" role="alertdialog" aria-label="Unsaved changes">
          <p>You have unsaved changes. Discard them?</p>
          <div className="actions">
            <button type="button" className="btn btn--danger" onClick={() => { setDirty(false); setTarget(pending); setPending(undefined) }}>
              Discard changes
            </button>
            <button type="button" className="btn" onClick={() => setPending(undefined)}>
              Keep editing
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
