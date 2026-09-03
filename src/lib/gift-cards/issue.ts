import type { Payload } from 'payload'
import type { OrderLineItem } from '@/lib/orders-math'
import { generateGiftCardCode, hashGiftCardCode } from './code'
import { storeWhere, storeRef } from '@/store-scope'

/**
 * Which cards an order should mint. Pure, so the "one card per unit at the unit
 * price" rule is testable without a database.
 *
 * Quantity 3 of a 50 variant mints three separate 50 cards, each with its own
 * code — not one 150 card.
 */
export function planGiftCardIssues(lineItems: OrderLineItem[]): { amountMinor: number }[] {
  const plans: { amountMinor: number }[] = []
  for (const line of lineItems) {
    if (!line.isGiftCard) continue
    for (let i = 0; i < line.qty; i += 1) plans.push({ amountMinor: line.unitPrice })
  }
  return plans
}

type IssuableOrder = {
  id: string | number
  storeId: string | number
  currency: string
  lineItems?: OrderLineItem[] | null
  giftCardRecipientName?: string | null
  giftCardRecipientEmail?: string | null
  giftCardMessage?: string | null
}

/**
 * Mint the cards for a paid order and write their `issue` ledger rows.
 *
 * Called from `payment-event-handler` immediately after the order is marked
 * paid, INSIDE the existing idempotency guard: orders carry a UNIQUE
 * (tenant, providerEventId) index and the handler returns early when the order
 * is no longer `pending`, so the `pending -> paid` transition itself never
 * runs this twice.
 *
 * But the transition and the minting are not one atomic step — minting can
 * still fail (or die partway through a multi-card order) AFTER the order is
 * already `paid`, and the handler's `already_paid` path calls this function
 * again as a self-heal on every later delivery of the same webhook. Unlike
 * the order-status transition, there is no unique index behind "cards issued
 * for this order," so this function makes itself idempotent by re-deriving
 * what should exist (`planGiftCardIssues`) and counting what already does,
 * minting only the shortfall. A fully-minted order costs one `count` query
 * and nothing else; a non-gift-card order costs nothing beyond the (already
 * free) `planGiftCardIssues([])` check.
 *
 * Deliberately does NOT re-check `assertGiftCardSale` / plan entitlement — the
 * customer has already paid. Entitlement is enforced once, at product-save
 * time (Task 4); refusing to mint here would take the money and hand back
 * nothing, which is worse than any plan gate.
 *
 * Returns the plaintext codes for the delivery email — only for cards minted
 * THIS call. A self-heal call that finds nothing outstanding returns `[]`,
 * same as a non-gift-card order; a caller cannot tell "nothing to do" apart
 * from "already done" from the return value alone, which is fine because
 * nothing currently needs to.
 */
export async function issueGiftCardsForOrder(
  payload: Payload,
  order: IssuableOrder,
): Promise<{ code: string; last4: string; amountMinor: number }[]> {
  const plans = planGiftCardIssues(order.lineItems ?? [])
  if (plans.length === 0) return []

  const existing = await payload.count({
    collection: 'gift-cards',
    where: { and: [storeWhere(order.storeId), { issuedFromOrder: { equals: order.id } }] },
    overrideAccess: true,
  })
  if (existing.totalDocs >= plans.length) return []
  const outstanding = plans.slice(existing.totalDocs)

  const issued: { code: string; last4: string; amountMinor: number }[] = []

  for (const plan of outstanding) {
    const { code, last4 } = generateGiftCardCode()
    // `IssuableOrder.id`/`storeId` are `string | number` (the shape both the
    // reconciliation handler and tests pass), but Payload's generated types
    // want `number | <RelatedDoc>` for a relationship value. `as never` here
    // matches the existing cast-at-the-create-call convention used elsewhere
    // in this codebase (e.g. `src/imports/core/media.ts`) for the same
    // generic-relationship-typing friction — it does not affect runtime
    // behaviour, only what the compiler accepts.
    const card = await payload.create({
      collection: 'gift-cards',
      overrideAccess: true,
      data: {
        ...storeRef(order.storeId),
        codeHash: hashGiftCardCode(code),
        last4,
        initialAmount: plan.amountMinor,
        balance: plan.amountMinor,
        currency: order.currency,
        status: 'active',
        issuedFromOrder: order.id,
        recipientName: order.giftCardRecipientName ?? undefined,
        recipientEmail: order.giftCardRecipientEmail ?? undefined,
        message: order.giftCardMessage ?? undefined,
        issuedAt: new Date().toISOString(),
      } as never,
    })

    await payload.create({
      collection: 'gift-card-transactions',
      overrideAccess: true,
      data: { ...storeRef(order.storeId), giftCard: card.id, type: 'issue', amount: plan.amountMinor, order: order.id } as never,
    })

    issued.push({ code, last4, amountMinor: plan.amountMinor })
  }

  return issued
}
