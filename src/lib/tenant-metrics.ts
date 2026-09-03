import type { Payload } from 'payload'
import { summarizeOrders } from './orders-math'
import { tracksInventory } from './inventory'
import { storeWhere } from '@/store-scope'
import { countVerifiedDomains, loadStoreById } from '@/store-loader-overlay'

const RECENT_ORDERS_LIMIT = 5
const DEFAULT_CURRENCY = 'AED'

/** Stock at or below this counts as "running low". */
export const LOW_STOCK_THRESHOLD = 5

/**
 * Bound on how many low-stock candidate rows we scan in code (see
 * `countLowStock`). If a tenant has more active, at-or-below-threshold,
 * non-variant products than this, the count is a floor rather than exact —
 * documented at the call site below.
 */
export const LOW_STOCK_SCAN_LIMIT = 200

export type RecentOrder = {
  id: number | string
  orderNumber: string
  status: string
  total: number | null
  customerLabel: string
  createdAt: string
}

export type TenantOnboarding = {
  hasProduct: boolean
  hasGateway: boolean
  hasStoreSettings: boolean
  hasBranding: boolean
  hasDomain: boolean
  isLive: boolean
}

export type TenantDashboardData = {
  currency: string
  paidOrderCount: number
  revenueMinor: number
  productCount: number
  customerCount: number
  pendingOrderCount: number
  recentOrders: RecentOrder[]
  onboarding: TenantOnboarding
  /**
   * Count of active, non-variant, inventory-tracked products at or below
   * LOW_STOCK_THRESHOLD on the product-level `stock` field. Variant products
   * are deliberately excluded: nothing syncs variant stock up to the product
   * level, so a hand-created variant product sits at the schema default of
   * product-level stock 0 forever, which would otherwise report permanent
   * false urgency. Gift-card products are excluded for exactly that reason —
   * their `stock` is never a real number either, so a gift card parked at the
   * default 0 would nag "running low" for the life of the store, about
   * something that can never run out. Draft products are excluded too, since
   * the copy talks about what a customer sees on the live storefront. Copy
   * must therefore read as a floor ("N products are running low"), never a
   * complete count.
   */
  lowStockCount: number
  /** Any order ever placed, paid or not. Distinct from paidOrderCount > 0. */
  hasEverHadOrder: boolean
  periods: { current: PeriodSummary; previous: PeriodSummary }
}

type RawOrder = {
  id: number | string
  orderNumber?: string | null
  status?: string | null
  total?: number | null
  paidAt?: string | null
  refundedAmount?: number | null
  email?: string | null
  createdAt?: string | null
}

/** Orders paid but not yet shipped — i.e. status is exactly 'paid'. */
export function countPendingFulfillment(orders: { status?: string | null }[]): number {
  return orders.filter((o) => o.status === 'paid').length
}

type LowStockCandidate = {
  stock?: number | null
  variants?: unknown[] | null
  issuesGiftCard?: boolean | null
}

/**
 * Counts products at or below `threshold` on their PRODUCT-level `stock`.
 *
 * Products carrying variants are excluded: nothing syncs variant stock up to
 * the product level (only the importer writes it), so a hand-created variant
 * product sits at the schema default of product-level stock 0 forever — if we
 * counted it, the dashboard would report false low-stock urgency permanently,
 * never clearing no matter how much variant stock the merchant actually has.
 *
 * Gift-card products are excluded for the same kind of reason, one step
 * earlier: their `stock` was never inventory at all (`tracksInventory`), so it
 * also sits at the default 0 forever. Counted, a single gift card would pin
 * "1 product is running low" to the dashboard permanently, pointing the
 * merchant at a number they cannot usefully change — the card is generated on
 * demand and can never run out.
 */
export function countLowStock(products: LowStockCandidate[], threshold: number): number {
  return products.filter((p) => {
    const hasVariants = Array.isArray(p.variants) && p.variants.length > 0
    return (
      !hasVariants &&
      tracksInventory(p) &&
      typeof p.stock === 'number' &&
      p.stock <= threshold
    )
  }).length
}

const PERIOD_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

export type PeriodSummary = { count: number; revenueMinor: number }

type ComparableOrder = {
  status?: string | null
  total?: number | null
  paidAt?: string | null
  refundedAmount?: number | null
}

/**
 * Splits orders into the trailing seven days and the seven days before that,
 * bucketing by `paidAt` because revenue belongs to when it was paid, not when
 * the order was created. `now` is injected so tests are deterministic.
 *
 * Reuses `summarizeOrders`, so the exclusion rules (never-paid, cancelled,
 * refunded) and the partial-refund subtraction stay in exactly one place.
 */
export function comparePeriods(
  orders: ComparableOrder[],
  now: Date,
): { current: PeriodSummary; previous: PeriodSummary } {
  const currentStart = now.getTime() - PERIOD_DAYS * DAY_MS
  const previousStart = currentStart - PERIOD_DAYS * DAY_MS

  const within = (from: number, to: number) =>
    orders.filter((o) => {
      if (!o.paidAt) return false
      const t = new Date(o.paidAt).getTime()
      return Number.isFinite(t) && t >= from && t < to
    })

  const summarize = (subset: ComparableOrder[]): PeriodSummary =>
    summarizeOrders(
      subset.map((o) => ({
        status: o.status ?? null,
        total: o.total ?? null,
        paidAt: o.paidAt ?? null,
        refundedAmount: o.refundedAmount ?? null,
      })),
    )

  return {
    current: summarize(within(currentStart, now.getTime() + 1)),
    previous: summarize(within(previousStart, currentStart)),
  }
}

export function toRecentOrders(orders: RawOrder[]): RecentOrder[] {
  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber ?? '',
    status: o.status ?? '',
    total: o.total ?? null,
    customerLabel: o.email ?? 'Guest',
    createdAt: o.createdAt ?? '',
  }))
}

export type OnboardingInput = {
  productCount: number
  activeGatewayCount: number
  storeSettings: { storeName?: string | null; currency?: string | null; logo?: unknown } | null
  verifiedDomainCount: number
  tenantStatus: string
}

export function deriveOnboarding(input: OnboardingInput): TenantOnboarding {
  const ss = input.storeSettings
  return {
    hasProduct: input.productCount > 0,
    hasGateway: input.activeGatewayCount > 0,
    hasStoreSettings: Boolean(ss?.storeName) && Boolean(ss?.currency),
    hasBranding: Boolean(ss?.logo),
    hasDomain: input.verifiedDomainCount > 0,
    isLive: input.tenantStatus === 'active',
  }
}

/**
 * Fetches per-tenant dashboard data. Uses overrideAccess: true — the caller
 * MUST verify the current user owns `tenantId` (or is a super-admin) first.
 */
export async function getTenantMetrics(
  payload: Payload,
  tenantId: string | number,
): Promise<TenantDashboardData> {
  const tenantWhere = storeWhere(tenantId)

  const [
    ordersRes,
    recentRes,
    productsRes,
    customersRes,
    gatewaysRes,
    domainsRes,
    settingsRes,
    tenantDoc,
    lowStockRes,
  ] = await Promise.all([
      payload.find({ collection: 'orders', where: tenantWhere, limit: 0, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'orders', where: tenantWhere, sort: '-createdAt', limit: RECENT_ORDERS_LIMIT, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'products', where: tenantWhere, limit: 0, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'customers', where: tenantWhere, limit: 0, depth: 0, overrideAccess: true }),
      payload.find({
        collection: 'gateway-configs',
        where: { and: [tenantWhere, { active: { equals: true } }] },
        limit: 0,
        depth: 0,
        overrideAccess: true,
      }),
      countVerifiedDomains(payload, tenantId),
      payload.find({ collection: 'store-settings', where: tenantWhere, limit: 1, depth: 0, overrideAccess: true }),
      loadStoreById(tenantId),
      // Candidates only: active, at-or-below-threshold, product-level stock.
      // Whether a candidate actually carries variants (and so should be
      // excluded — see countLowStock) can't be expressed reliably as a
      // `where` clause against an array field, so we fetch a bounded set of
      // candidate docs and filter in code. If a tenant has more than
      // LOW_STOCK_SCAN_LIMIT candidates, the resulting count is a floor, not
      // exact — an acceptable trade for a "worth a look" nudge, not a ledger.
      payload.find({
        collection: 'products',
        where: {
          and: [
            tenantWhere,
            { status: { equals: 'active' } },
            { stock: { less_than_equal: LOW_STOCK_THRESHOLD } },
          ],
        },
        limit: LOW_STOCK_SCAN_LIMIT,
        depth: 0,
        // `issuesGiftCard` MUST be selected: countLowStock excludes gift cards
        // on it, and an unselected field arrives undefined, which reads as a
        // normal product.
        select: { stock: true, variants: true, issuesGiftCard: true },
        overrideAccess: true,
      }),
    ])

  const allOrders = ordersRes.docs as RawOrder[]
  // refundedAmount MUST be forwarded: summarizeOrders subtracts it, and a
  // PARTIALLY refunded order keeps status 'paid', so omitting the field
  // overstated revenue for every partial refund.
  const summary = summarizeOrders(
    allOrders.map((o) => ({
      status: o.status ?? null,
      total: o.total ?? null,
      paidAt: o.paidAt ?? null,
      refundedAmount: o.refundedAmount ?? null,
    })),
  )
  const storeSettings = (settingsRes.docs[0] ?? null) as OnboardingInput['storeSettings']

  return {
    currency: storeSettings?.currency ?? DEFAULT_CURRENCY,
    paidOrderCount: summary.count,
    revenueMinor: summary.revenueMinor,
    productCount: productsRes.totalDocs,
    customerCount: customersRes.totalDocs,
    pendingOrderCount: countPendingFulfillment(allOrders),
    recentOrders: toRecentOrders(recentRes.docs as RawOrder[]),
    onboarding: deriveOnboarding({
      productCount: productsRes.totalDocs,
      activeGatewayCount: gatewaysRes.totalDocs,
      storeSettings,
      verifiedDomainCount: domainsRes,
      tenantStatus: tenantDoc?.status ?? 'pending',
    }),
    lowStockCount: countLowStock(lowStockRes.docs as LowStockCandidate[], LOW_STOCK_THRESHOLD),
    hasEverHadOrder: allOrders.length > 0,
    periods: comparePeriods(allOrders, new Date()),
  }
}
