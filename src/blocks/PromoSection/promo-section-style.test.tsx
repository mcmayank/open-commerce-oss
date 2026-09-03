/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { PromoSectionComponent } from './Component'

afterEach(cleanup)

describe('PromoSection --bs-* wiring', () => {
  it('eyebrow, heading, body, media and section read --bs-* vars with current-value fallbacks (split, default variant)', () => {
    const el = PromoSectionComponent({
      block: { eyebrow: 'New in', heading: 'Meet the collection', body: 'Fresh drops weekly.' } as any,
      ctx: {} as any,
    })
    const { container } = render(el as any)

    const eyebrow = container.querySelector('[data-nb-part="eyebrow"]')!
    expect(eyebrow.className).toContain('var(--bs-eyebrow-size,0.875rem)')
    expect(eyebrow.className).toContain('var(--bs-eyebrow-weight,600)')

    const heading = container.querySelector('[data-nb-part="heading"]')!
    expect(heading.className).toContain('var(--bs-heading-size,1.875rem)')
    expect(heading.className).toContain('var(--bs-heading-weight,800)')

    const body = container.querySelector('[data-nb-part="body"]')!
    expect(body.className).toContain('var(--bs-subheading-size,1rem)')
    expect(body.className).toContain('var(--bs-subheading-weight,400)')

    const media = container.querySelector('[data-nb-part="media"]')!
    expect(media.className).toContain('var(--bs-media-radius,var(--bs-media-layout-radius,0))')

    // Copy panel carries the section padding for this variant (no full-bleed section wrapper padding).
    const copyPanel = heading.parentElement!
    expect(copyPanel.className).toContain('var(--bs-section-pad,3rem)')
  })

  it('overlay variant wires the larger heading/body sizes plus a section width and pad', () => {
    const el = PromoSectionComponent({
      block: { variant: 'overlay', heading: 'Big sale' } as any,
      ctx: {} as any,
    })
    const { container } = render(el as any)

    const heading = container.querySelector('[data-nb-part="heading"]')!
    expect(heading.className).toContain('var(--bs-heading-size,1.875rem)')

    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,42rem)')
    expect(widthEl.className).toContain('var(--bs-section-pad,4rem)')
  })

  it('bannerStrip variant wires the compact heading/body sizes plus section width and pad', () => {
    const el = PromoSectionComponent({
      block: { variant: 'bannerStrip', heading: 'Limited time' } as any,
      ctx: {} as any,
    })
    const { container } = render(el as any)

    const heading = container.querySelector('[data-nb-part="heading"]')!
    expect(heading.className).toContain('var(--bs-heading-size,1.25rem)')

    const section = container.querySelector('section')!
    expect(section.className).toContain('var(--bs-section-pad,2rem)')
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,72rem)')
  })
})
