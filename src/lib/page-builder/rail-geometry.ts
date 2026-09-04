/**
 * Rail sizing for the page-builder shell.
 *
 * Replaces the fixed `grid-template-columns: 260px 1fr 320px` with clamped,
 * user-draggable widths. The clamp is expressed here rather than in CSS because
 * a persisted width from a wide monitor must be re-clamped when the same user
 * opens the builder on a laptop — CSS `min-width` alone would let the canvas be
 * squeezed out entirely.
 *
 * Pure — no DOM, no React.
 */

export type RailSide = 'left' | 'right'

/** Below these the rail's own controls stop fitting; collapse instead of shrinking further. */
export const RAIL_MIN = { left: 220, right: 320 } as const

/** Opening widths for a user with no stored preference. */
export const RAIL_DEFAULT = { left: 268, right: 372 } as const

/** Width of a rail collapsed to its icon strip. */
export const RAIL_COLLAPSED_WIDTH = 56

/** Below this the canvas stops being a useful preview at any device width. */
export const CANVAS_MIN_WIDTH = 360

export function clampRailWidth(side: RailSide, width: number, totalWidth: number): number {
  const min = RAIL_MIN[side]
  const otherMin = side === 'left' ? RAIL_MIN.right : RAIL_MIN.left
  const max = totalWidth - otherMin - CANVAS_MIN_WIDTH

  // Viewport too small to satisfy both rails and the canvas at once. Honour the
  // rail's own minimum and let the canvas overflow — a clipped canvas is
  // recoverable by collapsing a rail; a zero-width one looks like a crash.
  if (max < min) return min

  return Math.min(max, Math.max(min, Math.round(width)))
}

export function canvasSlotWidth(
  totalWidth: number,
  leftWidth: number,
  rightWidth: number,
): number {
  return Math.max(0, totalWidth - leftWidth - rightWidth)
}
