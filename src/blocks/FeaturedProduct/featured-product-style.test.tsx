/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { FeaturedProductComponent } from './Component'

afterEach(cleanup)

const product = {
  id: 1,
  tenant: 1,
  title: 'Fixture Product',
  slug: 'fixture-product',
  status: 'active',
  price: 1000,
  images: [{ id: 1, url: '/product.png', alt: 'Fixture product' }],
}
const ctx = { tenantId: 1, currency: 'USD' } as any

describe('FeaturedProduct --bs-* wiring', () => {
  it('heading, body, media and section read --bs-* vars with current-value fallbacks (imageLeft, default variant)', () => {
    const el = FeaturedProductComponent({ block: { variant: 'imageLeft', product } as any, ctx })
    const { container } = render(el as any)

    const heading = container.querySelector('[data-nb-part="heading"]')!
    expect(heading.className).toContain('var(--bs-heading-size,1.875rem)')
    expect(heading.className).toContain('var(--bs-heading-weight,800)')

    const body = container.querySelector('[data-nb-part="body"]')!
    expect(body.className).toContain('var(--bs-subheading-size,1.5rem)')
    expect(body.className).toContain('var(--bs-subheading-weight,600)')

    const media = container.querySelector('[data-nb-part="media"]')!
    expect(media.className).toContain('var(--bs-media-radius,var(--bs-media-layout-radius,0))')

    // Content column carries the section padding for this variant (no full-bleed section wrapper padding).
    const contentDiv = heading.parentElement!
    expect(contentDiv.className).toContain('var(--bs-section-pad,3rem)')
  })

  it('overlay variant wires the larger heading/body sizes and a section width', () => {
    const el = FeaturedProductComponent({ block: { variant: 'overlay', product } as any, ctx })
    const { container } = render(el as any)

    const heading = container.querySelector('[data-nb-part="heading"]')!
    expect(heading.className).toContain('var(--bs-heading-size,2.25rem)')

    const body = container.querySelector('[data-nb-part="body"]')!
    expect(body.className).toContain('var(--bs-subheading-size,1.5rem)')

    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,42rem)')
  })
})
