import { useCallback, useEffect, useRef, useState } from 'react'
import type { CompareEntry, ImportFile, ImportResult, RepoInfo, RevertPart } from '../../../shared/api'
import { T } from '../../../shared/text'
import { errorMessage } from '../lib/hooks'
import { ItemEditor, type EditorTarget } from '../workspace/ItemEditor'
import { FieldsDialog, useColumnPrefs } from '../workspace/FieldsPanel'
import { ChangesSide, ChangesView } from '../workspace/ChangesView'
import { GitBar } from '../workspace/GitPanels'
import { ExportDialog } from '../workspace/ExportDialog'
import { ImportDialog } from '../workspace/ImportDialog'
import { RowMenu } from '../workspace/RowMenu'
import { ItemTable, shownColumnKeys, withWidth, type TreeControls } from '../workspace/ItemTable'
import { ProblemList, problemsOf } from '../workspace/screen/Problems'
import { Toolbar } from '../workspace/screen/Toolbar'
import { useFilters } from '../workspace/screen/useFilters'
import { useChanges } from '../workspace/screen/useChanges'
import { useGit } from '../workspace/screen/useGit'

/**
 * The open repository: the item table (document hierarchy, or a flat list while searching/filtering)
 * and the editor on the right. State is grouped by area: filters (useFilters), Git (useGit), the Changes view
 * (useChanges), editor.
 */
export function WorkspaceScreen({ info, onInfo, importFile }: { info: RepoInfo; onInfo: (i: RepoInfo) => void; importFile?: ImportFile | null }) {
  const schema = info.schema
  const filters = useFilters(schema)
  const { query, filtered } = filters
  const [columnPrefs, setColumnPrefs] = useColumnPrefs(info.root)
  const [editFields, setEditFields] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [expanding, setExpanding] = useState(false)
  const tree = useRef<TreeControls | null>(null)
  const [revealNonce, setRevealNonce] = useState(0)
  const [showChanges, setShowChanges] = useState(false)
  const [exportOpen, setExportOpen] = useState<false | { chosen?: string[] }>(false)
  // items chosen with Ctrl/Shift+click, and the right-click menu (M7)
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set())
  const [rowMenu, setRowMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  // the import wizard; a new project from a file opens it straight away (and commits the import)
  const [importing, setImporting] = useState<{ file: ImportFile | null; newProject: boolean } | null>(importFile ? { file: importFile, newProject: true } : null)
  const [exported, setExported] = useState<{ path: string; count: number } | null>(null)
  const [imported, setImported] = useState<(ImportResult & { ok: true }) | null>(null)
  const [target, setTarget] = useState<EditorTarget | null>(null)
  const [pending, setPending] = useState<EditorTarget | null | undefined>(undefined)
  const [dirty, setDirty] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)
  const [total, setTotal] = useState(info.itemCount)
  const [showProblems, setShowProblems] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  /**
   * After ReqMan changed something: redraw, and re-read only the files that changed (the core watches the
   * folder, so this costs milliseconds even with 10,000 items — review P-01).
   */
  const afterChange = useCallback(async (): Promise<void> => {
    setDataVersion((v) => v + 1)
    onInfo(await window.reqman.refreshRepository())
  }, [onInfo])
  const git = useGit({ dataVersion, dirty, afterChange })
  const changes = useChanges(showChanges, dataVersion)

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

  // Pick up changes made outside ReqMan (Git pull, an editor) when the window gets focus again.
  useEffect(() => {
    const onFocus = (): void =>
      void window.reqman
        .refreshRepository(true)
        .then((i) => {
          onInfo(i)
          setRefreshError(null)
          setDataVersion((v) => v + 1) // also refreshes the Git bar (commits made outside ReqMan)
        })
        .catch((e: unknown) => setRefreshError(errorMessage(e)))
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [onInfo])

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

  const toggleChanges = (): void => {
    if (!showChanges) {
      git.reload()
      changes.reset() // opens on uncommitted changes (O-06)
    }
    setShowChanges((v) => !v)
  }
  const revert = async (id: string, part: RevertPart): Promise<void> => {
    const r = await window.reqman.revertChange(id, part)
    if (!r.ok) changes.setError(r.message)
    await afterChange()
  }
  const discard = async (entry: CompareEntry): Promise<void> => {
    const r = await window.reqman.discardChanges(entry.paths)
    if (!r.ok) changes.setError(r.message)
    git.onPanelResult(r)
  }

  const newItem = async (type: string, parent?: string): Promise<void> => {
    if (!type) return
    const item = await window.reqman.newItem(type, parent)
    request({ kind: 'draft', item })
  }

  const onMove = async (id: string, parent: string | null, before: string | null): Promise<void> => {
    if (dirty && target?.kind === 'item' && target.id === id) {
      setNotice(T.workspace.moveFirst(id))
      return
    }
    const r = await window.reqman.reparentItem(id, parent, before)
    setNotice(r.ok ? null : T.workspace.moveFailed(id, r.message))
    if (r.ok) {
      await afterChange()
      setRevealNonce((n) => n + 1)
      if (!(target?.kind === 'item' && target.id === id)) request({ kind: 'item', id })
    }
  }

  const expandAll = async (): Promise<void> => {
    setExpanding(true)
    try {
      await tree.current?.expandAll()
    } finally {
      setExpanding(false)
    }
  }

  const selectedId = target?.kind === 'item' ? target.id : null
  const problems = problemsOf(info)

  return (
    <div className="workspace">
      <section className="workspace__main" aria-label={T.workspace.items}>
        <GitBar
          state={git.state}
          busy={git.busy}
          blockedReason={git.blocked}
          changesOpen={showChanges}
          onToggleChanges={toggleChanges}
          onRun={(a) => (a === 'push' ? git.requestPush() : void git.run(a))}
          notice={git.notice}
          onDismiss={git.dismiss}
          onOpenItem={select}
          pushOffer={git.pushOffer}
          onPushOffer={git.answerPush}
          onPublish={git.publish}
        />
        {showChanges && git.state?.available && (
          <ChangesView
            schema={schema}
            changes={changes}
            git={git.state}
            blocked={git.blocked}
            pulling={git.busy !== null}
            onPull={() => void git.run('pull')}
            onRevert={revert}
            onDiscard={discard}
            onOpenItem={select}
            onClose={() => setShowChanges(false)}
          />
        )}
        {/* The table stays mounted while the Changes view is open, so its opened levels and scroll position survive. */}
        <div className={showChanges && git.state?.available ? 'is-hidden' : 'workspace__items'}>
          <Toolbar
            schema={schema}
            filters={filters}
            prefs={columnPrefs}
            onPrefs={setColumnPrefs}
            onEditFields={() => setEditFields(true)}
            canExport={info.itemCount > 0}
            onExport={() => setExportOpen({})}
            onImport={() => setImporting({ file: null, newProject: false })}
            expanding={expanding}
            onExpandAll={() => void expandAll()}
            onCollapseAll={() => tree.current?.collapseAll()}
            onNewItem={(type) => void newItem(type)}
          />

          {filtered && <div className="table-mode">{T.workspace.searchMode}</div>}
          <ItemTable
            schema={schema}
            prefs={columnPrefs}
            onResize={(key, width) => setColumnPrefs({ ...columnPrefs, widths: withWidth(columnPrefs.widths, key, width) })}
            chosen={chosen}
            onChoose={(ids, how) =>
              setChosen((prev) => {
                if (how === 'clear') return new Set()
                // the open item counts as chosen when the choosing starts
                const next = new Set(prev.size === 0 && selectedId ? [selectedId] : prev)
                if (how === 'range') for (const id of ids) next.add(id)
                else for (const id of ids) if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }
            onRowMenu={(id, x, y) => setRowMenu({ id, x, y })}
            mode={filtered ? 'flat' : 'tree'}
            query={query}
            dataVersion={dataVersion}
            selectedId={selectedId}
            onSelect={select}
            onSort={filters.onSort}
            onTotal={setTotal}
            onMove={(id, parent, before) => void onMove(id, parent, before)}
            controlsRef={tree}
            revealNonce={revealNonce}
            emptyText={info.itemCount === 0 ? T.workspace.emptyRepo : T.workspace.emptyFilter}
          />
          {exported && (
            <div className="notice table-notice table-notice--ok" role="status">
              {T.exportDialog.done(exported.count, exported.path)}{' '}
              <button type="button" className="link-btn" onClick={() => void window.reqman.showInFolder(exported.path)}>
                {T.exportDialog.showInFolder}
              </button>{' '}
              <button type="button" className="link-btn" onClick={() => setExported(null)}>
                {T.common.dismiss}
              </button>
            </div>
          )}
          {imported && (
            <div className="notice table-notice table-notice--ok" role="status">
              {T.importDialog.done(imported.created, imported.updated, imported.unchanged, imported.skipped, imported.committed)}{' '}
              <button type="button" className="link-btn" onClick={() => setImported(null)}>
                {T.common.dismiss}
              </button>
            </div>
          )}
          {notice && (
            <div className="notice notice--warn table-notice" role="alert">
              {notice}{' '}
              <button type="button" className="link-btn" onClick={() => setNotice(null)}>
                {T.common.dismiss}
              </button>
            </div>
          )}
        </div>

        {showProblems && problems.length > 0 && <ProblemList problems={problems} onOpen={select} onFixed={() => void afterChange()} />}
        <footer className="statusbar">
          <span>{filtered ? T.workspace.of(total, info.itemCount) : T.common.items(info.itemCount)}</span>
          {problems.length > 0 ? (
            <button type="button" className="link-btn statusbar__problems" onClick={() => setShowProblems((s) => !s)}>
              {T.workspace.problemCount(problems.length, showProblems)}
            </button>
          ) : (
            <span className="statusbar__ok">{T.workspace.noProblems}</span>
          )}
          {chosen.size > 0 ? (
            <span className="statusbar__hint">
              {T.rowMenu.chosenStatus(chosen.size)} · {T.rowMenu.chosenHint}{' '}
              <button type="button" className="link-btn" onClick={() => setChosen(new Set())}>
                {T.rowMenu.clearChosen}
              </button>
            </span>
          ) : (
            !filtered && info.itemCount > 1 && <span className="statusbar__hint">{T.workspace.dragHint}</span>
          )}
          {!info.isGitRepository && <span className="statusbar__warn">{T.workspace.notGit}</span>}
          {refreshError && <span className="statusbar__warn">{T.workspace.refreshFailed(refreshError)}</span>}
          <span className="toolbar__spacer" />
          <span className="statusbar__path" title={info.root}>
            {info.root}
          </span>
        </footer>
      </section>

      {showChanges && git.state?.available && <ChangesSide changes={changes} git={git.state} blocked={git.blocked} onResult={git.onPanelResult} />}

      {target && (
        <div className={showChanges && git.state?.available ? 'is-hidden' : 'contents'}>
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

      {rowMenu && (
        <RowMenu
          {...rowMenu}
          chosenCount={chosen.has(rowMenu.id) ? chosen.size : 0}
          onOpen={() => select(rowMenu.id)}
          onExportItem={() => setExportOpen({ chosen: [rowMenu.id] })}
          onExportChosen={() => setExportOpen({ chosen: [...chosen] })}
          onClose={() => setRowMenu(null)}
        />
      )}

      {importing && (
        <ImportDialog
          schema={schema}
          file={importing.file}
          newProject={importing.newProject}
          onClose={() => setImporting(null)}
          onDone={(r) => {
            setImporting(null)
            onInfo(r.info)
            setDataVersion((v) => v + 1)
            setNotice(null)
            setImported(r)
          }}
        />
      )}

      {exportOpen && (
        <ExportDialog
          {...(exportOpen.chosen ? { chosen: exportOpen.chosen } : {})}
          shownColumns={shownColumnKeys(schema, columnPrefs)}
          filtered={filtered}
          filteredCount={total}
          totalCount={info.itemCount}
          query={query}
          onClose={() => setExportOpen(false)}
          onDone={(r) => {
            setExportOpen(false)
            setExported({ path: r.path, count: r.count })
          }}
        />
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
        <div className="guard" role="alertdialog" aria-label={T.workspace.unsaved}>
          <p>{T.workspace.unsavedAsk}</p>
          <div className="actions">
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                setDirty(false)
                setTarget(pending)
                setPending(undefined)
              }}
            >
              {T.workspace.discard}
            </button>
            <button type="button" className="btn" onClick={() => setPending(undefined)}>
              {T.workspace.keepEditing}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
