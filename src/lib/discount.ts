export type DiscountLike = {
  type: 'percent' | 'fixed'
  value: number
  minOrder?: number | null
  usageLimit?: number | null
  usedCount?: number | null
  validFrom?: string | null
  validUntil?: string | null
  active: boolean
}

/**
 * Pure function — no side-effects, no Payload imports.
 * Returns the discount amount in integer minor units and an optional error string.
 *
 * Invariants:
 *   - discountAmount is always a non-negative integer
 *   - discountAmount never exceeds subtotalMinor (total cannot go negative)
 *
 * Guards evaluated in order:
 *   1. active flag
 *   2. usage limit (usedCount >= usageLimit)
 *   3. validity window (validFrom / validUntil)
 *   4. minimum order (subtotal < minOrder)
 *
 * All guard failures return { discountAmount: 0, error: string }.
 */
export function applyDiscount(
  subtotalMinor: number,
  code: DiscountLike,
  now: Date = new Date(),
): { discountAmount: number; error?: string } {
  const err = (msg: string) => ({ discountAmount: 0, error: msg })

  // 1. active check
  if (!code.active) return err('Discount code is inactive.')

  // 2. usage limit check
  if (code.usageLimit != null && (code.usedCount ?? 0) >= code.usageLimit) {
    return err('Discount code usage limit reached.')
  }

  // 3. validity window
  if (code.validFrom != null && now < new Date(code.validFrom)) {
    return err('Discount code is not yet valid.')
  }
  if (code.validUntil != null && now > new Date(code.validUntil)) {
    return err('Discount code has expired.')
  }

  // 4. minimum order
  if (code.minOrder != null && subtotalMinor < code.minOrder) {
    return err(`Minimum order of ${code.minOrder} minor units required.`)
  }

  // Calculate discount
  let discountAmount: number
  if (code.type === 'percent') {
    // Floor to integer minor units — no fractional paise/cents.
    // Cap at subtotalMinor so a value > 100 cannot produce a discount exceeding the subtotal.
    discountAmount = Math.min(subtotalMinor, Math.floor(subtotalMinor * (code.value / 100)))
  } else {
    // Fixed — cap so total cannot go negative
    discountAmount = Math.min(code.value, subtotalMinor)
  }

  // Invariant: non-negative integer
  discountAmount = Math.max(0, Math.floor(discountAmount))

  return { discountAmount }
}
