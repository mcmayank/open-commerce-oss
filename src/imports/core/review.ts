/**
 * Review-phase rules — phase two of three.
 *
 * Pure, so the decisions that matter are testable without a browser. The screen
 * renders what these functions return; it does not re-derive any of it.
 *
 * Nothing here touches the network or the database. Review is UI only: the
 * catalog was fetched once during discovery and is not read again.
 */
import type { ImportWarning } from './types'

export type ReviewItem = {
  id: number
  status: 'pending' | 'selected' | 'skipped' | 'imported' | 'failed'
  warnings: ImportWarning[]
  /** Variants on the mapped product, used to project the import's cost. */
  variantCount: number
  /** Null when the source gave no usable price and the merchant has not set one. */
  priceMinor: number | null
}

export type BlockerCode =
  | 'no_selection'
  | 'ownership_not_attested'
  | 'tax_treatment_unanswered'
  | 'selected_item_without_price'
  | 'over_plan_cap'

export type Blocker = { code: BlockerCode; message: string }

export type ReviewGateArgs = {
  items: ReviewItem[]
  ownershipAttested: boolean
  taxTreatment: 'inclusive' | 'exclusive' | null
  /** From the plan limits. Never hardcode it at a call site. */
  maxProducts: number
  /** Products this store already has; the cap applies to the total. */
  existingProductCount: number
}

export type ReviewGate = { canImport: boolean; blockers: Blocker[] }

const isSelected = (item: ReviewItem) => item.status === 'selected'

/**
 * Every reason the import cannot start, all at once.
 *
 * Reporting them one at a time turns a two-field form into a guessing game, so
 * the screen shows the whole list and enables the button when it empties.
 */
export function reviewGate(args: ReviewGateArgs): ReviewGate {
  const selected = args.items.filter(isSelected)
  const blockers: Blocker[] = []

  if (selected.length === 0) {
    blockers.push({ code: 'no_selection', message: 'Choose at least one product to import.' })
  }

  if (!args.ownershipAttested) {
    blockers.push({
      code: 'ownership_not_attested',
      message: 'Confirm you own this store, or are authorised to import from it.',
    })
  }

  if (args.taxTreatment === null) {
    blockers.push({
      code: 'tax_treatment_unanswered',
      message:
        'Say whether the prices on your existing store include tax. There is no default — ' +
        'guessing would make every imported price wrong.',
    })
  }

  const unpriced = selected.filter((item) => item.priceMinor === null)
  if (unpriced.length > 0) {
    blockers.push({
      code: 'selected_item_without_price',
      message:
        `${unpriced.length} selected ${unpriced.length === 1 ? 'product has' : 'products have'} ` +
        `no price. Set one, or deselect them.`,
    })
  }

  // Refusing up front beats importing as many as fit and then failing, which
  // reads as success until the merchant counts what arrived.
  const total = args.existingProductCount + selected.length
  if (total > args.maxProducts) {
    const room = Math.max(args.maxProducts - args.existingProductCount, 0)
    blockers.push({
      code: 'over_plan_cap',
      message:
        `Your plan allows ${args.maxProducts} products and this store already has ` +
        `${args.existingProductCount}, so there is room for ${room}. ` +
        `You have ${selected.length} selected.`,
    })
  }

  return { canImport: blockers.length === 0, blockers }
}

/**
 * How many extra requests the selected products will cost.
 *
 * WooCommerce cannot batch variation fetches — `?include=` was tested against a
 * live store and returns nothing — so every variant beyond a simple product is
 * its own round trip. A single-variant product costs none.
 */
export function projectedVariationRequests(items: ReviewItem[]): number {
  return items
    .filter(isSelected)
    .reduce((sum, item) => sum + (item.variantCount > 1 ? item.variantCount : 0), 0)
}

/**
 * Per-origin pacing in `safeFetch` is deliberate — two concurrent requests with
 * a 250 ms gap, so an import never looks like an attack on the merchant's own
 * server. The consequence is that a large variable catalog genuinely takes
 * minutes, and saying so beats a spinner that looks stuck.
 */
export function describeDuration(requests: number): string | null {
  if (requests < 100) return null

  // Two in flight, 250ms apart: ~8 requests/second, rounded down for honesty.
  const seconds = Math.ceil(requests / 8)
  const minutes = Math.max(1, Math.round(seconds / 60))

  return (
    `This selection needs about ${requests.toLocaleString('en-US')} extra requests to read ` +
    `product variations, which will take roughly ${minutes} minute${minutes === 1 ? '' : 's'}. ` +
    `Niblr paces these deliberately so your existing store is not overloaded.`
  )
}
