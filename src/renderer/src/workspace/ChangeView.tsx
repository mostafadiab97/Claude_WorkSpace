import type { ItemDiff, Link, Schema } from '../../../shared/domain'
import { linkName } from '../lib/schema'

/** What one change did to one item: changed fields (before → after), the text, links added and removed. */
export function ChangeView({ schema, diff, unreadable }: { schema: Schema; diff: ItemDiff; unreadable?: string | undefined }) {
  const links = (ls: Link[], sign: string): string[] => ls.map((l) => `${sign} ${linkName(schema, l.type)} ${l.target}`)
  const nothing = diff.rows.length === 0 && !diff.text && diff.linksAdded.length === 0 && diff.linksRemoved.length === 0
  return (
    <section className="change" aria-label="What changed">
      <h4 className="links__title">{diff.kind === 'added' ? 'Created with' : diff.kind === 'deleted' ? 'Deleted' : 'What changed'}</h4>
      {unreadable && <p className="notice notice--warn">One version could not be read: {unreadable}</p>}
      {nothing && <p className="muted-inline">Nothing visible changed (e.g. only a link confirmation or formatting).</p>}
      {diff.rows.length > 0 && (
        <table className="change__table">
          <thead>
            <tr>
              <th scope="col">Field</th>
              {diff.kind !== 'added' && <th scope="col">Before</th>}
              <th scope="col">{diff.kind === 'added' ? 'Value' : 'After'}</th>
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
          <span className="field__label">Text</span>
          {diff.kind !== 'added' && <pre className="change__before">{diff.text.before || '(empty)'}</pre>}
          <pre className="change__after">{diff.text.after || '(empty)'}</pre>
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
