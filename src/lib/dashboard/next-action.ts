import type { TenantDashboardData } from '@/lib/tenant-metrics'
import { SETUP_STEPS, countCompleteSteps, firstIncompleteStep } from './setup-steps'

export type NextActionKey = 'setup' | 'fulfil' | 'first-sale' | 'low-stock' | 'healthy'

/**
 * Everything the hero needs to render, as plain data. The component branches
 * on nothing — all decision logic lives in resolveNextAction so it can be
 * tested without rendering.
 */
export type NextAction = {
  key: NextActionKey
  eyebrow: string
  title: string
  body: string
  ctaLabel: string
  ctaHref: string
  /** Anchor target for the primary CTA. Set only when the CTA leaves the admin. */
  ctaTarget?: '_blank'
  secondaryLabel?: string
  secondaryHref?: string
  /** Render SeedSampleProductsButton beside the CTA (first setup step only). */
  showSeedSamples: boolean
  /**
   * Render the "Import from an existing store" link beside the CTA. Jumps to
   * the ImportStoreCard anchored at #import-store further down this same
   * dashboard — the entry point shipped with roadmap row 17. It must survive
   * the retirement of OnboardingPanel.
   */
  showImportStore: boolean
  showSetupRail: boolean
}

/** Orders list filtered to the paid-but-unshipped state the merchant must action. */
const ORDERS_AWAITING_HREF = '/admin/collections/orders?where[status][equals]=paid'
const ORDERS_HREF = '/admin/collections/orders'
const PRODUCTS_HREF = '/admin/collections/products'

/**
 * Decides the single thing the merchant should do next. First match wins:
 *
 *   1. setup       — the store cannot transact until setup is finished
 *   2. fulfil      — a customer has already paid and is waiting
 *   3. first-sale  — ready to sell but has never sold
 *   4. low-stock   — a warning, not a blocker
 *   5. healthy     — a resting state, so the dashboard never invents urgency
 */
export function resolveNextAction(m: TenantDashboardData): NextAction {
  // 1 — Finish setup.
  const step = firstIncompleteStep(m.onboarding)
  if (step) {
    const done = countCompleteSteps(m.onboarding)
    return {
      key: 'setup',
      eyebrow: `Your next step · ${done} of ${SETUP_STEPS.length} done`,
      title: step.title,
      body: step.desc,
      ctaLabel: step.cta,
      ctaHref: step.href,
      showSeedSamples: step.secondary?.includes('seedSamples') ?? false,
      showImportStore: step.secondary?.includes('importStore') ?? false,
      showSetupRail: true,
    }
  }

  // 2 — Orders are waiting. Fulfilment is per-order via FulfillmentCard; there
  // is no bulk action, so the CTA takes the merchant to the filtered list.
  if (m.pendingOrderCount > 0) {
    const one = m.pendingOrderCount === 1
    return {
      key: 'fulfil',
      eyebrow: 'Needs your attention',
      title: `${m.pendingOrderCount} ${one ? 'order is' : 'orders are'} waiting to be fulfilled`,
      body: one
        ? 'A customer has paid and is waiting. Open the order to mark it shipped.'
        : 'These customers have paid and are waiting. Open each order to mark it shipped.',
      ctaLabel: 'View orders to fulfil',
      ctaHref: ORDERS_AWAITING_HREF,
      showSeedSamples: false,
      showImportStore: false,
      showSetupRail: false,
    }
  }

  // 3 — Set up, but nothing has ever been ordered.
  if (!m.hasEverHadOrder) {
    return {
      key: 'first-sale',
      eyebrow: 'You are ready to sell',
      title: 'Get your first sale',
      body: 'Your store is set up and can take orders. Share your storefront link with customers to get the first one in.',
      ctaLabel: 'View your live store',
      ctaHref: '/',
      ctaTarget: '_blank',
      secondaryLabel: 'Add another product',
      secondaryHref: '/admin/collections/products/create',
      showSeedSamples: false,
      showImportStore: false,
      showSetupRail: false,
    }
  }

  // 4 — Stock warning. Counts active, non-variant products only; copy is a floor.
  if (m.lowStockCount > 0) {
    const one = m.lowStockCount === 1
    return {
      key: 'low-stock',
      eyebrow: 'Worth a look',
      title: `${m.lowStockCount} ${one ? 'product is' : 'products are'} running low`,
      body: 'Restock before they sell out — a product at zero stock shows as out of stock on your storefront.',
      ctaLabel: 'Review stock',
      ctaHref: PRODUCTS_HREF,
      showSeedSamples: false,
      showImportStore: false,
      showSetupRail: false,
    }
  }

  // 5 — Resting state.
  const { count } = m.periods.current
  return {
    key: 'healthy',
    eyebrow: 'All clear',
    title: 'Everything is running smoothly',
    body:
      count > 0
        ? `${count} paid order${count === 1 ? '' : 's'} in the last seven days, and nothing is waiting on you.`
        : 'Nothing is waiting on you. No new orders in the last seven days.',
    ctaLabel: 'View orders',
    ctaHref: ORDERS_HREF,
    showSeedSamples: false,
    showImportStore: false,
    showSetupRail: false,
  }
}
