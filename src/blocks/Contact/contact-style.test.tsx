/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ContactComponent } from './Component'

afterEach(cleanup)

describe('Contact --bs-* wiring', () => {
  it('heading, body, media and section read --bs-* vars with current-value fallbacks (mapSplit, default variant)', () => {
    const el = ContactComponent({
      block: {
        heading: 'Visit us',
        address: '1 Test Street',
        mapEmbedUrl: 'https://maps.google.com/embed?x=1',
      } as any,
      ctx: {} as any,
    })
    const { container } = render(el as any)

    const heading = container.querySelector('[data-nb-part="heading"]')!
    expect(heading.className).toContain('var(--bs-heading-size,1.5rem)')
    expect(heading.className).toContain('var(--bs-heading-weight,700)')

    const body = container.querySelector('[data-nb-part="body"]')!
    expect(body.className).toContain('var(--bs-subheading-size,0.875rem)')
    expect(body.className).toContain('var(--bs-subheading-weight,400)')

    const media = container.querySelector('[data-nb-part="media"]')!
    expect(media.className).toContain('var(--bs-media-radius,var(--bs-media-layout-radius,0.25rem))')

    const section = container.querySelector('section')!
    expect(section.className).toContain('var(--bs-section-pad,3.5rem)')
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,72rem)')
  })

  it('banner variant wires section pad without a width container', () => {
    const el = ContactComponent({
      block: { variant: 'banner', heading: 'Visit us', phone: '+1 555 0100' } as any,
      ctx: {} as any,
    })
    const { container } = render(el as any)
    const section = container.querySelector('section')!
    expect(section.className).toContain('var(--bs-section-pad,1.5rem)')
  })
})
