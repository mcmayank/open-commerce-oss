'use client'

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  parseBridgeMessage,
  type BlockRect,
  type EditTargetMessage,
} from '@/lib/preview-bridge/protocol'
import type { DeviceKey } from '@/lib/page-builder/canvas-fit'

/**
 * Builder-side (admin/parent) half of the Phase 3b page-builder preview
 * bridge. Owns the iframe ref, listens for `select`/`ready` messages posted
 * up from the previewed storefront frame, and exposes `patch` to push live
 * `--bs-*` CSS var edits down into that frame.
 *
 * `onSelect`/`onReady` are wrapped in `useEffectEvent`, so the window
 * `message` listener never needs to be torn down and re-added — the effect
 * that installs it keeps an empty dependency array while the handlers still
 * see the latest props on every message. (This previously wrote a ref during
 * render, which `react-hooks/refs` rightly flags: a render-phase ref write is
 * not guaranteed to have happened by the time anything reads it.) Effect
 * events must only ever be called from inside an effect, which is exactly
 * where `handleMessage` lives.
 *
 * Task 9 adds block geometry: `rects` (from the frame's `rects` messages —
 * every block's position/size, in the frame's own unscaled coordinate space)
 * and `hoveredId` (from `hover` messages), plus a `measure()` that asks the
 * frame to re-report both right now. The frame already re-measures on its own
 * scroll/resize (`PreviewBridge.tsx`), so `measure()` only needs to be called
 * for a change the frame can't observe by itself: switching the canvas's
 * DEVICE (desktop/tablet/mobile) resizes the iframe from the OUTSIDE. That's
 * why this hook takes an optional `device` — a change there clears the
 * (now-stale, describing the OLD device width) `rects` immediately and
 * requests fresh ones, rather than leaving a mis-scaled selection box on
 * screen for however long the round trip to the frame and back takes.
 */
export function usePreviewBridge(opts: {
  onSelect: (blockId: string) => void
  onReady?: () => void
  /** Round 2, Task 3 — the frame reported a double-clicked, editable text
   *  element. Forwarded RAW: which field (if any) it maps to is resolved in
   *  the builder, the only side that holds form state. Optional, so a caller
   *  with no in-place editing simply ignores the message. */
  onEditTarget?: (target: EditTargetMessage) => void
  device?: DeviceKey
}): {
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  patch: (blockId: string, vars: Record<string, string>) => void
  setScheme: (blockId: string, scheme: string) => void
  reload: () => void
  rects: BlockRect[]
  hoveredId: string | null
  measure: () => void
} {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [rects, setRects] = useState<BlockRect[]>([])
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Posts a `measure` request to the frame. Shared by the exposed `measure()`
  // (called by the caller on a device change) and the internal `ready`
  // handling below — same postMessage shape `patch`/`setScheme` already use.
  const measure = useCallback(() => {
    const contentWindow = iframeRef.current?.contentWindow
    if (!contentWindow) return
    contentWindow.postMessage({ source: 'nb-builder', type: 'measure' }, window.location.origin)
  }, [])

  const onSelect = useEffectEvent((blockId: string) => {
    opts.onSelect(blockId)
  })
  const onReady = useEffectEvent(() => {
    opts.onReady?.()
    measure()
  })
  // Same `useEffectEvent` treatment as `onSelect`/`onReady`: the message
  // listener is installed once with empty deps, so the handler has to read the
  // latest prop rather than the one captured on mount.
  const onEditTarget = useEffectEvent((target: EditTargetMessage) => {
    opts.onEditTarget?.(target)
  })

  useEffect(() => {
    const expectedOrigin = window.location.origin

    const handleMessage = (e: MessageEvent) => {
      const msg = parseBridgeMessage(e.data, e.origin, expectedOrigin)
      if (!msg) return
      if (msg.type === 'select') {
        onSelect(msg.blockId)
      } else if (msg.type === 'ready') {
        onReady()
      } else if (msg.type === 'rects') {
        setRects(msg.rects)
      } else if (msg.type === 'hover') {
        setHoveredId(msg.blockId)
      } else if (msg.type === 'edit-target') {
        onEditTarget(msg)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // See the docblock above: a device change invalidates whatever rects are
  // currently held (they describe the OLD width) before the frame has had a
  // chance to report fresh ones. Also fires once on mount, which is a
  // harmless no-op — `rects` starts empty and `measure()` no-ops until the
  // iframe has a `contentWindow`.
  useEffect(() => {
    setRects([])
    measure()
  }, [opts.device, measure])

  const patch = useCallback((blockId: string, vars: Record<string, string>) => {
    const contentWindow = iframeRef.current?.contentWindow
    if (!contentWindow) return
    contentWindow.postMessage(
      { source: 'nb-builder', type: 'patch', blockId, vars },
      window.location.origin,
    )
  }, [])

  // Scheme is CSS-patchable live (see PreviewBridge's `scheme` handler), so
  // this posts the same way `patch` does rather than reloading.
  const setScheme = useCallback((blockId: string, scheme: string) => {
    const contentWindow = iframeRef.current?.contentWindow
    if (!contentWindow) return
    contentWindow.postMessage(
      { source: 'nb-builder', type: 'scheme', blockId, scheme },
      window.location.origin,
    )
  }, [])

  // Variant is structural (a different DOM shape, not a CSS var), so there's
  // no live-patch path for it — the caller reloads the preview iframe instead.
  const reload = useCallback(() => {
    iframeRef.current?.contentWindow?.location.reload()
  }, [])

  return { iframeRef, patch, setScheme, reload, rects, hoveredId, measure }
}
