// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { SeedSampleProductsButton } from './SeedSampleProductsButton'
import { SAMPLE_CATALOGUES } from '@/packs-overlay'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  refresh.mockReset()
})

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

// Needs bundled catalogues; the OSS export ships none (src/packs-overlay.ts).
describe.skipIf(Object.keys(SAMPLE_CATALOGUES).length === 0)('SeedSampleProductsButton', () => {
  it('lists every registered catalogue when opened', () => {
    render(<SeedSampleProductsButton />)
    fireEvent.click(screen.getByText('Start with sample products'))
    for (const c of Object.values(SAMPLE_CATALOGUES)) {
      expect(screen.getByText(c.label)).toBeTruthy()
    }
  })

  // The spec calls the product-limit sentence "not optional", and it has to be
  // readable BEFORE the merchant picks a pack, not only on the removal card.
  it('discloses the plan-limit cost before seeding', () => {
    render(<SeedSampleProductsButton />)
    fireEvent.click(screen.getByText('Start with sample products'))
    expect(
      screen.getByText(/counted towards your plan.s product limit/i),
    ).toBeTruthy()
    expect(screen.getByText(/remove them all in one click/i)).toBeTruthy()
  })

  // A pack replaces the home page. Saying so only on the removal card, or only
  // after the click, tells the merchant once the change has already happened.
  it('discloses that the homepage is replaced, before seeding', () => {
    render(<SeedSampleProductsButton />)
    fireEvent.click(screen.getByText('Start with sample products'))
    const note = screen.getByText(/sets your homepage to the pack.s layout/i)
    expect(note.textContent).toMatch(/unless you have already edited it/i)
  })

  it('shows each pack’s size, derived from the catalogue', () => {
    render(<SeedSampleProductsButton />)
    fireEvent.click(screen.getByText('Start with sample products'))

    // Counted, not looked up. Every registered pack currently holds ten
    // products and three categories, so the size line is not unique — a
    // getByText here throws on multiple matches the moment a second pack
    // registers. Assert one line per pack, and that each pack's own numbers
    // are among them.
    const sizeLines = screen.getAllByText(/\d+ products?, \d+ categor(y|ies)/)
    const packs = Object.values(SAMPLE_CATALOGUES)
    expect(sizeLines).toHaveLength(packs.length)

    const rendered = sizeLines.map((el) => el.textContent)
    for (const c of packs) {
      const p = c.products.length
      const k = c.categories.length
      const expected = `${p} ${p === 1 ? 'product' : 'products'}, ${k} ${k === 1 ? 'category' : 'categories'}`
      expect(rendered, `${c.slug} size line missing`).toContain(expected)
    }
  })

  it('refreshes the page after a successful seed', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, json: async () => ({ created: { media: 10, categories: 3, products: 10 } }),
    })
    render(<SeedSampleProductsButton />)
    fireEvent.click(screen.getByText('Start with sample products'))
    fireEvent.click(screen.getByText(Object.values(SAMPLE_CATALOGUES)[0].label))
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
  })

  // When the merchant had already designed their homepage, the seeder leaves it
  // alone. Refreshing straight away unmounts this island (its onboarding step is
  // now done), so the notice has to hold the refresh or it is never read — which
  // would leave the merchant with a pack whose layout silently did not appear.
  it('holds the refresh and says the homepage was kept when the seeder skipped it', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        created: { media: 10, categories: 3, products: 10, pages: 0, homepageSkipped: true },
      }),
    })
    render(<SeedSampleProductsButton />)
    fireEvent.click(screen.getByText('Start with sample products'))
    fireEvent.click(screen.getByText(Object.values(SAMPLE_CATALOGUES)[0].label))

    const status = await screen.findByRole('status')
    expect(status.textContent).toMatch(/sample products added/i)
    expect(status.textContent).toMatch(/homepage was left as you had it/i)
    expect(refresh).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Got it'))
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('shows the server error inline and does not refresh', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false, json: async () => ({ error: 'Your catalogue already has products.' }),
    })
    render(<SeedSampleProductsButton />)
    fireEvent.click(screen.getByText('Start with sample products'))
    fireEvent.click(screen.getByText(Object.values(SAMPLE_CATALOGUES)[0].label))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('already has products'),
    )
    expect(refresh).not.toHaveBeenCalled()
  })

  it('closes on Escape and returns focus to the trigger', () => {
    render(<SeedSampleProductsButton />)
    const trigger = screen.getByText('Start with sample products')
    fireEvent.click(trigger)
    const menu = screen.getByRole('menu')
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('closes when the user clicks outside the menu', () => {
    render(
      <div>
        <button type="button">outside</button>
        <SeedSampleProductsButton />
      </div>,
    )
    fireEvent.click(screen.getByText('Start with sample products'))
    expect(screen.getByRole('menu')).toBeTruthy()
    fireEvent.mouseDown(screen.getByText('outside'))
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
