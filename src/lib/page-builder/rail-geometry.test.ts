import { describe, it, expect } from 'vitest'
import {
  RAIL_MIN,
  RAIL_COLLAPSED_WIDTH,
  CANVAS_MIN_WIDTH,
  clampRailWidth,
  canvasSlotWidth,
} from './rail-geometry'

describe('clampRailWidth', () => {
  it('passes a comfortable width through untouched', () => {
    expect(clampRailWidth('left', 300, 1440)).toBe(300)
  })

  it('refuses to go below the side minimum', () => {
    expect(clampRailWidth('left', 40, 1440)).toBe(RAIL_MIN.left)
    expect(clampRailWidth('right', 40, 1440)).toBe(RAIL_MIN.right)
  })

  it('never starves the canvas below its minimum', () => {
    // 1440 total, other rail at its minimum, canvas needs CANVAS_MIN_WIDTH.
    const max = 1440 - RAIL_MIN.right - CANVAS_MIN_WIDTH
    expect(clampRailWidth('left', 2000, 1440)).toBe(max)
  })

  it('falls back to the minimum when the viewport is too small to satisfy everyone', () => {
    // A viewport this narrow cannot honour both rails and the canvas; the rail
    // must not become negative or exceed the viewport.
    const result = clampRailWidth('left', 400, 500)
    expect(result).toBe(RAIL_MIN.left)
  })
})

describe('canvasSlotWidth', () => {
  it('is what remains after both rails', () => {
    expect(canvasSlotWidth(1440, 268, 372)).toBe(800)
  })

  it('accounts for collapsed rails', () => {
    expect(canvasSlotWidth(1440, RAIL_COLLAPSED_WIDTH, RAIL_COLLAPSED_WIDTH)).toBe(
      1440 - RAIL_COLLAPSED_WIDTH * 2,
    )
  })

  it('never reports a negative slot', () => {
    expect(canvasSlotWidth(300, 268, 372)).toBe(0)
  })
})
