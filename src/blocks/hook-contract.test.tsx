// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { RenderBlocks } from './index'
import { BLOCK_FIXTURES } from './test-fixtures'
import type { BlockFixture } from './test-fixtures'
import { isNbPart } from './lib/hooks'

/** Look up a fixture by name; throws if the name drifts from test-fixtures.tsx. */
function fixture(name: string): BlockFixture {
  const found = BLOCK_FIXTURES.find((f) => f.name === name)
  if (!found) throw new Error(`No fixture named ${name} in BLOCK_FIXTURES`)
  return found
}

// Stub the data-access boundary so ProductGrid/Component's listProducts import
// doesn't boot Payload and require PAYLOAD_SECRET in the test environment.
vi.mock('@/lib/storefront', () => ({
  getStore: vi.fn(),
  storeOrigin: vi.fn(),
  resolveHost: vi.fn(),
}))

// `payload` is unused by every fixture RenderBlocks exercises here (see
// test-fixtures.tsx docblock: async server components are excluded), but
// BlockContext requires it, so a stub satisfies the type.
const ctx = { tenantId: 1, currency: 'AED', premiumSections: true, payload: {} as unknown as import('payload').Payload }

afterEach(cleanup)

describe('block wrapper hook attributes', () => {
  it('labels each wrapper with its block type', () => {
    const { container } = render(
      <RenderBlocks blocks={[{ id: 'a', blockType: 'faq', items: [{ id: 'q', question: 'Q', answer: 'A' }] }]} ctx={ctx} />,
    )
    expect(container.querySelector('[data-nb-block="faq"]')).not.toBeNull()
  })

  it('labels the variant when the block has one', () => {
    const { container } = render(
      <RenderBlocks blocks={[{ id: 'b', blockType: 'featureGrid', variant: 'cards', heading: 'H' }]} ctx={ctx} />,
    )
    const el = container.querySelector('[data-nb-block="featureGrid"]')
    expect(el?.getAttribute('data-nb-variant')).toBe('cards')
  })

  it('omits the variant attribute when the block has none', () => {
    const { container } = render(
      <RenderBlocks blocks={[{ id: 'c', blockType: 'featureGrid', heading: 'H' }]} ctx={ctx} />,
    )
    const el = container.querySelector('[data-nb-block="featureGrid"]')
    expect(el?.hasAttribute('data-nb-variant')).toBe(false)
  })

  it('omits the variant attribute when the variant is an empty string', () => {
    const { container } = render(
      <RenderBlocks blocks={[{ id: 'd', blockType: 'featureGrid', variant: '', heading: 'H' }]} ctx={ctx} />,
    )
    const el = container.querySelector('[data-nb-block="featureGrid"]')
    expect(el?.hasAttribute('data-nb-variant')).toBe(false)
  })
})

describe('nb-hooks part coverage', () => {
  for (const { name, render: renderBlock, headless } of BLOCK_FIXTURES) {
    it(`${name} marks its heading and emits only published parts`, () => {
      const { container } = render(renderBlock())

      // Every emitted part name must be in the vocabulary.
      const emitted = [...container.querySelectorAll('[data-nb-part]')].map(
        (el) => el.getAttribute('data-nb-part') ?? '',
      )
      expect(emitted.filter((p) => !isNbPart(p))).toEqual([])

      // A block must emit at least one hook. Without this, a block that
      // regressed to zero attributes and renders no h1/h2/h3 would pass this
      // test vacuously — both assertions above are trivially true on an
      // empty array. This is the exact hole ImageGallery fell through before
      // its `item` hook was added.
      expect(emitted.length).toBeGreaterThan(0)

      // A block that renders a heading must mark it. The heading is the part
      // designers reach for first; leaving it unmarked makes the block
      // unstyleable through the contract. Gated on the same `headless` flag
      // as heading-color.test.tsx: for a fixture NOT marked headless, a
      // heading must exist at all (not just "if present, be marked") —
      // otherwise a block that regressed to rendering zero headings but
      // still emits some other hook (body/cta/item) would silently skip
      // this check instead of failing.
      const headings = [...container.querySelectorAll('h1, h2, h3')]
      if (!headless) {
        expect(headings.length).toBeGreaterThan(0)
        expect(headings.some((h) => h.getAttribute('data-nb-part')?.endsWith('heading'))).toBe(true)
      }
    })
  }
})

describe('the three newest parts (eyebrow, badge, link) are actually emitted', () => {
  it('MediaHero marks its eyebrow', () => {
    const { container } = render(fixture('MediaHero').render())
    expect(container.querySelector('[data-nb-part="eyebrow"]')).not.toBeNull()
  })

  it('PromoSection marks its eyebrow', () => {
    const { container } = render(fixture('PromoSection').render())
    expect(container.querySelector('[data-nb-part="eyebrow"]')).not.toBeNull()
  })

  it('SplitHero marks its eyebrow', () => {
    const { container } = render(fixture('SplitHero').render())
    expect(container.querySelector('[data-nb-part="eyebrow"]')).not.toBeNull()
  })

  it('StoryStats marks its eyebrow', () => {
    const { container } = render(fixture('StoryStats').render())
    expect(container.querySelector('[data-nb-part="eyebrow"]')).not.toBeNull()
  })

  it('Steps marks its numbered badge inside the item wrapper', () => {
    const { container } = render(fixture('Steps').render())
    // Exercises the worked scoping example from docs/THEMING-HOOKS.md:
    // [data-nb-part="item"] [data-nb-part="badge"].
    expect(container.querySelector('[data-nb-part="item"] [data-nb-part="badge"]')).not.toBeNull()
  })

  it('Contact marks its tel/whatsapp/mailto anchors as links, not ctas', () => {
    const { container } = render(fixture('Contact').render())
    const links = container.querySelectorAll('[data-nb-part="link"]')
    expect(links.length).toBeGreaterThan(0)
    links.forEach((el) => expect(el.getAttribute('data-nb-part')).not.toBe('cta'))
  })

  it('Reviews marks its "on {product}" credit link, inside the item, as link not cta', () => {
    const { container } = render(fixture('Reviews').render())
    const link = container.querySelector('[data-nb-part="item"] [data-nb-part="link"]')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('data-nb-part')).not.toBe('cta')
  })
})

describe('previously-vacuous item-level fixtures now genuinely exercised', () => {
  // FeatureGrid, LogoStrip, and StoryStats' fixtures all passed the generic
  // "nb-hooks part coverage" suite above before their field names were
  // corrected — none of those assertions single out an item-level part, so a
  // fixture rendering zero items (block heading only) was indistinguishable
  // from one rendering real cards. These assertions close that hole for the
  // three blocks the fixture sweep found, the same way the "three newest
  // parts" suite above closes it for eyebrow/badge/link.

  it('FeatureGrid emits item / item-heading / item-body / item-media from a real items array', () => {
    const { container } = render(fixture('FeatureGrid').render())
    expect(container.querySelector('[data-nb-part="item"]')).not.toBeNull()
    expect(container.querySelector('[data-nb-part="item-heading"]')).not.toBeNull()
    expect(container.querySelector('[data-nb-part="item-body"]')).not.toBeNull()
    expect(container.querySelector('[data-nb-part="item-media"]')).not.toBeNull()
  })

  it('LogoStrip resolves its alt text from the real `label` field, not the nonexistent `name`', () => {
    const { container } = render(fixture('LogoStrip').render())
    const img = container.querySelector('[data-nb-part="item-media"]')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('alt')).toBe('Acme')
  })

  it('StoryStats emits item / item-heading / item-body from a real stats array', () => {
    const { container } = render(fixture('StoryStats').render())
    expect(container.querySelector('[data-nb-part="item"]')).not.toBeNull()
    expect(container.querySelector('[data-nb-part="item-heading"]')).not.toBeNull()
    expect(container.querySelector('[data-nb-part="item-body"]')).not.toBeNull()
  })
})
