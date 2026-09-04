/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { VideoEmbedComponent } from './Component'

afterEach(cleanup)

const ctx = {} as any

describe('VideoEmbed --bs-* wiring', () => {
  it('heading, body, media and section read --bs-* vars with current-value fallbacks (contained, default variant)', () => {
    const el = VideoEmbedComponent({
      block: { heading: 'Watch this', provider: 'youtube', url: 'https://youtu.be/abc123', caption: 'A caption' } as any,
      ctx,
    })
    const { container } = render(el as any)

    const heading = container.querySelector('[data-nb-part="heading"]')!
    expect(heading.className).toContain('var(--bs-heading-size,1.5rem)')
    expect(heading.className).toContain('var(--bs-heading-weight,700)')

    const body = container.querySelector('[data-nb-part="body"]')!
    expect(body.className).toContain('var(--bs-subheading-size,0.875rem)')
    expect(body.className).toContain('var(--bs-subheading-weight,400)')

    const media = container.querySelector('[data-nb-part="media"]')!
    expect(media.className).toContain('var(--bs-media-radius,var(--bs-media-layout-radius,0))')

    const section = container.querySelector('section')!
    expect(section.className).toContain('var(--bs-section-pad,3.5rem)')
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,56rem)')
  })

  it('sideBySide variant wires its own section width', () => {
    const el = VideoEmbedComponent({
      block: { variant: 'sideBySide', heading: 'Watch this', provider: 'youtube', url: 'https://youtu.be/abc123' } as any,
      ctx,
    })
    const { container } = render(el as any)
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,64rem)')
  })

  it('textOverlay variant wires the larger heading and its own section pad/width', () => {
    const el = VideoEmbedComponent({
      block: { variant: 'textOverlay', heading: 'Watch this', provider: 'youtube', url: 'https://youtu.be/abc123' } as any,
      ctx,
    })
    const { container } = render(el as any)
    const heading = container.querySelector('[data-nb-part="heading"]')!
    expect(heading.className).toContain('var(--bs-heading-size,1.875rem)')
    const widthEl = container.querySelector('.mx-auto')!
    expect(widthEl.className).toContain('var(--bs-section-width,42rem)')
    expect(widthEl.className).toContain('var(--bs-section-pad,4rem)')
  })
})
