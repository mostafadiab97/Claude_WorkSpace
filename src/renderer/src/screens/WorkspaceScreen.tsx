import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from 'react'
import { onToolbarKeyDown, rovingToolbar } from '../lib/keys'
import type { CompareEntry, ImportFile, ImportResult, RepoInfo, RevertPart } from '../../../shared/api'
import { T } from '../../../shared/text'
import { errorMessage } from '../lib/hooks'
import { ItemEditor, type EditorTarget } from '../workspace/ItemEditor'
import { FieldsDialog, useColumnPrefs } from '../workspace/FieldsPanel'
import { TypesDialog } from '../workspace/TypesPanel'
import { HistoryDialog } from '../workspace/HistoryDialog'
import { ChangesSide, ChangesView } from '../workspace/ChangesView'
import { TraceabilityView } from '../workspace/TraceabilityView'
import { GitBar } from '../workspace/GitPanels'
import { MergeDialog } from '../workspace/MergeDialog'
import { ExportDialog } from '../workspace/ExportDialog'
import { useEditorWidth } from '../workspace/screen/EditorSplitter'
import { setTeamFeatures } from '../lib/features'
import { ImportDialog } from '../workspace/ImportDialog'
import { RowMenu } from '../workspace/RowMenu'
import { columnOrder, ItemTable, moveColumn, shownColumnKeys, withWidth, type TreeControls } from '../workspace/ItemTable'
import { ProblemList, problemsOf } from '../workspace/screen/Problems'
import { ALL_DOCUMENTS, DocumentBar } from '../workspace/screen/DocumentBar'
import { Toolbar } from '../workspace/screen/Toolbar'
import { useFilters } from '../workspace/screen/useFilters'
import { middleEllipsis, showDragTip } from '../lib/statusbar'
import { workspaceHasKeyboard } from '../lib/shortcuts'
import { useChanges } from '../workspace/screen/useChanges'
import { WORKING } from '../workspace/compareRange'
import { useGit } from '../workspace/screen/useGit'
import { Chevron, Icon } from '../components/icons'

/**
 * The open repository: the item table (document hierarchy, or a flat list while searching/filtering)
 * and the editor on the right. State is grouped by area: filters (useFilters), Git (useGit), the Changes view
 * (useChanges), editor.
 */
export function WorkspaceScreen({
  info,
  onInfo,
  importFile,
  gitSlot = null,
  onShortcuts,
  onLeaveGuard,
  onGitBusy,
  onQuickStart
}: {
  info: RepoInfo
  onInfo: (i: RepoInfo) => void
  importFile?: ImportFile | null
  gitSlot?: HTMLElement | null
  /** Ctrl+/ — the keyboard shortcuts page of the user guide. */
  onShortcuts?: () => void
  /** The app's way to leave this screen (the ✕ beside the project name) asks about unsaved edits first (CR2-01). */
  onLeaveGuard?: (guard: ((leave: () => void) => void) | null) => void
  /** Whether a Git action is running (the ✕ is disabled meanwhile — CR2-01). */
  onGitBusy?: (busy: boolean) => void
  /** Opens the quick start page of the guide (the first-run card — UX-W01). */
  onQuickStart?: () => void
}) {
  const schema = info.schema
  const filters = useFilters(schema)
  const { query: filterQuery, filtered } = filters
  // the document shown (S-10): one document at a time or all; remembered per repository on this PC
  const [document, setDocumentState] = useState<string>(() => {
    const names = info.documents.map((d) => d.name)
    const saved = ((): string | null => {
      try {
        return localStorage.getItem(`rq.document.${info.root}`)
      } catch {
        return null
      }
    })()
    if (saved !== null && (saved === ALL_DOCUMENTS ? names.length > 1 : names.includes(saved))) return saved
    return names.length === 1 ? (names[0] as string) : ALL_DOCUMENTS
  })
  const setDocument = (d: string): void => {
    setDocumentState(d)
    setDataVersion((v) => v + 1) // the tree reloads its levels for the other document
    try {
      localStorage.setItem(`rq.document.${info.root}`, d)
    } catch {
      // a private window: the choice lasts for this session only
    }
  }
  // a document that disappeared (renamed, pulled away) falls back to the first one or all
  const names = info.documents.map((d) => d.name)
  if (document !== ALL_DOCUMENTS && !names.includes(document)) setDocumentState(names.length === 1 ? (names[0] as string) : ALL_DOCUMENTS)
  const query = useMemo(() => (document === ALL_DOCUMENTS ? filterQuery : { ...filterQuery, document }), [filterQuery, document])
  const [columnPrefs, setColumnPrefs] = useColumnPrefs(info.root)
  const [editFields, setEditFields] = useState(false)
  const [editTypes, setEditTypes] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [folderLater, setFolderLater] = useState(false)
  const [folderDone, setFolderDone] = useState(false)
  const [renamingFolder, setRenamingFolder] = useState(false)
  const renameFolder = async (): Promise<void> => {
    setRenamingFolder(true)
    try {
      const r = await window.reqochet.renameProjectFolder()
      if (r.ok) {
        onInfo(r.info)
        setDataVersion((v) => v + 1) // the Git bar now shows one commit to push
        setFolderDone(true)
      } else setNotice(r.message)
    } catch (e) {
      setNotice(errorMessage(e))
    } finally {
      setRenamingFolder(false)
    }
  }
  const [expanding, setExpanding] = useState(false)
  const tree = useRef<TreeControls | null>(null)
  const [revealNonce, setRevealNonce] = useState(0)
  const [showChanges, setShowChanges] = useState(false)
  // theme 1b (T-01): the Traceability view takes the table's place like Changes
  const [showTrace, setShowTrace] = useState(false)
  // the table came from Traceability → Show the gaps: offer the way back (owner, 10 Nov 2026 — 0.20.0 test 3)
  const [fromTrace, setFromTrace] = useState(false)
  const [typesTab, setTypesTab] = useState<'items' | 'links' | 'rules'>('items')
  // the team's feature switches from schema.yaml (P-40a); cleared when the repository closes
  useEffect(() => {
    setTeamFeatures(info.schema.features)
    return () => setTeamFeatures(undefined)
  }, [info.schema.features])
  const [exportOpen, setExportOpen] = useState<false | { chosen?: string[] }>(false)
  // items chosen with Ctrl/Shift+click, and the right-click menu (M7)
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set())
  const [rowMenu, setRowMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  // the import wizard; a new project from a file opens it straight away (and commits the import)
  const [importing, setImporting] = useState<{ file: ImportFile | null; newProject: boolean } | null>(importFile ? { file: importFile, newProject: true } : null)
  const [exported, setExported] = useState<{ path: string; count: number } | null>(null)
  // the "Exported …" note closes by itself like the other success notes (UI B-10)
  useEffect(() => {
    if (!exported) return
    const t = setTimeout(() => setExported(null), 12_000)
    return () => clearTimeout(t)
  }, [exported])
  const [imported, setImported] = useState<(ImportResult & { ok: true }) | null>(null)
  const [target, setTarget] = useState<EditorTarget | null>(null)
  // An action waiting for "Save and continue / Discard / Keep editing" (switching item, closing, pushing)
  const [pending, setPending] = useState<{ then: () => void } | undefined>(undefined)
  const [dirty, setDirty] = useState(false)
  const [formReset, setFormReset] = useState(0)
  const [newWhere, setNewWhere] = useState<'after' | 'inside' | 'end'>('after')
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
    onInfo(await window.reqochet.refreshRepository())
  }, [onInfo])
  // History and baselines (1a part 2): the dialog, and an older version opened read-only
  const [historyOpen, setHistoryOpen] = useState(false)
  // D-19b: an old version shown in the table (info.version), and the message while it opens
  const viewing = info.version
  const [versionBusy, setVersionBusy] = useState(false)
  const [versionError, setVersionError] = useState<string | null>(null)
  const git = useGit({ dataVersion, dirty, afterChange })
  const changes = useChanges(showChanges, dataVersion)

  // Switching items with unsaved changes asks first.
  // Opening an item (or a new one) shows the editor again in place of the Changes panel.
  const guarded = (then: () => void): void => (dirty ? setPending({ then }) : then())
  const request = (next: EditorTarget | null): void => {
    if (next) setShowChanges(false)
    guarded(() => setTarget(next))
  }
  // the app's ✕ and the Git state it needs (CR2-01)
  const dirtyNow = useRef(dirty)
  useEffect(() => {
    dirtyNow.current = dirty
  }, [dirty])
  useEffect(() => {
    onLeaveGuard?.((then) => (dirtyNow.current ? setPending({ then }) : then()))
    return () => onLeaveGuard?.(null)
  }, [onLeaveGuard])
  useEffect(() => onGitBusy?.(git.busy !== null), [git.busy, onGitBusy])
  // Push with unsaved edits asks first (the owner, 5 Nov 2026), then goes on with the normal pull-first question
  const push = (): void => guarded(() => git.requestPush())
  const select = (id: string): void => {
    setShowChanges(false)
    if (target?.kind === 'item' && target.id === id) return
    request({ kind: 'item', id })
  }

  // Pick up changes made outside reqochet (Git pull, an editor) when the window gets focus again. Only when files
  // really changed does everything reload; otherwise just the Git bar (commits made outside) — CR2-04
  const reloadGit = useRef(git.reload)
  useEffect(() => {
    reloadGit.current = git.reload
  })
  useEffect(() => {
    const onFocus = (): void =>
      void window.reqochet
        .refreshRepository(true)
        .then((i) => {
          onInfo(i)
          setRefreshError(null)
          if (i.lastSync.changedFiles > 0 || i.lastSync.full) setDataVersion((v) => v + 1)
          else reloadGit.current()
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

  // Keyboard shortcuts (UX-25; listed in the user guide, section 18). Ctrl+S and Alt+↑/↓ live in the editor.
  const searchRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const newRef = useRef<HTMLButtonElement>(null)
  const filtersRef = useRef<HTMLButtonElement>(null)
  const newDocRef = useRef<(() => void) | null>(null)
  const expandRef = useRef<() => void>(() => {})
  const collapseRef = useRef<() => void>(() => {})
  const toggleRef = useRef<() => void>(() => {})
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || !workspaceHasKeyboard(rootRef.current)) return
      const k = e.key.toLowerCase()
      if (k === 'f' && !e.shiftKey) {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      } else if (k === 'n' && !e.shiftKey) {
        // opens the New item panel (0.23.0: type and place, then the editor)
        e.preventDefault()
        newRef.current?.click()
      } else if (k === 'n' && e.shiftKey && newDocRef.current) {
        e.preventDefault()
        newDocRef.current()
      } else if (k === 'f' && e.shiftKey) {
        e.preventDefault()
        filtersRef.current?.click()
      } else if (e.key === 'ArrowDown' && e.shiftKey) {
        e.preventDefault()
        expandRef.current()
      } else if (e.key === 'ArrowUp' && e.shiftKey) {
        e.preventDefault()
        collapseRef.current()
      } else if (k === 'c' && e.shiftKey) {
        e.preventDefault()
        toggleRef.current()
      } else if (e.key === '/' && onShortcuts) {
        e.preventDefault()
        onShortcuts()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onShortcuts])

  const toggleChanges = (): void => {
    setShowTrace(false)
    if (!showChanges) {
      git.reload()
      changes.reset() // opens on uncommitted changes (O-06)
    }
    setShowChanges((v) => !v)
  }
  useEffect(() => {
    toggleRef.current = toggleChanges
  })
  const revert = async (id: string, part: RevertPart): Promise<void> => {
    const r = await window.reqochet.revertChange(id, part)
    if (!r.ok) changes.setError(r.message)
    await afterChange()
  }
  const discard = async (entry: CompareEntry): Promise<void> => {
    const r = await window.reqochet.discardChanges(entry.paths)
    if (!r.ok) changes.setError(r.message)
    git.onPanelResult(r)
  }

  const newItem = async (type: string, parent?: string, after?: string): Promise<void> => {
    if (!type) return
    const item = await window.reqochet.newItem(type, parent, after, document === ALL_DOCUMENTS ? undefined : document)
    request({ kind: 'draft', item })
  }

  const onMove = async (ids: string[], parent: string | null, before: string | null): Promise<void> => {
    const id = ids[0] as string
    if (dirty && target?.kind === 'item' && ids.includes(target.id)) {
      setNotice(T.workspace.moveFirst(target.id))
      return
    }
    // several chosen rows move together (the owner, 0.11.0); they stay chosen
    const r = ids.length > 1 ? await window.reqochet.reparentItems(ids, parent, before) : await window.reqochet.reparentItem(id, parent, before)
    setNotice(r.ok ? null : T.workspace.moveFailed(ids.length > 1 ? T.workspace.items : id, r.message))
    if (r.ok && ids.length > 1) {
      await afterChange()
      return
    }
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

  useEffect(() => {
    expandRef.current = () => {
      if (!expanding && !filters.filtered) void expandAll()
    }
    collapseRef.current = () => {
      if (!filters.filtered) tree.current?.collapseAll()
    }
  })
  // the bar above the table is one Tab stop (0.23.0)
  const barRef = useRef<HTMLDivElement>(null)
  useEffect(() => rovingToolbar(barRef.current))
  const onToolbarFocus = (e: FocusEvent<HTMLDivElement>): void => {
    if ((e.target as HTMLElement).hasAttribute('data-toolbar-item')) rovingToolbar(e.currentTarget, e.target as HTMLElement)
  }

  const selectedId = target?.kind === 'item' ? target.id : null
  const editorWidth = useEditorWidth()
  const editorSave = useRef<(() => Promise<boolean>) | null>(null)
  const onSaveReady = useCallback((save: (() => Promise<boolean>) | null) => {
    editorSave.current = save
  }, [])
  const problems = problemsOf(info)
  // items that break a coverage rule (T-08), counted for the status bar and the Problems panel
  const rulesKey = JSON.stringify(schema.rules ?? [])
  const [gapTotal, setGapCount] = useState(0)
  const gapCount = (schema.rules?.length ?? 0) > 0 ? gapTotal : 0
  useEffect(() => {
    if (!(schema.rules?.length ?? 0)) return
    let live = true
    window.reqochet.queryItems({ gaps: true, limit: 0 }).then(
      (r) => live && setGapCount(r.total),
      // the count must never break the window; the rules are listed under Problems if they cannot be checked (SEC20-04)
      () => live && setGapCount(0)
    )
    return () => {
      live = false
    }
  }, [rulesKey, dataVersion, info, schema.rules?.length])
  const decideRules = async (take: boolean): Promise<void> => {
    try {
      const rules = take ? await window.reqochet.starterRules() : []
      const r = await window.reqochet.saveSchemaRules(rules, info.schemaRevision)
      if (r.ok) {
        onInfo(r.info)
        setDataVersion((v) => v + 1)
      } else setNotice(r.message)
    } catch (e) {
      setNotice(errorMessage(e))
    }
  }
  const openVersion = async (ref: string): Promise<void> => {
    setHistoryOpen(false)
    setVersionBusy(true)
    setVersionError(null)
    try {
      const r = await window.reqochet.openVersion(ref)
      if (!r.ok) {
        setVersionError(r.message)
        return
      }
      setShowChanges(false)
      setTarget(null)
      setChosen(new Set())
      onInfo(r.info)
      setDataVersion((v) => v + 1)
    } catch (e) {
      setVersionError(errorMessage(e))
    } finally {
      setVersionBusy(false)
    }
  }
  const backToNow = async (): Promise<void> => {
    setTarget(null)
    setChosen(new Set())
    onInfo(await window.reqochet.closeVersion())
    setDataVersion((v) => v + 1)
  }

  return (
    <div className="workspace" style={editorWidth.style} ref={rootRef}>
      <section className="workspace__main" aria-label={T.workspace.items}>
        {viewing && (
          // D-19b: the whole table shows an old version; this bar says which and leads back
          <div className="version-bar" role="status">
            <strong className="version-bar__label" dir="auto">
              {T.version.banner(viewing.label)}
            </strong>
            <span className="version-bar__tag">{T.version.readOnlyTag}</span>
            <span className="muted-inline">{T.version.hint}</span>
            <span className="toolbar__spacer" />
            <button type="button" className="btn btn--small btn--primary" onClick={() => void backToNow()}>
              {T.version.back}
            </button>
          </div>
        )}
        {versionBusy && <p className="notice table-notice" role="status">{T.version.opening}</p>}
        {versionError && (
          <p className="notice notice--error table-notice" role="alert">
            {versionError}{' '}
            <button type="button" className="link-btn" onClick={() => setVersionError(null)}>
              {T.common.dismiss}
            </button>
          </p>
        )}
        <GitBar
          hidden={viewing !== undefined}
          slot={gitSlot}
          state={git.state}
          busy={git.busy}
          blockedReason={git.blocked}
          changesOpen={showChanges}
          onToggleChanges={toggleChanges}
          traceOpen={showTrace}
          onToggleTrace={() => {
            setShowChanges(false)
            setShowTrace((v) => !v)
          }}
          onOpenHistory={() => setHistoryOpen(true)}
          onRun={(a) => (a === 'push' ? push() : void git.run(a))}
          notice={git.notice}
          onDismiss={git.dismiss}
          onOpenItem={select}
          pushOffer={git.pushOffer}
          onPushOffer={git.answerPush}
          onPublish={git.publish}
          onCreateBranch={git.createBranch}
          onSwitchBranch={async (name, how) => {
            const ok = await git.switchBranch(name, how)
            // the open item may not exist on the other branch: start from the table
            if (ok && !dirty) setTarget(null)
            return ok
          }}
          onPullFrom={async (name) => {
            const ok = await git.pullFrom(name)
            // another branch's changes arrive uncommitted (0.13.0): show them for review right away
            if (ok && !showChanges) {
              changes.reset()
              setShowChanges(true)
            }
            return ok
          }}
          onDeleteBranch={git.deleteBranch}
          onCompareBranch={(name) => {
            if (!showChanges) git.reload()
            setShowChanges(true)
            void changes.chooseBranch(name)
          }}
          onCommitFirst={() => {
            if (!showChanges) toggleChanges()
            else changes.reset()
          }}
        />
        {showTrace && !showChanges && (
          <TraceabilityView
            schema={schema}
            info={info}
            document={document === ALL_DOCUMENTS ? undefined : document}
            query={query}
            dataVersion={dataVersion}
            onOpenItem={(id) => {
              setShowTrace(false)
              select(id)
            }}
            onShowGaps={(type) => {
              setShowTrace(false)
              setFromTrace(true)
              filters.setTypes(type)
              filters.setLinkFilter('gaps')
            }}
            {...(viewing
              ? {}
              : {
                  onEditRules: () => {
                    setTypesTab('rules')
                    setEditTypes(true)
                  }
                })}
            onClose={() => setShowTrace(false)}
          />
        )}
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
            onDiscardPaths={async (paths) => {
              const r = await window.reqochet.discardChanges(paths)
              if (!r.ok) changes.setError(r.message)
              git.onPanelResult(r)
            }}
            onOpenItem={select}
            onOpenImpact={(id) =>
              guarded(() => {
                setShowChanges(false)
                setTarget({ kind: 'item', id, tab: 'impact' })
              })
            }
            onClose={() => setShowChanges(false)}
          />
        )}
        {/* The table stays mounted while the Changes view is open, so its opened levels and scroll position survive. */}
        <div className={(showChanges && git.state?.available) || showTrace ? 'is-hidden' : 'workspace__items'}>
          {/* one bar: the document picker and the toolbar share a row while both fit (visual review V-05) */}
          {/* one Tab stop for the whole bar; ← → move between its controls (0.23.0, Fable's review) */}
          <div ref={barRef} className="workbar" role="toolbar" aria-label={T.workspace.toolbarLabel} onKeyDown={onToolbarKeyDown} onFocus={onToolbarFocus}>
          <DocumentBar info={info} document={document} onDocument={setDocument} onInfo={onInfo} guard={guarded} readOnly={viewing !== undefined} newRef={newDocRef} />
          <Toolbar
            searchRef={searchRef}
            newRef={newRef}
            filtersRef={filtersRef}
            outline={() => tree.current?.outline() ?? 'mixed'}
            schema={schema}
            filters={filters}
            prefs={columnPrefs}
            onPrefs={setColumnPrefs}
            onEditFields={() => setEditFields(true)}
            onEditTypes={() => setEditTypes(true)}
            canExport={info.itemCount > 0}
            onExport={() => setExportOpen({})}
            onImport={() => guarded(() => setImporting({ file: null, newProject: false }))}
            expanding={expanding}
            onExpandAll={() => void expandAll()}
            onCollapseAll={() => tree.current?.collapseAll()}
            onNewItem={(type) => {
              // where it goes: below the selected item (default), inside it, or at the end (the owner, 5 Nov 2026)
              const sel = target?.kind === 'item' ? target.id : undefined
              if (sel && newWhere === 'after') void newItem(type, undefined, sel)
              else if (sel && newWhere === 'inside') void newItem(type, sel)
              else void newItem(type)
            }}
            newWhere={newWhere}
            onNewWhere={setNewWhere}
            hasSelection={target?.kind === 'item'}
            readOnly={viewing !== undefined}
          />
          </div>

          {/* 0.16: a project still under ReqMan's folder name — offer the rename as one commit (owner, 31 Oct / 4 Nov) */}
          {folderDone && (
            <div className="notice table-notice table-notice--ok folder-notice" role="status">
              <span>{T.workspace.legacyFolderDone}</span>
              <button type="button" className="link-btn" onClick={() => setFolderDone(false)}>
                {T.common.dismiss}
              </button>
            </div>
          )}
          {info.legacyFolder && !folderLater && (
            <div className="notice table-notice folder-notice folder-notice--ask" role="status">
              <span className="folder-notice__text">{T.workspace.legacyFolder}</span>
              <span className="actions">
                <button type="button" className="btn btn--small btn--primary" disabled={renamingFolder} onClick={() => void renameFolder()}>
                  {T.workspace.legacyFolderUpdate}
                </button>
                <button type="button" className="btn btn--small" onClick={() => setFolderLater(true)}>
                  {T.workspace.legacyFolderLater}
                </button>
              </span>
            </div>
          )}
          {/* theme 1b (T-02): a project that never decided about coverage rules is offered the starter set once */}
          {info.schema.rules === undefined && !viewing && (
            <div className="notice table-notice folder-notice folder-notice--ask" role="status">
              <span className="folder-notice__text">{T.trace.offer}</span>
              <span className="actions">
                <button type="button" className="btn btn--small btn--primary" onClick={() => void decideRules(true)}>
                  {T.trace.offerYes}
                </button>
                <button type="button" className="btn btn--small" onClick={() => void decideRules(false)}>
                  {T.trace.offerNo}
                </button>
              </span>
            </div>
          )}
          {filtered && (
            <div className="table-mode">
              {fromTrace && filters.linkFilter === 'gaps' && (
                <button
                  type="button"
                  className="btn btn--small table-mode__back"
                  onClick={() => {
                    setFromTrace(false)
                    setShowChanges(false)
                    setShowTrace(true)
                  }}
                >
                  <Icon name="arrowBack" size={14} />
                  {T.trace.backToTrace}
                </button>
              )}
              {T.workspace.searchMode}
            </div>
          )}
          <ItemTable
            schema={schema}
            prefs={columnPrefs}
            onResize={(key, width) => setColumnPrefs({ ...columnPrefs, widths: withWidth(columnPrefs.widths, key, width) })}
            documentGroups={document === ALL_DOCUMENTS && info.documents.length > 1 ? info.documents.map((d) => ({ name: d.name, count: d.itemCount })) : undefined}
            onMoveColumn={(from, to) => setColumnPrefs({ ...columnPrefs, order: moveColumn(columnOrder(schema, columnPrefs.order), from, to) })}
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
            onRowMenu={(id, x, y) => !viewing && setRowMenu({ id, x, y })}
            mode={filtered ? 'flat' : 'tree'}
            query={query}
            dataVersion={dataVersion}
            selectedId={selectedId}
            onSelect={select}
            onSort={filters.onSort}
            onTotal={setTotal}
            onMove={(ids, parent, before) => !viewing && void onMove(ids, parent, before)}
            controlsRef={tree}
            revealNonce={revealNonce}
            emptyText={
              // a new project, or an empty document (S-10): what to do first
              info.itemCount === 0 || (!filtered && document !== ALL_DOCUMENTS && (info.documents.find((d) => d.name === document)?.itemCount ?? 0) === 0) ? (
                // first run: what to do first, in one place (UX-W01)
                <div className="first-run" role="region" aria-label={T.workspace.firstRunTitle}>
                  <h2 className="first-run__title">{T.workspace.firstRunTitle}</h2>
                  <p className="first-run__text">{T.workspace.firstRunText}</p>
                  <div className="first-run__actions">
                    <button type="button" className="btn btn--primary" onClick={() => void newItem(schema.itemTypes.find((x) => x.requirement !== false)?.id ?? schema.itemTypes[0]?.id ?? '')}>
                      {T.workspace.firstRunNew}
                    </button>
                    <button type="button" className="btn" onClick={() => guarded(() => setImporting({ file: null, newProject: false }))}>
                      {T.workspace.firstRunImport}
                    </button>
                    {onQuickStart && (
                      <button type="button" className="link-btn" onClick={onQuickStart}>
                        {T.workspace.firstRunGuide}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                T.workspace.emptyFilter
              )
            }
          />
          {exported && (
            <div className="notice table-notice table-notice--ok" role="status">
              {T.exportDialog.done(exported.count, exported.path)}{' '}
              <button type="button" className="link-btn" onClick={() => void window.reqochet.showInFolder(exported.path)}>
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

        {showProblems && problems.length + gapCount > 0 && (
          <ProblemList
            problems={problems}
            gapCount={gapCount}
            onShowGaps={() => {
              setShowProblems(false)
              filters.setLinkFilter('gaps')
            }}
            onOpenCoverage={() => {
              setShowProblems(false)
              setShowChanges(false)
              setShowTrace(true)
            }}
            onOpen={select}
            onFixed={() => void afterChange()}
            onClose={() => setShowProblems(false)}
            guard={guarded}
          />
        )}
        <footer className="statusbar">
          <span>{filtered ? T.workspace.of(total, info.itemCount) : T.common.items(info.itemCount)}</span>
          {problems.length > 0 ? (
            <button
              type="button"
              className={problems.some((p) => p.severity === 'error') ? 'link-btn statusbar__problems' : 'link-btn statusbar__problems statusbar__problems--warn'}
              aria-expanded={showProblems}
              onClick={() => setShowProblems((s) => !s)}
            >
              {T.workspace.problemCount(problems.length)} <Chevron open={showProblems} size={12} />
            </button>
          ) : (
            <span className="statusbar__ok">{T.workspace.noProblems}</span>
          )}
          {/* coverage gaps are warnings, counted on their own (a big project can have thousands — T-08) */}
          {gapCount > 0 && (
            <button type="button" className="link-btn statusbar__problems statusbar__problems--warn" aria-expanded={showProblems} title={T.trace.statusGapsTooltip} onClick={() => setShowProblems((s) => !s)}>
              {T.trace.statusGaps(gapCount)}
            </button>
          )}
          {chosen.size > 0 ? (
            <span className="statusbar__hint">
              {T.rowMenu.chosenStatus(chosen.size)} · {T.rowMenu.chosenHint}{' '}
              <button type="button" className="link-btn" onClick={() => setChosen(new Set())}>
                {T.rowMenu.clearChosen}
              </button>
            </span>
          ) : filtered ? (
            // UX-36: what the table is filtered by, with a quick way out
            <span className="statusbar__hint statusbar__filter" title={filters.summary}>
              {T.workspace.filteredBy(filters.summary)}{' '}
              <button type="button" className="link-btn" onClick={filters.clear} aria-label={T.workspace.clearFiltersStatus} title={T.workspace.clearFiltersStatus}>
                <Icon name="close" />
              </button>
            </span>
          ) : (
            info.itemCount > 1 && !showChanges && !showTrace && !viewing && showDragTip() && <span className="statusbar__hint">{T.workspace.dragHint}</span>
          )}
          {!info.isGitRepository && <span className="statusbar__warn">{T.workspace.notGit}</span>}
          {refreshError && <span className="statusbar__warn">{T.workspace.refreshFailed(refreshError)}</span>}
          <span className="toolbar__spacer" />
          {git.lastPull && <span className="statusbar__hint">{T.workspace.lastPull(git.lastPull.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }))}</span>}
          <span className="statusbar__path" title={info.root}>
            {middleEllipsis(info.root, 60)}
          </span>
        </footer>
      </section>

      {showChanges && git.state?.available && changes.preset === 'uncommitted' && <ChangesSide git={git.state} blocked={git.blocked} onResult={git.onPanelResult} onPush={push} />}

      {target && (
        <div className={(showChanges && git.state?.available) || showTrace ? 'is-hidden' : 'workspace__side'}>
          {editorWidth.handle}
          <ItemEditor
            // Same key for a draft and the saved item, so the editor stays in place when a new item is saved.
            key={`${target.kind === 'item' ? target.id : target.item.id}:${formReset}`}
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
            onSaveReady={onSaveReady}
            reloadToken={dataVersion}
            onLinksChanged={() => void afterChange()}
            onNewChild={(type, parent) => void newItem(type, parent)}
            onOpen={select}
            onClose={() => request(null)}
            readOnly={viewing !== undefined}
          />
        </div>
      )}

      {git.plan && <MergeDialog plan={git.plan} onDone={git.mergeDone} onOpen={select} />}

      {rowMenu && (
        <RowMenu
          {...rowMenu}
          chosenCount={chosen.has(rowMenu.id) ? chosen.size : 0}
          onOpen={() => select(rowMenu.id)}
          onExportItem={() => setExportOpen({ chosen: [rowMenu.id] })}
          onExportChosen={() => setExportOpen({ chosen: [...chosen] })}
          onAddChild={() => void newItem(schema.itemTypes.find((x) => x.requirement !== false)?.id ?? schema.itemTypes[0]?.id ?? '', rowMenu.id)}
          onDelete={() => {
            setShowChanges(false)
            guarded(() => setTarget({ kind: 'item', id: rowMenu.id, askDelete: true }))
          }}
          onClose={() => setRowMenu(null)}
        />
      )}

      {importing && (
        <ImportDialog
          schema={schema}
          file={importing.file}
          newProject={importing.newProject}
          {...(document !== ALL_DOCUMENTS ? { document } : {})}
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

      {historyOpen && (
        <HistoryDialog
          onClose={() => setHistoryOpen(false)}
          // unsaved edits are asked about first, as before any other switch (CR19-01)
          onOpenSnapshot={(ref) => guarded(() => void openVersion(ref))}
          onCompare={(ref) => {
            // an older version against the working folder, in the Changes view (S-09)
            setHistoryOpen(false)
            git.reload()
            changes.choose('custom')
            changes.setCustom({ from: ref, to: WORKING })
            setShowChanges(true)
          }}
          onResult={(r) => git.onPanelResult(r)}
        />
      )}
      {editTypes && (
        <TypesDialog
          info={info}
          tab={typesTab}
          onClose={() => {
            setEditTypes(false)
            setTypesTab('items')
          }}
          onSaved={(i) => {
            setEditTypes(false)
            onInfo(i)
            setDataVersion((v) => v + 1)
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
        // UI review UX-09: a centred question with "Save and continue" first; Discard is outlined, not filled
        <div className="modal" role="presentation">
          <div className="guard" role="alertdialog" aria-label={T.workspace.unsaved}>
            <p>{T.workspace.unsavedAsk}</p>
            <div className="actions">
              <button
                type="button"
                className="btn btn--primary"
                autoFocus
                onClick={() => {
                  const next = pending
                  void (editorSave.current?.() ?? Promise.resolve(false)).then((ok) => {
                    setPending(undefined)
                    if (!ok) return // the editor shows why it could not save
                    setDirty(false)
                    next.then()
                  })
                }}
              >
                {T.workspace.saveAndContinue}
              </button>
              <button
                type="button"
                className="btn btn--danger-outline"
                onClick={() => {
                  setDirty(false)
                  setPending(undefined)
                  setFormReset((n) => n + 1) // the editor reads the item again: the typed edits are dropped
                  pending.then()
                }}
              >
                {T.workspace.discard}
              </button>
              <button type="button" className="btn" onClick={() => setPending(undefined)}>
                {T.workspace.keepEditing}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
