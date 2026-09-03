import React from 'react'
import type { Payload } from 'payload'
import { HeroComponent } from './Hero/Component'
import { RichTextComponent } from './RichText/Component'
import { ProductGridComponent } from './ProductGrid/Component'
import { ImageGalleryComponent } from './ImageGallery/Component'
import { CTABannerComponent } from './CTABanner/Component'
import { TestimonialsComponent } from './Testimonials/Component'
import { FAQComponent } from './FAQ/Component'
import { NewsletterSignupComponent } from './NewsletterSignup/Component'
import { SplitHeroComponent } from './SplitHero/Component'
import { SpacerComponent } from './Spacer/Component'
import { FeatureGridComponent } from './FeatureGrid/Component'
import { StepsComponent } from './Steps/Component'
import { LogoStripComponent } from './LogoStrip/Component'
import { VideoEmbedComponent } from './VideoEmbed/Component'
import { ContactComponent } from './Contact/Component'
import { FeaturedProductComponent } from './FeaturedProduct/Component'
import { IncentivesComponent } from './Incentives/Component'
import { CategoryPreviewsComponent } from './CategoryPreviews/Component'
import { PromoSectionComponent } from './PromoSection/Component'
import { ReviewsComponent } from './Reviews/Component'
import { MediaHeroComponent } from './MediaHero/Component'
import { TickerComponent } from './Ticker/Component'
import { StoryStatsComponent } from './StoryStats/Component'
import { CustomSectionComponent } from './CustomSection/Component'
import { PREMIUM_BLOCK_TYPES } from './premium'
import { BLOCK_DEFAULT_SCHEME, sectionVars, type SectionScheme } from './lib/colorScheme'
import { resolveBlockStyle } from '@/lib/block-style/resolve'
import type { BlockStyle } from '@/lib/block-style/vocabulary'

export type BlockContext = {
  tenantId: string | number
  currency: string
  premiumSections: boolean
  /**
   * Needed by `customSection`: `content` lives in a json column, so Payload
   * never populates the Media relationship a media slot points at, and the
   * render path resolves those ids itself (src/lib/recipe-media.ts).
   */
  payload: Payload
}

// Each entry renders one stored block. `block` is the union from payload-types.
const registry: Record<string, React.FC<{ block: any; ctx: BlockContext }>> = {
  hero: HeroComponent,
  richText: RichTextComponent,
  productGrid: ProductGridComponent as React.FC<{ block: any; ctx: BlockContext }>,
  imageGallery: ImageGalleryComponent,
  ctaBanner: CTABannerComponent,
  testimonials: TestimonialsComponent,
  faq: FAQComponent,
  newsletterSignup: NewsletterSignupComponent,
  splitHero: SplitHeroComponent,
  spacer: SpacerComponent,
  featureGrid: FeatureGridComponent,
  steps: StepsComponent,
  logoStrip: LogoStripComponent,
  videoEmbed: VideoEmbedComponent,
  contact: ContactComponent,
  featuredProduct: FeaturedProductComponent as React.FC<{ block: any; ctx: BlockContext }>,
  incentives: IncentivesComponent,
  categoryPreviews: CategoryPreviewsComponent as React.FC<{ block: any; ctx: BlockContext }>,
  promoSection: PromoSectionComponent,
  reviews: ReviewsComponent,
  mediaHero: MediaHeroComponent,
  ticker: TickerComponent,
  storyStats: StoryStatsComponent,
  customSection: CustomSectionComponent as React.FC<{ block: any; ctx: BlockContext }>,
}

/**
 * `pages.blockStyles` / store settings `blockStyleDefaults` are untyped Payload
 * json columns — `{[k: string]: unknown} | unknown[] | string | number | boolean
 * | null` per payload-types.ts. Only a plain object is a valid style map; any
 * other shape (including a malformed save) contributes nothing rather than
 * throwing, matching resolveBlockStyle's "absent key → no vars" contract.
 */
function asStyleMap(value: unknown): Record<string, BlockStyle> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, BlockStyle>
}

export function RenderBlocks({
  blocks,
  ctx,
  schemes,
  blockStyles,
  styleDefaults,
}: {
  blocks: any[] | null | undefined
  ctx: BlockContext
  /** Active theme's per-block scheme overrides (Slice E), over BLOCK_DEFAULT_SCHEME. */
  schemes?: Record<string, SectionScheme>
  /** Per-instance `--bs-*` style overrides, keyed by block id (`pages.blockStyles`). */
  blockStyles?: Record<string, unknown>
  /** Store-wide `--bs-*` style defaults, keyed by blockType (store settings `blockStyleDefaults`). */
  styleDefaults?: Record<string, unknown>
}) {
  if (!blocks?.length) return null
  const instanceStyles = asStyleMap(blockStyles)
  const storeDefaults = asStyleMap(styleDefaults)
  return (
    <>
      {blocks.map((block, i) => {
        // Premium blocks (e.g. splitHero) are gated behind the store's plan entitlement.
        // Block-level gating only. Premium *variants* are deliberately NOT gated
        // here: the storefront always renders what is saved, so a grandfathered
        // page (or a Pro -> Starter downgrade) never silently changes appearance.
        // Variant entitlement is enforced at save time in plan-enforcement.ts.
        if (PREMIUM_BLOCK_TYPES.has(block.blockType) && !ctx.premiumSections) return null
        const Comp = registry[block.blockType]
        if (!Comp) return null // unknown block type — skip gracefully
        // Wrap each block in its section color scheme: the wrapper sets the
        // --section-* vars (and, for non-default schemes, the band background)
        // that scheme-aware blocks consume. Blocks that don't read them are
        // unaffected on the default scheme.
        // A per-instance scheme wins over the per-block-type default. `customSection`
        // needs this: every custom section shares one blockType, so BLOCK_DEFAULT_SCHEME
        // cannot tell them apart. `||` not `??` — an unset Payload select is '' as often
        // as it is null, and '' is not a scheme. No shipped block sets this field, so
        // all 23 resolve exactly as before.
        const scheme =
          (block.scheme as SectionScheme | undefined) ||
          (schemes?.[block.blockType] ?? BLOCK_DEFAULT_SCHEME[block.blockType] ?? 'default')
        // Merged --bs-* style vars: store-wide default for this blockType, then
        // this instance's own override wins field-by-field (resolveBlockStyle,
        // Task 2). A block with neither contributes no --bs-* vars at all.
        const bs = resolveBlockStyle(block.blockType, block.id ?? '', storeDefaults, instanceStyles)
        return (
          <div
            key={block.id ?? i}
            data-scheme={scheme}
            // Published hook contract (nb-hooks/1) — see docs/THEMING-HOOKS.md.
            // Merchant CSS targets these; they are an API, not an implementation
            // detail, and must not be renamed without a contract version bump.
            data-nb-block={block.blockType}
            data-nb-variant={block.variant || undefined}
            data-nb-block-id={block.id || undefined}
            style={{ ...sectionVars(scheme), ...bs }}
          >
            <Comp block={block} ctx={ctx} />
          </div>
        )
      })}
    </>
  )
}
