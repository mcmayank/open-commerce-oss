// @vitest-environment jsdom
import * as React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SECTION_PRESETS } from '@/blocks/recipe/presets'

/**
 * Mirrors VariantOptionValues.test.tsx / SectionPresetField.test.tsx: a fake
 * `useField` keyed to the one path this component reads/writes (`content`),
 * and a fake `useFormFields` reading the sibling `definition` id out of a
 * plain field-state object this suite controls directly.
 */
type FieldState = Record<string, { value: unknown }>

let fieldState: FieldState = {}
let contentValue: unknown = null
const setContentValue = vi.fn((v: unknown) => {
  contentValue = v
})

vi.mock('@payloadcms/ui', () => ({
  useField: () => ({ value: contentValue, setValue: setContentValue }),
  useFormFields: (selector: (args: [FieldState, unknown]) => unknown) => selector([fieldState, () => {}]),
  FieldLabel: ({ label }: { label: string }) => <span>{label}</span>,
}))

const mod = await import('./RecipeContentField')
const RecipeContentField = mod.default as unknown as React.FC<{
  path: string
  field: { label?: string }
}>

const portraitCards = SECTION_PRESETS.find((p) => p.id === 'portraitCards')!.recipe

function stubFetchOnce(response: { ok: boolean; json: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: response.ok, json: async () => response.json }),
  )
}

/**
 * Routes distinct URLs (by prefix) to distinct responses. Needed once a test
 * exercises the media slot through the whole seam: it hits the definition
 * fetch AND whichever of RecipeMediaInput's own endpoints its state needs
 * (`/api/media/<id>?depth=0` for a current selection, `/api/media?limit=24…`
 * for the picker list) — `stubFetchOnce`'s single canned response can't tell
 * those apart.
 */
function stubFetchByUrl(byUrl: Record<string, { ok: boolean; json: unknown }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const match = Object.keys(byUrl).find((key) => url.startsWith(key))
      if (!match) throw new Error(`unexpected fetch: ${url}`)
      const { ok, json } = byUrl[match]!
      return { ok, json: async () => json }
    }),
  )
}

beforeEach(() => {
  fieldState = {}
  contentValue = null
  setContentValue.mockClear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('RecipeContentField', () => {
  it('says to choose a section when no definition is picked yet', () => {
    // No `layout.2.definition` entry at all — an unpopulated relationship.
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    render(<RecipeContentField path="layout.2.content" field={{ label: 'Content' }} />)
    expect(screen.getByText(/choose a section above/i)).toBeTruthy()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('renders an input per slot, labelled with the slot label, once the published recipe loads', async () => {
    fieldState = { 'layout.2.definition': { value: 'def-1' } }
    stubFetchOnce({ ok: true, json: { _status: 'published', recipe: portraitCards } })

    render(<RecipeContentField path="layout.2.content" field={{ label: 'Content' }} />)

    // Header slot: heading labelled "Section title".
    await screen.findByLabelText('Section title')
    // Item slots, once per declared atom — labels come straight from the recipe.
    // The "Image" (media) slot is a RecipeMediaInput picker, not a plain
    // labelled input, so it's asserted via its "Choose image" control instead.
    expect(screen.getAllByRole('button', { name: /Choose image/i })).toHaveLength(3) // count: 3 in the preset
    expect(screen.getAllByLabelText('Small label')).toHaveLength(3)
    expect(screen.getAllByLabelText('Title')).toHaveLength(3)
    expect(screen.getAllByLabelText('Description')).toHaveLength(3)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/section-definitions/def-1?depth=0',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('points every generated label at a control that exists, including the media slot', async () => {
    // The media branch renders a picker, not an <input>, so it used to ignore
    // the `id` this form hands its inputs — leaving `<label htmlFor="…-image">`
    // attached to nothing and a screen reader announcing "Image" with no
    // control. Resolving each label's `htmlFor` through the DOM is what catches
    // that; asserting the label's *text* renders would not, since the orphaned
    // label rendered fine.
    fieldState = { 'layout.2.definition': { value: 'def-1' } }
    stubFetchOnce({ ok: true, json: { _status: 'published', recipe: portraitCards } })

    const { container } = render(<RecipeContentField path="layout.2.content" field={{ label: 'Content' }} />)
    await screen.findByLabelText('Section title')

    const labels = [...container.querySelectorAll('label[for]')]
    // Guard: zero labels would satisfy the loop below vacuously.
    expect(labels.length).toBeGreaterThan(0)
    // And the media labels specifically are among them — the whole point.
    const imageLabels = labels.filter((l) => l.textContent === 'Image')
    expect(imageLabels).toHaveLength(3) // count: 3 in the preset

    for (const label of labels) {
      const id = label.getAttribute('for')!
      // Attribute selector, not `#id`: these ids embed the field path and so
      // contain dots, which a bare `#` selector would read as a class.
      expect(container.querySelector(`[id="${id}"]`)).toBeTruthy()
    }
  })

  it('says to publish first when the definition has no published version', async () => {
    fieldState = { 'layout.2.definition': { value: 'def-1' } }
    stubFetchOnce({ ok: true, json: { _status: 'draft', recipe: portraitCards } })

    render(<RecipeContentField path="layout.2.content" field={{ label: 'Content' }} />)

    await screen.findByText(/publish this section before filling it in/i)
    expect(screen.queryByLabelText('Section title')).toBeNull()
  })

  it('writes a scalar into the right item index, leaving the rest untouched', async () => {
    // Uses the "Small label" (plain text) slot rather than "Image": the media
    // slot is a RecipeMediaInput picker now (Task 8), covered by its own
    // scalar-invariant tests in RecipeMediaInput.test.tsx, and isn't driven by
    // a simple `fireEvent.change` the way a text input is.
    fieldState = { 'layout.2.definition': { value: 'def-1' } }
    stubFetchOnce({ ok: true, json: { _status: 'published', recipe: portraitCards } })

    render(<RecipeContentField path="layout.2.content" field={{ label: 'Content' }} />)
    const labelInputs = await screen.findAllByLabelText('Small label')
    expect(labelInputs).toHaveLength(3)

    fireEvent.change(labelInputs[1]!, { target: { value: 'New arrival' } })

    expect(setContentValue).toHaveBeenCalledTimes(1)
    const written = setContentValue.mock.calls[0]![0] as { header: unknown; items: Record<string, unknown>[] }
    expect(written.items).toHaveLength(3)
    expect(written.items[1]!.label).toBe('New arrival')
    expect(typeof written.items[1]!.label).toBe('string')
    expect(written.items[0]).toEqual({})
    expect(written.items[2]).toEqual({})
    expect(written.header).toEqual({})
  })

  // Task 8's own integration seam: RecipeMediaInput.test.tsx proves the
  // picker calls ITS OWN onChange with a bare id, but never touches the
  // wrapper closure in RecipeContentField's `'media'` case that (a) coerces
  // a stored empty string back to "nothing picked" on read and (b) coerces
  // the picker's `string | number | null` back to the content blob's plain
  // string convention on write. A bug in either coercion — writing to the
  // header closure instead of the item closure, or dropping the `String()` —
  // would pass every test in the diff without this.
  it('picks a media id into the right item slot as a bare scalar, through the whole RecipeContentField seam', async () => {
    fieldState = { 'layout.2.definition': { value: 'def-1' } }
    stubFetchByUrl({
      '/api/section-definitions/def-1?depth=0': { ok: true, json: { _status: 'published', recipe: portraitCards } },
      '/api/media?limit=24': { ok: true, json: { docs: [{ id: 99, url: '/img.webp', alt: 'Cool image' }] } },
    })

    render(<RecipeContentField path="layout.2.content" field={{ label: 'Content' }} />)

    const chooseButtons = await screen.findAllByRole('button', { name: 'Choose image for Image' })
    expect(chooseButtons).toHaveLength(3)
    fireEvent.click(chooseButtons[1]!) // the SECOND item's media slot

    const tile = await screen.findByRole('button', { name: 'Cool image' })
    fireEvent.click(tile)

    expect(setContentValue).toHaveBeenCalledTimes(1)
    const written = setContentValue.mock.calls[0]![0] as { header: unknown; items: Record<string, unknown>[] }
    expect(written.items).toHaveLength(3)
    expect(written.items[1]!.image).toBe('99') // the bare id, coerced to the content blob's string convention
    expect(typeof written.items[1]!.image).toBe('string')
    expect(written.items[0]).toEqual({})
    expect(written.items[2]).toEqual({})
    expect(written.header).toEqual({})
  })

  it('clears a media slot back to unset, not the literal string "null" or "undefined"', async () => {
    fieldState = { 'layout.2.definition': { value: 'def-1' } }
    // Item 1 already has a media id stored; items 0 and 2 have nothing —
    // read coercion is exercised on all three (only item 1 fetches a doc).
    contentValue = { header: {}, items: [{}, { image: '99' }, {}] }
    stubFetchByUrl({
      '/api/section-definitions/def-1?depth=0': { ok: true, json: { _status: 'published', recipe: portraitCards } },
      '/api/media/99?depth=0': { ok: true, json: { id: 99, url: '/img.webp', alt: 'Cool image' } },
    })

    render(<RecipeContentField path="layout.2.content" field={{ label: 'Content' }} />)

    // Only item 1 has a value, so only it renders a "Remove" control —
    // proof the read coercion correctly told items 0 and 2 there is nothing
    // picked, rather than trying (and 404ing) a fetch for an empty id.
    const removeButtons = await screen.findAllByRole('button', { name: 'Remove image for Image' })
    expect(removeButtons).toHaveLength(1)
    fireEvent.click(removeButtons[0]!)

    expect(setContentValue).toHaveBeenCalledTimes(1)
    const written = setContentValue.mock.calls[0]![0] as { header: unknown; items: Record<string, unknown>[] }
    expect(written.items[1]!.image).toBe('')
    expect(written.items[1]!.image).not.toBe('null')
    expect(written.items[1]!.image).not.toBe('undefined')
    expect(written.items[0]).toEqual({})
    expect(written.items[2]).toEqual({})
  })

  it('writes a scalar into the header when a header field is typed into', async () => {
    fieldState = { 'layout.2.definition': { value: 'def-1' } }
    stubFetchOnce({ ok: true, json: { _status: 'published', recipe: portraitCards } })

    render(<RecipeContentField path="layout.2.content" field={{ label: 'Content' }} />)
    const title = await screen.findByLabelText('Section title')

    fireEvent.change(title, { target: { value: 'New arrivals' } })

    expect(setContentValue).toHaveBeenCalledTimes(1)
    const written = setContentValue.mock.calls[0]![0] as { header: Record<string, unknown>; items: unknown[] }
    expect(written.header).toEqual({ title: 'New arrivals' })
    await waitFor(() => {})
  })

  // Critical 1: republishing a recipe with a smaller `count` must never make
  // typing into a visible item destroy items the form can no longer show.
  it('never shrinks stored items below what is already saved, even though only `count` render', async () => {
    fieldState = { 'layout.2.definition': { value: 'def-1' } }
    // Five items were saved against an earlier, wider version of this recipe;
    // the current published version only declares 3.
    contentValue = {
      header: {},
      items: [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'd' }, { label: 'e' }],
    }
    stubFetchOnce({ ok: true, json: { _status: 'published', recipe: portraitCards } })

    render(<RecipeContentField path="layout.2.content" field={{ label: 'Content' }} />)
    const labelInputs = await screen.findAllByLabelText('Small label')
    expect(labelInputs).toHaveLength(3) // only 3 fieldsets render — the form respects `count`

    // Typing into the FIRST visible item is the case that silently destroyed
    // items 3 and 4 before this fix: any write at all rebuilt `items` to
    // length `itemCount`.
    fireEvent.change(labelInputs[0]!, { target: { value: 'a-edited' } })

    expect(setContentValue).toHaveBeenCalledTimes(1)
    const written = setContentValue.mock.calls[0]![0] as { items: Record<string, unknown>[] }
    expect(written.items).toHaveLength(5)
    expect(written.items[0]).toEqual({ label: 'a-edited' })
    expect(written.items[3]).toEqual({ label: 'd' })
    expect(written.items[4]).toEqual({ label: 'e' })
  })

  // Critical 1's disclosure: extra saved items the form cannot show should
  // say so, rather than looking like they were quietly dropped.
  it('tells the merchant when saved items are hidden by a smaller current count', async () => {
    fieldState = { 'layout.2.definition': { value: 'def-1' } }
    contentValue = { header: {}, items: [{}, {}, {}, {}, {}] }
    stubFetchOnce({ ok: true, json: { _status: 'published', recipe: portraitCards } })

    render(<RecipeContentField path="layout.2.content" field={{ label: 'Content' }} />)
    await screen.findAllByLabelText('Small label')

    expect(screen.getByText(/2 additional items.*kept but hidden/i)).toBeTruthy()
  })

  // Critical 2: a malformed stored recipe must never blank the merchant's
  // whole edit view. `slotFieldsOf` itself has no defence against a `null`
  // template entry or a non-array `template` — it is `parseRecipe`, called
  // here for the first time, that sanitizes both away before slotFieldsOf
  // ever sees them.
  it('does not crash on a template that is not an array — renders the sanitized recipe instead', async () => {
    fieldState = { 'layout.2.definition': { value: 'def-1' } }
    const malformed = { ...portraitCards, items: { ...portraitCards.items, template: { not: 'an array' } } }
    stubFetchOnce({ ok: true, json: { _status: 'published', recipe: malformed } })

    render(<RecipeContentField path="layout.2.content" field={{ label: 'Content' }} />)

    // The header still renders; a non-array template drops the whole `items`
    // block (parse.ts's own documented behaviour), leaving no item fieldsets
    // — but nothing throws.
    await screen.findByLabelText('Section title')
    expect(screen.queryByLabelText('Small label')).toBeNull()
  })

  it('does not crash on a template array containing a null entry — drops it, keeps the rest', async () => {
    fieldState = { 'layout.2.definition': { value: 'def-1' } }
    const malformed = {
      ...portraitCards,
      items: { ...portraitCards.items, template: [null, ...portraitCards.items!.template] },
    }
    stubFetchOnce({ ok: true, json: { _status: 'published', recipe: malformed } })

    render(<RecipeContentField path="layout.2.content" field={{ label: 'Content' }} />)

    await screen.findByLabelText('Section title')
    expect(screen.getAllByLabelText('Small label')).toHaveLength(3)
  })

  it('shows a distinct message when the stored recipe fails validation entirely', async () => {
    fieldState = { 'layout.2.definition': { value: 'def-1' } }
    // `version: 2` is unsupported — parseRecipe throws rather than dropping
    // or defaulting, since an unknown version cannot be safely read as v1.
    stubFetchOnce({ ok: true, json: { _status: 'published', recipe: { ...portraitCards, version: 2 } } })

    render(<RecipeContentField path="layout.2.content" field={{ label: 'Content' }} />)

    await screen.findByText(/section's layout is not valid/i)
    expect(screen.queryByLabelText('Section title')).toBeNull()
  })

  // Important 3: a deleted/inaccessible definition must read differently
  // from a definition that merely has no published version — the merchant
  // cannot act on "publish this" for something that no longer exists.
  it('distinguishes a failed fetch from an unpublished draft', async () => {
    fieldState = { 'layout.2.definition': { value: 'def-1' } }
    stubFetchOnce({ ok: false, json: {} })

    render(<RecipeContentField path="layout.2.content" field={{ label: 'Content' }} />)

    await screen.findByText(/could not be loaded/i)
    expect(screen.queryByText(/publish this section/i)).toBeNull()
  })

  it('shows the load-failure state when the fetch itself rejects', async () => {
    fieldState = { 'layout.2.definition': { value: 'def-1' } }
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    render(<RecipeContentField path="layout.2.content" field={{ label: 'Content' }} />)

    await screen.findByText(/could not be loaded/i)
  })

  // The `active` guard exists to stop a STALE request — one issued for a
  // `definition` id that has since changed — from overwriting state a
  // FRESHER request already set. The ordering that actually exercises the
  // guard is the fresh response settling first and the stale one arriving
  // late: two requests resolved in the order they were issued (A-then-B)
  // preserve that order through the microtask queue regardless of any guard,
  // which is why an earlier version of this test passed even with the guard
  // deleted. Resolution order is controlled explicitly with deferred
  // promises, independent of creation order, to make the guard load-bearing.
  it('ignores a stale response that arrives after a fresher one has already rendered', async () => {
    fieldState = { 'layout.2.definition': { value: 'def-1' } }
    let resolveDef1!: (v: unknown) => void
    let resolveDef2!: (v: unknown) => void
    const def1Promise = new Promise((resolve) => {
      resolveDef1 = resolve
    })
    const def2Promise = new Promise((resolve) => {
      resolveDef2 = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('def-1')) return def1Promise
        if (url.includes('def-2')) return def2Promise
        throw new Error(`unexpected url: ${url}`)
      }),
    )

    const { rerender } = render(<RecipeContentField path="layout.2.content" field={{ label: 'Content' }} />)

    // The sibling `definition` id changes before def-1's request resolves —
    // def-1 is now stale, def-2 is fresh.
    fieldState = { 'layout.2.definition': { value: 'def-2' } }
    rerender(<RecipeContentField path="layout.2.content" field={{ label: 'Content' }} />)

    // The FRESH request (def-2, published) settles FIRST and is allowed to render.
    resolveDef2({ ok: true, json: async () => ({ _status: 'published', recipe: portraitCards }) })
    await screen.findByLabelText('Section title')

    // The STALE request (def-1, draft) settles AFTER. Unguarded, this
    // overwrites the fresh state with the stale draft's — the guard is what
    // makes it a no-op instead.
    //
    // Wrapped in `act`, not a bare microtask-count loop: React's Scheduler
    // can flush a state update on a macrotask boundary, not only a
    // microtask one, so awaiting plain `Promise.resolve()` a fixed number of
    // times is not guaranteed to observe it landing. `act` drains React's
    // own pending-work queue (whichever boundary it lands on) before its
    // promise settles, and a real `setTimeout` tick inside it gives that
    // queue somewhere to actually flush to.
    await act(async () => {
      resolveDef1({ ok: true, json: async () => ({ _status: 'draft', recipe: portraitCards }) })
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(screen.queryByText(/publish this section/i)).toBeNull()
    expect(screen.getByLabelText('Section title')).toBeTruthy()
  })

  // The unmount half of the `active` guard has no way to be observed as a
  // failing test: React 18+ silently no-ops a state update dispatched from
  // an unmounted function component's closure — no console warning (that
  // warning was removed in React 18), no thrown error, no visible side
  // effect of any kind. An earlier version of this test asserted on that
  // removed warning and could not fail with the guard deleted; there is no
  // honest replacement assertion available under real React 19 (this is a
  // React runtime fact, not a limitation of the `@payloadcms/ui` mock), so
  // the test is deleted rather than kept in a form that cannot discriminate.
  // The stale-id-change race above is what actually exercises `active`.
})
