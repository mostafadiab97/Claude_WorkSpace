import { useEffect, useState } from 'react'
import type { ImpactResult } from '../../../shared/api'
import type { Schema } from '../../../shared/domain'
import { T } from '../../../shared/text'
import { errorMessage } from '../lib/hooks'
import { linkName, typeName } from '../lib/schema'

/**
 * The Impact tab of the editor (theme 1b — the owner's decision T-06): everything that depends on the item, all levels
 * down, as an indented tree — items linked to it (verifies, refines…; not "relates to") and the items below it.
 */
export function ImpactView(props: { schema: Schema; itemId: string; reloadToken: number; onOpen: (id: string) => void }) {
  const [r, setR] = useState<ImpactResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    window.reqochet.getImpact(props.itemId).then(
      (x) => {
        if (!live) return
        setR(x)
        setError(null)
      },
      (e: unknown) => live && setError(errorMessage(e))
    )
    return () => {
      live = false
    }
  }, [props.itemId, props.reloadToken])
  if (error) return <p className="notice notice--error" role="alert">{error}</p>
  if (!r) return <p className="muted" role="status">{T.trace.loading}</p>
  // the tree order: each node right after the one it hangs under (the core lists them level by level)
  const kids = new Map<string, ImpactResult['nodes']>()
  for (const n of r.nodes) kids.set(n.parent, [...(kids.get(n.parent) ?? []), n])
  const ordered: ImpactResult['nodes'] = []
  const walk = (id: string): void => {
    for (const n of kids.get(id) ?? []) {
      ordered.push(n)
      walk(n.id)
    }
  }
  walk(props.itemId)
  return (
    <section className="impact" aria-label={T.trace.impactTab}>
      <p className="muted-inline">{T.trace.impactHint}</p>
      {r.nodes.length === 0 ? (
        <p className="muted">{T.trace.impactNone}</p>
      ) : (
        <>
          <p>{T.trace.impactCount(r.nodes.length)}</p>
          {r.truncated && <p className="notice notice--warn">{T.trace.impactTruncated(r.nodes.length)}</p>}
          <ul className="impact__tree" role="tree" aria-label={T.trace.impactTab}>
            {ordered.slice(0, 1000).map((n) => (
              <li key={n.id} role="treeitem" aria-level={n.depth} aria-selected={false} className="impact__node" style={{ paddingInlineStart: `calc(${n.depth - 1} * var(--rm-space-lg))` }}>
                <span className="impact__via">{n.via === 'child' ? T.trace.impactChild : linkName(props.schema, n.via)}</span>
                {n.suspect && (
                  <span className="impact__suspect" role="img" aria-label={T.trace.impactSuspect} title={T.trace.impactSuspect}>
                    ⚠
                  </span>
                )}
                <button type="button" className="link-btn" onClick={() => props.onOpen(n.id)}>
                  {n.number ? `${n.number} ` : ''}
                  {n.id}
                </button>
                <span dir="auto">{n.title || T.common.noTitle}</span>
                <span className="muted-inline">{typeName(props.schema, n.type)}</span>
              </li>
            ))}
            {ordered.length > 1000 && <li className="muted-inline">{T.trace.notShown(ordered.length - 1000)}</li>}
          </ul>
        </>
      )}
    </section>
  )
}
