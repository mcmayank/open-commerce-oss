'use client'

import React from 'react'
import { useForm, useFormFields } from '@payloadcms/ui'
import { layerTitle, TITLE_FIELDS } from '@/lib/page-builder/layer-title'
import type { BlockEntitlements } from '@/mcp/blocks'
import { usePremiumEntitlement } from '../PremiumEntitlement/PremiumEntitlementClient'
import { useSelection } from './selection'
import { BlockLibrary, labelForBlockType, isBlockLocked } from './BlockLibrary'

type Row = {
  id: string
  blockType?: string
}

type FieldCell = { value?: unknown }

const GENERIC_INSERT_LABEL = 'Add section'

/**
 * Left pane of the Phase 3b page builder — a content-first "layers" rail
 * (Task 8), replacing the outline the builder shipped with in Task 5. That
 * earlier outline led every row with the block's TYPE ("Hero", "FAQ"); this
 * rail leads with the block's own words (`layerTitle`, Task 7) and shows the
 * type as quiet metadata instead, so the rail reads like the page rather than
 * like a schema.
 *
 * ADD BECOMES PLACEMENT: the outline split "add a block" and "choose where it
 * goes" into two gestures — open a standing library panel, then rely on
 * whichever row happened to be selected to decide the insertion point. This
 * rail collapses that into one gesture: a "+" affordance sits in every gap
 * between rows (and at the very top and bottom), labelled with the row it
 * would land after, and opens `BlockLibrary` as a popover bound to exactly
 * that index (`BlockLibrary`'s new `rowIndex` prop, Task 8).
 *
 * Only the gaps BETWEEN two existing rows carry a row's title in their label
 * ("Insert a section after Hero") — the leading and trailing gaps use the
 * generic "Add section" instead of "after {the only row}"/"after {the last
 * row}". That's not just a copy choice: a single-row page's only row and its
 * trailing gap would otherwise render near-identical text ("Fresh from the
 * oven, daily" / "Insert a section after Fresh from the oven, daily"), which
 * is confusable for a merchant and (worse) ambiguous for anything that
 * queries the rail by that row's own text.
 *
 * Read each row's own field values with `useFormFields` selecting
 * `layout.<i>.<field>` for each of `layerTitle`'s `TITLE_FIELDS` — the same
 * flat, dotted-path field-state shape the earlier outline already relied on
 * for `layout.rows` (Payload's own `fieldReducer.js` keys form state this
 * way).
 *
 * `moveFieldRow` / `removeFieldRow` calls are copied verbatim from that
 * outline — they use Payload's rows API rather than replacing the whole
 * array, which is what keeps untouched rows' sub-field state intact. The
 * up/down buttons stay as the keyboard-accessible reorder path alongside the
 * new HTML5 drag-and-drop reorder, per Task 8's brief: drag must never be the
 * *only* way to reorder.
 *
 * Locking reuses `isBlockLocked` (`BlockLibrary.tsx`), itself built on
 * `blockAvailable` (`@/mcp/blocks`) — the one entitlement source `list_blocks`
 * and the library already check — so a row added before a downgrade shows the
 * same lock the library would show if you tried to add it again today.
 */
export function LayersRail() {
  const { moveFieldRow, removeFieldRow } = useForm()
  const fields = (useFormFields(([f]) => f) ?? {}) as Record<string, unknown>
  const rows = ((fields.layout as { rows?: Row[] } | undefined)?.rows ?? []) as Row[]
  const { selectedId, select } = useSelection()
  const { premiumSections, customSections } = usePremiumEntitlement()
  const entitlements: BlockEntitlements = { premiumSections, customSections }

  // Which insertion gap's popover is open, identified by the `layout` index a
  // new row would land at. `null` means no popover is open. A gap's index is
  // only meaningful for the row count it was opened against — removing a row
  // shifts every later index out from under an open popover, so a stale index
  // (now past the last valid gap) is treated as closed here rather than
  // tracked and re-mapped; the merchant can reopen the gap that's actually
  // still there. Derived at render rather than synchronized via an effect —
  // there's no external system to synchronize with here, just a value that's
  // sometimes stale.
  const [openGapState, setOpenGapState] = React.useState<number | null>(null)
  const openGap = openGapState !== null && openGapState <= rows.length ? openGapState : null
  const closeGap = React.useCallback(() => setOpenGapState(null), [])

  // Not memoized: it's a plain read of the already-computed `fields` object,
  // not expensive enough to warrant `useCallback`'s own overhead, and `fields`
  // itself isn't referentially stable across renders (see `useFormFields`
  // above) so memoizing here would just recompute every time anyway.
  const valuesForRow = (index: number): Record<string, unknown> => {
    const values: Record<string, unknown> = {}
    for (const key of TITLE_FIELDS) {
      const cell = fields[`layout.${index}.${key}`] as FieldCell | undefined
      if (cell && typeof cell === 'object' && 'value' in cell) {
        values[key] = cell.value
      }
    }
    return values
  }

  const titleForRow = (row: Row, index: number) => layerTitle(valuesForRow(index), labelForBlockType(row.blockType))

  const handleRemove = (rowIndex: number, rowId: string) => {
    removeFieldRow({ path: 'layout', rowIndex })
    if (selectedId === rowId) {
      select(null)
    }
  }

  const handleDrop = (targetIndex: number) => (event: React.DragEvent<HTMLLIElement>) => {
    event.preventDefault()
    const fromRaw = event.dataTransfer.getData('text/plain')
    const fromIndex = Number(fromRaw)
    if (fromRaw === '' || Number.isNaN(fromIndex) || fromIndex === targetIndex) return
    moveFieldRow({ path: 'layout', moveFromIndex: fromIndex, moveToIndex: targetIndex })
  }

  const insertionGap = (index: number, label: string) => (
    <li className="nb-pb-layers__gap" key={`gap-${index}`}>
      <button
        type="button"
        className="nb-pb-layers__insert"
        aria-expanded={openGap === index}
        onClick={() => setOpenGapState(openGap === index ? null : index)}
      >
        <span aria-hidden="true">+</span> {label}
      </button>
      {openGap === index ? (
        <div className="nb-pb-layers__popover">
          <BlockLibrary rowIndex={index} onAdd={closeGap} />
        </div>
      ) : null}
    </li>
  )

  if (rows.length === 0) {
    return (
      <div className="nb-pb-layers nb-pb-layers--empty">
        <p className="nb-pb-layers__empty-copy">No sections yet.</p>
        <button
          type="button"
          className="nb-pb-layers__insert nb-pb-layers__insert--empty"
          aria-expanded={openGap === 0}
          onClick={() => setOpenGapState(openGap === 0 ? null : 0)}
        >
          <span aria-hidden="true">+</span> {GENERIC_INSERT_LABEL}
        </button>
        {openGap === 0 ? (
          <div className="nb-pb-layers__popover">
            <BlockLibrary rowIndex={0} onAdd={closeGap} />
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <ul className="nb-pb-layers">
      {insertionGap(0, GENERIC_INSERT_LABEL)}
      {rows.map((row, index) => {
        const isSelected = row.id === selectedId
        const title = titleForRow(row, index)
        const locked = isBlockLocked(row.blockType, entitlements)
        const nextGapLabel =
          index < rows.length - 1 ? `Insert a section after ${title}` : GENERIC_INSERT_LABEL

        return (
          <React.Fragment key={row.id}>
            <li
              className={`nb-pb-layers__row${isSelected ? ' is-selected' : ''}`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', String(index))
                event.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop(index)}
            >
              <button
                type="button"
                className="nb-pb-layers__row-btn"
                aria-current={isSelected ? 'true' : undefined}
                onClick={() => select(row.id)}
              >
                <span className="nb-pb-layers__title">{title}</span>
                <span className="nb-pb-layers__type">
                  {' · '}
                  {row.blockType}
                  {locked ? (
                    <span
                      className="nb-pb-layers__lock"
                      aria-label="Locked — upgrade required"
                      title="Upgrade required"
                    >
                      &#128274;
                    </span>
                  ) : null}
                </span>
              </button>
              <span className="nb-pb-layers__actions">
                <button
                  type="button"
                  aria-label="Move up"
                  className="nb-pb-layers__icon-btn"
                  disabled={index === 0}
                  onClick={() => moveFieldRow({ path: 'layout', moveFromIndex: index, moveToIndex: index - 1 })}
                >
                  &#8593;
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  className="nb-pb-layers__icon-btn"
                  disabled={index === rows.length - 1}
                  onClick={() => moveFieldRow({ path: 'layout', moveFromIndex: index, moveToIndex: index + 1 })}
                >
                  &#8595;
                </button>
                <button
                  type="button"
                  aria-label="Remove block"
                  className="nb-pb-layers__icon-btn nb-pb-layers__icon-btn--remove"
                  onClick={() => handleRemove(index, row.id)}
                >
                  &#215;
                </button>
              </span>
            </li>
            {insertionGap(index + 1, nextGapLabel)}
          </React.Fragment>
        )
      })}
    </ul>
  )
}
