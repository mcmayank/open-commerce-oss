// @vitest-environment jsdom
import * as React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
// These cases assert the multi-store query shapes, so pin the store-scope seam
// to its hosted branch; the OSS export replaces the overlay with the single-store one.
vi.mock('@/store-scope-overlay', () => ({ hostedScope: true }))

const mod = await import('./RecipeMediaInput')
const RecipeMediaInput = mod.default

type FetchResponse = { ok: boolean; json: () => Promise<unknown> }

/** Routes `/api/media/<id>?depth=0` and `/api/media?...` to different canned responses. */
function stubFetch(byUrl: Record<string, { ok: boolean; body?: unknown }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string): Promise<FetchResponse> => {
      const match = Object.keys(byUrl).find((key) => url.startsWith(key))
      if (!match) throw new Error(`unexpected fetch: ${url}`)
      const { ok, body } = byUrl[match]!
      return { ok, json: async () => body }
    }),
  )
}

/** Every `/api/media?...` URL requested, in order. */
function listRequests(): string[] {
  const fetchMock = globalThis.fetch as unknown as { mock: { calls: [string][] } }
  return fetchMock.mock.calls.map(([url]) => url).filter((url) => url.startsWith('/api/media?'))
}

const PAGE_1 = '/api/media?limit=24&depth=0&sort=-createdAt&page=1'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('RecipeMediaInput', () => {
  it('renders the current selection as a thumbnail with its alt text', async () => {
    stubFetch({
      '/api/media/42?depth=0': { ok: true, body: { id: 42, url: '/media/shoe.webp', alt: 'A red shoe' } },
    })

    render(<RecipeMediaInput value={42} onChange={vi.fn()} />)

    const img = await screen.findByAltText('A red shoe')
    expect(img.getAttribute('src')).toBe('/media/shoe.webp')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/media/42?depth=0',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('picking an image calls onChange with the bare id, never the doc object', async () => {
    stubFetch({
      '/api/media?': {
        ok: true,
        body: { docs: [{ id: 7, url: '/media/mug.webp', alt: 'Blue mug' }] },
      },
    })
    const onChange = vi.fn()

    render(<RecipeMediaInput value={null} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Choose image' }))
    const tile = await screen.findByRole('button', { name: 'Blue mug' })
    fireEvent.click(tile)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(7)
    // The scalar-slot invariant: a picked doc must never surface as an object.
    expect(typeof onChange.mock.calls[0]![0]).not.toBe('object')
  })

  it('omits the tenant constraint when no tenant is known (single-tenant self-host)', async () => {
    stubFetch({ '/api/media?': { ok: true, body: { docs: [{ id: 7, url: '/m.webp', alt: 'Blue mug' }] } } })

    render(<RecipeMediaInput value={null} onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose image' }))
    await screen.findByRole('button', { name: 'Blue mug' })

    expect(listRequests()).toEqual([PAGE_1])
  })

  it('scopes the query to the document tenant so another store’s media is never offered', async () => {
    stubFetch({ '/api/media?': { ok: true, body: { docs: [{ id: 7, url: '/m.webp', alt: 'Blue mug' }] } } })

    render(<RecipeMediaInput value={null} onChange={vi.fn()} tenantId={4} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose image' }))
    await screen.findByRole('button', { name: 'Blue mug' })

    // Exact URL, not a substring: the constraint has to reach the server, and
    // an unconstrained request would otherwise still satisfy a `toContain`.
    expect(listRequests()).toEqual([`${PAGE_1}&where[tenant][equals]=4`])
  })

  it('searches on the server rather than filtering the loaded page', async () => {
    stubFetch({
      '/api/media?': { ok: true, body: { docs: [{ id: 2, url: '/b.webp', alt: 'Red shoe' }] } },
    })

    render(<RecipeMediaInput value={null} onChange={vi.fn()} tenantId={4} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose image' }))
    await screen.findByRole('button', { name: 'Red shoe' })

    fireEvent.change(screen.getByPlaceholderText('Search by alt text…'), { target: { value: 'red' } })

    // The whole point of the fix: typing issues a NEW request carrying the term.
    // A client-side filter would leave the request list at length 1 forever,
    // which is what made image 25 of a 25-image library unreachable.
    await waitFor(() => {
      expect(listRequests()).toEqual([
        `${PAGE_1}&where[tenant][equals]=4`,
        `${PAGE_1}&where[tenant][equals]=4&where[alt][like]=red`,
      ])
    })
  })

  it('debounces typing into a single request', async () => {
    stubFetch({ '/api/media?': { ok: true, body: { docs: [] } } })

    render(<RecipeMediaInput value={null} onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose image' }))
    await waitFor(() => expect(listRequests()).toHaveLength(1))

    const box = screen.getByPlaceholderText('Search by alt text…')
    fireEvent.change(box, { target: { value: 'r' } })
    fireEvent.change(box, { target: { value: 're' } })
    fireEvent.change(box, { target: { value: 'red' } })

    await waitFor(() => expect(listRequests()).toHaveLength(2))
    expect(listRequests()[1]).toBe(`${PAGE_1}&where[alt][like]=red`)
  })

  it('Load more appends the next page and disappears at the end of the library', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string): Promise<FetchResponse> => {
        const page2 = url.includes('page=2')
        return {
          ok: true,
          json: async () => ({
            docs: page2
              ? [{ id: 2, url: '/b.webp', alt: 'Red shoe' }]
              : [{ id: 1, url: '/a.webp', alt: 'Blue mug' }],
            hasNextPage: !page2,
          }),
        }
      }),
    )

    render(<RecipeMediaInput value={null} onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose image' }))
    await screen.findByRole('button', { name: 'Blue mug' })
    expect(screen.queryByRole('button', { name: 'Red shoe' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))

    // Appended, not replaced — page 1's results must survive.
    await screen.findByRole('button', { name: 'Red shoe' })
    expect(screen.getByRole('button', { name: 'Blue mug' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  })

  it('does not offer Load more when the first page is the whole library', async () => {
    stubFetch({
      '/api/media?': { ok: true, body: { docs: [{ id: 1, url: '/a.webp', alt: 'Blue mug' }], hasNextPage: false } },
    })

    render(<RecipeMediaInput value={null} onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose image' }))
    await screen.findByRole('button', { name: 'Blue mug' })

    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  })

  it('a slow earlier search cannot overwrite the results of a later one', async () => {
    const resolvers: Array<(docs: unknown) => void> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (url: string) =>
          new Promise<FetchResponse>((resolve) => {
            resolvers.push((body) => resolve({ ok: true, json: async () => body }))
            void url
          }),
      ),
    )

    render(<RecipeMediaInput value={null} onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose image' }))
    await waitFor(() => expect(resolvers).toHaveLength(1))
    resolvers[0]!({ docs: [] })

    fireEvent.change(screen.getByPlaceholderText('Search by alt text…'), { target: { value: 're' } })
    await waitFor(() => expect(resolvers).toHaveLength(2))
    fireEvent.change(screen.getByPlaceholderText('Search by alt text…'), { target: { value: 'red' } })
    await waitFor(() => expect(resolvers).toHaveLength(3))

    // Newest lands first, then the stale "re" response arrives late.
    resolvers[2]!({ docs: [{ id: 2, url: '/b.webp', alt: 'Red shoe' }] })
    await screen.findByRole('button', { name: 'Red shoe' })
    resolvers[1]!({ docs: [{ id: 9, url: '/z.webp', alt: 'Stale result' }] })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Red shoe' })).toBeTruthy()
    })
    expect(screen.queryByRole('button', { name: 'Stale result' })).toBeNull()
  })

  it('warns when an already-saved pick belongs to another store', async () => {
    stubFetch({
      '/api/media/1537?depth=0': {
        ok: true,
        body: { id: 1537, url: '/media/chain.webp', alt: 'Layered Chain Set', tenant: 464 },
      },
    })

    render(<RecipeMediaInput value={1537} onChange={vi.fn()} tenantId={1} />)

    // The thumbnail still renders — the point is that it is no longer silent.
    await screen.findByAltText('Layered Chain Set')
    expect(screen.getByText(/belongs to a different store/i)).toBeTruthy()
  })

  it('does not warn when the saved pick belongs to this store', async () => {
    stubFetch({
      '/api/media/12?depth=0': {
        ok: true,
        body: { id: 12, url: '/media/tile.webp', alt: 'Values tile', tenant: 1 },
      },
    })

    render(<RecipeMediaInput value={12} onChange={vi.fn()} tenantId={1} />)

    await screen.findByAltText('Values tile')
    expect(screen.queryByText(/belongs to a different store/i)).toBeNull()
  })

  it('clearing calls onChange(null)', async () => {
    stubFetch({
      '/api/media/9?depth=0': { ok: true, body: { id: 9, url: '/media/hat.webp', alt: 'A hat' } },
    })
    const onChange = vi.fn()

    render(<RecipeMediaInput value={9} onChange={onChange} />)
    await screen.findByAltText('A hat')

    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('renders the empty state rather than throwing when the media doc 404s', async () => {
    stubFetch({
      '/api/media/404?depth=0': { ok: false, body: null },
    })

    expect(() => render(<RecipeMediaInput value={404} onChange={vi.fn()} />)).not.toThrow()

    await waitFor(() => {
      expect(screen.getByText(/could not be found/i)).toBeTruthy()
    })
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('shows a no-upload empty state pointing at the Media collection when nothing is selected', () => {
    render(<RecipeMediaInput value={null} onChange={vi.fn()} />)
    expect(screen.getByText(/no image selected/i)).toBeTruthy()
    const link = screen.getByRole('link', { name: 'Media' })
    expect(link.getAttribute('href')).toBe('/admin/collections/media')
  })
})
