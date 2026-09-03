/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ReviewsComponent } from './Component'

afterEach(cleanup)

const item = { id: 'r1', rating: 5, quote: 'Great store!', author: 'Jane' }

describe('Reviews --bs-* wiring', () => {
  it('cards (default): heading and section read --bs-* vars with current-value fallbacks; item-level parts are untouched', () => {
    const el = ReviewsComponent({
      block: { heading: 'What customers say', items: [item] } as any,
      ctx: {} as any,
    })
    const { container } = render(el as any)

    const heading = container.querySelector('[data-nb-part="heading"]')!
    expect(heading.className).toContain('var(--bs-heading-size,1.5rem)')
    expect(heading.className).toContain('var(--bs-heading-weight,700)')

    const section = container.querySelector('section')!
    expect(section.className).toContain('var(--bs-section-pad,3rem)')
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,72rem)')

    // Item-level parts (the review cards) stay unwired — no --bs-* vars.
    const itemHeading = container.querySelector('[data-nb-part="item-heading"]')!
    expect(itemHeading.className).not.toContain('--bs-')
    const itemBody = container.querySelector('[data-nb-part="item-body"]')!
    expect(itemBody.className).not.toContain('--bs-')
  })

  it('list variant: section width falls back to the narrower literal (48rem)', () => {
    const el = ReviewsComponent({
      block: { variant: 'list', heading: 'What customers say', items: [item] } as any,
      ctx: {} as any,
    })
    const { container } = render(el as any)
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,48rem)')
  })

  it('masonry variant: section width falls back to 72rem', () => {
    const el = ReviewsComponent({
      block: { variant: 'masonry', heading: 'What customers say', items: [item] } as any,
      ctx: {} as any,
    })
    const { container } = render(el as any)
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,72rem)')
  })
})
