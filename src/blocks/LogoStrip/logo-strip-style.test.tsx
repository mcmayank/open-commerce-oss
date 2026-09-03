/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { LogoStripComponent } from './Component'

afterEach(cleanup)

const LOGOS = [{ id: 'l1', image: { url: '/logo.png' }, label: 'Acme' }] as never

describe('LogoStrip --bs-* wiring', () => {
  it('heading and section (staticRow, the default variant) read --bs-* vars with current-value fallbacks', () => {
    const el = LogoStripComponent({
      block: { variant: 'staticRow', heading: 'Trusted by', logos: LOGOS } as never,
      ctx: {} as never,
    })
    const { container } = render(el as any)

    const heading = container.querySelector('[data-nb-part="heading"]')!
    expect(heading.className).toContain('var(--bs-heading-size,1.25rem)')
    expect(heading.className).toContain('var(--bs-heading-weight,700)')
    expect(heading.className).toContain('var(--bs-heading-tracking,-0.025em)')

    const section = container.querySelector('section')!
    expect(section.className).toContain('var(--bs-section-pad,3.5rem)')
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,64rem)')

    // Logos are item-media — left untouched.
    const itemMedia = container.querySelector('[data-nb-part="item-media"]')!
    expect(itemMedia.className).not.toContain('--bs-')
  })

  it('grid variant section reads --bs-section-pad and --bs-section-width', () => {
    const el = LogoStripComponent({ block: { variant: 'grid', logos: LOGOS } as never, ctx: {} as never })
    const { container } = render(el as any)
    const section = container.querySelector('section')!
    expect(section.className).toContain('var(--bs-section-pad,3.5rem)')
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,64rem)')
  })

  it('bordered variant section reads --bs-section-pad and --bs-section-width', () => {
    const el = LogoStripComponent({ block: { variant: 'bordered', logos: LOGOS } as never, ctx: {} as never })
    const { container } = render(el as any)
    const section = container.querySelector('section')!
    expect(section.className).toContain('var(--bs-section-pad,3.5rem)')
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,64rem)')
  })

  it('marquee variant section reads --bs-section-pad only (no content-width container)', () => {
    const el = LogoStripComponent({ block: { variant: 'marquee', logos: LOGOS } as never, ctx: {} as never })
    const { container } = render(el as any)
    const section = container.querySelector('section')!
    expect(section.className).toContain('var(--bs-section-pad,3.5rem)')
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).not.toContain('--bs-')
  })
})
