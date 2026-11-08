import { useState } from 'react'
import type { RepoInfo } from '../../../shared/api'
import type { CoverageRule } from '../../../shared/domain'
import { T } from '../../../shared/text'
import { errorMessage } from '../lib/hooks'
import { linkLabel, ruleText, typeLabel } from '../lib/schema'

type Draft = CoverageRule & { key: number }
let nextKey = 1

/** A rule id from its parts, unique in the list ("system-requirement-verifies-incoming-2"). */
const ruleId = (r: Omit<CoverageRule, 'id'>, taken: Set<string>): string => {
  const base = `${r.type}-${r.link}-${r.direction}`
  let id = base
  for (let k = 2; taken.has(id); k++) id = `${base}-${k}`
  return id
}

/**
 * The Rules tab of the item-types window (theme 1b — the owner's decision T-03): what a complete project looks like.
 * Saved into schema.yaml (`rules:`) and shared through Git; the app only warns (T-04).
 */
export function RulesPanel(props: { info: RepoInfo; onSaved: (i: RepoInfo) => void; onDirty: (dirty: boolean) => void; footer: (save: React.ReactNode) => React.ReactNode }) {
  const schema = props.info.schema
  const [rules, setRules] = useState<Draft[]>(() => (schema.rules ?? []).map((r) => ({ ...r, key: nextKey++ })))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const types = schema.itemTypes
  const change = (next: Draft[]): void => {
    setRules(next)
    props.onDirty(true)
  }
  const patch = (key: number, p: Partial<CoverageRule>): void => change(rules.map((r) => (r.key === key ? { ...r, ...p } : r)))
  const save = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const taken = new Set<string>()
      const plain = rules.map(({ key: _key, ...r }) => {
        void _key
        const id = ruleId(r, taken)
        taken.add(id)
        return { ...r, id, ...(r.from?.length ? { from: r.from } : {}) }
      })
      const r = await window.reqochet.saveSchemaRules(plain, props.info.schemaRevision)
      if (!r.ok) setError(r.message)
      else {
        props.onDirty(false)
        props.onSaved(r.info)
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const starter = async (): Promise<void> => {
    // the starter set comes from the core, so it is the same as for a new project
    const r = await window.reqochet.starterRules()
    change([...rules, ...r.filter((x) => !rules.some((y) => y.type === x.type && y.link === x.link && y.direction === x.direction)).map((x) => ({ ...x, key: nextKey++ }))])
  }
  return (
    <>
      <div className="modal__body scroll">
        <p className="muted">{T.trace.rulesHint}</p>
        {rules.length === 0 && <p className="muted">{T.trace.rulesNone}</p>}
        <ul className="rules">
          {rules.map((r) => (
            <li key={r.key} className="rules__row">
              <p className="rules__text" dir="auto">
                {ruleText(schema, r)}
              </p>
              <div className="rules__fields">
                <label className="field">
                  <span className="field__label">{T.trace.ruleType}</span>
                  <select className="input" value={r.type} onChange={(e) => patch(r.key, { type: e.target.value })}>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {typeLabel(t)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">{T.trace.ruleDirection}</span>
                  <select className="input" value={r.direction} onChange={(e) => patch(r.key, { direction: e.target.value as CoverageRule['direction'] })}>
                    <option value="incoming">{T.trace.ruleIncoming}</option>
                    <option value="outgoing">{T.trace.ruleOutgoing}</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">{T.trace.ruleLink}</span>
                  <select className="input" value={r.link} onChange={(e) => patch(r.key, { link: e.target.value })}>
                    {schema.linkTypes.map((l) => (
                      <option key={l.id} value={l.id}>
                        {linkLabel(l, r.direction === 'incoming')}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">{T.trace.ruleFrom}</span>
                  <select className="input" value={r.from?.length === 1 ? r.from[0] : r.from?.length ? '*multi' : ''} onChange={(e) => patch(r.key, e.target.value === '*multi' ? {} : { from: e.target.value ? [e.target.value] : [] })}>
                    <option value="">{T.trace.ruleAnyType}</option>
                    {(r.from?.length ?? 0) > 1 && <option value="*multi">{(r.from ?? []).map((f) => typeLabel(types.find((t) => t.id === f) ?? { id: f, name: f, requirement: true })).join(' / ')}</option>}
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {typeLabel(t)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field rules__min">
                  <span className="field__label">{T.trace.ruleMin}</span>
                  <input className="input" type="number" min={1} max={99} value={r.min} onChange={(e) => patch(r.key, { min: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })} />
                </label>
                <label className="field">
                  <span className="field__label">{T.trace.ruleLevel}</span>
                  <select className="input" value={r.level} title={T.trace.levelTooltip} onChange={(e) => patch(r.key, { level: e.target.value as CoverageRule['level'] })}>
                    <option value="warning">{T.trace.levelWarning}</option>
                    <option value="error">{T.trace.levelError}</option>
                  </select>
                </label>
                <button type="button" className="icon-btn" aria-label={T.trace.ruleRemove(ruleText(schema, r))} title={T.trace.ruleRemove(ruleText(schema, r))} onClick={() => change(rules.filter((x) => x.key !== r.key))}>
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="actions">
          <button
            type="button"
            className="btn btn--small"
            onClick={() => change([...rules, { key: nextKey++, id: '', type: types.find((t) => t.requirement !== false)?.id ?? types[0]?.id ?? '', link: schema.linkTypes[0]?.id ?? '', direction: 'incoming', min: 1, level: 'warning' }])}
          >
            {T.trace.ruleAdd}
          </button>
          <button type="button" className="btn btn--small" onClick={() => void starter()}>
            {T.trace.starterAdd}
          </button>
        </div>
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
      </div>
      {props.footer(
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void save()}>
          {T.common.save}
        </button>
      )}
    </>
  )
}
