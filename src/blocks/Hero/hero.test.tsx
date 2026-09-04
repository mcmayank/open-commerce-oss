// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Hero } from './config'
import { HeroComponent } from './Component'
import { RenderBlocks, type BlockContext } from '../index'

// RenderBlocks eagerly imports every registered block component, including
// ProductGrid, whose listProducts import boots Payload — stub the
// data-access boundary so rendering a plain 'hero' block doesn't need
// PAYLOAD_SECRET (same stub as render-blocks-style.test.tsx).
vi.mock('@/lib/storefront', () => ({
  getStore: vi.fn(),
  storeOrigin: vi.fn(),
  resolveHost: vi.fn(),
}))

const ctx: BlockContext = {
  tenantId: 1,
  currency: 'AED',
  premiumSections: true,
  payload: {} as unknown as import('payload').Payload,
}

afterEach(cleanup)

const names = Hero.fields.map((f: any) => f.name).filter(Boolean)

describe('Hero config', () => {
  it('keeps the legacy fields so existing rows are not orphaned', () => {
    for (const n of ['heading', 'subheading', 'backgroundImage', 'ctaLabel', 'ctaHref']) {
      expect(names, `missing legacy field ${n}`).toContain(n)
    }
  })

  it('adds the unified variant field with all six variants and the picker', () => {
    const variant: any = Hero.fields.find((f: any) => f.name === 'variant')
    expect(variant, 'variant field missing').toBeTruthy()
    const values = variant.options.map((o: any) => o.value)
    expect(values.length).toBe(6)
    expect(values).toEqual(
      expect.arrayContaining(['centered', 'split', 'overlay', 'video', 'stacked', 'showcase']),
    )
    expect(variant.admin?.components?.Field).toBe('@/components/admin/VariantPickerField')
  })

  it('adds the new content/layout fields and caps floatingCards at 2', () => {
    for (const n of ['scheme', 'eyebrow', 'media', 'poster', 'mediaSide', 'textAlign',
      'verticalAlign', 'overlay', 'minHeight', 'primaryCtaLabel', 'primaryCtaHref',
      'secondaryCtaLabel', 'secondaryCtaHref', 'headingAccent', 'featureChip', 'floatingCards']) {
      expect(names, `missing new field ${n}`).toContain(n)
    }
    const cards: any = Hero.fields.find((f: any) => f.name === 'floatingCards')
    expect(cards.type).toBe('array')
    expect(cards.maxRows).toBe(2)
  })
})

const media = { url: '/x.jpg', mimeType: 'image/jpeg', alt: 'x' } as any
const vid = { url: '/x.mp4', mimeType: 'video/mp4', alt: 'x' } as any

describe('Hero render', () => {
  it('centered (legacy row: variant null) renders heading via section-heading', () => {
    const { getByRole } = render(<HeroComponent block={{ heading: 'Hi', ctaLabel: 'Go', ctaHref: '/p' } as any} ctx={{} as any} />)
    const h = getByRole('heading', { level: 1 })
    expect(h.textContent).toBe('Hi')
    expect(h.className).toContain('text-(--section-heading)')
  })

  it('centered honors textAlign left', () => {
    const { container } = render(<HeroComponent block={{ variant: 'centered', textAlign: 'left', heading: 'Hi' } as any} ctx={{} as any} />)
    const textContainer = container.querySelector('[data-nb-part="heading"]')?.parentElement
    expect(textContainer?.className).toContain('text-left')
  })

  it('centered defaults to text-center when textAlign is not set', () => {
    const { container } = render(<HeroComponent block={{ variant: 'centered', heading: 'Hi' } as any} ctx={{} as any} />)
    const textContainer = container.querySelector('[data-nb-part="heading"]')?.parentElement
    expect(textContainer?.className).toContain('text-center')
  })

  it('split renders the media image and both CTAs', () => {
    const { container } = render(<HeroComponent block={{ variant: 'split', heading: 'H', media,
      primaryCtaLabel: 'A', primaryCtaHref: '/a', secondaryCtaLabel: 'B', secondaryCtaHref: '/b' } as any} ctx={{} as any} />)
    const img = container.querySelector('[data-nb-part="media"]')
    expect(img?.tagName.toLowerCase()).toBe('img')
    expect(container.querySelectorAll('[data-nb-part="cta"]').length).toBe(2)
  })

  it('video renders a <video> element', () => {
    const { container } = render(<HeroComponent block={{ variant: 'video', heading: 'H', media: vid } as any} ctx={{} as any} />)
    const el = container.querySelector('[data-nb-part="media"]')
    expect(el?.tagName.toLowerCase()).toBe('video')
  })

  it('showcase renders up to two floating cards, capped', () => {
    const cards = [
      { title: 'One', subtitle: 'a', corner: 'topRight' },
      { title: 'Two', subtitle: 'b', corner: 'bottomLeft' },
    ]
    const { getByText } = render(<HeroComponent block={{ variant: 'showcase', heading: 'H',
      headingAccent: 'Accent', featureChip: 'chip', media, floatingCards: cards } as any} ctx={{} as any} />)
    expect(getByText('One')).toBeTruthy()
    expect(getByText('Two')).toBeTruthy()
    expect(getByText('Accent')).toBeTruthy() // two-tone heading second line
    expect(getByText('chip')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Block-style (--bs-*) consumption — Task 8
// ---------------------------------------------------------------------------
//
// Blocks are "dumb": they never receive the resolved style as a prop, only
// read `--bs-*` custom properties an ancestor sets (RenderBlocks). So these
// tests exercise two different, complementary things:
//   1. Structure: HeroComponent's own markup always carries the arbitrary-var
//      classes that READ each var, with a literal fallback to today's
//      default — this is constant regardless of any override and proves the
//      wiring (§2c: "the class is in source, the value flows at runtime").
//   2. The wrapper's resolved vars: rendering through RenderBlocks with a
//      real blockStyles override proves resolveBlockStyle produces the right
//      *value* for that override on the ancestor — checked as a style-
//      attribute string (jsdom has no CSS engine), never computed CSS.

const showcaseBlock = {
  id: 'h1',
  blockType: 'hero',
  variant: 'showcase',
  heading: 'Grow faster',
  headingAccent: 'without limits',
  eyebrow: 'New',
  subheading: 'Own your storefront.',
  media: { url: '/x.jpg', mimeType: 'image/jpeg', alt: 'x' },
}

describe('Hero reads --bs-* vars (structure, not computed CSS)', () => {
  it('showcase eyebrow carries the size/weight/tracking/font arbitrary-var classes with fallbacks', () => {
    const { container } = render(<HeroComponent block={showcaseBlock as any} ctx={{} as any} />)
    const eyebrow = container.querySelector('[data-nb-part="eyebrow"]') as HTMLElement
    expect(eyebrow).toBeTruthy()
    expect(eyebrow.className).toContain('var(--bs-eyebrow-size,')
    expect(eyebrow.className).toContain('var(--bs-eyebrow-weight,')
    expect(eyebrow.className).toContain('var(--bs-eyebrow-tracking,')
    expect(eyebrow.className).toContain('var(--bs-eyebrow-font,')
    expect(eyebrow.className).toContain('var(--bs-eyebrow-transform,')
    expect(eyebrow.className).toContain('var(--bs-eyebrow-style,')
  })

  it('showcase heading carries the size/weight/tracking/font arbitrary-var classes, still on --section-heading', () => {
    const { container } = render(<HeroComponent block={showcaseBlock as any} ctx={{} as any} />)
    const heading = container.querySelector('[data-nb-part="heading"]') as HTMLElement
    expect(heading).toBeTruthy()
    expect(heading.className).toContain('text-(--section-heading)') // dark-scrim exception preserved
    expect(heading.className).toContain('var(--bs-heading-size,')
    expect(heading.className).toContain('var(--bs-heading-weight,')
    expect(heading.className).toContain('var(--bs-heading-font,')
  })

  it('showcase subheading carries its arbitrary-var classes', () => {
    const { container } = render(<HeroComponent block={showcaseBlock as any} ctx={{} as any} />)
    const sub = container.querySelector('[data-nb-part="body"]') as HTMLElement
    expect(sub).toBeTruthy()
    expect(sub.className).toContain('var(--bs-subheading-size,')
    expect(sub.className).toContain('var(--bs-subheading-weight,')
  })

  it('showcase accent span reads font/color/italic vars, never inline', () => {
    const { container } = render(<HeroComponent block={showcaseBlock as any} ctx={{} as any} />)
    const accent = Array.from(container.querySelectorAll('h1 span')).find((el) =>
      el.textContent?.includes('without limits'),
    ) as HTMLElement
    expect(accent).toBeTruthy()
    expect(accent.className).toContain('var(--bs-accent-font,')
    expect(accent.className).toContain('var(--bs-accent-color,')
    expect(accent.className).toContain('var(--bs-accent-style,')
    expect(accent.getAttribute('style')).toBeFalsy() // no inline color/font-family
  })

  it('showcase media reads radius/shadow/blend vars and the layout pad on its wrapper', () => {
    const { container } = render(<HeroComponent block={showcaseBlock as any} ctx={{} as any} />)
    const media = container.querySelector('[data-nb-part="media"]') as HTMLElement
    expect(media).toBeTruthy()
    expect(media.className).toContain('var(--bs-media-radius,')
    expect(media.className).toContain('var(--bs-media-layout-radius,')
    expect(media.className).toContain('var(--bs-media-shadow,')
    expect(media.className).toContain('mix-blend-mode:var(--bs-media-blend,')
    const mediaWrapper = media.parentElement as HTMLElement
    expect(mediaWrapper.className).toContain('var(--bs-media-layout-pad,')
  })

  it('showcase text column reads --bs-section-pad', () => {
    const { container } = render(<HeroComponent block={showcaseBlock as any} ctx={{} as any} />)
    const heading = container.querySelector('[data-nb-part="heading"]') as HTMLElement
    const textCol = heading.closest('div') as HTMLElement
    expect(textCol?.className).toContain('var(--bs-section-pad,')
  })

  it('showcase constrains the whole grid — media half included — to the shared section width', () => {
    const { container } = render(<HeroComponent block={showcaseBlock as any} ctx={{} as any} />)
    // The container must wrap the GRID, not a column: if it only wrapped the copy,
    // the media half would still bleed to the viewport edge (the bug this asserts against).
    const grid = container.querySelector('section > div') as HTMLElement
    expect(grid).toBeTruthy()
    expect(grid.className).toContain('max-w-[var(--bs-section-width,72rem)]')
    expect(grid.className).toContain('grid')
    // Both halves are inside it.
    const media = container.querySelector('img, video') as HTMLElement
    expect(media).toBeTruthy()
    expect(grid.contains(media)).toBe(true)
    const heading = container.querySelector('[data-nb-part="heading"]') as HTMLElement
    expect(grid.contains(heading)).toBe(true)
  })

  it('centered/overlay/stacked headings and eyebrows also read their --bs-* vars (not just showcase)', () => {
    const centered = render(<HeroComponent block={{ variant: 'centered', heading: 'H', eyebrow: 'E' } as any} ctx={{} as any} />)
    expect(centered.container.querySelector('[data-nb-part="heading"]')?.className).toContain('var(--bs-heading-size,')
    expect(centered.container.querySelector('[data-nb-part="eyebrow"]')?.className).toContain('var(--bs-eyebrow-size,')
    centered.unmount()

    const overlay = render(<HeroComponent block={{ variant: 'overlay', heading: 'H', eyebrow: 'E' } as any} ctx={{} as any} />)
    expect(overlay.container.querySelector('[data-nb-part="heading"]')?.className).toContain('var(--bs-heading-size,')
    overlay.unmount()

    const stacked = render(<HeroComponent block={{ variant: 'stacked', heading: 'H', eyebrow: 'E' } as any} ctx={{} as any} />)
    expect(stacked.container.querySelector('[data-nb-part="heading"]')?.className).toContain('var(--bs-heading-size,')
  })
})

describe('Fix round 1: stacked eyebrow stays aligned to textAlign under the treatment bundle', () => {
  // jsdom has no layout engine, so this is a structural proxy only (does the
  // right alignSelf CLASS get applied) — it cannot prove the eyebrow is
  // actually centered/left/right on screen. The real layout regression test
  // is tests/component/hero-stacked-alignment.component.ts (real Chromium +
  // real compiled Tailwind CSS via Playwright, see playwright.component.config.ts),
  // which caught this bug (EYEBROW_TREATMENT's `inline-block w-fit` opts the
  // eyebrow out of the flex column's default stretch, so without an explicit
  // alignSelf it silently pins to flex-start/left regardless of textAlign).
  it.each([
    ['left', 'mr-auto'],
    ['center', 'mx-auto'],
    ['right', 'ml-auto'],
  ] as const)('textAlign %s puts %s on the stacked eyebrow, not just the content column', (textAlign, expectedClass) => {
    const { container } = render(
      <HeroComponent block={{ variant: 'stacked', heading: 'H', eyebrow: 'E', textAlign } as any} ctx={{} as any} />,
    )
    const eyebrow = container.querySelector('[data-nb-part="eyebrow"]') as HTMLElement
    expect(eyebrow.className).toContain(expectedClass)
    // Still carries the treatment bundle's inline-block/w-fit (what made the alignSelf necessary).
    expect(eyebrow.className).toContain('inline-block')
    expect(eyebrow.className).toContain('w-fit')
  })

  it('default (no textAlign field) matches centered: mx-auto on the eyebrow', () => {
    const { container } = render(<HeroComponent block={{ variant: 'stacked', heading: 'H', eyebrow: 'E' } as any} ctx={{} as any} />)
    const eyebrow = container.querySelector('[data-nb-part="eyebrow"]') as HTMLElement
    expect(eyebrow.className).toContain('mx-auto')
  })
})

describe('Hero un-styled render is pixel-identical to the pre-block-style default', () => {
  it('showcase heading fallback embeds the previous literal defaults (3xl -> sm:4xl, extrabold, tight)', () => {
    const { container } = render(<HeroComponent block={showcaseBlock as any} ctx={{} as any} />)
    const heading = container.querySelector('[data-nb-part="heading"]') as HTMLElement
    expect(heading.className).toContain('var(--bs-heading-size,1.875rem)')
    expect(heading.className).toContain('sm:text-[length:var(--bs-heading-size,2.25rem)]')
    expect(heading.className).toContain('var(--bs-heading-weight,800)')
    expect(heading.className).toContain('var(--bs-heading-tracking,-0.025em)')
  })

  it('centered heading fallback embeds the previous literal defaults (4xl -> sm:5xl)', () => {
    const { container } = render(<HeroComponent block={{ variant: 'centered', heading: 'H' } as any} ctx={{} as any} />)
    const heading = container.querySelector('[data-nb-part="heading"]') as HTMLElement
    expect(heading.className).toContain('var(--bs-heading-size,2.25rem)')
    expect(heading.className).toContain('sm:text-[length:var(--bs-heading-size,3rem)]')
  })

  it('eyebrow fallback embeds the previous literal default (text-sm/600/wide/uppercase)', () => {
    const { container } = render(<HeroComponent block={{ variant: 'centered', heading: 'H', eyebrow: 'E' } as any} ctx={{} as any} />)
    const eyebrow = container.querySelector('[data-nb-part="eyebrow"]') as HTMLElement
    expect(eyebrow.className).toContain('var(--bs-eyebrow-size,0.875rem)')
    expect(eyebrow.className).toContain('var(--bs-eyebrow-weight,600)')
    expect(eyebrow.className).toContain('uppercase')
  })
})

describe('Hero structural controls (eyebrow.treatment, media.layout) resolve as var bundles on the wrapper', () => {
  it('pill treatment resolves a tinted background, padding and radius on the wrapper', () => {
    const { container } = render(
      <RenderBlocks blocks={[showcaseBlock]} ctx={ctx} blockStyles={{ h1: { eyebrow: { treatment: 'pill' } } }} />,
    )
    const wrapper = container.querySelector('[data-nb-block="hero"]') as HTMLElement
    expect(wrapper.style.getPropertyValue('--bs-eyebrow-treatment-bg')).toContain('color-mix')
    expect(wrapper.style.getPropertyValue('--bs-eyebrow-treatment-radius')).toBe('9999px')
    expect(wrapper.style.getPropertyValue('--bs-eyebrow-treatment-transform')).toBe('uppercase')
  })

  it("plain-caps treatment drops the pill's background/padding/radius on the wrapper", () => {
    const { container } = render(
      <RenderBlocks blocks={[showcaseBlock]} ctx={ctx} blockStyles={{ h1: { eyebrow: { treatment: 'plain-caps' } } }} />,
    )
    const wrapper = container.querySelector('[data-nb-block="hero"]') as HTMLElement
    expect(wrapper.style.getPropertyValue('--bs-eyebrow-treatment-bg')).toBe('transparent')
    expect(wrapper.style.getPropertyValue('--bs-eyebrow-treatment-pad')).toBe('0')
    expect(wrapper.style.getPropertyValue('--bs-eyebrow-treatment-radius')).toBe('0')
    expect(wrapper.style.getPropertyValue('--bs-eyebrow-treatment-transform')).toBe('uppercase')
  })

  it("plain treatment additionally drops the caps transform", () => {
    const { container } = render(
      <RenderBlocks blocks={[showcaseBlock]} ctx={ctx} blockStyles={{ h1: { eyebrow: { treatment: 'plain' } } }} />,
    )
    const wrapper = container.querySelector('[data-nb-block="hero"]') as HTMLElement
    expect(wrapper.style.getPropertyValue('--bs-eyebrow-treatment-transform')).toBe('none')
  })

  it('inset media layout resolves non-zero padding and an implied radius on the wrapper', () => {
    const { container } = render(
      <RenderBlocks blocks={[showcaseBlock]} ctx={ctx} blockStyles={{ h1: { media: { layout: 'inset' } } }} />,
    )
    const wrapper = container.querySelector('[data-nb-block="hero"]') as HTMLElement
    expect(wrapper.style.getPropertyValue('--bs-media-layout-pad')).toBe('1.5rem')
    expect(wrapper.style.getPropertyValue('--bs-media-layout-radius')).toBe('1.5rem')
  })

  it("full-bleed media layout drops the inset padding and rounding on the wrapper", () => {
    const { container } = render(
      <RenderBlocks blocks={[showcaseBlock]} ctx={ctx} blockStyles={{ h1: { media: { layout: 'full-bleed' } } }} />,
    )
    const wrapper = container.querySelector('[data-nb-block="hero"]') as HTMLElement
    expect(wrapper.style.getPropertyValue('--bs-media-layout-pad')).toBe('0')
    expect(wrapper.style.getPropertyValue('--bs-media-layout-radius')).toBe('0')
  })
})
