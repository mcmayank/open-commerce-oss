/**
 * Post-payment side effects. These run EXACTLY ONCE, only on the pending→paid
 * transition, and are all best-effort: a failure here is logged but never rolls
 * back the payment confirmation (the order is already marked paid).
 *
 * Moved verbatim from the webhook route so the reconciliation handler owns the
 * complete "mark paid → fulfil" sequence.
 */
import type { Payload } from 'payload'
import { sendOrderConfirmation } from '@/lib/email'
import { issueInvoice } from '@/lib/invoicing/issue'
import { tracksInventory } from '@/lib/inventory'
import type { Order, Product } from '@/payload-types'
import { storeWhere } from '@/store-scope'

/**
 * Decrement stock for each line item.
 * Tenant-scoped, variant-aware, floored at 0; per-line errors are logged only.
 *
 * Products that don't track inventory (gift cards) are skipped entirely — both
 * the variant and the product path. A gift card is generated per unit at
 * payment time, so there is nothing to take off a shelf; decrementing would
 * walk its schema-default 0 nowhere on the first sale and then, if a merchant
 * had ever typed a number in, silently stop the card selling once it ran out.
 */
export async function decrementStock(
  payload: Payload,
  tenantId: number | string,
  lineItems: Order['lineItems'],
): Promise<void> {
  for (const line of lineItems) {
    try {
      const { docs } = await payload.find({
        collection: 'products',
        where: {
          and: [storeWhere(tenantId), { id: { equals: Number(line.productId) } }],
        },
        limit: 1,
        overrideAccess: true,
      })
      const product: Product | undefined = docs[0]
      if (!product) {
        console.warn(`[reconcile] product not found: ${line.productId} tenant=${tenantId}`)
        continue
      }

      if (!tracksInventory(product)) continue

      if (line.variantTitle) {
        let variantMatched = false
        const variants = (product.variants ?? []).map((v) => {
          if (v.title === line.variantTitle) {
            variantMatched = true
            return { ...v, stock: Math.max(0, (v.stock ?? 0) - line.qty) }
          }
          return v
        })
        if (!variantMatched) {
          console.warn('[reconcile] variant not found for stock decrement', {
            productId: line.productId,
            variantTitle: line.variantTitle,
          })
        }
        await payload.update({ collection: 'products', id: product.id, data: { variants }, overrideAccess: true })
      } else {
        const newStock = Math.max(0, (product.stock ?? 0) - line.qty)
        await payload.update({ collection: 'products', id: product.id, data: { stock: newStock }, overrideAccess: true })
      }
    } catch (err) {
      console.error(`[reconcile] stock decrement failed for product ${line.productId}:`, err)
    }
  }
}

/** Increment `usedCount` on a discount-code document (tenant-scoped lookup by code). */
export async function incrementDiscountUsedCount(
  payload: Payload,
  tenantId: number | string,
  code: string,
): Promise<void> {
  const { docs } = await payload.find({
    collection: 'discount-codes',
    where: { and: [storeWhere(tenantId), { code: { equals: code } }] },
    limit: 1,
    overrideAccess: true,
  })
  const discountCode = docs[0]
  if (!discountCode) {
    console.warn(`[reconcile] discount code not found: ${code} tenant=${tenantId}`)
    return
  }
  await payload.update({
    collection: 'discount-codes',
    id: discountCode.id,
    data: { usedCount: (discountCode.usedCount ?? 0) + 1 },
    overrideAccess: true,
  })
}

/**
 * Run the full post-paid side-effect sequence. Each step is independently
 * best-effort. `order` must already be marked paid.
 */
export async function runPaidSideEffects(
  payload: Payload,
  tenantId: number | string,
  order: Order,
): Promise<void> {
  try {
    await decrementStock(payload, tenantId, order.lineItems)
  } catch (err) {
    console.error('[reconcile] stock decrement failed:', err)
  }

  if (order.discountCode) {
    try {
      await incrementDiscountUsedCount(payload, tenantId, order.discountCode)
    } catch (err) {
      console.error('[reconcile] discount usedCount increment failed:', err)
    }
  }

  // Re-fetch so the email/invoice see the paid status.
  let fresh: Order | null = null
  try {
    fresh = (await payload.findByID({ collection: 'orders', id: order.id, overrideAccess: true })) as Order
    await sendOrderConfirmation(fresh)
  } catch (err) {
    console.error('[reconcile] email send failed:', err)
  }

  try {
    if (fresh) {
      await issueInvoice(payload, fresh)
    } else {
      console.error('[reconcile] auto-issue invoice skipped: order re-fetch failed')
    }
  } catch (err) {
    console.error('[reconcile] auto-issue invoice failed:', err)
  }
}
