'use client'

import React from 'react'
import type { useForm } from '@payloadcms/ui'
import type { BlockStyle } from '@/lib/block-style/vocabulary'

/**
 * Selection-overlay handlers (Task 9) — reorder, duplicate, delete. All three
 * are form-state operations `PageBuilderShell` already owns via the exact
 * same `useForm()` primitives `LayersRail` uses; `SelectionOverlay` itself
 * only ever calls the functions this hook returns, never posts a bridge
 * message.
 *
 * `moveFieldRow`/`dispatchFields`/`removeFieldRow`/`setModified` are taken as
 * a TYPE-ONLY import of `useForm`'s return shape, not as a call to `useForm()`
 * itself — the caller (`PageBuilderShell`, already inside a `<Form>`) calls
 * `useForm()` and passes the pieces in. That keeps this module free of any
 * RUNTIME dependency on `@payloadcms/ui`, whose client barrel transitively
 * imports a `.css` file vitest's default transform rejects — the same reason
 * `useBuilderFormState.ts` and `useRailGrip.ts` were split out of
 * `PageBuilderView.tsx`, and what lets this hook (and its handlers) be unit
 * tested at all.
 *
 * DUPLICATE — `dispatchFields({ type: 'DUPLICATE_ROW', path, rowIndex })` is
 * the exact mechanism Payload's own Blocks field uses for its "Duplicate" row
 * action (`node_modules/@payloadcms/ui/dist/fields/Blocks/index.js`): it
 * deep-copies the row's sub-field state (real content, not just the block
 * type) and gives the new row/nested-id fields fresh ids
 * (`fieldReducer.js`'s `DUPLICATE_ROW` case). An earlier version of this hook
 * called `addFieldRow` with no `subFieldState` instead — the same call
 * `BlockLibrary`'s "Add" makes — which inserts an EMPTY row of the same block
 * type. That made a control labelled "Duplicate" produce an empty block next
 * to a filled-in one, which is a bug, not a design choice: `setModified(true)`
 * mirrors the stock Blocks field's own call (dispatching alone doesn't mark
 * the form modified).
 *
 * STYLE COPY (final-review Important 1) — `DUPLICATE_ROW` deep-copies the
 * row's own sub-field state (real content), but a block's visual style lives
 * OUTSIDE the row entirely: `blockStyles` is a page-level map keyed by row
 * id (see `BlockInspector.tsx`), a different field this hook has no reach
 * into via `dispatchFields`/`moveFieldRow`/`removeFieldRow` alone. Left
 * alone, the new row has no `blockStyles` entry and renders at theme/store
 * defaults — a merchant styles a Hero, clicks Duplicate, and gets the right
 * words in the wrong skin.
 *
 * The new row lands deterministically at `rowIndex + 1`
 * (`fieldReducer.js`'s `DUPLICATE_ROW` case), but `dispatchFields` doesn't
 * hand back the fresh row id synchronously — the reducer runs through
 * `<Form>`'s own state, and this hook only sees the result on its NEXT
 * render, once the caller's `rows` prop (subscribed via `useFormFields`)
 * reflects it. So `handleDuplicate` records the source id and the
 * PRE-duplicate row count in a ref, and an effect watches `rows` for the
 * length to grow past that count before reading the new neighbor's id out of
 * `rows[sourceIndex + 1]` and copying `blockStyles[sourceId]` onto it.
 *
 * Skips the write entirely when the source block has no style entry at all —
 * copying `undefined` would otherwise plant a spurious empty `{}` for a
 * block nobody ever styled, which `setBlockStyleInMap` elsewhere in this
 * codebase treats as meaningfully different from "no entry" (an empty-vs-
 * absent distinction `panel.ts` is deliberate about).
 */
export function useSelectionActions({
  rows,
  selectedId,
  select,
  moveFieldRow,
  dispatchFields,
  removeFieldRow,
  setModified,
  blockStyles,
  setBlockStyles,
}: {
  rows: Array<{ id: string; blockType?: string }>
  selectedId: string | null
  select: (id: string | null) => void
  moveFieldRow: ReturnType<typeof useForm>['moveFieldRow']
  dispatchFields: ReturnType<typeof useForm>['dispatchFields']
  removeFieldRow: ReturnType<typeof useForm>['removeFieldRow']
  setModified: ReturnType<typeof useForm>['setModified']
  /** The page-level style map (`blockStyles` field value), and its setter —
   *  passed in rather than read via `useField` here so this module stays free
   *  of any RUNTIME `@payloadcms/ui` dependency (see the docblock above). Both
   *  are optional so a caller with no style map to hand (e.g. an existing
   *  test) still gets working move/delete without wiring style-copy support. */
  blockStyles?: Record<string, BlockStyle>
  setBlockStyles?: (next: Record<string, BlockStyle>) => void
}): {
  selectedIndex: number
  selectedBlockType: string | undefined
  handleMove: (dir: 'up' | 'down') => void
  handleDuplicate: () => void
  handleDelete: () => void
} {
  const selectedIndex = selectedId ? rows.findIndex((row) => row.id === selectedId) : -1
  const selectedBlockType = selectedIndex >= 0 ? rows[selectedIndex]?.blockType : undefined

  const handleMove = React.useCallback(
    (dir: 'up' | 'down') => {
      if (selectedIndex < 0) return
      const target = dir === 'up' ? selectedIndex - 1 : selectedIndex + 1
      if (target < 0 || target >= rows.length) return
      moveFieldRow({ path: 'layout', moveFromIndex: selectedIndex, moveToIndex: target })
    },
    [selectedIndex, rows.length, moveFieldRow],
  )

  // See STYLE COPY above: set by `handleDuplicate`, consumed and cleared by
  // the effect below once the new row shows up in `rows`.
  const pendingDuplicateRef = React.useRef<{ sourceId: string; prevLength: number } | null>(null)

  const handleDuplicate = React.useCallback(() => {
    if (selectedIndex < 0) return
    const sourceId = rows[selectedIndex]?.id
    pendingDuplicateRef.current = sourceId ? { sourceId, prevLength: rows.length } : null
    dispatchFields({ type: 'DUPLICATE_ROW', path: 'layout', rowIndex: selectedIndex })
    setModified(true)
  }, [selectedIndex, rows, dispatchFields, setModified])

  React.useEffect(() => {
    const pending = pendingDuplicateRef.current
    if (!pending || !setBlockStyles) return
    // The duplicate hasn't landed in form state yet — `rows` still describes
    // the pre-dispatch layout. Bail without clearing the ref so a later
    // render (once it lands) still gets a chance to run this.
    if (rows.length <= pending.prevLength) return
    pendingDuplicateRef.current = null
    const sourceIndex = rows.findIndex((row) => row.id === pending.sourceId)
    if (sourceIndex < 0) return
    const newRow = rows[sourceIndex + 1]
    if (!newRow) return
    const sourceStyle = blockStyles?.[pending.sourceId]
    // No entry for the source block — leave the duplicate with no entry too,
    // rather than writing a spurious empty one (see docblock above).
    if (!sourceStyle) return
    setBlockStyles({
      ...blockStyles,
      // Deep-cloned so neither copy can ever be affected by an in-place
      // mutation of the other's nested group objects — `BlockStyle` is a
      // plain JSON-shaped value (group -> control -> string), so a
      // JSON round-trip is a safe, dependency-free deep clone.
      [newRow.id]: JSON.parse(JSON.stringify(sourceStyle)) as BlockStyle,
    })
  }, [rows, blockStyles, setBlockStyles])

  const handleDelete = React.useCallback(() => {
    if (selectedIndex < 0) return
    removeFieldRow({ path: 'layout', rowIndex: selectedIndex })
    select(null)
  }, [selectedIndex, removeFieldRow, select])

  return { selectedIndex, selectedBlockType, handleMove, handleDuplicate, handleDelete }
}
