import { useState } from 'react'
import type { RepoInfo } from '../../../../shared/api'
import { T } from '../../../../shared/text'

/** "All documents" in the picker: not a folder name (a folder name never starts with NUL). */
export const ALL_DOCUMENTS = '\u0000all'

/**
 * The documents of the repository (S-10: one folder each under requirements/): a picker showing one document at a
 * time or all of them, "New document…" and "Rename…". A project made before 0.17 has one folder called "items";
 * the bar offers to give it a real name (one commit, history kept). Loose item files are offered a document too.
 */
export function DocumentBar(props: { info: RepoInfo; document: string; onDocument: (d: string) => void; onInfo: (i: RepoInfo) => void; guard: (then: () => void) => void }) {
  const { info, document, onDocument } = props
  const [naming, setNaming] = useState<null | { kind: 'new' | 'rename'; from: string }>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [later, setLater] = useState(false)
  const docs = info.documents
  const label = (d: string): string => (d === '' ? T.documents.loose : d)
  const legacy = docs.length === 1 && docs[0]?.name === 'items'
  const loose = docs.find((d) => d.name === '')

  const submit = async (): Promise<void> => {
    if (!naming) return
    setBusy(true)
    setError(null)
    const r = naming.kind === 'new' ? await window.reqochet.createDocument(name) : await window.reqochet.renameDocument(naming.from, name)
    setBusy(false)
    if (!r.ok) return setError(r.message)
    props.onInfo(r.info)
    onDocument(name.trim())
    setNaming(null)
  }
  const start = (kind: 'new' | 'rename', from: string, initial: string): void =>
    props.guard(() => {
      setNaming({ kind, from })
      setName(initial)
      setError(null)
    })

  return (
    <div className="document-bar">
      <label className="document-bar__label" htmlFor="document-picker">
        {T.documents.label}
      </label>
      <select id="document-picker" className="select-btn select-btn--fit" value={document} onChange={(e) => onDocument(e.target.value)} title={T.documents.pickerTooltip}>
        {docs.length > 1 && <option value={ALL_DOCUMENTS}>{T.documents.all(info.itemCount)}</option>}
        {docs.map((d) => (
          <option key={d.name} value={d.name}>
            {T.documents.option(label(d.name), d.itemCount)}
          </option>
        ))}
      </select>
      {naming ? (
        <form
          className="document-bar__form"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label={naming.kind === 'new' ? T.documents.newName : T.documents.renameName(label(naming.from))} placeholder={T.documents.placeholder} />
          <button type="submit" className="btn btn--small btn--primary" disabled={busy || !name.trim()}>
            {naming.kind === 'new' ? T.documents.create : T.documents.rename}
          </button>
          <button type="button" className="btn btn--small" onClick={() => setNaming(null)}>
            {T.common.cancel}
          </button>
        </form>
      ) : (
        <>
          <button type="button" className="link-btn" onClick={() => start('new', '', '')}>
            {T.documents.newDocument}
          </button>
          {document !== ALL_DOCUMENTS && (
            <button type="button" className="link-btn" onClick={() => start('rename', document, document === 'items' || document === '' ? '' : document)}>
              {T.documents.renameDocument}
            </button>
          )}
        </>
      )}
      {error && (
        <span className="notice notice--error" role="alert">
          {error}
        </span>
      )}
      {!naming && !later && (legacy || loose) && (
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
