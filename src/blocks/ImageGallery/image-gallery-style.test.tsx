/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ImageGalleryComponent } from './Component'

afterEach(cleanup)

describe('ImageGallery --bs-* wiring', () => {
  it('section reads --bs-section-pad with its current-value fallback; item-media stays unwired', () => {
    const el = ImageGalleryComponent({
      block: { images: [{ id: 1, url: '/gallery.png', alt: 'Fixture image' }] } as never,
      ctx: {} as never,
    })
    const { container } = render(el as any)

    const section = container.querySelector('section')!
    expect(section.className).toContain('var(--bs-section-pad,2.5rem)')

    // No heading/eyebrow/body on this block, and the image tiles are
    // item-media — neither should carry any --bs-* var.
    expect(container.querySelector('[data-nb-part="heading"]')).toBeNull()
    const itemMedia = container.querySelector('[data-nb-part="item-media"]')!
    expect(itemMedia.className).not.toContain('--bs-')
  })
})
