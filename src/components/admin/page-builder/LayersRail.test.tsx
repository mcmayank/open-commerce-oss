/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { LayersRail } from './LayersRail'
import { SelectionProvider } from './selection'

const moveFieldRow = vi.fn()
const removeFieldRow = vi.fn()
const addFieldRow = vi.fn()

let mockRows: Array<{ id: string; blockType?: string }> = []
let mockValues: Record<string, unknown> = {}

vi.mock('@payloadcms/ui', () => ({
  useForm: () => ({ moveFieldRow, removeFieldRow, addFieldRow }),
  useFormFields: (selector: (args: [Record<string, unknown>]) => unknown) =>
    selector([{ layout: { rows: mockRows }, ...mockValues }]),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockRows = []
  mockValues = {}
})

describe('LayersRail', () => {
  it('leads each row with the block content and keeps the type as metadata', () => {
    mockRows = [{ id: 'r1', blockType: 'hero' }]
    mockValues = { 'layout.0.heading': { value: 'Fresh from the oven, daily' } }
    render(
      <SelectionProvider>
        <LayersRail />
      </SelectionProvider>,
    )
    const row = screen.getByRole('button', { name: /Fresh from the oven, daily/ })
    expect(row).toBeTruthy()
    expect(row.textContent).toContain('hero')
  })

  it('falls back to the block label when the block has no words', () => {
    mockRows = [{ id: 'r1', blockType: 'imageGallery' }]
    render(
      <SelectionProvider>
        <LayersRail />
      </SelectionProvider>,
    )
    expect(screen.getByRole('button', { name: /Image Gallery/ })).toBeTruthy()
  })

  it('inserts at the gap that was clicked, not at the end', () => {
    mockRows = [
      { id: 'r1', blockType: 'hero' },
      { id: 'r2', blockType: 'faq' },
    ]
    render(
      <SelectionProvider>
        <LayersRail />
      </SelectionProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Insert a section after Hero' }))
    // The popover opens bound to index 1; choosing a block inserts there.
    fireEvent.click(screen.getByRole('button', { name: 'FAQ' }))
    expect(addFieldRow).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'layout', rowIndex: 1 }),
    )
  })

  it('shows an empty state with a single insertion affordance', () => {
    mockRows = []
    render(
      <SelectionProvider>
        <LayersRail />
      </SelectionProvider>,
    )
    expect(screen.getByRole('button', { name: /Add section/i })).toBeTruthy()
  })

  it('keeps every insertion-gap trigger natively focusable, so a keyboard user can tab to it', () => {
    // Regression guard for a real bug: `.nb-pb-layers__insert` is `opacity: 0`
    // until hovered/expanded, revealed on focus by a `:focus-visible` CSS rule
    // (page-builder.css) — but that rule (and the visible focus ring paired
    // with it) only ever fires if the element is natively focusable in the
    // first place. jsdom doesn't compute the CSS cascade, so it can't confirm
    // the button becomes visible or gets an outline on focus — that part is
    // browser-only and was verified by reading the stylesheet, not by this
    // test. What jsdom *can* confirm, faithfully, is the DOM-level
    // precondition the CSS relies on: calling `.focus()` here must actually
    // move `document.activeElement`, the way it would for a Tab keypress. A
    // regression that made this element non-focusable (a stray `tabIndex={-1}`,
    // swapping the `<button>` for a `<div>`) would silently defeat the CSS fix
    // and would fail this assertion.
    // The interior gap trigger specifically — this is the one that starts
    // `opacity: 0` (page-builder.css's `.nb-pb-layers__insert` base rule) and
    // relies entirely on the `:focus-visible`/`:focus` fix to reappear; the
    // empty-state trigger is always visible and wouldn't exercise the bug.
    mockRows = [
      { id: 'r1', blockType: 'hero' },
      { id: 'r2', blockType: 'faq' },
    ]
    render(
      <SelectionProvider>
        <LayersRail />
      </SelectionProvider>,
    )
    const trigger = screen.getByRole('button', { name: 'Insert a section after Hero' })
    expect(trigger.tagName).toBe('BUTTON')
    expect((trigger as HTMLButtonElement).disabled).toBe(false)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)
  })
})
