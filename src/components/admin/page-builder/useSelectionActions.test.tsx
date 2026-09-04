/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useSelectionActions } from './useSelectionActions'
import type { BlockStyle } from '@/lib/block-style/vocabulary'

afterEach(cleanup)

const ROWS = [
  { id: 'row_a', blockType: 'hero' },
  { id: 'row_b', blockType: 'faq' },
  { id: 'row_c', blockType: 'richText' },
]

function setup(overrides: Partial<Parameters<typeof useSelectionActions>[0]> = {}) {
  const moveFieldRow = vi.fn()
  const dispatchFields = vi.fn()
  const removeFieldRow = vi.fn()
  const setModified = vi.fn()
  const select = vi.fn()

  const { result, rerender } = renderHook(
    (props: Partial<Parameters<typeof useSelectionActions>[0]> = {}) =>
      useSelectionActions({
        rows: ROWS,
        selectedId: 'row_b',
        select,
        moveFieldRow,
        dispatchFields,
        removeFieldRow,
        setModified,
        ...overrides,
        ...props,
      }),
  )

  return { result, rerender, moveFieldRow, dispatchFields, removeFieldRow, setModified, select }
}

describe('useSelectionActions', () => {
  it('resolves the selected index and block type from the given rows', () => {
    const { result } = setup()
    expect(result.current.selectedIndex).toBe(1)
    expect(result.current.selectedBlockType).toBe('faq')
  })

  it('duplicate DISPATCHES a DUPLICATE_ROW action for the selected row — a real content clone, not an empty appended row', () => {
    // This is the exact mechanism Payload's own Blocks field uses for its
    // "Duplicate" row action (fieldReducer.js's DUPLICATE_ROW case): it deep
    // copies the row's sub-field state. Asserting the dispatch shape (not
    // just "some row got added") is what would have caught the earlier bug,
    // where `addFieldRow` with no `subFieldState` produced an EMPTY block of
    // the same type instead of a copy of the selected one's content.
    const { result, dispatchFields, setModified } = setup()
    result.current.handleDuplicate()
    expect(dispatchFields).toHaveBeenCalledWith({
      type: 'DUPLICATE_ROW',
      path: 'layout',
      rowIndex: 1,
    })
    expect(setModified).toHaveBeenCalledWith(true)
  })

  it('duplicate is a no-op when nothing is selected', () => {
    const { result, dispatchFields, setModified } = setup({ selectedId: null })
    result.current.handleDuplicate()
    expect(dispatchFields).not.toHaveBeenCalled()
    expect(setModified).not.toHaveBeenCalled()
  })

  it('duplicate copies the source block style entry onto the new row (final-review Important 1)', () => {
    // `DUPLICATE_ROW` deep-copies content but the new row's id is fresh and
    // unknown until the reducer's result flows back through `rows` on the
    // next render — this simulates exactly that: handleDuplicate() fires
    // first (rows still the OLD 3-row array), then a rerender delivers the
    // post-dispatch 4-row array with the real new id inserted right after the
    // source ('row_b_dup'), the way fieldReducer.js's own insertion does.
    const setBlockStyles = vi.fn()
    const blockStyles: Record<string, BlockStyle> = { row_b: { heading: { size: 'lg' } } }
    const { result, rerender } = setup({ blockStyles, setBlockStyles })

    result.current.handleDuplicate()
    expect(setBlockStyles).not.toHaveBeenCalled()

    const rowsAfterDuplicate = [
      { id: 'row_a', blockType: 'hero' },
      { id: 'row_b', blockType: 'faq' },
      { id: 'row_b_dup', blockType: 'faq' },
      { id: 'row_c', blockType: 'richText' },
    ]
    rerender({ rows: rowsAfterDuplicate, blockStyles, setBlockStyles })

    expect(setBlockStyles).toHaveBeenCalledTimes(1)
    expect(setBlockStyles).toHaveBeenCalledWith({
      row_b: { heading: { size: 'lg' } },
      row_b_dup: { heading: { size: 'lg' } },
    })
    // Deep-cloned, not the same reference — a later edit to one must never
    // leak into the other via a shared nested object.
    const written = setBlockStyles.mock.calls[0][0] as typeof blockStyles
    expect(written.row_b_dup).not.toBe(blockStyles.row_b)
  })

  it('duplicating an unstyled block does not write a spurious empty blockStyles entry', () => {
    const setBlockStyles = vi.fn()
    const blockStyles = {} // source ('row_b') has no style entry at all
    const { result, rerender } = setup({ blockStyles, setBlockStyles })

    result.current.handleDuplicate()

    const rowsAfterDuplicate = [
      { id: 'row_a', blockType: 'hero' },
      { id: 'row_b', blockType: 'faq' },
      { id: 'row_b_dup', blockType: 'faq' },
      { id: 'row_c', blockType: 'richText' },
    ]
    rerender({ rows: rowsAfterDuplicate, blockStyles, setBlockStyles })

    expect(setBlockStyles).not.toHaveBeenCalled()
  })

  it('does not blow up copying style when no blockStyles/setBlockStyles is supplied', () => {
    // Existing callers (and this file's other tests) don't pass these —
    // they're optional so plain move/delete keeps working without wiring
    // style-copy support.
    const { result, rerender } = setup()
    expect(() => result.current.handleDuplicate()).not.toThrow()
    const rowsAfterDuplicate = [
      { id: 'row_a', blockType: 'hero' },
      { id: 'row_b', blockType: 'faq' },
      { id: 'row_b_dup', blockType: 'faq' },
      { id: 'row_c', blockType: 'richText' },
    ]
    expect(() => rerender({ rows: rowsAfterDuplicate })).not.toThrow()
  })

  it('move up moves the selected row one index earlier', () => {
    const { result, moveFieldRow } = setup()
    result.current.handleMove('up')
    expect(moveFieldRow).toHaveBeenCalledWith({ path: 'layout', moveFromIndex: 1, moveToIndex: 0 })
  })

  it('move down moves the selected row one index later', () => {
    const { result, moveFieldRow } = setup()
    result.current.handleMove('down')
    expect(moveFieldRow).toHaveBeenCalledWith({ path: 'layout', moveFromIndex: 1, moveToIndex: 2 })
  })

  it('move is a no-op past either boundary', () => {
    const { result, moveFieldRow } = setup({ selectedId: 'row_a' })
    result.current.handleMove('up')
    expect(moveFieldRow).not.toHaveBeenCalled()

    const last = setup({ selectedId: 'row_c' })
    last.result.current.handleMove('down')
    expect(last.moveFieldRow).not.toHaveBeenCalled()
  })

  it('delete removes the selected row and clears the selection', () => {
    const { result, removeFieldRow, select } = setup()
    result.current.handleDelete()
    expect(removeFieldRow).toHaveBeenCalledWith({ path: 'layout', rowIndex: 1 })
    expect(select).toHaveBeenCalledWith(null)
  })

  it('delete is a no-op when nothing is selected', () => {
    const { result, removeFieldRow, select } = setup({ selectedId: null })
    result.current.handleDelete()
    expect(removeFieldRow).not.toHaveBeenCalled()
    expect(select).not.toHaveBeenCalled()
  })
})
