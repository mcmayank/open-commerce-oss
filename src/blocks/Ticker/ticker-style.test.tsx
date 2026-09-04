/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { TickerComponent } from './Component'

afterEach(cleanup)

describe('Ticker --bs-* wiring', () => {
  it('static variant section reads --bs-section-pad and --bs-section-width; items stay unwired', () => {
    const el = TickerComponent({
      block: { variant: 'static', items: [{ id: 'p1', label: 'Free shipping' }] } as never,
      ctx: {} as never,
    })
    const { container } = render(el as any)

    const section = container.querySelector('section')!
    expect(section.className).toContain('var(--bs-section-pad,1rem)')
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,64rem)')

    const item = container.querySelector('[data-nb-part="item"]')!
    expect(item.className).not.toContain('--bs-')
  })

  it('marquee variant section reads --bs-section-pad only (no content-width container)', () => {
    const el = TickerComponent({
      block: { variant: 'marquee', items: [{ id: 'p1', label: 'Free shipping' }] } as never,
      ctx: {} as never,
    })
    const { container } = render(el as any)

    const section = container.querySelector('section')!
    expect(section.className).toContain('var(--bs-section-pad,1rem)')

    const item = container.querySelector('[data-nb-part="item"]')!
    expect(item.className).not.toContain('--bs-')
  })
})
