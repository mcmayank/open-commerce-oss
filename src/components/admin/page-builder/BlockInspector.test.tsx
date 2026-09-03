/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { BlockInspector } from './BlockInspector'

const setValue = vi.fn() // blockStyles field
const setSchemeValue = vi.fn() // a block's `scheme` field
let mockBlockStylesValue: Record<string, unknown> = {}
let mockSchemeValue = ''
let mockRows: Array<{ id: string; blockType?: string }> = []
// Flat form-state entries keyed by dotted path, e.g. 'layout.0.variant' — mirrors
// how Payload's real useFormFields exposes sibling fields outside `rows`.
let mockFlatFields: Record<string, { value?: unknown }> = {}

vi.mock('@payloadcms/ui', () => ({
  useField: (opts: { path: string }) => {
    if (opts.path === 'blockStyles') return { value: mockBlockStylesValue, setValue }
    if (opts.path.endsWith('.scheme')) return { value: mockSchemeValue, setValue: setSchemeValue }
    return { value: undefined, setValue: vi.fn() }
  },
  useFormFields: (selector: (args: [Record<string, unknown>]) => unknown) =>
    selector([{ layout: { rows: mockRows }, ...mockFlatFields }]),
}))

let mockSelectedId = 'a'
vi.mock('./selection', () => ({
  useSelection: () => ({ selectedId: mockSelectedId, select: vi.fn() }),
}))

vi.mock('@/components/admin/VariantPickerField', () => ({
  default: (props: { path: string }) => <div data-testid="variant-picker" data-path={props.path} />,
}))

vi.mock('./BlockContentEditor', () => ({
  BlockContentEditor: () => <div data-testid="content-editor" />,
  BlockLayoutFields: () => <div data-testid="layout-fields" />,
}))

afterEach(() => {
  cleanup()
  setValue.mockReset()
  setSchemeValue.mockReset()
  mockBlockStylesValue = {}
  mockSchemeValue = ''
  mockRows = []
  mockFlatFields = {}
  mockSelectedId = 'a'
})


/** The inspector opens on Content, so style assertions must switch tabs first. */
function showStyleTab() {
  fireEvent.click(screen.getByRole('tab', { name: /style/i }))
}

/** The inspector opens on Content, so layout assertions must switch tabs first. */
function showLayoutTab() {
  fireEvent.click(screen.getByRole('tab', { name: /layout/i }))
}

/** Renders the inspector for a single block of the given type, on its default Content tab. */
function renderInspectorFor(blockType: string) {
  mockRows = [{ id: 'a', blockType }]
  return render(<BlockInspector patch={vi.fn()} setScheme={vi.fn()} reload={vi.fn()} />)
}

/**
 * Same block-of-type setup as `renderInspectorFor`, but returns the element
 * for `rerender` instead of mounting it — for tests simulating "a different
 * block got selected in the outline", which also gives that block a new id
 * (a real selection change always does; two rows never share one).
 */
function inspectorFor(blockType: string) {
  mockRows = [{ id: blockType, blockType }]
  mockSelectedId = blockType
  return <BlockInspector patch={vi.fn()} setScheme={vi.fn()} reload={vi.fn()} />
}

describe('BlockInspector', () => {
  it('renders the block label and the full style groups for a stylable block', () => {
    mockRows = [{ id: 'a', blockType: 'hero' }]
    render(<BlockInspector patch={vi.fn()} setScheme={vi.fn()} reload={vi.fn()} />)
    showStyleTab()

    expect(screen.getByText('Hero')).toBeTruthy()
    // Eyebrow/Heading/Subheading are the three collapsible typography groups
    // (Task 5) — their titles live inside a disclosure <button>, so they're
    // queried by role rather than by legend text (see
    // StyleControlGroups.test.tsx's "collapsible typography groups" block).
    expect(screen.getByRole('button', { name: /Eyebrow/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Heading/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Subheading/ })).toBeTruthy()

    // Section moved to the Layout tab (Task 6) — density and width live
    // beside height and alignment, not among typography. It isn't
    // collapsible, so it keeps the plain legend-text query; scoped to
    // <legend> since some group's own options are also labelled e.g. "Heading".
    showLayoutTab()
    expect(screen.getByText('Section', { selector: 'legend' })).toBeTruthy()
  })

  it('shows the "not available" note for a non-stylable block, and renders no style controls', () => {
    mockRows = [{ id: 'a', blockType: 'spacer' }]
    render(<BlockInspector patch={vi.fn()} setScheme={vi.fn()} reload={vi.fn()} />)
    showStyleTab()

    expect(screen.getByText(/full styling isn't available for this block yet/i)).toBeTruthy()
    expect(screen.queryByText('Eyebrow')).toBeNull()
    expect(screen.queryAllByRole('combobox').length).toBe(0)
  })

  it('changing a style control writes the updated blockStyles map via setValue AND live-patches the iframe', () => {
    mockRows = [{ id: 'a', blockType: 'hero' }]
    const patch = vi.fn()
    render(<BlockInspector patch={patch} setScheme={vi.fn()} reload={vi.fn()} />)
    showStyleTab()

    // Scope to the vocabulary style groups only — a scheme <select> now also
    // renders above them for a scheme-bearing block like hero. Controls are now
    // switches/segmented buttons rather than <select>s (Task 4); Section moved
    // to the Layout tab (Task 6), so the first one in presentation order here
    // is Heading > Size, a scale segmented control — Heading opens expanded by
    // default (Task 5).
    const groups = document.querySelector('.nb-pb-inspector__groups') as HTMLElement
    const radios = within(groups).getAllByRole('radio')
    expect(radios.length).toBeGreaterThan(0)

    fireEvent.click(radios[0])

    // Read/modify/write cycle: setValue called with the whole blockStyles map, keyed by the selected block id.
    expect(setValue).toHaveBeenCalledTimes(1)
    const nextMap = setValue.mock.calls[0][0] as Record<string, unknown>
    expect(nextMap.a).toBeTruthy()

    // Live patch: patch(blockId, vars) called with the vars for the just-changed style.
    expect(patch).toHaveBeenCalledTimes(1)
    expect(patch.mock.calls[0][0]).toBe('a')
    const vars = patch.mock.calls[0][1] as Record<string, string>
    expect(Object.keys(vars).length).toBeGreaterThan(0)
  })

  it('falls back to the "not available" note when the selected id has no matching row', () => {
    // rows empty -> blockType undefined -> non-stylable branch. Confirms the lookup
    // doesn't crash when selection and form-state rows are momentarily out of sync.
    mockRows = []
    render(<BlockInspector patch={vi.fn()} setScheme={vi.fn()} reload={vi.fn()} />)
    showStyleTab()
    expect(screen.getByText(/full styling isn't available for this block yet/i)).toBeTruthy()
  })

  it('renders the scheme control for a block with a scheme field, and changing it updates the field and live-patches via setScheme', () => {
    mockRows = [{ id: 'a', blockType: 'hero' }]
    const setScheme = vi.fn()
    render(<BlockInspector patch={vi.fn()} setScheme={setScheme} reload={vi.fn()} />)
    showStyleTab()

    const schemeSelect = screen.getByRole('combobox', { name: /scheme/i }) as HTMLSelectElement
    const optionValues = Array.from(schemeSelect.querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value)
    expect(optionValues).toEqual(['', 'default', 'muted', 'inverse', 'accent'])

    fireEvent.change(schemeSelect, { target: { value: 'muted' } })

    expect(setSchemeValue).toHaveBeenCalledWith('muted')
    expect(setScheme).toHaveBeenCalledWith('a', 'muted')
  })

  it('mounts VariantPickerField at the row-scoped path for a block with a variant field', () => {
    mockRows = [{ id: 'a', blockType: 'hero' }]
    render(<BlockInspector patch={vi.fn()} setScheme={vi.fn()} reload={vi.fn()} />)
    showLayoutTab()

    const picker = screen.getByTestId('variant-picker')
    expect(picker.getAttribute('data-path')).toBe('layout.0.variant')
  })

  it('hides the scheme control and the variant picker for a block with neither field', () => {
    mockRows = [{ id: 'a', blockType: 'richText' }]
    render(<BlockInspector patch={vi.fn()} setScheme={vi.fn()} reload={vi.fn()} />)

    showStyleTab()
    expect(screen.queryByRole('combobox', { name: /scheme/i })).toBeNull()

    showLayoutTab()
    expect(screen.queryByTestId('variant-picker')).toBeNull()
  })

  it('reloads the preview when the variant value changes for the selected block, but not on mount', () => {
    mockRows = [{ id: 'a', blockType: 'hero' }]
    mockFlatFields = { 'layout.0.variant': { value: 'centered' } }
    const reload = vi.fn()
    const { rerender } = render(<BlockInspector patch={vi.fn()} setScheme={vi.fn()} reload={reload} />)
    expect(reload).not.toHaveBeenCalled()

    mockFlatFields = { 'layout.0.variant': { value: 'split' } }
    rerender(<BlockInspector patch={vi.fn()} setScheme={vi.fn()} reload={reload} />)
    expect(reload).toHaveBeenCalledTimes(1)

    // Re-rendering with the same (already-applied) value must not reload again.
    rerender(<BlockInspector patch={vi.fn()} setScheme={vi.fn()} reload={reload} />)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe('BlockInspector — no selection', () => {
  afterEach(() => {
    vi.doUnmock('./selection')
    vi.resetModules()
  })

  it('shows an empty state prompting the admin to select a block', async () => {
    vi.resetModules()
    vi.doMock('./selection', () => ({
      useSelection: () => ({ selectedId: null, select: vi.fn() }),
    }))
    mockRows = [{ id: 'a', blockType: 'hero' }]
    const { BlockInspector: BlockInspectorNoSelection } = await import('./BlockInspector')
    render(<BlockInspectorNoSelection patch={vi.fn()} setScheme={vi.fn()} reload={vi.fn()} />)
    expect(screen.getByText(/select a block to edit it/i)).toBeTruthy()
    expect(screen.queryAllByRole('combobox').length).toBe(0)
  })
})

describe('BlockInspector — Content / Style / Layout tabs', () => {
  it('renders three tabs and opens on Content', () => {
    renderInspectorFor('hero')
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    expect(tabs.map((t) => t.textContent)).toEqual(['Content', 'Style', 'Layout'])
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
  })

  it('opens on the Content tab so a newly added block is immediately fillable', () => {
    mockRows = [{ id: 'a', blockType: 'hero' }]
    render(<BlockInspector patch={vi.fn()} setScheme={vi.fn()} reload={vi.fn()} />)

    expect(screen.getByRole('tab', { name: /content/i }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('content-editor')).toBeTruthy()
  })

  it('shows the style controls only on the Style tab, and the content editor only on Content', () => {
    mockRows = [{ id: 'a', blockType: 'hero' }]
    render(<BlockInspector patch={vi.fn()} setScheme={vi.fn()} reload={vi.fn()} />)

    expect(document.querySelector('.nb-pb-inspector__groups')).toBeNull()

    showStyleTab()
    expect(document.querySelector('.nb-pb-inspector__groups')).toBeTruthy()
    expect(screen.queryByTestId('content-editor')).toBeNull()
  })

  it('puts section density and width on Layout, not Style', () => {
    renderInspectorFor('hero')
    showLayoutTab()
    expect(screen.getByText('Section')).toBeTruthy()
  })

  it('returns to the Content tab when a different block is selected', () => {
    // Selecting another block in the outline (or clicking one in the preview)
    // should land on its content, not leave the admin on the previous block's
    // Style tab wondering where the fields went.
    mockRows = [{ id: 'a', blockType: 'hero' }, { id: 'b', blockType: 'faq' }]
    const { rerender } = render(<BlockInspector patch={vi.fn()} setScheme={vi.fn()} reload={vi.fn()} />)

    showStyleTab()
    expect(screen.getByRole('tab', { name: /style/i }).getAttribute('aria-selected')).toBe('true')

    mockSelectedId = 'b'
    rerender(<BlockInspector patch={vi.fn()} setScheme={vi.fn()} reload={vi.fn()} />)

    expect(screen.getByRole('tab', { name: /content/i }).getAttribute('aria-selected')).toBe('true')
  })

  it('resets to Content when the selected block changes', () => {
    const { rerender } = renderInspectorFor('hero')
    showLayoutTab()
    expect(screen.getByRole('tab', { name: 'Layout' }).getAttribute('aria-selected')).toBe('true')

    rerender(inspectorFor('faq'))
    expect(screen.getByRole('tab', { name: 'Content' }).getAttribute('aria-selected')).toBe('true')
  })
})

describe('BlockInspector — Layout tab', () => {
  it('renders the layout fields on Layout, not on Content or Style', () => {
    // Height, alignment and overlay are layout decisions. They used to sit in
    // the Content tab between `overlay` and `primaryCtaLabel`, where nobody
    // resizing a hero would look — then on the Style tab (Task 5) mixed in
    // with typography, which is no better a home. Task 6 gives them their
    // own tab.
    mockRows = [{ id: 'a', blockType: 'hero' }]
    render(<BlockInspector patch={vi.fn()} setScheme={vi.fn()} reload={vi.fn()} />)

    expect(screen.queryByTestId('layout-fields')).toBeNull()

    showStyleTab()
    expect(screen.queryByTestId('layout-fields')).toBeNull()

    showLayoutTab()
    expect(screen.getByTestId('layout-fields')).toBeTruthy()
    expect(screen.queryByTestId('content-editor')).toBeNull()
  })

  it('keeps the variant picker alongside the layout fields, and the scheme control on Style instead', () => {
    mockRows = [{ id: 'a', blockType: 'hero' }]
    render(<BlockInspector patch={vi.fn()} setScheme={vi.fn()} reload={vi.fn()} />)

    showStyleTab()
    expect(screen.getByRole('combobox', { name: /scheme/i })).toBeTruthy()
    expect(screen.queryByTestId('variant-picker')).toBeNull()
    expect(screen.queryByTestId('layout-fields')).toBeNull()

    showLayoutTab()
    expect(screen.getByTestId('variant-picker')).toBeTruthy()
    expect(screen.getByTestId('layout-fields')).toBeTruthy()
  })
})

describe('BlockInspector — hidden-groups note', () => {
  it('tells the merchant how many controls are hidden and why', () => {
    // Product Grid reads eyebrow, heading and section — 13 of the 28 controls
    // belong to groups it cannot use. The count is read off `styleGroupsFor`
    // against the full vocabulary, not against whichever tab is open, so it
    // must stay 13 even though `section` itself now renders on the Layout
    // tab rather than Style.
    renderInspectorFor('productGrid')
    showStyleTab()
    const note = screen.getByTestId('nb-hidden-groups-note')
    expect(note).toBeTruthy()
    expect(note.textContent).toContain('13')
  })

  it('shows no hidden-groups note for Hero, which reads every group', () => {
    renderInspectorFor('hero')
    showStyleTab()
    expect(screen.queryByTestId('nb-hidden-groups-note')).toBeNull()
  })

  it('points to the Layout tab for a section-only block, instead of implying controls are hidden on this one', () => {
    // Regression coverage (MINOR-8): Logo Strip's only live group is
    // `section`, which is entirely filtered onto the Layout tab — so the
    // Style tab renders ZERO controls. The old copy ("26 of 28 aren't shown")
    // implied 2 controls WERE visible right here; a merchant seeing nothing
    // was told the wrong thing. The new copy names the actual count and tab.
    renderInspectorFor('logoStrip')
    showStyleTab()
    const note = screen.getByTestId('nb-hidden-groups-note')
    expect(note).toBeTruthy()
    expect(note.textContent).toContain('2')
    expect(note.textContent).toContain('28')
    expect(note.textContent).toContain('Layout tab')
  })
})

describe('BlockInspector — promote-to-store-wide reachability', () => {
  // Regression coverage: Task 4 built and unit-tested the promote affordance
  // entirely inside StyleControlGroups.test.tsx, but AllStyleGroups only
  // renders it when a `blockType` prop is actually passed in — and this
  // component's Style-tab call site didn't pass one, so the button was fully
  // implemented and fully inert. A unit test on StyleControlGroups alone can
  // never catch that: it renders AllStyleGroups directly with an explicit
  // `blockType`, so it can't see whether the REAL caller forwards one. Only a
  // test through BlockInspector itself, asserting on what a merchant would
  // actually see, catches a caller that forgets the prop.
  it('passes the selected block\'s type through, so the promote-to-store-wide button is reachable', () => {
    renderInspectorFor('hero')
    showStyleTab()
    expect(screen.getByRole('button', { name: /use this style for all/i })).toBeTruthy()
  })

  it('renders no promote affordance when the selection cannot be resolved to a block type', () => {
    // selectedId doesn't match any row's id — the same "stale selection"
    // shape idx/blockType already defend against elsewhere in this
    // component (isStylable also goes false here). Confirms the affordance
    // degrades to simply absent rather than rendering with a blank/broken
    // "Use this style for all  blocks" label when blockType is undefined.
    mockRows = [{ id: 'other-row', blockType: 'hero' }]
    mockSelectedId = 'a'
    render(<BlockInspector patch={vi.fn()} setScheme={vi.fn()} reload={vi.fn()} />)
    showStyleTab()
    expect(screen.queryByRole('button', { name: /use this style for all/i })).toBeNull()
  })
})

