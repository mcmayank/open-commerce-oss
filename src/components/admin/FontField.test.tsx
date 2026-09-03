// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import FontField, { QUICK_PICKS, filterFamilies } from './FontField'
import type { PickerFamily } from '@/lib/fonts/types'

const setValue = vi.fn()
let mockValue = ''

vi.mock('@payloadcms/ui', () => ({
  useField: () => ({ value: mockValue, setValue }),
}))

type FetchResponse = { ok: boolean; json: () => Promise<unknown> }

function stubFontsFetch(families: PickerFamily[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (): Promise<FetchResponse> => ({ ok: true, json: async () => ({ families }) })),
  )
}

afterEach(() => {
  cleanup()
  setValue.mockReset()
  mockValue = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const family = (name: string, overrides: Partial<PickerFamily> = {}): PickerFamily => ({
  family: name,
  category: 'sans-serif',
  variable: false,
  selectable: true,
  ...overrides,
})

const CATALOG = ['Inter', 'Space Grotesk', 'Space Mono', 'Playfair Display'].map((n) => family(n))

describe('filterFamilies', () => {
  it('returns everything for an empty query, capped', () => {
    const result = filterFamilies(CATALOG, '')
    expect(result.length).toBe(CATALOG.length)
  })

  it('matches case-insensitively on a substring', () => {
    const result = filterFamilies(CATALOG, 'space')
    expect(result.map((f) => f.family)).toEqual(['Space Grotesk', 'Space Mono'])
  })

  it('returns an empty list for a query that matches nothing', () => {
    // Positive control lives in the test above: if filterFamilies returned
    // everything unconditionally, that test would fail, so this one cannot
    // pass vacuously.
    expect(filterFamilies(CATALOG, 'zzzznotafont')).toEqual([])
  })

  it('caps the result list so the picker never renders the whole catalog', () => {
    const many = Array.from({ length: 500 }, (_, i) => family(`Font ${i}`))
    expect(filterFamilies(many, '').length).toBeLessThanOrEqual(60)
  })
})

describe('QUICK_PICKS', () => {
  it('offers the system stack plus the five pre-existing families, so no merchant loses their setup', () => {
    expect(QUICK_PICKS).toEqual([
      'system',
      'Inter',
      'Poppins',
      'Merriweather',
      'Cormorant Garamond',
      'Jost',
    ])
  })
})

const field = { name: 'fontFamily', label: 'Body font' } as never

describe('FontField', () => {
  it('renders each quick pick in its own typeface', () => {
    render(<FontField field={field} path="theme.fontFamily" />)
    const poppins = screen.getByText('Poppins') as HTMLElement
    expect(poppins.style.fontFamily).toContain('Poppins')
    const system = screen.getByText('System') as HTMLElement
    expect(system.style.fontFamily).not.toContain('Poppins')
  })

  it('narrows the result list to a typed query', async () => {
    stubFontsFetch([family('Space Grotesk'), family('Space Mono'), family('Playfair Display')])
    render(<FontField field={field} path="theme.fontFamily" />)

    fireEvent.change(screen.getByPlaceholderText('Search Google Fonts…'), {
      target: { value: 'space' },
    })

    await waitFor(() => {
      expect(screen.getByText('Space Grotesk')).toBeTruthy()
    })
    expect(screen.getByText('Space Mono')).toBeTruthy()
    // Positive control: a non-matching family is not just hidden by CSS, it
    // never renders — otherwise this suite could pass with filtering broken.
    // (Not "Inter" — that's also a QUICK_PICKS button and would always render.)
    expect(screen.queryByText('Playfair Display')).toBeNull()
  })

  it('selecting a selectable family persists the value and clears the query', async () => {
    stubFontsFetch([family('Space Grotesk')])
    render(<FontField field={field} path="theme.fontFamily" />)

    fireEvent.change(screen.getByPlaceholderText('Search Google Fonts…'), {
      target: { value: 'space' },
    })

    const row = await screen.findByText('Space Grotesk')
    fireEvent.click(row)

    expect(setValue).toHaveBeenCalledWith('Space Grotesk')
    // Selection clears the search box's local `query` state — note the mocked
    // `useField` above does not actually persist `value`, so the placeholder
    // stays the "no current value" variant; only the input's own value clears.
    expect((screen.getByPlaceholderText('Search Google Fonts…') as HTMLInputElement).value).toBe('')
  })

  it('renders an unselectable family dimmed, non-clickable, with a reason — and a selectable one stays clickable', async () => {
    // Positive control: Available Font must still be a real, clickable button
    // in the same list, so this test cannot pass by the whole list being inert.
    stubFontsFetch([
      family('Available Font', { selectable: true }),
      family('Unavailable Font', { selectable: false }),
    ])
    render(<FontField field={field} path="theme.fontFamily" />)

    fireEvent.change(screen.getByPlaceholderText('Search Google Fonts…'), {
      target: { value: 'font' },
    })

    await waitFor(() => {
      expect(screen.getByText('Unavailable Font')).toBeTruthy()
    })
    expect(screen.getByText(/Unavailable in this theme/)).toBeTruthy()

    const availableRow = screen.getByText('Available Font').closest('button')
    expect(availableRow).not.toBeNull()
    const unavailableRow = screen.getByText('Unavailable Font').closest('button')
    expect(unavailableRow).toBeNull()

    fireEvent.click(screen.getByText('Unavailable Font'))
    expect(setValue).not.toHaveBeenCalled()

    fireEvent.click(availableRow!)
    expect(setValue).toHaveBeenCalledWith('Available Font')
  })
})
