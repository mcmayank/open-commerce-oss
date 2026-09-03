// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { RemoveSampleContentCard } from './RemoveSampleContentCard'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const counts = { media: 10, categories: 3, products: 10, pages: 0 }
/** A tenant whose homepage came from the pack — the row removal resets rather than deletes. */
const countsWithPage = { ...counts, pages: 1 }
/**
 * A merchant who bulk-deleted the seeded products, categories and media in the
 * admin list view. The sample homepage survives, and this card is the only UI
 * that resets it — so it still renders, and its copy has to cope.
 */
const pageOnlyCounts = { media: 0, categories: 0, products: 0, pages: 1 }

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  refresh.mockReset()
})

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('RemoveSampleContentCard', () => {
  it('shows the real counts', () => {
    render(<RemoveSampleContentCard counts={counts} />)
    expect(screen.getByText(/10 sample products, 3 categories and/)).toBeTruthy()
  })

  it('requires confirmation before removing, and the confirmation states the counts and that it cannot be undone', () => {
    render(<RemoveSampleContentCard counts={counts} />)
    expect(screen.queryByRole('alert')).toBeNull()

    fireEvent.click(screen.getByText('Remove sample products'))

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Remove 10 products, 3 categories and 10 images')
    expect(alert.textContent).toContain('includes any you have edited')
    expect(alert.textContent).toContain('cannot be undone')
  })

  // The counts name products, categories and images. The homepage is neither,
  // and it is the one thing removal changes without deleting — say so, or the
  // merchant finds their storefront front page different and unaccounted for.
  it('says the homepage goes back to the starter layout when the pack supplied one', () => {
    render(<RemoveSampleContentCard counts={countsWithPage} />)
    expect(screen.getByText(/your homepage came with the pack too/i)).toBeTruthy()

    fireEvent.click(screen.getByText('Remove sample products'))
    expect(screen.getByRole('alert').textContent).toContain(
      'Your homepage goes back to the standard starter layout',
    )
  })

  // "including any changes you made to it" reads as though the changes come
  // across. They are destroyed. This is the confirmation step of an
  // irreversible action, so the wording has to be unambiguous.
  it('says the homepage changes are discarded, not carried over', () => {
    render(<RemoveSampleContentCard counts={countsWithPage} />)
    fireEvent.click(screen.getByText('Remove sample products'))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('discarding any changes you made to it')
    expect(alert.textContent).not.toContain('including any changes')
  })

  // The card now appears for a sample homepage alone. Formatted naively that
  // asks the merchant to confirm "Remove 0 products, 0 categories and 0 images".
  it('drops the zeroed counts when the homepage is the only sample row left', () => {
    render(<RemoveSampleContentCard counts={pageOnlyCounts} />)
    expect(document.body.textContent).not.toContain('0 products')
    expect(document.body.textContent).not.toContain('0 categories')
    expect(document.body.textContent).not.toContain('0 images')

    fireEvent.click(screen.getByText('Reset sample homepage'))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Reset your homepage to the standard starter layout')
    expect(alert.textContent).toContain('discarding any changes you made to it')
    expect(alert.textContent).toContain('cannot be undone')
    expect(alert.textContent).not.toContain('0 ')
  })

  // Singulars, once any count can legitimately be 1.
  it('does not say "1 products"', () => {
    render(<RemoveSampleContentCard counts={{ media: 1, categories: 1, products: 1, pages: 1 }} />)
    expect(screen.getByText(/1 sample product, 1 category and 1 image\./)).toBeTruthy()
  })

  it('says nothing about the homepage when the pack did not supply one', () => {
    render(<RemoveSampleContentCard counts={counts} />)
    fireEvent.click(screen.getByText('Remove sample products'))
    expect(screen.getByRole('alert').textContent).not.toContain('homepage')
    expect(screen.queryByText(/came with the pack/i)).toBeNull()
  })

  it('cancel dismisses the confirmation without calling the API', () => {
    render(<RemoveSampleContentCard counts={counts} />)
    fireEvent.click(screen.getByText('Remove sample products'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('refreshes the page after a successful removal', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ removed: counts }),
    })
    render(<RemoveSampleContentCard counts={counts} />)
    fireEvent.click(screen.getByText('Remove sample products'))
    fireEvent.click(screen.getByText('Yes, remove them'))
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/samples/remove',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('shows the server error inline and does not refresh', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Not authorised.' }),
    })
    render(<RemoveSampleContentCard counts={counts} />)
    fireEvent.click(screen.getByText('Remove sample products'))
    fireEvent.click(screen.getByText('Yes, remove them'))
    await waitFor(() => expect(screen.getByText('Not authorised.')).toBeTruthy())
    expect(refresh).not.toHaveBeenCalled()
  })

  it('shows a network error inline when the request cannot reach the server', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'))
    render(<RemoveSampleContentCard counts={counts} />)
    fireEvent.click(screen.getByText('Remove sample products'))
    fireEvent.click(screen.getByText('Yes, remove them'))
    await waitFor(() =>
      expect(screen.getByText('Could not reach the server. Please try again.')).toBeTruthy(),
    )
    expect(refresh).not.toHaveBeenCalled()
  })
})
