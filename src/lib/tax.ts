/**
 * Storefront tax arithmetic. Pure — no Payload, no network, integer minor units
 * end to end.
 *
 * Niblr calculates and documents tax. It never remits or files it: the merchant
 * does that. But because Niblr issues the invoice, a wrong number here is
 * Niblr's output, under the merchant's name — which is why this module has no
 * floating-point arithmetic in it and no `toBeCloseTo` in its tests.
 *
 * THE RULE THAT MATTERS: inclusive tax is EXTRACTION, not addition.
 *
 *   Inclusive (the default for UAE and India, and the correct default):
 *     a listed AED 100 means the shopper pays AED 100.
 *     tax = 100 × 5 / 105 = 4.76 · net 95.24 · gross 100 — the total does not move.
 *
 *   Exclusive:
 *     tax = 100 × 5 / 100 = 5.00 · net 100 · gross 105.
 *
 * Computing `base × rate / 100` in inclusive mode is the standard bug. It gives
 * 5.00, a gross of 105, and a price that no longer matches the listing.
 */

export type TaxConfig = {
  enabled: boolean
  /** Percent, e.g. 5. Fractions allowed (7.5); anything below zero means no tax. */
  rate: number
  pricesIncludeTax: boolean
  registrationNumber?: string | null
}

export type TaxBreakdown = {
  /** The tax itself, in minor units. */
  taxMinor: number
  /** Amount excluding tax. */
  netMinor: number
  /** Amount including tax — what the shopper pays. */
  grossMinor: number
}

/**
 * Divide two non-negative integers, rounding half up, without touching a float.
 *
 * `Math.round(n / d)` would introduce a floating-point division before the
 * rounding decision, so a value that is mathematically exactly .5 can land
 * either side of it. Doubling first keeps the comparison in integers.
 */
function divRoundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator))
}

/**
 * Split a taxable base into tax, net and gross.
 *
 * `taxableBaseMinor` is subtotal − discount + shipping, in minor units. In
 * inclusive mode it is the gross and the result never changes it; in exclusive
 * mode it is the net and tax is added on top.
 *
 * Guarantees, all covered by tests:
 *  - `netMinor + taxMinor === grossMinor`, always
 *  - every component is a non-negative integer
 *  - inclusive mode never changes the gross from the base it was given
 */
export function computeTax(taxableBaseMinor: number, config: TaxConfig): TaxBreakdown {
  const base = Math.max(0, Math.trunc(taxableBaseMinor))

  // Rate as integer basis points, so a fractional percent (7.5) stays exact.
  const rateBp = Math.round(Math.max(0, config.rate) * 100)

  if (!config.enabled || rateBp === 0 || base === 0) {
    return { taxMinor: 0, netMinor: base, grossMinor: base }
  }

  if (config.pricesIncludeTax) {
    // Extraction: the base already contains the tax.
    const taxMinor = divRoundHalfUp(base * rateBp, 10000 + rateBp)
    return { taxMinor, netMinor: base - taxMinor, grossMinor: base }
  }

  // Addition: the base is net, tax goes on top.
  const taxMinor = divRoundHalfUp(base * rateBp, 10000)
  return { taxMinor, netMinor: base, grossMinor: base + taxMinor }
}

/**
 * What an order records about tax, and how much the total actually moves.
 *
 * The two are NOT the same number, which is the whole point of this type.
 */
export type OrderTaxSnapshot = {
  /** The VAT on this order — extracted (inclusive) or added (exclusive). Stored. */
  taxAmount: number
  /**
   * How much to ADD to the order total. Zero in inclusive mode, because the tax
   * is already inside the line prices.
   *
   * `computeOrderAmounts` does `subtotal − discount + shipping + tax`, which is
   * right for exclusive and would double-charge for inclusive. Pass this, never
   * `taxAmount`.
   */
  taxToAdd: number
  /** Snapshotted so a later settings change cannot restate an issued invoice. */
  taxRate: number | null
  taxInclusive: boolean | null
  supplierTrn: string | null
}

/**
 * Resolve the tax for an order from the store's settings at the moment it is
 * placed. Everything it returns is written onto the order; nothing is read live
 * from settings again.
 *
 * An unregistered store gets nulls rather than zeros, so the invoice can tell
 * "no VAT applies" apart from "VAT applies and happens to be zero" — the first
 * shows no VAT line at all, the second shows 0.00.
 */
export function orderTax(
  taxableBaseMinor: number,
  config: TaxConfig | null | undefined,
): OrderTaxSnapshot {
  const none: OrderTaxSnapshot = {
    taxAmount: 0,
    taxToAdd: 0,
    taxRate: null,
    taxInclusive: null,
    supplierTrn: null,
  }
  if (!config?.enabled) return none

  const { taxMinor } = computeTax(taxableBaseMinor, config)
  const trn = String(config.registrationNumber ?? '').trim()

  return {
    taxAmount: taxMinor,
    taxToAdd: config.pricesIncludeTax ? 0 : taxMinor,
    taxRate: config.rate,
    taxInclusive: config.pricesIncludeTax,
    supplierTrn: trn.length > 0 ? trn : null,
  }
}
