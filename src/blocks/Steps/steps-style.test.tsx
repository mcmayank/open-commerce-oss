/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { StepsComponent } from './Component'

afterEach(cleanup)

const steps = [{ id: 's1', title: 'Order', description: 'Place your order.' }]

describe('Steps --bs-* wiring', () => {
  it('horizontal (default): heading and section read --bs-* vars with current-value fallbacks; item-level parts are untouched', () => {
    const el = StepsComponent({
      block: { heading: 'How it works', steps } as any,
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

    // Item-level parts (badge/item-heading/item-body) stay unwired — no --bs-* vars.
    const badge = container.querySelector('[data-nb-part="badge"]')!
    expect(badge.className).not.toContain('--bs-')
    const itemHeading = container.querySelector('[data-nb-part="item-heading"]')!
    expect(itemHeading.className).not.toContain('--bs-')
    const itemBody = container.querySelector('[data-nb-part="item-body"]')!
    expect(itemBody.className).not.toContain('--bs-')
  })

  it('cards variant: section width falls back to 72rem', () => {
    const el = StepsComponent({
      block: { variant: 'cards', heading: 'How it works', steps } as any,
      ctx: {} as any,
    })
    const { container } = render(el as any)
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,72rem)')
  })

  it('vertical variant: section width falls back to the narrower literal (42rem)', () => {
    const el = StepsComponent({
      block: { variant: 'vertical', heading: 'How it works', steps } as any,
      ctx: {} as any,
    })
    const { container } = render(el as any)
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,42rem)')
  })

  it('compact variant: section width falls back to the narrower literal (42rem)', () => {
    const el = StepsComponent({
      block: { variant: 'compact', heading: 'How it works', steps } as any,
      ctx: {} as any,
    })
    const { container } = render(el as any)
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,42rem)')
  })
})
