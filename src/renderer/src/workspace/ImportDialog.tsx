import { useEffect, useMemo, useState } from 'react'
import type { ImportFile, ImportPreview, ImportResult, ImportSettings, ImportTarget } from '../../../shared/api'
import type { Schema } from '../../../shared/domain'
import { errorMessage } from '../lib/hooks'
import { T } from '../../../shared/text'

type Step = 'file' | 'columns' | 'check'

/**
 * Import from Excel or CSV (M7), in three steps: 1. the file, its sheet and which row holds the column names;
 * 2. what each column means (guessed from the names, changeable) and the type of rows without one; 3. the preview —
 * how many items are new, updated, unchanged or skipped, and every problem by row. Importing writes uncommitted
 * changes (review them in Changes); a new project from a file commits them right away.
 */
export function ImportDialog(props: { schema: Schema; file: ImportFile | null; newProject: boolean; onClose: () => void; onDone: (r: ImportResult & { ok: true }) => void }) {
  const { schema } = props
  const [file, setFile] = useState<ImportFile | null>(props.file)
  const [step, setStep] = useState<Step>('file')
  const [sheet, setSheet] = useState(props.file?.sheets[0]?.name ?? '')
  const [headerRow, setHeaderRow] = useState(0)
  const [mapping, setMapping] = useState<ImportTarget[] | null>(null)
  const firstType = schema.itemTypes.find((t) => t.id === 'system-requirement')?.id ?? schema.itemTypes.find((t) => t.requirement)?.id ?? schema.itemTypes[0]?.id ?? ''
  const [defaultType, setDefaultType] = useState(firstType)
  const [preview, setPreview] = useState<{ key: string; data: ImportPreview } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sheetInfo = file?.sheets.find((s) => s.name === sheet)
  const settings: ImportSettings | null = file && sheet ? { token: file.token, sheet, headerRow, defaultType, ...(mapping ? { mapping } : {}) } : null
  const key = settings ? JSON.stringify(settings) : ''

  // the preview follows every choice (from step 2 on)
  useEffect(() => {
    if (!settings || step === 'file') return
    let live = true
    const t = window.setTimeout(() => {
      void window.reqman
        .previewImport(settings)
        .then((data) => {
          if (!live) return
          setPreview({ key, data })
          setError(null)
        })
        .catch((e: unknown) => live && setError(errorMessage(e)))
    }, 150)
    return () => {
      live = false
      window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key stands for settings
  }, [key, step])

  const data = preview?.key === key ? preview.data : null
  // the guessed mapping, until the user changes a column
  const shownMapping = mapping ?? data?.mapping ?? null

  const choose = async (): Promise<void> => {
    setError(null)
    try {
      const f = await window.reqman.chooseImportFile()
      if (!f) return
      setFile(f)
      setSheet(f.sheets.find((s) => s.rowCount > 0)?.name ?? f.sheets[0]?.name ?? '')
      setHeaderRow(guessHeader(f.sheets[0]?.sample ?? []))
      setMapping(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const run = async (): Promise<void> => {
    if (!settings) return
    setBusy(true)
    setError(null)
    try {
      const r = await window.reqman.runImport({ ...settings, ...(shownMapping ? { mapping: shownMapping } : {}) }, props.newProject && file ? T.importMsg.imported(file.name) : undefined)
      if (r.ok) props.onDone(r)
      else setError(r.message)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const targets = useMemo(() => targetOptions(schema), [schema])
  const hasContent = shownMapping?.some((t) => t === 'title' || t === 'text') ?? false
  const sample = sheetInfo?.sample ?? []
  const headers = sample[headerRow] ?? []
  const width = Math.max(headers.length, ...sample.slice(headerRow + 1).map((r) => r.length))

  return (
    <div className="modal" role="presentation">
      <div className="modal__panel import" role="dialog" aria-modal="true" aria-label={T.importDialog.title}>
        <header className="modal__header">
          <div>
            <h2 className="modal__title">{props.newProject ? T.importDialog.titleNew : T.importDialog.title}</h2>
            <p className="muted">{props.newProject ? T.importDialog.introNew : T.importDialog.intro}</p>
          </div>
          <button type="button" className="icon-btn" aria-label={T.common.close} onClick={props.onClose}>
            ✕
          </button>
        </header>
        <ol className="import__steps" aria-label={T.importDialog.steps}>
          {(['file', 'columns', 'check'] as const).map((s, i) => (
            <li key={s} className={s === step ? 'import__step import__step--on' : 'import__step'} aria-current={s === step ? 'step' : undefined}>
              {i + 1}. {T.importDialog.stepNames[s]}
            </li>
          ))}
        </ol>
        <div className="modal__body import__body">
          {step === 'file' && (
            <>
              <div className="actions">
                <button type="button" className="btn" onClick={() => void choose()}>
                  {file ? T.importDialog.otherFile : T.importDialog.chooseFile}
                </button>
                {file && <span className="import__file">{file.name}</span>}
              </div>
              {file && (
                <>
                  {file.sheets.length > 1 && (
                    <label className="field">
                      <span className="field__label">{T.importDialog.sheet}</span>
                      <select
                        className="input"
                        value={sheet}
                        onChange={(e) => {
                          setSheet(e.target.value)
                          setHeaderRow(guessHeader(file.sheets.find((s) => s.name === e.target.value)?.sample ?? []))
                          setMapping(null)
                        }}
                      >
                        {file.sheets.map((s) => (
                          <option key={s.name} value={s.name}>
                            {T.importDialog.sheetOption(s.name, s.rowCount)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <p className="muted-inline">{T.importDialog.headerHint}</p>
                  <div className="import__grid scroll" role="table" aria-label={T.importDialog.sampleLabel}>
                    {sample.slice(0, 15).map((r, i) => (
                      <div
                        key={i}
                        role="row"
                        className={i === headerRow ? 'import__row import__row--header' : i < headerRow ? 'import__row import__row--above' : 'import__row'}
                        onClick={() => {
                          setHeaderRow(i)
                          setMapping(null)
                        }}
                      >
                        <span className="import__rowno" role="rowheader">
                          {i + 1}
                        </span>
                        {Array.from({ length: Math.min(12, Math.max(width, r.length)) }, (_v, c) => (
                          <span key={c} role="cell" className="import__cell" title={r[c]}>
                            {r[c] ?? ''}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                  <label className="field import__headerrow">
                    <span className="field__label">{T.importDialog.headerRow}</span>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={headerRow + 1}
                      onChange={(e) => {
                        setHeaderRow(Math.max(0, Number(e.target.value) - 1))
                        setMapping(null)
                      }}
                    />
                  </label>
                </>
              )}
            </>
          )}

          {step === 'columns' && (
            <>
              <label className="field">
                <span className="field__label">{T.importDialog.defaultType}</span>
                <select className="input" value={defaultType} onChange={(e) => setDefaultType(e.target.value)}>
                  {schema.itemTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="import__mapping" role="table" aria-label={T.importDialog.columnsLabel}>
                <div className="import__map import__map--head" role="row">
                  <span role="columnheader">{T.importDialog.column}</span>
                  <span role="columnheader">{T.importDialog.firstValues}</span>
                  <span role="columnheader">{T.importDialog.useAs}</span>
                </div>
                {Array.from({ length: Math.max(width, shownMapping?.length ?? 0) }, (_v, c) => (
                  <div key={c} className="import__map" role="row">
                    <span className="import__colname" role="cell">
                      {headers[c] || T.importDialog.unnamed(c + 1)}
                    </span>
                    <span className="import__values muted-inline" role="cell">
                      {sample
                        .slice(headerRow + 1, headerRow + 4)
                        .map((r) => r[c] ?? '')
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <select
                      className="input"
                      aria-label={T.importDialog.useAsFor(headers[c] || T.importDialog.unnamed(c + 1))}
                      value={shownMapping?.[c] ?? 'ignore'}
                      onChange={(e) => {
                        const next = [...(shownMapping ?? Array.from({ length: width }, () => 'ignore' as ImportTarget))]
                        // every target except "ignore" is used by one column only
                        const t = e.target.value as ImportTarget
                        if (t !== 'ignore') for (let i = 0; i < next.length; i++) if (next[i] === t) next[i] = 'ignore'
                        next[c] = t
                        setMapping(next)
                      }}
                    >
                      {targets.map((g) => (
                        <optgroup key={g.label} label={g.label}>
                          {g.options.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {data && <Counts data={data} />}
              {!hasContent && data && <p className="notice notice--warn">{T.importMsg.noTitleColumn}</p>}
            </>
          )}

          {step === 'check' && (
            <>
              {!data ? (
                <p className="muted" role="status">
                  {T.importDialog.checking}
                </p>
              ) : (
                <>
                  <Counts data={data} />
                  {data.problems.length > 0 ? (
                    <section className="import__problems" aria-label={T.importDialog.problems}>
                      <h3 className="links__title">{T.importDialog.problemsTitle(data.problems.length)}</h3>
                      <ul className="scroll">
                        {data.problems.map((p, i) => (
                          <li key={i} className={p.severity === 'error' ? 'import__problem import__problem--error' : 'import__problem'}>
                            <span className="import__rowno">{T.importDialog.rowLabel(p.row)}</span>
                            {p.column && <span className="muted-inline">{p.column}</span>}
                            <span>{p.message}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : (
                    <p className="statusbar__ok">{T.importDialog.noProblems}</p>
                  )}
                  <div className="import__preview scroll" role="table" aria-label={T.importDialog.previewLabel}>
                    {data.rows.slice(0, 100).map((r) => (
                      <div key={r.row} className="import__prow" role="row">
                        <span className="import__rowno" role="cell">
                          {r.row}
                        </span>
                        <span className={`import__action import__action--${r.action}`} role="cell">
                          {T.importDialog.actions[r.action]}
                        </span>
                        <span className="tree__id" role="cell">
                          {r.id}
                        </span>
                        <span className="muted-inline" role="cell">
                          {schema.itemTypes.find((t) => t.id === r.type)?.name ?? r.type}
                        </span>
                        <span className="import__ptitle" role="cell">
                          {r.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {error && <p className="notice notice--error" role="alert">{error}</p>}
        </div>
        <footer className="modal__footer actions actions--spread">
          <button type="button" className="btn" onClick={props.onClose}>
            {T.common.cancel}
          </button>
          <span className="actions">
            {step !== 'file' && (
              <button type="button" className="btn" onClick={() => setStep(step === 'check' ? 'columns' : 'file')}>
                {T.importDialog.back}
              </button>
            )}
            {step === 'file' && (
              <button type="button" className="btn btn--primary" disabled={!file || !sheetInfo || sheetInfo.rowCount === 0} onClick={() => setStep('columns')}>
                {T.importDialog.next}
              </button>
            )}
            {step === 'columns' && (
              <button type="button" className="btn btn--primary" disabled={!hasContent} onClick={() => setStep('check')}>
                {T.importDialog.next}
              </button>
            )}
            {step === 'check' && (
              <button type="button" className="btn btn--primary" disabled={busy || !data || !hasContent || data.counts.create + data.counts.update + data.extraLinks === 0} onClick={() => void run()}>
                {busy ? T.importDialog.importing : props.newProject ? T.importDialog.importCommit(data?.counts.create ?? 0) : T.importDialog.importRun((data?.counts.create ?? 0) + (data?.counts.update ?? 0))}
              </button>
            )}
          </span>
        </footer>
      </div>
    </div>
  )
}

function Counts({ data }: { data: ImportPreview }) {
  const c = data.counts
  return (
    <p className="import__counts" role="status">
      <span className="chip chip--static chip--added">{T.importDialog.countNew(c.create)}</span>
      <span className="chip chip--static chip--modified">{T.importDialog.countUpdate(c.update)}</span>
      <span className="chip chip--static">{T.importDialog.countSame(c.unchanged)}</span>
      {c.skip > 0 && <span className="chip chip--static chip--warn">{T.importDialog.countSkip(c.skip)}</span>}
      {data.extraLinks > 0 && <span className="chip chip--static">{T.importDialog.countLinks(data.extraLinks)}</span>}
    </p>
  )
}

/** Same rule as the core's guess: the first row with two or more short cells. */
function guessHeader(rows: string[][]): number {
  const i = rows.findIndex((r) => r.filter((c) => c.trim()).length >= 2 && r.every((c) => c.length <= 60))
  return i < 0 ? 0 : i
}

function targetOptions(schema: Schema): { label: string; options: { value: ImportTarget; label: string }[] }[] {
  const o = T.importDialog.targets
  return [
    {
      label: o.groupBasic,
      options: [
        { value: 'ignore', label: o.ignore },
        { value: 'id', label: o.id },
        { value: 'number', label: o.number },
        { value: 'title', label: o.title },
        { value: 'text', label: o.text },
        { value: 'type', label: o.type },
        { value: 'parent', label: o.parent },
        { value: 'level', label: o.level }
      ]
    },
    { label: o.groupFields, options: schema.fields.map((f) => ({ value: `field:${f.id}` as ImportTarget, label: f.name })) },
    {
      label: o.groupLinks,
      options: [
        { value: 'links', label: o.links },
        { value: 'linkedFrom', label: o.linkedFrom },
        ...schema.linkTypes.flatMap((l) => [
          { value: `link:${l.id}` as ImportTarget, label: o.linkOut(l.name) },
          { value: `linkFrom:${l.id}` as ImportTarget, label: o.linkIn(l.reverseName) }
        ])
      ]
    }
  ]
}
