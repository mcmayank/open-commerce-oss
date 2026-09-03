/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useRailGrip } from './useRailGrip'

afterEach(cleanup)

/**
 * Minimal fake PointerEvent-shaped object. `useRailGrip`'s handlers only ever
 * read `clientX`, `pointerId`, `buttons`, and call `currentTarget.{set,release}PointerCapture` —
 * that's all this needs to satisfy.
 */
function fakePointerEvent({
  clientX = 0,
  buttons = 1,
}: { clientX?: number; buttons?: number } = {}) {
  return {
    clientX,
    buttons,
    pointerId: 1,
    currentTarget: {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    },
  } as unknown as React.PointerEvent<HTMLDivElement>
}

/** A `gridRef` whose `getBoundingClientRect().width` is controllable. */
function fakeGridRef(width: number): React.RefObject<HTMLDivElement | null> {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => ({ width }) as DOMRect
  return { current: el }
}

describe('useRailGrip', () => {
  it('clears the drag on pointercancel so a later hover-only pointermove does not resize', () => {
    const setWidth = vi.fn()
    const onCommit = vi.fn()
    const gridRef = fakeGridRef(1000)
    const { result } = renderHook(() =>
      useRailGrip({ side: 'left', width: 268, setWidth, gridRef, onCommit }),
    )

    act(() => {
      result.current.onPointerDown(fakePointerEvent({ clientX: 100 }))
    })
    // The gesture is interrupted before pointerup — e.g. a touch cancellation.
    act(() => {
      // Presence guard: if onPointerCancel were missing, this line itself
      // throws (`undefined is not a function`), which is exactly the failure
      // this test is meant to catch before the fix lands.
      expect(typeof result.current.onPointerCancel).toBe('function')
      result.current.onPointerCancel(fakePointerEvent({ clientX: 100 }))
    })
    setWidth.mockClear()

    // The pointer is now just hovering over the grip strip with no button
    // held — `pointermove` still fires on hover regardless of capture.
    act(() => {
      result.current.onPointerMove(fakePointerEvent({ clientX: 500, buttons: 0 }))
    })

    expect(setWidth).not.toHaveBeenCalled()
  })

  it('still resizes on drag and commits on pointerup when nothing is cancelled', () => {
    const setWidth = vi.fn()
    const onCommit = vi.fn()
    const gridRef = fakeGridRef(1000)
    const { result, rerender } = renderHook(
      ({ width }) => useRailGrip({ side: 'left', width, setWidth, gridRef, onCommit }),
      { initialProps: { width: 268 } },
    )

    act(() => {
      result.current.onPointerDown(fakePointerEvent({ clientX: 100 }))
    })
    act(() => {
      result.current.onPointerMove(fakePointerEvent({ clientX: 150, buttons: 1 }))
    })
    // 268 + (150 - 100) = 318, well within RAIL_MIN.left/the 1000-wide slot's max.
    expect(setWidth).toHaveBeenCalledWith(318)

    // Widths are committed on pointerup, not on every move — mirror that by
    // re-rendering the hook with the width `setWidth` would have produced.
    rerender({ width: 318 })
    act(() => {
      result.current.onPointerUp(fakePointerEvent({ clientX: 150 }))
    })
    expect(onCommit).toHaveBeenCalledWith(318)
  })
})
