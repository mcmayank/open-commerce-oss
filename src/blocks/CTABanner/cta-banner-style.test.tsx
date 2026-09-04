/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { CTABannerComponent } from './Component'

afterEach(cleanup)

describe('CTABanner --bs-* wiring', () => {
  it('heading, body and section read --bs-* vars with current-value fallbacks', () => {
    const { container } = render(
      <CTABannerComponent block={{ heading: 'Get the drop', body: 'Weekly.' } as any} ctx={{} as any} /> as any,
    )
    const heading = container.querySelector('[data-nb-part="heading"]')!
    expect(heading.className).toContain('var(--bs-heading-size,1.875rem)')
    expect(heading.className).toContain('var(--bs-heading-weight,800)')
    const body = container.querySelector('[data-nb-part="body"]')!
    expect(body.className).toContain('var(--bs-subheading-size,1.125rem)')
    const section = container.querySelector('section')!
    expect(section.className).toContain('var(--bs-section-pad,4rem)')
  })
})
