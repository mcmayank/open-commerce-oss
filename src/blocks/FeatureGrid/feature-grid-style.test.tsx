/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { FeatureGridComponent } from './Component'

afterEach(cleanup)

describe('FeatureGrid --bs-* wiring', () => {
  it('heading and section read --bs-* vars with current-value fallbacks; item-level parts are untouched', () => {
    const el = FeatureGridComponent({
      block: {
        heading: 'Why shop with us',
        columns: '3',
        items: [{ icon: 'star', heading: 'Fast shipping', text: 'Two-day delivery.' }],
      } as any,
      ctx: {} as any,
    })
    const { container } = render(el as any)

    const heading = container.querySelector('[data-nb-part="heading"]')!
    expect(heading.className).toContain('var(--bs-heading-size,1.5rem)')
    expect(heading.className).toContain('var(--bs-heading-weight,700)')

    const section = container.querySelector('section')!
    expect(section.className).toContain('var(--bs-section-pad,3.5rem)')
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,72rem)')

    // Item-level parts (item-heading/item-body/item-media) stay unwired — no --bs-* vars.
    const itemHeading = container.querySelector('[data-nb-part="item-heading"]')!
    expect(itemHeading.className).not.toContain('--bs-')
    const itemBody = container.querySelector('[data-nb-part="item-body"]')!
    expect(itemBody.className).not.toContain('--bs-')
    const itemMedia = container.querySelector('[data-nb-part="item-media"]')!
    expect(itemMedia.className).not.toContain('--bs-')
  })
})
