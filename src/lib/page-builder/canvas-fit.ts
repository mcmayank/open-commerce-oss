/**
 * Canvas fit maths for the page builder.
 *
 * The builder renders the storefront at a chosen DEVICE width and scales the
 * result to fit whatever slot the rails leave over. That separation is the
 * whole point: the iframe keeps its true device width, so the storefront's own
 * responsive rules fire at the width being previewed rather than at the width
 * of the admin pane. Before this, the iframe simply took the leftover space and
 * a merchant collapsing the nav got a wider TABLET rather than more desktop.
 *
 * Pure and side-effect free — no DOM, no React — so the maths is tested
 * directly, same discipline as src/lib/block-style/panel.ts.
 */

export const DEVICE_WIDTHS = {
  desktop: 1280,
  tablet: 834,
  mobile: 390,
} as const

export type DeviceKey = keyof typeof DEVICE_WIDTHS

export type CanvasFit = {
  /** The width the iframe is rendered at — never the slot width. */
  deviceWidth: number
  /** CSS transform scale applied to the iframe. Never above 1: scaling a design UP misrepresents it. */
  scale: number
  /** `scale` as a whole percent, for the top bar readout. */
  zoomPercent: number
}

export function fitCanvas(device: DeviceKey, slotWidth: number): CanvasFit {
  const deviceWidth = DEVICE_WIDTHS[device]
  // A slot of 0 is the pre-layout state on first paint, not a real measurement.
  // Dividing by it yields 0/NaN and a blank canvas, so treat it as full scale.
  const scale = slotWidth > 0 ? Math.min(1, slotWidth / deviceWidth) : 1
  return { deviceWidth, scale, zoomPercent: Math.round(scale * 100) }
}
