'use client'

import React from 'react'
import { varsForStyle, type BlockStyle } from '@/lib/block-style/vocabulary'
import { setControlValue, type StyleGroupKey } from '@/lib/block-style/panel'

/**
 * Previews a style option on the canvas while the pointer rests on it.
 *
 * The intent delay is what makes this usable rather than seizure-inducing:
 * without it, dragging the pointer across a seven-step size scale fires seven
 * previews. Only a hover that settles gets applied.
 *
 * `patch()` is `PreviewBridge`'s protocol, and that protocol is REPLACE, not
 * merge: it applies every key in the given var set, then clears any `--bs-*`
 * var it applied on a PRIOR patch for that block that's absent from THIS one
 * (see PreviewBridge.tsx's `handleMessage`). So every call here sends the
 * block's full committed-or-previewed var set via `varsForStyle`, never a
 * partial diff — a partial patch would read as "every other var just got
 * unset" to the bridge and wipe out unrelated style choices already applied
 * to the block (in the worst case, hovering the value already active emits
 * an empty diff and blanks the block's entire live style on one 120ms rest).
 * The bridge already tracks what it previously applied and computes the
 * removals itself, so sending the full set here is all that's needed.
 *
 * Nothing here writes to form state — `patch()` sets CSS custom properties on
 * the live frame and `onPreviewEnd` reverses exactly what was applied. A preview
 * that escaped into form state would be a phantom edit the merchant never made.
 */
export function useHoverPreview({
  patch,
  blockId,
  style,
  delayMs = 120,
}: {
  patch: (blockId: string, vars: Record<string, string>) => void
  blockId: string | null
  style: BlockStyle
  delayMs?: number
}) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const applied = React.useRef<BlockStyle | null>(null)

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  const onPreview = React.useCallback(
    (group: StyleGroupKey, control: string, value: string | undefined) => {
      if (!blockId) return
      clearTimer()
      timer.current = setTimeout(() => {
        timer.current = null
        const next = setControlValue(style, group, control, value)
        patch(blockId, varsForStyle(next))
        applied.current = next
      }, delayMs)
    },
    [blockId, style, patch, delayMs],
  )

  const onPreviewEnd = React.useCallback(() => {
    clearTimer()
    if (!blockId || !applied.current) return
    patch(blockId, varsForStyle(style))
    applied.current = null
  }, [blockId, style, patch])

  // Unmount mid-preview must not strand a previewed value on the frame.
  React.useEffect(() => () => clearTimer(), [])

  // A SELECTION change must not strand one either. `BlockInspector` doesn't
  // remount this hook when the admin picks a different block — it's the same
  // hook instance, just re-rendered with a new `blockId`/`style` — so the
  // unmount-only cleanup above never runs for that case. A hover that settles
  // into an applied preview and then loses its `onMouseLeave` (e.g. keyboard
  // re-selection with the pointer never physically leaving the control) would
  // otherwise sit on the OLD block's frame forever. Track the previous
  // blockId/style in refs and, when blockId actually changes, revert against
  // them before adopting the new ones.
  const prevRef = React.useRef({ blockId, style })
  React.useEffect(() => {
    const prev = prevRef.current
    prevRef.current = { blockId, style }
    if (prev.blockId === blockId) return
    clearTimer()
    if (prev.blockId && applied.current) {
      patch(prev.blockId, varsForStyle(prev.style))
    }
    applied.current = null
  }, [blockId, style, patch])

  return { onPreview, onPreviewEnd }
}
