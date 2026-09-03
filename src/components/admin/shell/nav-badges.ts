import type { Payload } from 'payload'
import { storeWhere } from '@/store-scope'

/**
 * Nav badge counts, keyed by collection slug (matches `buildNavModel`'s
 * `badges[c.slug]` lookup in nav-model.ts).
 *
 * Only one badge today: orders awaiting fulfilment. Orders has no literal
 * "unfulfilled" status — `pending`/`paid`/`shipped`/`delivered`/`cancelled`/
 * `refunded` are the real values (src/collections/Orders.ts). `paid` is the
 * status that needs the merchant's action next: `TenantDashboard.tsx` already
 * labels it "Awaiting fulfilment" and gives it the warning tone for exactly
 * this reason — `shipped`/`delivered` orders are already fulfilled, and
 * `pending` orders aren't paid yet, so neither belongs in this count.
 *
 * Best-effort: any failure (or a null tenant, e.g. platform apex / unbound
 * host) returns `{}` rather than throwing, so a badge query never blocks nav
 * render.
 */
export async function navBadges(
  payload: Payload,
  tenantId: string | null,
): Promise<Record<string, number>> {
  if (!tenantId) return {}
  try {
    const r = await payload.find({
      collection: 'orders',
      where: {
        and: [storeWhere(tenantId), { status: { equals: 'paid' } }],
      },
      limit: 0,
      overrideAccess: true,
    })
    return { orders: r.totalDocs }
  } catch {
    return {}
  }
}
