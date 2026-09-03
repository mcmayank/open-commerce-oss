// @vitest-environment jsdom
//
// Separate file from SeedSampleProductsButton.test.tsx: this one mocks
// @/packs-overlay with synthetic entries, which vi.mock hoists for the
// whole file, so it must not share a file with tests that need the real
// registry.
//
// This exists to catch a hardcoded option list. The other test file builds
// its expectations from `Object.values(SAMPLE_CATALOGUES)` — the same source
// the component reads — so a component that hardcoded the current single
// 'bakery' entry would render identically and still pass there. Mocking the
// registry with three distinct synthetic entries (none named 'bakery')
// genuinely fails against a hardcoded list.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { SeedSampleProductsButton } from './SeedSampleProductsButton'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

// Distinct, deliberately non-production counts: the per-option "N products,
// M categories" line must come from each catalogue, not from a literal.
// The factory is hoisted, so `synthetic` has to be declared inside it.
vi.mock('@/packs-overlay', () => {
  const synthetic = (slug: string, label: string, products: number, categories: number) => ({
    slug,
    label,
    authoredCurrency: 'AED',
    categories: Array.from({ length: categories }, (_, i) => ({
      slug: `c${i}`,
      title: `C${i}`,
      description: '',
    })),
    products: Array.from({ length: products }, (_, i) => ({
      slug: `p${i}`,
      title: `P${i}`,
      description: '',
      priceMinor: 100,
      stock: 1,
      categorySlug: 'c0',
      image: `p${i}.jpg`,
    })),
  })
  return {
    SAMPLE_CATALOGUES: {
      alpha: synthetic('alpha', 'Alpha Catalogue', 4, 1),
      beta: synthetic('beta', 'Beta Catalogue', 7, 2),
      gamma: synthetic('gamma', 'Gamma Catalogue', 2, 3),
    },
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  refresh.mockReset()
})

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('SeedSampleProductsButton against a synthetic registry', () => {
  it('renders every entry the registry provides, not a hardcoded list', () => {
    render(<SeedSampleProductsButton />)
    fireEvent.click(screen.getByText('Start with sample products'))
    expect(screen.getByText('Alpha Catalogue')).toBeTruthy()
    expect(screen.getByText('Beta Catalogue')).toBeTruthy()
    expect(screen.getByText('Gamma Catalogue')).toBeTruthy()
    // The real registry's only current entry. A hardcoded list shaped like
    // production would show this instead of (or as well as) the synthetic ones.
    expect(screen.queryByText('Bakery & café')).toBeNull()
  })

  it('derives each option’s counts from its own catalogue', () => {
    render(<SeedSampleProductsButton />)
    fireEvent.click(screen.getByText('Start with sample products'))
    expect(screen.getByText('4 products, 1 category')).toBeTruthy()
    expect(screen.getByText('7 products, 2 categories')).toBeTruthy()
    expect(screen.getByText('2 products, 3 categories')).toBeTruthy()
  })

  it('moves focus between items with arrow keys, wrapping at the ends', () => {
    render(<SeedSampleProductsButton />)
    fireEvent.click(screen.getByText('Start with sample products'))
    const items = screen.getAllByRole('menuitem')
    expect(items).toHaveLength(3)
    expect(document.activeElement).toBe(items[0])

    fireEvent.keyDown(items[0], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])

    fireEvent.keyDown(items[1], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[2])

    fireEvent.keyDown(items[2], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[0]) // wraps forward

    fireEvent.keyDown(items[0], { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[2]) // wraps backward
  })
})
