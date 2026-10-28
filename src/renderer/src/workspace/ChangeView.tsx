import type { ItemDiff, Link, Schema } from '../../../shared/domain'
import { linkName } from '../lib/schema'
import { T } from '../../../shared/text'

/** What one change did to one item: changed fields (before → after), the text, links added and removed. */
export function ChangeView({ schema, diff, unreadable }: { schema: Schema; diff: ItemDiff; unreadable?: string | undefined }) {
  const links = (ls: Link[], sign: string): string[] => ls.map((l) => `${sign} ${linkName(schema, l.type)} ${l.target}`)
  const nothing = diff.rows.length === 0 && !diff.text && diff.linksAdded.length === 0 && diff.linksRemoved.length === 0
  return (
    <section className="change" aria-label={T.change.label}>
      <h4 className="links__title">{diff.kind === 'added' ? T.change.created : diff.kind === 'deleted' ? T.change.deleted : T.change.changed}</h4>
      {unreadable && <p className="notice notice--warn">{T.change.unreadable(unreadable)}</p>}
      {nothing && <p className="muted-inline">{T.change.nothing}</p>}
      {diff.rows.length > 0 && (
        <table className="change__table">
          <thead>
            <tr>
              <th scope="col">{T.change.field}</th>
              {diff.kind !== 'added' && <th scope="col">{T.change.before}</th>}
              <th scope="col">{diff.kind === 'added' ? T.change.value : T.change.after}</th>
            </tr>
          </thead>
          <tbody>
            {diff.rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.label}</th>
                {diff.kind !== 'added' && <td className="change__before">{r.before || '—'}</td>}
                <td className="change__after">{r.after || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {diff.text && (
        <div className="change__text">
          <span className="field__label">{T.change.text}</span>
          {diff.kind !== 'added' && <pre className="change__before">{diff.text.before || T.change.empty}</pre>}
          <pre className="change__after">{diff.text.after || T.change.empty}</pre>
        </div>
      )}
      {(diff.linksAdded.length > 0 || diff.linksRemoved.length > 0) && (
        <ul className="change__links">
          {links(diff.linksAdded, '+').map((t) => (
            <li key={t} className="change__after">{t}</li>
          ))}
          {links(diff.linksRemoved, '−').map((t) => (
            <li key={t} className="change__before">{t}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
