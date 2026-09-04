/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ProductGridComponent } from './Component'

afterEach(cleanup)
// ProductGrid fetches products; stub the storefront data layer like render-blocks-style.test.tsx does.
vi.mock('@/lib/storefront', () => ({ listProducts: vi.fn().mockResolvedValue([]) }))

describe('ProductGrid --bs-* wiring', () => {
  it('eyebrow, heading and section read --bs-* vars with current-value fallbacks', async () => {
    const el = await ProductGridComponent({
      block: { eyebrow: 'This week', heading: 'Best sellers' } as any,
      ctx: {} as any,
    })
    const { container } = render(el as any)
    const eyebrow = container.querySelector('[data-nb-part="eyebrow"]')!
    expect(eyebrow.className).toContain('var(--bs-eyebrow-size,0.875rem)')
    expect(eyebrow.className).toContain('var(--bs-eyebrow-weight,600)')
    const heading = container.querySelector('[data-nb-part="heading"]')!
    expect(heading.className).toContain('var(--bs-heading-size,1.5rem)')
    expect(heading.className).toContain('var(--bs-heading-weight,700)')
    const section = container.querySelector('section')!
    expect(section.className).toContain('var(--bs-section-pad,3rem)')
  })
})
