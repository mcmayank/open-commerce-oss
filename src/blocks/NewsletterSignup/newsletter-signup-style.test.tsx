/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { NewsletterSignupComponent } from './Component'

afterEach(cleanup)

describe('NewsletterSignup --bs-* wiring', () => {
  it('heading and section read --bs-* vars with current-value fallbacks', () => {
    const el = NewsletterSignupComponent({ block: { heading: 'Stay in the loop' } as any, ctx: {} as any })
    const { container } = render(el as any)

    const heading = container.querySelector('[data-nb-part="heading"]')!
    expect(heading.className).toContain('var(--bs-heading-size,1.5rem)')
    expect(heading.className).toContain('var(--bs-heading-weight,700)')

    const section = container.querySelector('section')!
    expect(section.className).toContain('var(--bs-section-pad,3.5rem)')
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,36rem)')
  })
})
