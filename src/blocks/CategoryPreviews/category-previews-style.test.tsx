/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { CategoryPreviewsComponent } from './Component'

afterEach(cleanup)
// listCategories must resolve at least one category — the component early-returns
// `null` when the list is empty (see Component.tsx), which would leave nothing to
// assert on regardless of --bs-* wiring.
vi.mock('@/lib/storefront', () => ({
  listCategories: vi.fn().mockResolvedValue([
    { id: '1', title: 'Cat A', slug: 'cat-a', image: null, description: null },
  ]),
}))

describe('CategoryPreviews --bs-* wiring', () => {
  it('heading and section read --bs-* vars with current-value fallbacks', async () => {
    const el = await CategoryPreviewsComponent({ block: { heading: 'Categories' } as any, ctx: {} as any })
    const { container } = render(el as any)
    const heading = container.querySelector('[data-nb-part="heading"]')!
    expect(heading.className).toContain('var(--bs-heading-size,1.5rem)')
    const section = container.querySelector('section')!
    expect(section.className).toContain('var(--bs-section-pad,3rem)')
  })
})
