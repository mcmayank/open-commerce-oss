import type { ReactElement } from 'react'

import { CTABannerComponent } from './CTABanner/Component'
import { ContactComponent } from './Contact/Component'
import { FAQComponent } from './FAQ/Component'
import { FeatureGridComponent } from './FeatureGrid/Component'
import { FeaturedProductComponent } from './FeaturedProduct/Component'
import { HeroComponent } from './Hero/Component'
import { ImageGalleryComponent } from './ImageGallery/Component'
import { IncentivesComponent } from './Incentives/Component'
import { LogoStripComponent } from './LogoStrip/Component'
import { MediaHeroComponent } from './MediaHero/Component'
import { NewsletterSignupComponent } from './NewsletterSignup/Component'
import { PromoSectionComponent } from './PromoSection/Component'
import { ReviewsComponent } from './Reviews/Component'
import { RichTextComponent } from './RichText/Component'
import { SplitHeroComponent } from './SplitHero/Component'
import { StepsComponent } from './Steps/Component'
import { StoryStatsComponent } from './StoryStats/Component'
import { TestimonialsComponent } from './Testimonials/Component'
import { TickerComponent } from './Ticker/Component'
import { VideoEmbedComponent } from './VideoEmbed/Component'

/**
 * Minimal renderable fixture per block, shared by the invariant suites
 * (heading-color, inline-style, hook-contract). One definition so a block's
 * required props are updated in a single place.
 *
 * Excludes CategoryPreviews and ProductGrid: both are async server components
 * that query Payload and cannot be rendered synchronously under jsdom. Also
 * excludes Spacer: it is inert layout with no heading/body/media/cta/item
 * content, so it has nothing for these invariant suites to check.
 */
// `payload` is never read by any fixture below (see docblock: this file
// deliberately excludes the async server components that would touch it), so
// an unimplemented stub satisfies `BlockContext` without booting Payload.
export const fixtureCtx = {
  tenantId: 1,
  currency: 'AED',
  premiumSections: true,
  payload: {} as unknown as import('payload').Payload,
}

const H = 'Section heading'

/** Minimal image media for Hero variants that require media to render `[data-nb-part="media"]`. */
const IMG_MEDIA = { url: '/x.jpg', mimeType: 'image/jpeg', alt: 'x' }

/** Minimal video media for the Hero `video` variant. */
const VID_MEDIA = { url: '/x.mp4', mimeType: 'video/mp4', alt: 'x' }

/** Minimal lexical document with a single paragraph, for RichText's fixture. */
const LEXICAL_PARAGRAPH = {
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Fixture body text.', version: 1 }],
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        version: 1,
      },
    ],
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    version: 1,
  },
}

export interface BlockFixture {
  name: string
  render: () => ReactElement
  /**
   * True when this block renders no h1/h2/h3 by design (e.g. ImageGallery,
   * RichText, Ticker) — the heading invariants in heading-color.test.tsx and
   * hook-contract.test.tsx have nothing to check for it, so they skip the
   * "must render a heading" assertion for this fixture rather than failing
   * on a block that was never supposed to have one.
   */
  headless?: boolean
}

export const BLOCK_FIXTURES: BlockFixture[] = [
  { name: 'CTABanner', render: () => <CTABannerComponent block={{ heading: H } as never} ctx={fixtureCtx} /> },
  {
    name: 'Contact',
    render: () => (
      <ContactComponent
        block={{ heading: H, address: '1 Test Street', phone: '+1 555 0100' } as never}
        ctx={fixtureCtx}
      />
    ),
  },
  {
    name: 'FAQ',
    render: () => (
      <FAQComponent
        block={{ heading: H, items: [{ id: 'q1', question: 'Q', answer: 'A' }] } as never}
        ctx={fixtureCtx}
      />
    ),
  },
  {
    // `items` (icon/heading/text, src/blocks/FeatureGrid/config.ts) was never
    // set at all — heading alone stopped the `!items?.length && !heading`
    // guard from bailing, so the block rendered its heading and zero item
    // cards. item/item-heading/item-body/item-media were never exercised by
    // any fixture-driven test (heading-color, inline-style, hook-contract).
    name: 'FeatureGrid',
    render: () => (
      <FeatureGridComponent
        block={{ heading: H, items: [{ id: 'f1', icon: 'star', heading: 'One', text: 'T' }] } as never}
        ctx={fixtureCtx}
      />
    ),
  },
  {
    // product.tenant must match fixtureCtx.tenantId, or the block bails and renders null.
    name: 'FeaturedProduct',
    render: () => (
      <FeaturedProductComponent
        block={{
          variant: 'imageLeft',
          product: {
            id: 1,
            tenant: 1,
            title: 'Fixture Product',
            slug: 'fixture-product',
            status: 'active',
            price: 1000,
            images: [{ id: 1, url: '/product.png', alt: 'Fixture product' }],
          },
        } as never}
        ctx={fixtureCtx}
      />
    ),
  },
  { name: 'Hero/centered', render: () => <HeroComponent block={{ variant: 'centered', heading: H } as never} ctx={fixtureCtx} /> },
  {
    name: 'Hero/split',
    render: () => (
      <HeroComponent
        block={
          { variant: 'split', heading: H, media: IMG_MEDIA, primaryCtaLabel: 'Go', primaryCtaHref: '/p' } as never
        }
        ctx={fixtureCtx}
      />
    ),
  },
  {
    name: 'Hero/overlay',
    render: () => <HeroComponent block={{ variant: 'overlay', heading: H, media: IMG_MEDIA } as never} ctx={fixtureCtx} />,
  },
  {
    name: 'Hero/video',
    render: () => <HeroComponent block={{ variant: 'video', heading: H, media: VID_MEDIA } as never} ctx={fixtureCtx} />,
  },
  {
    name: 'Hero/stacked',
    render: () => <HeroComponent block={{ variant: 'stacked', heading: H, media: IMG_MEDIA } as never} ctx={fixtureCtx} />,
  },
  {
    name: 'Hero/showcase',
    render: () => (
      <HeroComponent
        block={
          {
            variant: 'showcase',
            heading: H,
            headingAccent: 'More',
            featureChip: 'chip',
            media: IMG_MEDIA,
            floatingCards: [{ title: 'C', subtitle: 's', corner: 'topRight' }],
          } as never
        }
        ctx={fixtureCtx}
      />
    ),
  },
  {
    name: 'ImageGallery',
    // Renders only a grid of images — no h1/h2/h3 by design.
    headless: true,
    render: () => (
      <ImageGalleryComponent
        block={{ images: [{ id: 1, url: '/gallery.png', alt: 'Fixture image' }] } as never}
        ctx={fixtureCtx}
      />
    ),
  },
  {
    name: 'Incentives',
    render: () => (
      <IncentivesComponent
        block={{ heading: H, items: [{ id: 'i1', icon: 'star', heading: 'Item', text: 'T' }] } as never}
        ctx={fixtureCtx}
      />
    ),
  },
  {
    // Needs at least one resolvable logo — the block renders nothing otherwise.
    // The logo entry's text field is `label` (src/blocks/LogoStrip/config.ts:29),
    // not `name` — the old `name: 'Acme'` didn't exist on the schema, so
    // LogoImage's `alt={logo.alt}` (which falls back to `logo.label ?? media?.alt`)
    // always rendered an empty alt. No hook was zeroed by this (LogoStrip's
    // `item` wrapper only exists on the bordered/marquee variants, not the
    // default staticRow this fixture renders), but it's the same
    // field-that-does-not-exist defect as the Steps/FeatureGrid fixtures.
    name: 'LogoStrip',
    render: () => (
      <LogoStripComponent
        block={{ heading: H, logos: [{ image: { url: '/logo.png' }, label: 'Acme' }] } as never}
        ctx={fixtureCtx}
      />
    ),
  },
  {
    name: 'MediaHero',
    render: () => <MediaHeroComponent block={{ heading: H, eyebrow: 'Fixture eyebrow' } as never} ctx={fixtureCtx} />,
  },
  {
    name: 'NewsletterSignup',
    render: () => <NewsletterSignupComponent block={{ heading: H } as never} ctx={fixtureCtx} />,
  },
  {
    name: 'PromoSection',
    render: () => (
      <PromoSectionComponent
        block={
          {
            heading: H,
            eyebrow: 'Fixture eyebrow',
            primaryCtaLabel: 'Shop',
            primaryCtaHref: '/products',
          } as never
        }
        ctx={fixtureCtx}
      />
    ),
  },
  {
    name: 'Reviews',
    render: () => (
      <ReviewsComponent
        block={
          {
            heading: H,
            items: [
              {
                id: 'r1',
                author: 'A',
                quote: 'B',
                rating: 5,
                // Must match fixtureCtx.tenantId (via reviewProduct's tenant
                // check) for the "on {product}" link to render at all.
                product: { id: 1, tenant: 1, title: 'Fixture Product', slug: 'fixture-product' },
              },
            ],
          } as never
        }
        ctx={fixtureCtx}
      />
    ),
  },
  {
    name: 'RichText',
    // Renders arbitrary lexical prose — no h1/h2/h3 by design.
    headless: true,
    render: () => <RichTextComponent block={{ content: LEXICAL_PARAGRAPH } as never} ctx={fixtureCtx} />,
  },
  {
    name: 'SplitHero',
    render: () => <SplitHeroComponent block={{ heading: H, eyebrow: 'Fixture eyebrow' } as never} ctx={fixtureCtx} />,
  },
  {
    // `steps` (title/description), not `items` (heading/text) — matches
    // StepsBlock's actual field shape (src/blocks/Steps/config.ts). Without a
    // populated `steps` array the block renders zero items, so it never
    // exercised item/item-heading/item-body/badge before this fix.
    name: 'Steps',
    render: () => (
      <StepsComponent
        block={{ heading: H, steps: [{ id: 's1', title: 'One', description: 'T' }] } as never}
        ctx={fixtureCtx}
      />
    ),
  },
  {
    // `stats` (src/blocks/StoryStats/config.ts) has no `minRows`, so it's
    // legitimately optional on the schema — but leaving it unset here meant
    // `rows.length > 0` never held, and item/item-heading/item-body were
    // never exercised by any fixture-driven test. Same defect shape as
    // FeatureGrid/Steps (an unpopulated array silently skips an entire class
    // of hooks), just via a field that's genuinely allowed to be empty rather
    // than a wrong field name.
    name: 'StoryStats',
    render: () => (
      <StoryStatsComponent
        block={
          {
            heading: H,
            eyebrow: 'Fixture eyebrow',
            stats: [{ id: 'stat1', value: '24h', label: 'Slow ferment' }],
          } as never
        }
        ctx={fixtureCtx}
      />
    ),
  },
  {
    name: 'Testimonials',
    render: () => (
      <TestimonialsComponent
        block={{ heading: H, items: [{ id: 't1', author: 'A', quote: 'Q' }] } as never}
        ctx={fixtureCtx}
      />
    ),
  },
  {
    name: 'Ticker',
    // Renders a row of repeated phrases — no h1/h2/h3 by design.
    headless: true,
    render: () => (
      <TickerComponent
        block={{ variant: 'static', items: [{ id: 'p1', label: 'Free shipping' }] } as never}
        ctx={fixtureCtx}
      />
    ),
  },
  {
    name: 'VideoEmbed',
    render: () => (
      <VideoEmbedComponent
        block={{ heading: H, provider: 'youtube', url: 'https://youtu.be/abc123' } as never}
        ctx={fixtureCtx}
      />
    ),
  },
]
