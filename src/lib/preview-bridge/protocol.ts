// Isomorphic, pure message-contract module for the page-builder preview bridge.
// No React, no DOM, no browser APIs — this is imported by both the storefront
// preview frame and the admin builder host, so it must run in either context.

// storefront → builder
export type SelectMessage = { source: 'nb-preview'; type: 'select'; blockId: string }
export type ReadyMessage = { source: 'nb-preview'; type: 'ready' }
// builder → storefront
export type PatchMessage = {
  source: 'nb-builder'
  type: 'patch'
  blockId: string
  vars: Record<string, string>
}
// A block's section `scheme` isn't a `--bs-*` var patch — it also toggles the
// wrapper's `data-scheme` attribute — so it gets its own message type rather
// than overloading PatchMessage's vars bag.
export type SchemeMessage = {
  source: 'nb-builder'
  type: 'scheme'
  blockId: string
  scheme: string
}

/**
 * Where a block sits inside the preview frame, in the frame's own unscaled
 * coordinate space. The builder draws selection and hover chrome as an overlay
 * OVER the iframe rather than inside it, so it needs geometry it cannot read
 * itself — a cross-document `getBoundingClientRect` is not available to it.
 *
 * Reordering is deliberately NOT a bridge message: it is a form-state operation
 * the builder already owns via `moveFieldRow`. The frame reports geometry; the
 * builder decides what to do with it.
 */
export type BlockRect = {
  blockId: string
  top: number
  left: number
  width: number
  height: number
}

// storefront → builder
export type RectsMessage = { source: 'nb-preview'; type: 'rects'; rects: BlockRect[] }
export type HoverMessage = { source: 'nb-preview'; type: 'hover'; blockId: string | null }
// builder → storefront
export type MeasureMessage = { source: 'nb-builder'; type: 'measure' }

/**
 * A double-clicked run of text the builder may edit in place.
 *
 * `rect` is viewport-relative in the FRAME's own unscaled coordinate space,
 * exactly like `BlockRect` — the builder multiplies by the canvas scale itself.
 * The frame deliberately does not decide WHICH FIELD this is: only the builder
 * holds form state, so it resolves that with `resolveEditField`.
 */
export type EditTargetMessage = {
  source: 'nb-preview'
  type: 'edit-target'
  blockId: string
  part: string
  text: string
  rect: { top: number; left: number; width: number; height: number }
}

export type BridgeMessage =
  | SelectMessage
  | ReadyMessage
  | RectsMessage
  | HoverMessage
  | PatchMessage
  | SchemeMessage
  | MeasureMessage
  | EditTargetMessage

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringMap(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false
  return Object.values(value).every((v) => typeof v === 'string')
}

function isBlockRect(value: unknown): value is BlockRect {
  if (!isRecord(value)) return false
  if (typeof value.blockId !== 'string') return false
  return (['top', 'left', 'width', 'height'] as const).every(
    (k) => typeof value[k] === 'number' && Number.isFinite(value[k]),
  )
}

function isRectLike(value: unknown): value is EditTargetMessage['rect'] {
  if (!isRecord(value)) return false
  return (['top', 'left', 'width', 'height'] as const).every(
    (k) => typeof value[k] === 'number' && Number.isFinite(value[k]),
  )
}

export function parseBridgeMessage(
  data: unknown,
  origin: string,
  expectedOrigin: string,
): BridgeMessage | null {
  if (origin !== expectedOrigin) return null
  if (!isRecord(data)) return null

  const { source, type } = data

  if (source === 'nb-preview') {
    if (type === 'select') {
      if (typeof data.blockId !== 'string') return null
      return { source: 'nb-preview', type: 'select', blockId: data.blockId }
    }
    if (type === 'ready') {
      return { source: 'nb-preview', type: 'ready' }
    }
    if (type === 'rects') {
      if (!Array.isArray(data.rects)) return null
      if (!data.rects.every(isBlockRect)) return null
      return { source: 'nb-preview', type: 'rects', rects: data.rects as BlockRect[] }
    }
    if (type === 'hover') {
      if (data.blockId !== null && typeof data.blockId !== 'string') return null
      return { source: 'nb-preview', type: 'hover', blockId: data.blockId as string | null }
    }
    if (type === 'edit-target') {
      if (typeof data.blockId !== 'string') return null
      if (typeof data.part !== 'string') return null
      if (typeof data.text !== 'string') return null
      if (!isRectLike(data.rect)) return null
      return data as unknown as EditTargetMessage
    }
    return null
  }

  if (source === 'nb-builder') {
    if (type === 'patch') {
      if (typeof data.blockId !== 'string') return null
      if (!isStringMap(data.vars)) return null
      return { source: 'nb-builder', type: 'patch', blockId: data.blockId, vars: data.vars }
    }
    if (type === 'scheme') {
      if (typeof data.blockId !== 'string') return null
      if (typeof data.scheme !== 'string') return null
      return { source: 'nb-builder', type: 'scheme', blockId: data.blockId, scheme: data.scheme }
    }
    if (type === 'measure') {
      return { source: 'nb-builder', type: 'measure' }
    }
    return null
  }

  return null
}
