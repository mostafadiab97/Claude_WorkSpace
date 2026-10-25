import { useCallback, useEffect, useState } from 'react'
import type { RepoInfo } from '../../../shared/api'
import type { ItemQuery, SortKey } from '../../../shared/domain'
import { errorMessage, useDebounced } from '../lib/hooks'
import { ItemEditor, type EditorTarget } from '../workspace/ItemEditor'
import { ItemTable } from '../workspace/ItemTable'
import { ItemTree } from '../workspace/ItemTree'

/** The open repository: hierarchy on the left, filterable table in the middle, editor on the right. */
export function WorkspaceScreen({ info, onInfo }: { info: RepoInfo; onInfo: (i: RepoInfo) => void }) {
  const schema = info.schema
  const [text, setText] = useState('')
  const search = useDebounced(text, 200)
  const [types, setTypes] = useState<string>('')
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({})
  const [sort, setSort] = useState<{ by: SortKey; descending: boolean }>({ by: 'id', descending: false })
  const [target, setTarget] = useState<EditorTarget | null>(null)
  const [pending, setPending] = useState<EditorTarget | null | undefined>(undefined)
  const [dirty, setDirty] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)
  const [total, setTotal] = useState(info.itemCount)
  const [showProblems, setShowProblems] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const query: Omit<ItemQuery, 'limit' | 'offset'> = {
    ...(search.trim() ? { text: search } : {}),
    ...(types ? { types: [types] } : {}),
    fields: Object.fromEntries(Object.entries(fieldFilters).filter(([, v]) => v).map(([k, v]) => [k, [v]])),
    sort
  }
  const filtered = Boolean(search.trim() || types || Object.values(fieldFilters).some(Boolean))

  // Switching items with unsaved changes asks first.
  const request = (next: EditorTarget | null): void => {
    if (dirty) setPending(next)
    else setTarget(next)
  }
  const select = (id: string): void => {
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

  const afterChange = async (): Promise<void> => {
    setDataVersion((v) => v + 1)
    onInfo(await window.reqman.refreshRepository())
  }

  const newItem = async (type: string, parent?: string): Promise<void> => {
    if (!type) return
    const item = await window.reqman.newItem(type, parent)
    request({ kind: 'draft', item })
  }

  const onSort = (key: SortKey): void =>
    setSort((s) => (s.by === key ? { by: key, descending: !s.descending } : { by: key, descending: false }))

  const enumFields = schema.fields.filter((f) => f.type === 'enum' || f.type === 'list')
  const selectedId = target?.kind === 'item' ? target.id : null
  const problems: { key: string; text: string; id?: string }[] = [
    ...info.schemaProblems.map((p) => ({ key: `s-${p.path}`, text: `schema.yaml ${p.path}: ${p.message}` })),
    // File problems carry the file path instead of an ID; only real IDs are clickable.
    ...info.issues.map((i) => ({ key: `i-${i.itemId}-${i.path}-${i.message}`, text: `${i.itemId}: ${i.message}`, ...(i.path === 'file' ? {} : { id: i.itemId }) }))
  ]

  return (
    <div className="workspace">
      <ItemTree schema={schema} dataVersion={dataVersion} selectedId={selectedId} onSelect={select} />

      <section className="workspace__main" aria-label="Items">
        <div className="toolbar">
          <input className="input toolbar__search" type="search" placeholder="Search ID, title, text…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search" />
          <select className="input toolbar__filter" value={types} onChange={(e) => setTypes(e.target.value)} aria-label="Type">
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
          {filtered && (
            <button type="button" className="btn" onClick={() => { setText(''); setTypes(''); setFieldFilters({}) }}>
              Clear filters
            </button>
          )}
          <span className="toolbar__spacer" />
          <select className="select-btn select-btn--primary" value="" onChange={(e) => void newItem(e.target.value)} aria-label="New item">
            <option value="">+ New item…</option>
            {schema.itemTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <ItemTable schema={schema} query={query} dataVersion={dataVersion} selectedId={selectedId} onSelect={select} onSort={onSort} onTotal={setTotal} emptyText={info.itemCount === 0 ? 'No items yet. Use “New item” to add the first one.' : 'No items match the filters.'} />

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
          {!info.isGitRepository && <span className="statusbar__warn">Not a Git repository</span>}
          {refreshError && <span className="statusbar__warn">Refresh failed: {refreshError}</span>}
          <span className="toolbar__spacer" />
          <span className="statusbar__path" title={info.root}>{info.root}</span>
        </footer>
      </section>

      {target && (
        <ItemEditor
          // Same key for a draft and the saved item, so the editor stays in place when a new item is saved.
          key={target.kind === 'item' ? target.id : target.item.id}
          schema={schema}
          target={target}
          onDirtyChange={setDirty}
          onSaved={(id) => {
            setTarget({ kind: 'item', id })
            void afterChange()
          }}
          onDeleted={() => {
            setDirty(false)
            setTarget(null)
            void afterChange()
          }}
          onMoved={() => setDataVersion((v) => v + 1)}
          onNewChild={(type, parent) => void newItem(type, parent)}
          onOpen={select}
          onClose={() => request(null)}
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
