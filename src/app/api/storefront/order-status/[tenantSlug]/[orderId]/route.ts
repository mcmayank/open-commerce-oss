/**
 * Store-scoped order-status polling endpoint for the checkout success page.
 *
 * GET /api/storefront/order-status/[tenantSlug]/[orderId]
 *
 * Returns ONLY `{ status, paid }` — no PII, no amounts, no internal ids. The
 * order is looked up tenant-scoped, so one store can never read another store's
 * order status. This exists because reaching the success page must NEVER be
 * treated as proof of payment — the page polls this endpoint, which reflects the
 * webhook-driven order status, until the order is actually paid.
 */
import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'
import { getStore } from '@/lib/storefront'
import { storeWhere } from '@/store-scope'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; orderId: string }> },
) {
  const { tenantSlug, orderId } = await params

  const store = await getStore(tenantSlug)
  if (!store) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const numericId = Number(orderId)
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'orders',
    where: { and: [{ id: { equals: numericId } }, storeWhere(store.id)] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const order = docs[0]
  if (!order) {
    return NextResponse.json({ found: false }, { status: 404 })
  }

  // Only expose the coarse status + a paid flag. Nothing else.
  return NextResponse.json({
    found: true,
    status: order.status,
    paid: order.status !== 'pending',
  })
}
