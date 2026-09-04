'use client'

import React from 'react'
import { clampRailWidth, type RailSide } from '@/lib/page-builder/rail-geometry'

/**
 * Pointer + keyboard handling shared by both rail grips in `PageBuilderView`'s
 * `PageBuilderShell`. Kept a plain object-returning hook (not a component)
 * since a grip is a DOM node with event handlers, not a subtree with its own
 * render logic — `CanvasStage`'s "produces a component" pattern doesn't fit
 * here.
 *
 * Reads the current total width live off `gridRef` on every move rather than
 * from state, so a browser window resize mid-drag doesn't clamp against a
 * stale total.
 *
 * Lives in its own module — not inline in `PageBuilderView.tsx` where it was
 * first written — purely so it can be unit tested without dragging in that
 * file's `import './page-builder.css'` and its whole component tree
 * (`BlockInspector` → ... → `react-image-crop`'s own CSS), which vitest's
 * default transform can't handle. This is a narrower move than the
 * `useResizableRails`/`ResizablePane` extraction flagged in code review as a
 * separate, deferred cleanup — it only relocates this one already-isolated
 * hook, not the shell's broader state.
 *
 * `onPointerUp` and `onPointerCancel` share one handler (`stopDragging`):
 * the browser fires `pointercancel` instead of `pointerup` when a drag is
 * interrupted (a touch cancellation, any other loss of pointer capture), and
 * auto-releases capture when it does — but nothing else was clearing
 * `dragRef`. Left set, that stale drag state meant a later *hover* over the
 * grip (no button held; `pointermove` fires on hover regardless of capture)
 * would silently resize the rail again. See `useRailGrip.test.tsx`'s
 * "clears the drag on pointercancel" case, which failed with
 * `onPointerCancel` undefined before this fix existed.
 */
export function useRailGrip({
  side,
  width,
  setWidth,
  gridRef,
  onCommit,
}: {
  side: RailSide
  width: number
  setWidth: (width: number) => void
  gridRef: React.RefObject<HTMLDivElement | null>
  onCommit: (width: number) => void
}) {
  const dragRef = React.useRef<{ startX: number; startWidth: number } | null>(null)

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragRef.current = { startX: e.clientX, startWidth: width }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [width],
  )

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      const total = gridRef.current?.getBoundingClientRect().width
      if (!drag || !total) return
      // Belt-and-braces, not the fix itself (that's `stopDragging` running on
      // `pointercancel` too, below): if drag state ever survives when it
      // shouldn't for some other reason, a hover with no button held still
      // won't silently resize the rail.
      if (e.buttons === 0) {
        dragRef.current = null
        return
      }
      const delta = e.clientX - drag.startX
      const raw = side === 'left' ? drag.startWidth + delta : drag.startWidth - delta
      setWidth(clampRailWidth(side, raw, total))
    },
    [side, setWidth, gridRef],
  )

  const stopDragging = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return
      dragRef.current = null
      e.currentTarget.releasePointerCapture(e.pointerId)
      onCommit(width)
    },
    [onCommit, width],
  )

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const total = gridRef.current?.getBoundingClientRect().width
      if (!total) return
      const step = e.shiftKey ? 40 : 10
      let raw: number | null = null
      if (e.key === 'ArrowLeft') raw = side === 'left' ? width - step : width + step
      else if (e.key === 'ArrowRight') raw = side === 'left' ? width + step : width - step
      if (raw === null) return
      e.preventDefault()
      const next = clampRailWidth(side, raw, total)
      setWidth(next)
      onCommit(next)
    },
    [side, width, gridRef, setWidth, onCommit],
  )

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: stopDragging,
    onPointerCancel: stopDragging,
    onKeyDown,
  }
}
