import { listProviders } from '@/payments/core/provider-registry'

/**
 * The marketing site's view of the payment rails, derived from the provider
 * registry so it cannot drift from the code.
 *
 * It drifted badly before this existed: `features/page.tsx` kept its own array
 * with `live: false` hardcoded on Mollie, Paystack, Flutterwave and Xendit —
 * four adapters that are registered, fully implemented against the required
 * interface, unit-tested, and already selectable by any merchant in Settings,
 * because `PaymentsSettingsView` renders `listProviders()` with no filter.
 * The site called them "Soon" for months.
 *
 * SERVER ONLY — `provider-registry` imports every adapter. Client sections take
 * the derived values as props.
 */

/**
 * How far a rail has been proven, which is NOT the same question as whether the
 * code exists.
 *
 *  - `live`     — merchants are transacting on it today.
 *  - `built`    — adapter implemented and unit-tested against the interface,
 *                 selectable in Settings, but no transaction has been run
 *                 through the real provider API yet.
 *
 * Do not promote a rail to `live` because its tests pass. Tests prove the
 * adapter's shape, not that money moved.
 */
export type RailReadiness = 'live' | 'built'

/** Rails a merchant is actually transacting on today. Everything else is `built`. */
const PROVEN_IN_PRODUCTION = new Set(['stripe', 'razorpay', 'offline'])

export type PaymentRail = {
  slug: string
  label: string
  region: string
  readiness: RailReadiness
  /** `offline` rails (cash, bank transfer) never redirect and take no keys. */
  isOffline: boolean
  /**
   * Whether the adapter implements the optional `refund()` method. This is an
   * API capability only — there is still no in-admin refund action on ANY rail
   * (ACTION-PLAN 3.2), so copy must not imply a refund button exists.
   */
  hasRefundApi: boolean
}

/** Every registered rail, in registry order. */
export function paymentRails(): PaymentRail[] {
  return listProviders().map((p) => ({
    slug: p.slug,
    label: p.label,
    region: p.region,
    readiness: PROVEN_IN_PRODUCTION.has(p.slug) ? 'live' : 'built',
    isOffline: p.kind === 'offline',
    hasRefundApi: typeof p.refund === 'function',
  }))
}

/** Total rails. Never write this number into copy by hand. */
export function railCount(): number {
  return listProviders().length
}

/** Human list of rail names, e.g. "Stripe, Razorpay and Mollie". */
export function railNames(rails: PaymentRail[]): string {
  const names = rails.map((r) => r.label)
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
