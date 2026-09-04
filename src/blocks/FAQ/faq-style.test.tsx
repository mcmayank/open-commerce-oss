/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { FAQComponent } from './Component'

afterEach(cleanup)

describe('FAQ --bs-* wiring', () => {
  it('heading and section read --bs-* vars with current-value fallbacks; item-level parts are untouched', () => {
    const el = FAQComponent({
      block: {
        heading: 'Questions',
        items: [{ id: 'q1', question: 'Do you ship internationally?', answer: 'Yes.' }],
      } as any,
      ctx: {} as any,
    })
    const { container } = render(el as any)

    const heading = container.querySelector('[data-nb-part="heading"]')!
    expect(heading.className).toContain('var(--bs-heading-size,1.5rem)')
    expect(heading.className).toContain('var(--bs-heading-weight,700)')

    const section = container.querySelector('section')!
    expect(section.className).toContain('var(--bs-section-pad,3rem)')
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,48rem)')

    // Item-level parts (the Q&A rows) stay unwired — no --bs-* vars.
    const itemHeading = container.querySelector('[data-nb-part="item-heading"]')!
    expect(itemHeading.className).not.toContain('--bs-')
    const itemBody = container.querySelector('[data-nb-part="item-body"]')!
    expect(itemBody.className).not.toContain('--bs-')
  })
})
