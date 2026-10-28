import type { Schema } from '../../../../shared/domain'
import { T } from '../../../../shared/text'
import { ColumnsMenu } from '../FieldsPanel'
import type { ColumnPrefs } from '../ItemTable'
import type { Filters, LinkFilter } from './useFilters'

/** Search, filters, columns, export, expand/collapse and "New item" above the table. */
export function Toolbar(props: {
  schema: Schema
  filters: Filters
  prefs: ColumnPrefs
  onPrefs: (p: ColumnPrefs) => void
  onEditFields: () => void
  canExport: boolean
  onExport: () => void
  expanding: boolean
  onExpandAll: () => void
  onCollapseAll: () => void
  onNewItem: (type: string) => void
}) {
  const { schema, filters: f } = props
  const enumFields = schema.fields.filter((d) => d.type === 'enum' || d.type === 'list')
  const tw = T.workspace
  return (
    <div className="toolbar">
      <input className="input toolbar__search" type="search" placeholder={tw.searchPlaceholder} value={f.text} onChange={(e) => f.setText(e.target.value)} aria-label={tw.search} />
      <select className="input toolbar__filter" value={f.types} onChange={(e) => f.setTypes(e.target.value)} aria-label={tw.typeFilter}>
        <option value="">{tw.allTypes}</option>
        {schema.itemTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {enumFields.map((d) => (
        <select
          key={d.id}
          className="input toolbar__filter"
          value={f.fieldFilters[d.id] ?? ''}
          aria-label={d.name}
          onChange={(e) => f.setField(d.id, e.target.value)}
          disabled={d.type === 'list' && !d.options}
          hidden={d.type === 'list' && !d.options}
        >
          <option value="">{tw.fieldAny(d.name)}</option>
          {d.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ))}
      <select className="input toolbar__filter" value={f.linkFilter} onChange={(e) => f.setLinkFilter(e.target.value as LinkFilter)} aria-label={tw.linksFilter}>
        <option value="">{tw.linksAny}</option>
        <option value="suspect">{tw.linksSuspect}</option>
        <option value="none">{tw.linksNone}</option>
      </select>
      {f.filtered && (
        <button type="button" className="btn" onClick={f.clear}>
          {tw.clearFilters}
        </button>
      )}
      <ColumnsMenu schema={schema} prefs={props.prefs} onChange={props.onPrefs} onEditFields={props.onEditFields} />
      <button type="button" className="btn" onClick={props.onExport} disabled={!props.canExport} title={T.exportDialog.buttonTooltip}>
        {tw.export}
      </button>
      <span className="toolbar__spacer" />
      {!f.filtered && (
        <>
          <button type="button" className="btn" disabled={props.expanding} onClick={props.onExpandAll} title={tw.expandAllTooltip}>
            {props.expanding ? tw.expanding : tw.expandAll}
          </button>
          <button type="button" className="btn" onClick={props.onCollapseAll} title={tw.collapseAllTooltip}>
            {tw.collapseAll}
          </button>
        </>
      )}
      <select className="select-btn select-btn--primary" value="" onChange={(e) => props.onNewItem(e.target.value)} aria-label={tw.newItem}>
        <option value="">{tw.newItemOption}</option>
        {schema.itemTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  )
}
