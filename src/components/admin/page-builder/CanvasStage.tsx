'use client'

import React from 'react'
import { fitCanvas, type DeviceKey } from '@/lib/page-builder/canvas-fit'
import type { BlockRect, EditTargetMessage } from '@/lib/preview-bridge/protocol'
import { SelectionOverlay } from './SelectionOverlay'
import { CanvasTextEditor } from './CanvasTextEditor'

/**
 * The preview canvas. The iframe is sized to the DEVICE width and the wrapper is
 * CSS-scaled to fit the slot, so the storefront's own responsive rules fire at
 * the width being previewed. Sizing the iframe to the leftover space instead —
 * what the original `1fr` column did — is why collapsing the nav produced a
 * wider tablet rather than more desktop.
 *
 * SELECTION OVERLAY (Task 9) — `.pb-canvas__overlay-layer` is a SIBLING of
 * `.pb-canvas__viewport`, not a child of it. `.pb-canvas__viewport` already
 * carries `transform: scale(...)`, which scales its *entire* painted subtree;
 * `SelectionOverlay` also multiplies every rect by `scale` itself (so its own
 * unit tests can assert plain pixel values without a DOM transform in the
 * loop). Nesting the overlay inside the transformed viewport would apply
 * both — the CSS transform AND the manual multiplication — landing every box
 * at scale² of where it belongs. Instead `.pb-canvas__overlay-layer` sits
 * outside that transform, sized to `deviceWidth * scale` and centered the
 * same way `.pb-canvas`'s `justify-content: center` centers the (untransformed
 * but same-width, same-transform-origin) viewport — so its top-left corner
 * lands exactly on the viewport's POST-transform (visual) top-left corner,
 * and `SelectionOverlay`'s already-scaled coordinates need no further
 * adjustment to line up.
 *
 * VIEWPORT HEIGHT (final-review Important 6) — `.pb-canvas__viewport`'s CSS
 * `height: 100%` used to mean "100% of the pane, BEFORE the scale transform
 * shrinks it." A transform never changes layout size, only paint, so at
 * scale `k` the box still occupied the pane's full height H in layout terms
 * but painted at `H * k`, leaving `H * (1 - k)` of bare pane below it — on a
 * ~1440px laptop a desktop preview at k=0.625 left 37% of the pane empty.
 * Setting the height to `100 / k` percent inflates the LAYOUT height to
 * `H / k`, so after the same `scale(k)` transform it paints at exactly `H` —
 * filling the pane. `.pb-preview-frame`'s own `height: 100%` (in
 * page-builder.css) is relative to this box, so the iframe's device-pixel
 * height grows by the same `1 / k`, exactly mirroring how its WIDTH already
 * worked (a fixed device px value, scaled down to fit — see `deviceWidth`
 * below). This changes nothing about `.pb-canvas__overlay-layer`'s
 * positioning: it is sized and centered independently of the viewport's own
 * height (`height: 100%` of `.pb-canvas`, i.e. of the pane itself), and the
 * viewport's visual top-left corner is unaffected by this change — scaling
 * from `transformOrigin: 'top center'` pins the top edge at layout y=0
 * regardless of the box's own height, so the overlay's coordinate contract
 * (`rect * scale`, no scroll offset) still lands exactly where the
 * (now full-height) viewport paints.
 */
export function CanvasStage({
  previewURL,
  device,
  slotWidth,
  iframeRef,
  rects,
  selectedId,
  hoveredId,
  blockType,
  onMove,
  onDuplicate,
  onDelete,
  stale,
  onDismissStale,
  edit,
  onCloseEdit,
}: {
  previewURL: string | undefined
  device: DeviceKey
  slotWidth: number
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  rects: BlockRect[]
  selectedId: string | null
  hoveredId: string | null
  blockType?: string
  onMove: (dir: 'up' | 'down') => void
  onDuplicate: () => void
  onDelete: () => void
  /** True once a structural edit (move/duplicate/delete) has happened since
   *  the canvas last matched what's on screen — see the docblock above
   *  `stale` renders (final-review Important 5) for why this can't just
   *  reload the iframe. Optional so existing callers/tests that don't care
   *  about staleness keep working with no banner ever shown. */
  stale?: boolean
  onDismissStale?: () => void
  /** Round 2, Task 3 — the resolved in-place edit target, or null when nothing
   *  is being edited. Resolved in `PageBuilderView` (the only side holding form
   *  state); this component just positions the editor. `path` is the form-state
   *  path the inspector binds for the same field, so the write lands in exactly
   *  one place. */
  edit?: { path: string; initialValue: string; rect: EditTargetMessage['rect'] } | null
  onCloseEdit?: () => void
}) {
  const { deviceWidth, scale } = fitCanvas(device, slotWidth)

  if (!previewURL) {
    return <div className="pb-pane__placeholder">Save this page to see a live preview.</div>
  }

  return (
    <div className="pb-canvas">
      {/* Final-review Important 5 — the preview iframe renders the SAVED
          draft from the database; `reload()` only ever fires from the
          variant-change effect in BlockInspector. Move/duplicate/delete change
          form state and the layers rail immediately, but the canvas shows
          nothing different until the merchant explicitly saves. Reloading
          here unconditionally would swap in the OLD saved draft, actively
          hiding the pending edit rather than confirming it — worse than
          today's silent staleness. This banner is the minimum honest fix:
          it says out loud that the canvas is not the source of truth right
          now, and lets the merchant dismiss it once they've read it — it
          reappears on the NEXT structural edit regardless (see
          PageBuilderShell), since dismissing today's notice says nothing
          about tomorrow's edit. */}
      {stale ? (
        <div className="pb-canvas__stale-banner" role="status">
          <span>Preview is out of date &mdash; save to refresh</span>
          {onDismissStale ? (
            <button
              type="button"
              className="pb-canvas__stale-dismiss"
              aria-label="Dismiss stale preview notice"
              onClick={onDismissStale}
            >
              &#215;
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        data-testid="nb-canvas-viewport"
        className="pb-canvas__viewport"
        style={{
          width: deviceWidth,
          // See VIEWPORT HEIGHT above: inflates layout height by 1/scale so
          // the subsequent `scale(...)` transform paints back to exactly
          // 100% of the pane instead of leaving `(1 - scale)` of it bare.
          height: `${100 / scale}%`,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        <iframe
          ref={iframeRef}
          src={previewURL}
          title="Storefront preview"
          className="pb-preview-frame"
          style={{ width: deviceWidth }}
        />
      </div>
      <div className="pb-canvas__overlay-layer" style={{ width: deviceWidth * scale }}>
        <SelectionOverlay
          rects={rects}
          scale={scale}
          selectedId={selectedId}
          hoveredId={hoveredId}
          blockType={blockType}
          onMove={onMove}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
        {/* Inside the SAME overlay layer as SelectionOverlay, deliberately:
            that layer sits outside `.pb-canvas__viewport`'s CSS transform, so
            both it and CanvasTextEditor multiply their rects by `scale`
            themselves. Nesting the editor in the transformed viewport instead
            would apply the scale twice and land the caret at scale² of where
            the text is. The layer is `pointer-events: none`; the editor
            re-enables them on itself (see page-builder.css) — it is the one
            part of that layer that has to receive typing. */}
        {edit && onCloseEdit ? (
          <CanvasTextEditor
            // Keyed on the bound path so a target-to-target switch with no
            // intervening `null` remounts rather than reusing the previous
            // editor's `draft` and its already-`settled` ref — which would be an
            // editor that silently writes nothing. Unreachable today (blur
            // commits and closes first); one attribute of insurance against a
            // future affordance that opens an editor without blurring.
            key={edit.path}
            path={edit.path}
            initialValue={edit.initialValue}
            rect={edit.rect}
            scale={scale}
            onClose={onCloseEdit}
          />
        ) : null}
      </div>
    </div>
  )
}
