/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import type { EditTargetMessage } from '@/lib/preview-bridge/protocol'
import { useCanvasEdit } from './useCanvasEdit'

afterEach(cleanup)

const rows = [{ id: 'blk_a' }, { id: 'blk_b' }, { id: 'blk_c' }]

// Shaped like Payload's form-state bag: keyed by the SAME path string
// `fieldPath` builds, each entry carrying a `value`.
const fields: Record<string, unknown> = {
  'layout.1.heading': { value: 'Fresh bread' },
  'layout.1.eyebrow': { value: 'Bakery' },
  'layout.1.subheading': { value: 'Baked daily' },
  'layout.1.primaryCtaLabel': { value: 'Order now' },
  'layout.1.secondaryCtaLabel': { value: 'See menu' },
}

function target(over: Partial<EditTargetMessage> = {}): EditTargetMessage {
  return {
    source: 'nb-preview',
    type: 'edit-target',
    blockId: 'blk_b',
    part: 'heading',
    text: 'Fresh bread',
    rect: { top: 10, left: 20, width: 300, height: 40 },
    ...over,
  }
}

describe('useCanvasEdit', () => {
  it('starts with no open editor', () => {
    const { result } = renderHook(() => useCanvasEdit({ rows, fields }))
    expect(result.current.edit).toBeNull()
  })

  it('opens an editor on the resolved field, at the row index the block id sits at', () => {
    const { result } = renderHook(() => useCanvasEdit({ rows, fields }))
    act(() => result.current.onEditTarget(target()))
    expect(result.current.edit).toEqual({
      path: 'layout.1.heading',
      initialValue: 'Fresh bread',
      rect: { top: 10, left: 20, width: 300, height: 40 },
    })
  })

  // The part vocabulary is coarser than the field names, and the text-equality
  // check inside resolveEditField is what actually pins the field.
  it('picks the CTA label whose current value is the clicked text', () => {
    const { result } = renderHook(() => useCanvasEdit({ rows, fields }))
    act(() => result.current.onEditTarget(target({ part: 'cta', text: 'See menu' })))
    expect(result.current.edit?.path).toBe('layout.1.secondaryCtaLabel')
    expect(result.current.edit?.initialValue).toBe('See menu')
  })

  it('maps the body part onto the subheading field', () => {
    const { result } = renderHook(() => useCanvasEdit({ rows, fields }))
    act(() => result.current.onEditTarget(target({ part: 'body', text: 'Baked daily' })))
    expect(result.current.edit?.path).toBe('layout.1.subheading')
  })

  // CTABanner, PromoSection and StoryStats name their sub-text `body`, not
  // `subheading`, and all three mark it up as `data-nb-part="body"` — mapping
  // the part to `subheading` alone left them inert on the canvas.
  it('maps the body part onto a block that names that field `body`', () => {
    const { result } = renderHook(() =>
      useCanvasEdit({ rows, fields: { 'layout.1.body': { value: 'Half price today' } } }),
    )
    act(() => result.current.onEditTarget(target({ part: 'body', text: 'Half price today' })))
    expect(result.current.edit?.path).toBe('layout.1.body')
    expect(result.current.edit?.initialValue).toBe('Half price today')
  })

  // The editor is a single-line <input>, and HTML input-value sanitisation
  // strips CR/LF — so a multi-line textarea value (subheading/body on six
  // blocks) would commit back flattened, losing the merchant's line breaks
  // with no warning. Refusing to open is the only honest option here.
  it('opens nothing when the resolved value is multi-line', () => {
    const multiline = { 'layout.1.subheading': { value: 'Baked daily\nfrom 6am' } }
    const { result } = renderHook(() => useCanvasEdit({ rows, fields: multiline }))
    // The value still RESOLVES — both sides are trimmed and the newline is
    // internal — so this is a second, explicit refusal, not a resolver miss.
    act(() => result.current.onEditTarget(target({ part: 'body', text: 'Baked daily\nfrom 6am' })))
    expect(result.current.edit).toBeNull()
  })

  // A null resolution is a deliberate no-op: opening an editor bound to a
  // guessed field is how a canvas edit ends up writing to the wrong one.
  it('opens nothing when the clicked text is not the field value', () => {
    const { result } = renderHook(() => useCanvasEdit({ rows, fields }))
    act(() => result.current.onEditTarget(target({ text: 'Something else' })))
    expect(result.current.edit).toBeNull()
  })

  it('opens nothing for a part Round 2 does not edit', () => {
    const { result } = renderHook(() => useCanvasEdit({ rows, fields }))
    act(() => result.current.onEditTarget(target({ part: 'item-heading' })))
    expect(result.current.edit).toBeNull()
  })

  // The block id comes from the preview frame, which renders the SAVED draft —
  // it can name a row that form state no longer has.
  it('opens nothing when the block id is not in form state', () => {
    const { result } = renderHook(() => useCanvasEdit({ rows, fields }))
    act(() => result.current.onEditTarget(target({ blockId: 'blk_gone' })))
    expect(result.current.edit).toBeNull()
  })

  it('opens nothing when the row exists but the field bag has no entry for it', () => {
    const { result } = renderHook(() => useCanvasEdit({ rows, fields: {} }))
    act(() => result.current.onEditTarget(target()))
    expect(result.current.edit).toBeNull()
  })

  // Form-state entries are `{ value }` objects; anything else must not be
  // coerced into an initialValue.
  it('tolerates a malformed form-state entry without opening an editor', () => {
    const { result } = renderHook(() =>
      useCanvasEdit({ rows, fields: { 'layout.1.heading': 'Fresh bread' } }),
    )
    act(() => result.current.onEditTarget(target()))
    expect(result.current.edit).toBeNull()
  })

  it('closeEdit clears the open editor', () => {
    const { result } = renderHook(() => useCanvasEdit({ rows, fields }))
    act(() => result.current.onEditTarget(target()))
    expect(result.current.edit).not.toBeNull()
    act(() => result.current.closeEdit())
    expect(result.current.edit).toBeNull()
  })

  // The path is the whole invariant: it must be the string `fieldPath` builds
  // for that row, which is the same string the inspector's RenderFields
  // parentPath composes to. Asserted against the builder, not a regex.
  it('addresses the row by index, not by id, so it matches the inspector path', () => {
    const shifted = [{ id: 'blk_x' }, { id: 'blk_y' }, { id: 'blk_b' }]
    const { result } = renderHook(() =>
      useCanvasEdit({ rows: shifted, fields: { 'layout.2.heading': { value: 'Fresh bread' } } }),
    )
    act(() => result.current.onEditTarget(target()))
    expect(result.current.edit?.path).toBe('layout.2.heading')
  })
})
