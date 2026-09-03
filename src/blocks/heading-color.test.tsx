// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

import { BLOCK_FIXTURES } from './test-fixtures'

/**
 * Every block heading must take its colour from `--section-heading`, never from
 * the body text token.
 *
 * `sectionVars` (src/blocks/lib/colorScheme.ts) resolves `--section-heading` to
 * `--color-heading` on the default and muted schemes and to
 * `--color-primary-contrast` on the inverse and accent bands. A heading that
 * reads `--color-text` therefore ignores the theme's heading colour, and one
 * that reads `--color-heading` directly would render dark-on-dark on an inverse
 * band. Reading the section var is the only correct source.
 *
 * Exception: a heading rendered on a deliberately dark surface — over imagery
 * behind a `bg-black/45` scrim, or on a `--color-primary` panel — keeps an
 * explicit light colour, whether set on the heading itself or inherited from an
 * ancestor. The section vars describe the section's own background, not a
 * photograph or a coloured panel drawn inside it, so `--section-heading` would
 * paint dark-on-dark there.
 */

afterEach(cleanup)

/** True when this element's colour comes from the scheme-aware heading token. */
function usesSectionHeading(el: HTMLElement): boolean {
  return (
    el.className.includes('text-(--section-heading)') ||
    (el.getAttribute('style') ?? '').includes('--section-heading')
  )
}

/**
 * True when this element, or any ancestor it inherits colour from, sets an
 * explicit light text colour — the deliberate opt-out for dark surfaces.
 */
function isOnDarkSurface(el: HTMLElement | null): boolean {
  for (let node = el; node; node = node.parentElement) {
    if (node.className && typeof node.className === 'string') {
      if (node.className.split(/\s+/).includes('text-white')) return true
    }
    const color = node.style?.color?.toLowerCase() ?? ''
    if (color === '#fff' || color === '#ffffff' || color === 'white') return true
  }
  return false
}

describe('block headings honour --section-heading', () => {
  for (const { name, render: renderBlock, headless } of BLOCK_FIXTURES) {
    it(`${name} colours every heading from the section heading token`, () => {
      const { container } = render(renderBlock())
      const headings = Array.from(container.querySelectorAll('h1, h2, h3')) as HTMLElement[]

      // Every fixture NOT marked `headless` in test-fixtures.tsx must render
      // at least one heading. Without this, a heading-bearing block that
      // regressed to rendering none (a props drift, a conditional-render
      // bug) would make `offenders` vacuously empty below and this test
      // would report green while checking nothing — the same class of hole
      // closed in hook-contract.test.tsx's `emitted.length` assertion.
      if (!headless) expect(headings.length).toBeGreaterThan(0)

      const offenders = headings
        .filter((h) => !usesSectionHeading(h) && !isOnDarkSurface(h))
        .map((h) => `<${h.tagName.toLowerCase()}> class="${h.className}" style="${h.getAttribute('style') ?? ''}"`)

      expect(offenders).toEqual([])
    })
  }
})
