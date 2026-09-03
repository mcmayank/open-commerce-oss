import { isPremiumVariant } from './premium'

/** Minimal shape of a layout block row as it arrives from the admin. */
export type LayoutBlock = {
  id?: string | null
  blockType?: string | null
  variant?: string | null
}

export type PremiumVariantUse = { blockType: string; variant: string }

/**
 * Premium variants NEWLY introduced by this save.
 *
 * A premium variant already present on the same block — matched on Payload's
 * stable block `id` — with the same value is grandfathered and not reported.
 * That is what lets a tenant on a free plan keep editing a page that already
 * uses a premium variant instead of being trapped in an unsavable form.
 *
 * Match key is the compound (id, variant), unlike the sibling
 * findNewCustomSections (custom-section-diff.ts), which matches on id alone.
 * That divergence is deliberate, not drift: a `customSection` has no variant
 * axis, and a block that keeps its id but switches TO a premium variant is a
 * genuinely new premium usage, not a grandfathered one — the id repeating
 * does not repeat the thing being gated.
 */
export function findNewPremiumVariants(
  incoming: LayoutBlock[] | null | undefined,
  original: LayoutBlock[] | null | undefined,
): PremiumVariantUse[] {
  if (!Array.isArray(incoming)) return []

  const before = new Map<string, string>()
  // Array.isArray, not `original ?? []`: `originalDoc.layout` is whatever the row
  // holds, and a non-array (a `{}` from a partial write, a string) is not
  // iterable — it would throw inside the Pages `beforeChange` hook and block the
  // save outright. Mirrors the same guard in findNewCustomSections.
  if (Array.isArray(original)) {
    for (const block of original) {
      if (block?.id && block.variant) before.set(block.id, block.variant)
    }
  }

  const introduced: PremiumVariantUse[] = []
  for (const block of incoming) {
    if (!block?.blockType || !block.variant) continue
    if (!isPremiumVariant(block.blockType, block.variant)) continue
    if (block.id && before.get(block.id) === block.variant) {
      // Consume the match so one original block can grandfather at most one
      // incoming block — otherwise duplicating a grandfathered id would
      // grandfather every duplicate too.
      before.delete(block.id)
      continue // grandfathered
    }
    introduced.push({ blockType: block.blockType, variant: block.variant })
  }
  return introduced
}
