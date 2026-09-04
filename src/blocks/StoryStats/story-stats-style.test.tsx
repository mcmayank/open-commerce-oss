/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { StoryStatsComponent } from './Component'

afterEach(cleanup)

describe('StoryStats --bs-* wiring', () => {
  it('eyebrow, heading, body, media and section read --bs-* vars with current-value fallbacks; item-level parts are untouched', () => {
    const el = StoryStatsComponent({
      block: {
        eyebrow: 'Our story',
        heading: 'Made with care',
        body: 'Every piece is hand-finished.',
        image: { id: 1, url: '/story.png', alt: 'Workshop' },
        stats: [{ id: 's1', value: '10k', label: 'Customers' }],
      } as any,
      ctx: {} as any,
    })
    const { container } = render(el as any)

    const eyebrow = container.querySelector('[data-nb-part="eyebrow"]')!
    expect(eyebrow.className).toContain('var(--bs-eyebrow-size,11px)')
    expect(eyebrow.className).toContain('var(--bs-eyebrow-weight,600)')

    const heading = container.querySelector('[data-nb-part="heading"]')!
    expect(heading.className).toContain('var(--bs-heading-size,1.875rem)')
    expect(heading.className).toContain('var(--bs-heading-weight,600)')

    const body = container.querySelector('[data-nb-part="body"]')!
    expect(body.className).toContain('var(--bs-subheading-size,1rem)')
    expect(body.className).toContain('var(--bs-subheading-weight,400)')

    const media = container.querySelector('[data-nb-part="media"]')!
    expect(media.className).toContain('var(--bs-media-radius,var(--bs-media-layout-radius,0))')

    const section = container.querySelector('section')!
    expect(section.className).toContain('var(--bs-section-pad,4rem)')
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,72rem)')

    // Item-level stat parts (item-heading/item-body) stay unwired — no --bs-* vars.
    const itemHeading = container.querySelector('[data-nb-part="item-heading"]')!
    expect(itemHeading.className).not.toContain('--bs-')
    const itemBody = container.querySelector('[data-nb-part="item-body"]')!
    expect(itemBody.className).not.toContain('--bs-')
  })
})
