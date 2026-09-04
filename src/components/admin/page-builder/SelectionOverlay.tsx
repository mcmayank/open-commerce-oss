'use client'

import React from 'react'
import type { BlockRect } from '@/lib/preview-bridge/protocol'

/**
 * Canvas selection chrome — Task 9. Drawn by the BUILDER, over the storefront
 * iframe (never inside it): the builder can't call `getBoundingClientRect`
 * across documents, so it relies on `BlockRect`s the preview frame reports
 * over the bridge (Task 4) and positions plain absolutely-positioned boxes on
 * top of it, in the frame's own device-width coordinate space multiplied by
 * the canvas's current CSS scale (`fitCanvas`, Task 2).
 *
 * Presentational only, and deliberately so: reorder, duplicate and delete are
 * form-state operations the caller already owns via `moveFieldRow` /
 * `addFieldRow` / `removeFieldRow` (see `PageBuilderView`) — this component
 * only calls the handlers it's given and never posts a bridge message itself.
 * The parent spec's "add reorder verbs to the protocol" idea was corrected
 * away before Task 4 shipped `BlockRect`; this component is *why* that
 * correction holds — geometry flows down from the frame, decisions flow from
 * here into form state, never back out through postMessage.
 *
 * A selection (or hover) whose block hasn't reported a rect yet renders
 * nothing for that box rather than falling back to a stale or zeroed
 * position — a missing box is confusing for a beat; a WRONG box (pointing at
 * the previous layout, or at 0,0) actively misleads about what's about to be
 * moved or deleted. This is also what makes a device-width change safe: the
 * caller clears its `rects` the moment the device changes (see
 * `usePreviewBridge`), so there's a beat with no box at all rather than a
 * mis-scaled leftover from the old layout.
 */
export function SelectionOverlay({
  rects,
  scale,
  selectedId,
  hoveredId,
  blockType,
  onMove,
  onDuplicate,
  onDelete,
}: {
  rects: BlockRect[]
  scale: number
  selectedId: string | null
  hoveredId: string | null
  /** Optional human label ("Hero", "FAQ") shown on the floating tag. Omitted
   *  entirely if the caller doesn't have one to hand — the action buttons are
   *  the part of the tag every test and every merchant interaction needs. */
  blockType?: string
  onMove: (dir: 'up' | 'down') => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const selectedRect = selectedId ? rects.find((r) => r.blockId === selectedId) : undefined
  const showHover = hoveredId !== null && hoveredId !== selectedId
  const hoverRect = showHover ? rects.find((r) => r.blockId === hoveredId) : undefined

  const boxStyle = (rect: BlockRect): React.CSSProperties => ({
    top: `${rect.top * scale}px`,
    left: `${rect.left * scale}px`,
    width: `${rect.width * scale}px`,
    height: `${rect.height * scale}px`,
  })

  // The floating tag sits just above the selected block's top edge. A block
  // flush with the top of the canvas has no room above it — tuck the tag
  // inside the box instead of letting it clip off the top of the canvas.
  const TAG_HEIGHT = 26
  const tagStyle = (rect: BlockRect): React.CSSProperties => ({
    top: `${Math.max(0, rect.top * scale - TAG_HEIGHT)}px`,
    left: `${rect.left * scale}px`,
  })

  return (
    <div className="nb-selection-overlay">
      {hoverRect && (
        <div
          data-testid="nb-hover-box"
          className="nb-selection-overlay__box nb-selection-overlay__box--hover"
          style={boxStyle(hoverRect)}
        />
      )}
      {selectedRect && (
        <>
          <div
            data-testid="nb-selection-box"
            className="nb-selection-overlay__box nb-selection-overlay__box--selected"
            style={boxStyle(selectedRect)}
          />
          <div className="nb-selection-overlay__tag" style={tagStyle(selectedRect)}>
            {blockType ? <span className="nb-selection-overlay__tag-type">{blockType}</span> : null}
            <span className="nb-selection-overlay__tag-actions">
              <button
                type="button"
                aria-label="Move block up"
                className="nb-selection-overlay__tag-btn"
                onClick={() => onMove('up')}
              >
                &#8593;
              </button>
              <button
                type="button"
                aria-label="Move block down"
                className="nb-selection-overlay__tag-btn"
                onClick={() => onMove('down')}
              >
                &#8595;
              </button>
              <button
                type="button"
                aria-label="Duplicate block"
                className="nb-selection-overlay__tag-btn"
                onClick={onDuplicate}
              >
                &#10697;
              </button>
              <button
                type="button"
                aria-label="Delete block"
                className="nb-selection-overlay__tag-btn nb-selection-overlay__tag-btn--delete"
                onClick={onDelete}
              >
                &#215;
              </button>
            </span>
          </div>
        </>
      )}
    </div>
  )
}
