import { fieldLabel, optionLabel, typeLabel } from '../../lib/schema'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { Schema } from '../../../../shared/domain'
import { T } from '../../../../shared/text'
import { ColumnsMenu } from '../FieldsPanel'
import type { ColumnPrefs } from '../ItemTable'
import type { Filters, LinkFilter } from './useFilters'
import { useFeature } from '../../lib/features'
import { Icon } from '../../components/icons'
import { MenuButton } from '../../components/MenuButton'
import { useSessionState } from '../../lib/sessionState'

/** Keys shown in tooltips (language-neutral; 0.23.0). */
export const KEYS = { search: 'Ctrl+F', filters: 'Ctrl+Shift+F', expand: 'Ctrl+Shift+↓', collapse: 'Ctrl+Shift+↑', newItem: 'Ctrl+N', newDocument: 'Ctrl+Shift+N', rename: 'F2' }

type Where = 'after' | 'inside' | 'end'

/**
 * The bar above the table (0.23.0, the owner's ideas of 13 Nov and Fable's review): search · outline (Expand / Collapse
 * all, the line that would do nothing greyed out) · Filters (icon + count) · View (rows and columns) · More (Import,
 * Export) · New item (a small panel: type and place, then the editor). The document button sits before it (DocumentBar).
 */
export function Toolbar({ searchRef, newRef, ...props }: {
  /** For the keyboard: Ctrl+F focuses the search, Ctrl+N opens "New item" (UX-25). */
  searchRef?: RefObject<HTMLInputElement | null>
  newRef?: RefObject<HTMLButtonElement | null>
  /** Ctrl+Shift+F opens the filters (0.23.0). */
  filtersRef?: RefObject<HTMLButtonElement | null>
  schema: Schema
  filters: Filters
  prefs: ColumnPrefs
  onPrefs: (p: ColumnPrefs) => void
  onEditFields: () => void
  /** Opens the item and link types (S-04). */
  onEditTypes: () => void
  canExport: boolean
  onExport: () => void
  onImport: () => void
  expanding: boolean
  onExpandAll: () => void
  onCollapseAll: () => void
  /** Fully open, fully closed or mixed — read when the outline menu opens. */
  outline: () => 'open' | 'closed' | 'mixed'
  onNewItem: (type: string) => void
  /** Where a new item goes (the owner, 5 Nov 2026). */
  newWhere: Where
  /** An old version is shown (D-19b): no new items, no import. */
  readOnly?: boolean
  onNewWhere: (w: Where) => void
  hasSelection: boolean
}) {
  const { schema, filters: f } = props
  const enumFields = schema.fields.filter((d) => d.type === 'enum' || d.type === 'list')
  const tw = T.workspace
  const importOn = useFeature('import')
  const exportOn = useFeature('export')
  const activeCount = (f.types ? 1 : 0) + Object.values(f.fieldFilters).filter(Boolean).length + (f.linkFilter ? 1 : 0)
  const showMore = (importOn && !props.readOnly) || exportOn
  return (
    <div className="toolbar">
      <input ref={searchRef} className="input toolbar__search" type="search" placeholder={tw.searchPlaceholder} value={f.text} onChange={(e) => f.setText(e.target.value)} aria-label={tw.search} title={tw.keyHint(tw.searchTooltip, KEYS.search)} data-toolbar-item="" />
      {/* T-2 a: one outline button; while a filter is on the list is flat, so both lines grey out (the bar keeps its shape) */}
      <MenuButton
        label={tw.outline}
        icon="expandAll"
        disabled={props.expanding}
        title={props.expanding ? tw.expanding : tw.outline}
        entries={() => {
          const state = f.filtered ? 'flat' : props.outline()
          return [
            { kind: 'item', label: tw.keyHint(tw.expandAll, KEYS.expand), icon: 'expandAll', disabled: state === 'open' || state === 'flat', onSelect: props.onExpandAll },
            { kind: 'item', label: tw.keyHint(tw.collapseAll, KEYS.collapse), icon: 'collapseAll', disabled: state === 'closed' || state === 'flat', onSelect: props.onCollapseAll }
          ]
        }}
      />
      <FilterMenu active={activeCount} buttonRef={props.filtersRef}>
      <select className="input" value={f.types} onChange={(e) => f.setTypes(e.target.value)} aria-label={tw.typeFilter}>
        <option value="">{tw.allTypes}</option>
        {schema.itemTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {typeLabel(t)}
          </option>
        ))}
      </select>
      {enumFields.map((d) => (
        <select
          key={d.id}
          className="input"
          value={f.fieldFilters[d.id] ?? ''}
          aria-label={fieldLabel(d)}
          onChange={(e) => f.setField(d.id, e.target.value)}
          disabled={d.type === 'list' && !d.options}
          hidden={d.type === 'list' && !d.options}
        >
          <option value="">{tw.fieldAny(fieldLabel(d))}</option>
          {d.options?.map((o) => (
            <option key={o} value={o}>
              {optionLabel(d, o)}
            </option>
          ))}
        </select>
      ))}
      <select className="input" value={f.linkFilter} onChange={(e) => f.setLinkFilter(e.target.value as LinkFilter)} aria-label={tw.linksFilter}>
        <option value="">{tw.linksAny}</option>
        <option value="suspect">{tw.linksSuspect}</option>
        <option value="none">{tw.linksNone}</option>
        <option value="incomplete" title={tw.incompleteTip}>
          {tw.incomplete}
        </option>
        <option value="gaps" title={T.trace.filterTooltip}>
          {T.trace.filter}
        </option>
      </select>
      </FilterMenu>
      {f.filtered && (
        <button type="button" className="btn btn--clear-filters" onClick={f.clear} data-toolbar-item="">
          {tw.clearFilters}
        </button>
      )}
      {/* T-4: Columns and Show text are one "View" pop-up — both answer "how does the table look" */}
      <ColumnsMenu
        schema={schema}
        prefs={props.prefs}
        onChange={props.onPrefs}
        onEditFields={props.onEditFields}
        onEditTypes={props.onEditTypes}
        viewButton={{ label: tw.view, title: tw.view }}
        top={
          <fieldset className="view-rows">
            <legend className="sr-only">{tw.showText}</legend>
            <label className="check" title={tw.showTextTooltip}>
              <input type="radio" name="view-rows" checked={props.prefs.oneLine !== true} onChange={() => props.onPrefs({ ...props.prefs, oneLine: false })} />
              {tw.rowsText}
            </label>
            <label className="check">
              <input type="radio" name="view-rows" checked={props.prefs.oneLine === true} onChange={() => props.onPrefs({ ...props.prefs, oneLine: true })} />
              {tw.rowsOneLine}
            </label>
          </fieldset>
        }
      />
      {showMore && (
        <MenuButton
          label={tw.more}
          icon="more"
          entries={() => [
            ...(importOn && !props.readOnly ? [{ kind: 'item' as const, label: T.importDialog.button, hint: T.importDialog.buttonTooltip, onSelect: props.onImport }] : []),
            ...(exportOn ? [{ kind: 'item' as const, label: tw.export, hint: T.exportDialog.buttonTooltip, disabled: !props.canExport, onSelect: props.onExport }] : [])
          ]}
        />
      )}
      <span className="toolbar__spacer" />
      {!props.readOnly && <NewItemButton buttonRef={newRef} schema={schema} where={props.hasSelection ? props.newWhere : 'end'} hasSelection={props.hasSelection} onWhere={props.onNewWhere} onCreate={props.onNewItem} />}
    </div>
  )
}

/**
 * T-3 a: "New item" opens a small panel — the type (the last one used is chosen) and the place — then the draft opens in
 * the editor as before (the editor holds title, text and every other field). Enter creates, Esc cancels.
 */
function NewItemButton(props: { buttonRef?: RefObject<HTMLButtonElement | null>; schema: Schema; where: Where; hasSelection: boolean; onWhere: (w: Where) => void; onCreate: (type: string) => void }) {
  const tw = T.workspace
  const [open, setOpen] = useState(false)
  const [type, setType] = useSessionState('newItem.type', props.schema.itemTypes[0]?.id ?? '')
  const box = useRef<HTMLDivElement>(null)
  const ownRef = useRef<HTMLButtonElement>(null)
  const btn = props.buttonRef ?? ownRef
  const types = props.schema.itemTypes
  const chosen = types.some((t) => t.id === type) ? type : (types[0]?.id ?? '')
  useEffect(() => {
    if (!open) return
    box.current?.querySelector<HTMLSelectElement>('select')?.focus()
    const onDown = (e: MouseEvent): void => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  const close = (): void => {
    setOpen(false)
    btn.current?.focus()
  }
  const places: { value: Where; label: string; off: boolean }[] = [
    { value: 'after', label: tw.newAfter, off: !props.hasSelection },
    { value: 'inside', label: tw.newInside, off: !props.hasSelection },
    { value: 'end', label: tw.newEnd, off: false }
  ]
  return (
    <div className="menu-btn new-item" ref={box}>
      <button ref={btn} type="button" className={`btn btn--primary new-item__btn${open ? ' is-open' : ''}`} aria-haspopup="dialog" aria-expanded={open} title={tw.keyHint(tw.newItemTooltip, KEYS.newItem)} data-toolbar-item="" onClick={() => setOpen((o) => !o)}>
        <Icon name="plus" />
        <span className="new-item__word">{tw.newItem}</span>
      </button>
      {open && (
        <form
          className="menu-btn__panel new-item__panel"
          role="dialog"
          aria-label={tw.newPanel}
          onSubmit={(e) => {
            e.preventDefault()
            if (!chosen) return
            setOpen(false)
            props.onCreate(chosen)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              close()
            }
          }}
        >
          <label className="new-item__field">
            <span>{tw.newType}</span>
            <select className="input" value={chosen} onChange={(e) => setType(e.target.value)}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="new-item__places" title={props.hasSelection ? tw.newWhereTooltip : tw.newWhereNone}>
            <legend>{tw.newPlace}</legend>
            {places.map((p) => (
              <label key={p.value} className="check">
                <input type="radio" name="new-item-place" disabled={p.off} checked={props.where === p.value} onChange={() => props.onWhere(p.value)} />
                {p.label}
              </label>
            ))}
          </fieldset>
          <div className="actions">
            <button type="submit" className="btn btn--primary" disabled={!chosen}>
              {T.documents.create}
            </button>
            <button type="button" className="btn" onClick={close}>
              {T.common.cancel}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

/** The filters in a pop-up (0.13.0: the toolbar fits in one row); the button shows how many are active. */
function FilterMenu({ active, children, buttonRef }: { active: number; children: ReactNode; buttonRef?: RefObject<HTMLButtonElement | null> }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const ownRef = useRef<HTMLButtonElement>(null)
  const btnRef = buttonRef ?? ownRef
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      setOpen(false)
      btnRef.current?.focus() // back on the button, not lost (code review 0.23.0 C-4)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, btnRef])
  return (
    <div className="filters" ref={box}>
      {/* T-4: an icon with its count; the count is spoken too ("Filters, 2") */}
      <button ref={btnRef} type="button" className={open ? 'icon-btn is-open filters__btn' : 'icon-btn filters__btn'} aria-expanded={open} aria-haspopup="dialog" aria-label={active > 0 ? `${T.workspace.filters}, ${active}` : T.workspace.filters} onClick={() => setOpen((v) => !v)} title={T.workspace.keyHint(T.workspace.filtersTooltip, KEYS.filters)} data-toolbar-item="">
        <Icon name="filter" />
        {active > 0 && <span className="filters__count">{active}</span>}
      </button>
      {open && (
        <div className="filters__panel" role="group" aria-label={T.workspace.filters}>
          {children}
        </div>
      )}
    </div>
  )
}
