import type { Block } from 'payload'
import { PAGE_BLOCKS } from '@/blocks/registry'
import { PREMIUM_BLOCK_TYPES, PREMIUM_VARIANTS } from '@/blocks/premium'
import { DEFAULT_THEME_SLUG, themeCatalog } from '@/themes/catalog'

/**
 * Counts the marketing site quotes, derived from the registries that define them.
 *
 * CLAUDE.md: "Derive counts (blocks, themes, gateways) from their registries in
 * UI. Never hardcode '23 blocks' into copy; it goes stale the next time one
 * ships." This module is how that rule is kept — every surface that states a
 * number imports it from here, so the homepage, /features and /templates cannot
 * drift from each other or from the code.
 *
 * SERVER ONLY. `@/blocks/registry` pulls in every Payload block config; keeping
 * these numbers out of the client bundle is why `Capability` takes them as
 * props rather than importing this module itself.
 */

/**
 * The blocks every count and every named example on this site is derived from.
 * All registered blocks are marketing-visible now that `customSection` has an
 * authoring UI (the section-definitions editor) — nothing is filtered out of
 * `PAGE_BLOCKS` here any more.
 */
const MARKETING_BLOCKS = PAGE_BLOCKS

/** Slugs behind the numbers below — exported so tests can constrain composition. */
export const MARKETING_BLOCK_SLUGS: readonly string[] = MARKETING_BLOCKS.map((b) => b.slug)

/** Storefront page-builder blocks the site may talk about. */
export const BLOCK_COUNT = MARKETING_BLOCKS.length

/**
 * Blocks the site must not call free. NOT `PREMIUM_BLOCK_TYPES`, which is the
 * render-time gate — `customSection` is deliberately absent from that set
 * because gating it at render would strip live sections on a downgrade. It is
 * gated at save by `assertCustomSections`, which the counts cannot see, so it
 * is named here instead. Subtraction is why this exists: a block gated by any
 * means that is not listed here lands in the free bucket silently.
 */
export const MARKETING_PREMIUM_BLOCKS: ReadonlySet<string> = new Set([
  ...PREMIUM_BLOCK_TYPES,
  'customSection',
])

/** Blocks gated to the premium plan, whether gated at render or at save. */
export const PREMIUM_BLOCK_COUNT = MARKETING_BLOCKS.filter((b) =>
  MARKETING_PREMIUM_BLOCKS.has(b.slug),
).length

/**
 * Blocks available on every plan, Free included.
 *
 * NOT the same as BLOCK_COUNT: the registry total includes the premium-gated
 * types. Copy that pairs a number with the word "free" must use this one — the
 * site said "23 free blocks" while one of the 23 was gated.
 */
export const FREE_BLOCK_COUNT = BLOCK_COUNT - PREMIUM_BLOCK_COUNT

/** Premium layout variants across all block types, e.g. productGrid → carousel. */
export const PREMIUM_VARIANT_COUNT = Object.values(PREMIUM_VARIANTS).reduce(
  (total, variants) => total + variants.size,
  0,
)

/** How many block types gain at least one premium layout. */
export const PREMIUM_VARIANT_BLOCK_COUNT = Object.keys(PREMIUM_VARIANTS).length

/**
 * Display names of the block types gated to Premium, read from the registry's
 * own labels rather than retyped.
 *
 * The admin label carries a "(Pro)" suffix so the gate is visible in the block
 * picker; marketing copy already frames it as premium, so the suffix is dropped
 * here. Payload allows `labels.singular` to be an i18n record, hence the guard.
 */
export const PREMIUM_BLOCK_NAMES = MARKETING_BLOCKS.filter((b) =>
  PREMIUM_BLOCK_TYPES.has(b.slug),
).map(
  (b) => {
    const label = b.labels?.singular
    const text = typeof label === 'string' ? label : b.slug
    return text.replace(/\s*\(Pro\)$/i, '')
  },
)

/**
 * A representative spread of premium layout variants, for copy that needs to
 * convey what the upsell actually is rather than a bare count.
 *
 * Every entry must map to a real `blockType → variant` pair in PREMIUM_VARIANTS.
 * `site-counts.test.ts` enforces that, because a plausible-sounding layout name
 * is exactly the kind of phantom feature that has shipped here before.
 */
export const PREMIUM_VARIANT_EXAMPLES = [
  { blockType: 'productGrid', variant: 'carousel', label: 'product carousels' },
  { blockType: 'logoStrip', variant: 'marquee', label: 'scrolling logo strips' },
  { blockType: 'reviews', variant: 'masonry', label: 'masonry review walls' },
  { blockType: 'categoryPreviews', variant: 'overlayCards', label: 'overlay category cards' },
  { blockType: 'videoEmbed', variant: 'textOverlay', label: 'text-over-video heroes' },
] as const

/**
 * Designed storefront themes — `editorial` and `sd-bakery` today.
 *
 * Excludes the built-in `default`, which is the unstyled storefront rather than
 * a theme someone chose. `TEMPLATE_COUNT` is the picker's total if you need the
 * other framing; do not conflate them in copy.
 */
export const THEME_COUNT = themeCatalog.filter((t) => t.slug !== DEFAULT_THEME_SLUG).length

/** Everything selectable in the template picker, including Default. */
export const TEMPLATE_COUNT = themeCatalog.length

/**
 * How many layout variants a block offers. Blocks without a `variant` select
 * return 0 and are excluded from the range below.
 */
function variantOptionCount(block: Block): number {
  const field = block.fields.find((f) => 'name' in f && f.name === 'variant')
  if (!field || field.type !== 'select' || !Array.isArray(field.options)) return 0
  return field.options.length
}

const VARIANT_COUNTS = MARKETING_BLOCKS.map(variantOptionCount).filter((n) => n > 0)

/** Blocks that offer a layout variant choice at all. */
export const BLOCKS_WITH_VARIANTS = VARIANT_COUNTS.length

/**
 * The real spread of layout variants per block, e.g. "2–4".
 *
 * /templates claimed "Each ships with 4 layout variants" while the actual range
 * was 2 to 4 and most blocks had fewer — the kind of number that is true the
 * week it is written and quietly false a block later.
 */
export const MIN_VARIANTS_PER_BLOCK = Math.min(...VARIANT_COUNTS)
export const MAX_VARIANTS_PER_BLOCK = Math.max(...VARIANT_COUNTS)

/**
 * A representative spread of block names, for copy that needs to convey range
 * rather than a bare number. Ordered to show the variety, not the registry
 * order. Keep every entry traceable to a config in `PAGE_BLOCKS`.
 */
export const BLOCK_EXAMPLES = [
  'split heroes',
  'product grids',
  'editorial layouts',
  'galleries',
  'reviews',
  'tickers',
  'FAQs',
  'steps',
  'testimonials',
  'contact forms',
] as const
