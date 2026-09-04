/** Block types gated behind the Growth plan (premiumSections entitlement). */
export const PREMIUM_BLOCK_TYPES = new Set<string>(['splitHero'])

/** True if any block in the layout is a premium block type. */
export function layoutUsesPremium(
  layout: { blockType?: string }[] | null | undefined,
): boolean {
  if (!Array.isArray(layout)) return false
  return layout.some((b) => b?.blockType != null && PREMIUM_BLOCK_TYPES.has(b.blockType))
}

/**
 * Layout variants gated behind the Growth plan, keyed by blockType.
 *
 * Kept in this JSX-free module so the server (save-time enforcement in
 * `plan-enforcement.ts`) and the client (lock badges in `VariantPickerField`)
 * share one source of truth and cannot drift.
 *
 * Rule: motion (carousel / marquee) and editorial overlay layouts require
 * Growth; the plain, standard layouts stay free. `splitHero` is deliberately
 * absent — it is gated at the BLOCK level via PREMIUM_BLOCK_TYPES.
 * Hero's editorial and motion variants (showcase, video) are also gated.
 */
export const PREMIUM_VARIANTS: Record<string, ReadonlySet<string>> = {
  hero: new Set(['showcase', 'video']),
  productGrid: new Set(['carousel']),
  logoStrip: new Set(['marquee']),
  ticker: new Set(['marquee']),
  reviews: new Set(['masonry']),
  categoryPreviews: new Set(['overlayCards']),
  promoSection: new Set(['overlay']),
  featuredProduct: new Set(['overlay']),
  videoEmbed: new Set(['textOverlay']),
}

/** True if this block/variant pair requires the Growth plan. */
export function isPremiumVariant(
  blockType?: string | null,
  variant?: string | null,
): boolean {
  if (!blockType || !variant) return false
  return PREMIUM_VARIANTS[blockType]?.has(variant) ?? false
}
