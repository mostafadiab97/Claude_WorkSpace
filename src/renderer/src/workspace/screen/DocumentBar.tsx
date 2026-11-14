import { useEffect, useState, type RefObject } from 'react'
import { MenuButton } from '../../components/MenuButton'
import { KEYS } from './Toolbar'
import type { RepoInfo } from '../../../../shared/api'
import { Icon } from '../../components/icons'
import { T } from '../../../../shared/text'
import { useSessionState } from '../../lib/sessionState'

/** "All documents" in the picker: not a folder name (a folder name never starts with NUL). */
export const ALL_DOCUMENTS = '\u0000all'

/**
 * The documents of the repository (S-10: one folder each under requirements/): a picker showing one document at a
 * time or all of them, "New document…" and "Rename…". A project made before 0.17 has one folder called "items";
 * the bar offers to give it a real name (one commit, history kept). Loose item files are offered a document too.
 */
export function DocumentBar({ newRef, ...props }: {
  info: RepoInfo
  document: string
  onDocument: (d: string) => void
  onInfo: (i: RepoInfo) => void
  guard: (then: () => void) => void
  readOnly?: boolean
  /** Ctrl+Shift+N (0.23.0): WorkspaceScreen calls it to start a new document. */
  newRef?: RefObject<(() => void) | null>
}) {
  const { info, document, onDocument } = props
  const [naming, setNaming] = useState<null | { kind: 'new' | 'rename'; from: string }>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [merging, setMerging] = useState<string | null>(null) // the target chosen in "Merge into…" (O-6)
  const [deleting, setDeleting] = useState(false) // "Delete…" asks once, inline (owner, 0.21.3)
  const [notice, setNotice] = useState<string | null>(null)
  // "Not now" holds for the rest of the session for this project, not only until the bar is drawn again (UX17-15)
  const [later, setLater] = useSessionState(`documents.later.${info.root}`, false)
  const docs = info.documents
  const label = (d: string): string => (d === '' ? T.documents.loose : d)
  const legacy = docs.length === 1 && docs[0]?.name === 'items'
  const loose = docs.find((d) => d.name === '')

  const submit = async (): Promise<void> => {
    if (!naming) return
    setBusy(true)
    setError(null)
    let r: Awaited<ReturnType<typeof window.reqochet.renameDocument>>
    try {
      r = naming.kind === 'new' ? await window.reqochet.createDocument(name) : await window.reqochet.renameDocument(naming.from, name)
    } catch (e) {
      // a refused call (e.g. a name over 80 characters) must not leave the bar busy for good (CRA-11)
      r = { ok: false, message: e instanceof Error ? e.message : String(e) }
    } finally {
      setBusy(false)
    }
    if (!r.ok) {
      setError(r.message)
      setNaming(null) // start again from what is there now (the old name may no longer exist)
      // the core re-read the folder: show what is on disk now, whatever happened (the owner, 8 Nov 2026)
      const now = await window.reqochet.refreshRepository(false).catch(() => null)
      if (now) props.onInfo(now)
      return
    }
    props.onInfo(r.info)
    onDocument(name.trim())
    setNaming(null)
  }
  const merge = async (into: string): Promise<void> => {
    setBusy(true)
    setError(null)
    const from = document
    const r = await window.reqochet.mergeDocument(from, into)
    setBusy(false)
    setMerging(null)
    if (!r.ok) return setError(r.message)
    props.onInfo(r.info)
    setNotice(r.differing.length > 0 ? T.documents.mergedDiffering(from, r.differing.length) : T.documents.merged(from, into))
    onDocument(r.differing.length > 0 ? from : into)
  }
  const remove = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const name = document
    const r = await window.reqochet.deleteDocument(name)
    setBusy(false)
    setDeleting(false)
    if (!r.ok) return setError(r.message)
    props.onInfo(r.info)
    setNotice(T.documents.deleted(name, r.removed))
    onDocument(ALL_DOCUMENTS)
  }
  const current = docs.length > 1 || document === ALL_DOCUMENTS ? document : (docs[0]?.name ?? document)
  const countOf = (d: string): number => (d === ALL_DOCUMENTS ? info.itemCount : (docs.find((x) => x.name === d)?.itemCount ?? 0))
  const canRename = document !== ALL_DOCUMENTS
  const canDelete = document !== ALL_DOCUMENTS && document !== ''
  const canMerge = canDelete && docs.filter((d) => d.name !== '' && d.name !== document).length > 0
  const startNew = (): void => start('new', '', '')
  const startRename = (): void => start('rename', document, document === 'items' || document === '' ? '' : document)
  const start = (kind: 'new' | 'rename', from: string, initial: string): void =>
    props.guard(() => {
      setNaming({ kind, from })
      setName(initial)
      setError(null)
    })
  useEffect(() => {
    if (newRef) newRef.current = props.readOnly ? null : startNew
  })

  return (
    <div className={docs.length <= 1 && !naming && !error && (later || !(legacy || loose)) ? 'document-bar document-bar--compact' : 'document-bar'}>
      {/* T-1 a (the owner, 13 Nov; Fable's review): one document button — name, item count, arrow; its menu lists the
          documents, then New, Rename, Merge into…, Delete (red, last). F2 renames, Ctrl+Shift+N makes a new one. */}
      <MenuButton
        label={T.documents.button(current === ALL_DOCUMENTS ? T.documents.all(info.itemCount) : label(current), countOf(current))}
        title={T.documents.pickerTooltip}
        className="doc-btn"
        menuLabel={T.documents.menuLabel}
        onButtonKeyDown={(e) => {
          if (e.key === 'F2' && canRename) {
            e.preventDefault()
            startRename()
          }
        }}
        entries={() => [
          ...(docs.length > 1 ? [{ kind: 'item' as const, label: T.documents.all(info.itemCount), checked: document === ALL_DOCUMENTS, onSelect: () => onDocument(ALL_DOCUMENTS) }] : []),
          ...docs.map((d) => ({ kind: 'item' as const, label: T.documents.option(label(d.name), d.itemCount), checked: document === d.name, onSelect: () => onDocument(d.name) })),
          ...(props.readOnly
            ? []
            : [
                { kind: 'sep' as const },
                { kind: 'item' as const, label: T.workspace.keyHint(T.documents.newDocument, KEYS.newDocument), icon: 'plus' as const, onSelect: startNew },
                ...(canRename ? [{ kind: 'item' as const, label: T.workspace.keyHint(T.documents.renameNamed(label(document)), KEYS.rename), icon: 'pencil' as const, onSelect: startRename }] : []),
                ...(canMerge ? [{ kind: 'item' as const, label: T.documents.mergeNamed(document), hint: T.documents.mergeIntoTooltip, icon: 'merge' as const, onSelect: () => props.guard(() => setMerging(docs.find((d) => d.name !== '' && d.name !== document)?.name ?? null)) }] : []),
                ...(canDelete ? [{ kind: 'item' as const, label: T.documents.deleteNamed(document), icon: 'trash' as const, danger: true, onSelect: () => props.guard(() => setDeleting(true)) }] : [])
              ])
        ]}
      >
        <span className="doc-btn__name" dir="auto">
          {current === ALL_DOCUMENTS ? T.documents.menuLabel : label(current)}
        </span>
        <span className="doc-btn__count">{T.documents.countShort(countOf(current))}</span>
        <Icon name="chevronDown" size={12} />
      </MenuButton>
      {naming ? (
        <form
          className="document-bar__form"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <input maxLength={80}
            className="input"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setNaming(null)
              }
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'document-bar-error' : undefined} aria-label={naming.kind === 'new' ? T.documents.newName : T.documents.renameName(label(naming.from))} placeholder={T.documents.placeholder} />
          <button type="submit" className="btn btn--small btn--primary" disabled={busy || !name.trim()}>
            {naming.kind === 'new' ? T.documents.create : T.documents.rename}
          </button>
          <button type="button" className="btn btn--small" onClick={() => setNaming(null)}>
            {T.common.cancel}
          </button>
          {naming.kind === 'rename' && <span className="muted-inline">{T.documents.renameHint}</span>}
        </form>
      ) : props.readOnly ? null : (
        <>
          {deleting && canDelete && (
            <span className="document-bar__merge" role="group" aria-label={T.documents.deleteGo}>
              <span>{T.documents.deleteAsk(document, countOf(document))}</span>
              <button type="button" className="btn btn--small btn--danger" disabled={busy} onClick={() => void remove()}>
                {T.documents.deleteGo}
              </button>
              <button type="button" className="btn btn--small" onClick={() => setDeleting(false)}>
                {T.common.cancel}
              </button>
            </span>
          )}
          {merging !== null && canMerge && (
            <span className="document-bar__merge">
              <select className="select-btn select-btn--fit" aria-label={T.documents.mergeTarget} value={merging} onChange={(e) => setMerging(e.target.value)}>
                {docs
                  .filter((d) => d.name !== '' && d.name !== document)
                  .map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
              </select>
              <button type="button" className="btn btn--small btn--primary" disabled={busy} onClick={() => void merge(merging)}>
                {T.documents.mergeGo}
              </button>
              <button type="button" className="btn btn--small" onClick={() => setMerging(null)}>
                {T.common.cancel}
              </button>
            </span>
          )}
        </>
      )}
      {notice && (
        <span className="notice notice--ok document-bar__error" role="status">
          {notice}
        </span>
      )}
      {error && (
        <span id="document-bar-error" className="notice notice--error document-bar__error" role="alert">
          {error}
        </span>
      )}
      {!naming && !later && !props.readOnly && (legacy || loose) && (
        <div className="notice table-notice folder-notice document-notice" role="status">
          <span className="folder-notice__text">{legacy ? T.documents.legacy : T.documents.looseAsk(loose?.itemCount ?? 0)}</span>
          <span className="actions">
            <button type="button" className="btn btn--small btn--primary" onClick={() => start('rename', legacy ? 'items' : '', '')}>
              {legacy ? T.documents.nameIt : T.documents.moveLoose}
            </button>
            <button type="button" className="btn btn--small" onClick={() => setLater(true)}>
              {T.workspace.legacyFolderLater}
            </button>
          </span>
        </div>
      )}
    </div>
  )
}
