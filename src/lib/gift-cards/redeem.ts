import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { storeSql } from '@/store-sql-overlay'
import { getProvider, listProviders } from '@/payments/core/provider-registry'
import { hashGiftCardCode } from './code'
import { issueGiftCardsForOrder } from './issue'
import { sendGiftCardEmailForOrder } from './email'
import type { OrderLineItem } from '../orders-math'
import type { OrderStatus } from '../refunds'
import { storeWhere, storeRef, storeIdOf } from '@/store-scope'

/**
 * Statuses that mean the money has already arrived, in the Orders `status`
 * select's own vocabulary (`src/collections/Orders.ts`). The admin
 * `FulfillmentCard` (`src/components/admin/FulfillmentCard.tsx`) lets a
 * merchant jump an order straight from `pending` to `shipped` or `delivered`
 * — plausible for a gift card, which is "delivered" by email the moment it's
 * paid for — so `status === 'paid'` alone misses real payments. `refunded`
 * and `cancelled` are deliberately excluded: those reverse or void a sale
 * rather than confirm one.
 *
 * Defined once and read by two consumers that would otherwise disagree:
 * `stampPaidAt` (`src/collections/Orders.ts`) decides from this list when to
 * stamp `paidAt`, and `sweepStuckGiftCardIssuance` below decides from the
 * SAME list which orders are visible to the gift-card repair pass. A status
 * missing from this array is invisible to revenue accounting AND to gift-card
 * minting at once.
 */
export const PAID_LIKE_ORDER_STATUSES: readonly OrderStatus[] = ['paid', 'shipped', 'delivered']

export type GiftCardDoc = {
  id: string | number
  balance: number
  currency: string
  status: 'active' | 'void'
  last4: string
}

type DrizzleExecutor = { execute: (q: unknown) => Promise<{ rows?: unknown[] }> }

/** Same escape hatch `reserveGiftCard` and `releaseGiftCardReservation` both use. */
function drizzleOf(payload: Payload): DrizzleExecutor {
  return (payload.db as unknown as { drizzle: DrizzleExecutor }).drizzle
}

/**
 * Look a card up by its plaintext code, scoped to one tenant.
 *
 * The digest is what is indexed, so this is a single equality lookup and the
 * plaintext never reaches the database. Returns null for not-found, wrong
 * tenant, or anything else — the caller must render one identical message for
 * every failure so this cannot be used to enumerate live codes.
 */
export async function findGiftCardByCode(
  payload: Payload,
  tenantId: string | number,
  code: string,
): Promise<GiftCardDoc | null> {
  const { docs } = await payload.find({
    collection: 'gift-cards',
    where: { and: [storeWhere(tenantId), { codeHash: { equals: hashGiftCardCode(code) } }] },
    limit: 1,
    overrideAccess: true,
  })
  return (docs[0] as GiftCardDoc | undefined) ?? null
}

/**
 * Take the money off the card, and only then let the order proceed.
 *
 * Reserving BEFORE the gateway call is deliberate. Decrementing on payment
 * success instead would leave a window in which the card is spent elsewhere
 * after we already asked the gateway for a reduced amount, and the shortfall
 * would be the merchant's. The cost is a release path: Task 7 reverses the
 * reservation when an attempt fails or is abandoned.
 *
 * The condition lives in ONE SQL statement, not in application code.
 * Postgres locks the row for the duration of the UPDATE, so two concurrent
 * checkouts on the same card cannot both pass the `balance >= amount` test.
 *
 * Payload's own `update({ where })` CANNOT be used for this. `updateMany` in
 * `@payloadcms/drizzle` runs a SELECT to collect ids and then updates by id —
 * the check and the write are two statements with a race between them, so a
 * conditional `where` on the balance reads as a guard while providing none.
 * Verified in `node_modules/@payloadcms/drizzle/dist/updateMany.js`.
 */
export async function reserveGiftCard(
  payload: Payload,
  args: {
    tenantId: string | number
    cardId: string | number
    orderId: string | number
    amountMinor: number
  },
): Promise<boolean> {
  const { tenantId, cardId, orderId, amountMinor } = args

  const db = drizzleOf(payload)

  const res = await db.execute(sql`
    UPDATE gift_cards
       SET balance = balance - ${amountMinor}
     WHERE id = ${cardId}
       ${storeSql(tenantId)}
       AND status = 'active'
       AND balance >= ${amountMinor}
    RETURNING balance
  `)

  // Zero rows means the guard rejected it: wrong tenant, voided, or another
  // checkout took the money first. All three are "no" to the caller.
  if ((res.rows ?? []).length === 0) return false

  // `order` on the ledger row has a FK to `orders.id`, and Postgres serial ids
  // never start at 0 — so `orderId: 0` (the documented placeholder for "no real
  // order") must become NULL here, or the insert violates the constraint
  // instead of recording an ownerless reservation the way the caller intended.
  await payload.create({
    collection: 'gift-card-transactions',
    overrideAccess: true,
    data: {
      ...storeRef(Number(tenantId)),
      giftCard: Number(cardId),
      type: 'redeem',
      amount: amountMinor,
      order: orderId ? Number(orderId) : null,
    },
  })

  return true
}

/**
 * Undo a reservation: put the money back on the card.
 *
 * Takes `cardId` and `amountMinor` as arguments rather than re-reading the
 * order that made the reservation. That is deliberate, not laziness — the
 * whole reason this function exists is to be callable from a path where the
 * order write itself may have failed (checkout's post-reservation order
 * update throwing, or the payment-gateway session call throwing), so the
 * caller must already be holding the values it reserved with in scope. If
 * this function re-read `order.giftCardAmount` to know how much to restore,
 * every one of those failure paths — the ones it exists to cover — would be
 * exactly the paths where that field was never written.
 *
 * Same atomicity requirement as `reserveGiftCard`, same reasoning: a plain
 * `payload.update` is a SELECT-then-update-by-id under the hood
 * (`@payloadcms/drizzle`'s `updateMany`), so a raw `SET balance = balance +
 * amount` through `payload.db.drizzle` is what actually makes this safe
 * against a concurrent operation on the same card (e.g. a refund) landing in
 * the same window. No `status = 'active'` guard here, unlike the reserve: the
 * money left this card while it was active, so it goes back regardless of
 * whatever the card's status is by the time the release runs — a void card
 * still owes its own accurate balance.
 *
 * `reverseGiftCardForOrder` (below) reads the order's `giftCardAmount` /
 * `giftCardUsed` and delegates to this function for the actual money
 * movement, rather than reimplementing the SQL — this stays the one place a
 * gift card balance is ever incremented.
 */
export async function releaseGiftCardReservation(
  payload: Payload,
  args: {
    tenantId: string | number
    cardId: string | number
    orderId: string | number | null
    amountMinor: number
  },
): Promise<void> {
  const { tenantId, cardId, orderId, amountMinor } = args

  const db = drizzleOf(payload)

  const res = await db.execute(sql`
    UPDATE gift_cards
       SET balance = balance + ${amountMinor}
     WHERE id = ${cardId}
       ${storeSql(tenantId)}
    RETURNING balance
  `)

  // Wrong tenant/card id should be unreachable — the caller is releasing a
  // reservation it just made against this exact (tenantId, cardId) pair — but
  // silently doing nothing here would strand the money with no signal at all.
  if ((res.rows ?? []).length === 0) {
    throw new Error(
      `releaseGiftCardReservation: no gift-card row matched tenant ${tenantId} / card ${cardId} — balance NOT restored.`,
    )
  }

  await payload.create({
    collection: 'gift-card-transactions',
    overrideAccess: true,
    data: {
      ...storeRef(Number(tenantId)),
      giftCard: Number(cardId),
      type: 'reverse',
      amount: amountMinor,
      order: orderId ? Number(orderId) : null,
    },
  })
}

/**
 * Release a reservation AND erase the order's record of it. The pair, not
 * either half on its own, is what a failed checkout needs.
 *
 * `giftCardAmount` on a `pending` order is read by two parties that mean
 * different things by it. To `sweepAbandonedGiftCardReservations` (via
 * `reverseGiftCardForOrder`) a non-zero value means "this card is still owed
 * its money back". To checkout, the moment `releaseGiftCardReservation`
 * returns, the card has ALREADY been made whole. Leave the field set and the
 * two readings collide: the order sits `pending` with `giftCardAmount > 0`
 * and a `createdAt` that ages past the abandonment window, the nightly sweep
 * matches exactly that shape, claims the amount and credits the SAME card a
 * second time. A 5000 card would end up holding 10000. The ledger still sums
 * consistently (`issue 5000, redeem −5000, reverse +5000, reverse +5000`), so
 * no existing invariant catches it — money is simply created. Clearing the
 * field here is what keeps the sweep's reading of it true.
 *
 * `giftCardUsed` goes with it: with no amount outstanding, a card pointer on
 * a never-paid order is a claim about a tender split that did not happen.
 *
 * Order matters. The credit runs first and is allowed to throw — if the money
 * did NOT make it back onto the card, the order must keep looking like it
 * still owes a release, because the sweep is then the only thing that will
 * ever repair it. Only after the credit has committed does the clear run, and
 * the clear itself never throws: every caller is already on its way to
 * returning a different, shopper-facing error, and this must not mask it.
 */
export async function releaseReservationAndClearOrder(
  payload: Payload,
  args: {
    tenantId: string | number
    orderId: string | number
    cardId: string | number
    amountMinor: number
  },
): Promise<void> {
  const { tenantId, orderId, cardId, amountMinor } = args

  await releaseGiftCardReservation(payload, { tenantId, cardId, orderId, amountMinor })

  try {
    await payload.update({
      collection: 'orders',
      id: orderId,
      data: { giftCardAmount: 0, giftCardUsed: null },
      overrideAccess: true,
    })
  } catch (err) {
    // Now the double-credit above IS live for this order. Nothing here can
    // fix it, so say so loudly enough to be found: the order id is all an
    // operator needs, and a code must never be logged.
    console.error(
      '[releaseReservationAndClearOrder] card credited but the order still records the reservation — the abandoned-reservation sweep may credit it a SECOND time',
      { order: orderId, card: cardId, amountMinor },
      err,
    )
  }
}

/**
 * Put a reservation back on the card, driven from the ORDER rather than from
 * values a caller is already holding.
 *
 * Three callers: reconciliation, when a payment attempt fails, is cancelled
 * or expires (Task 7); the abandoned-checkout sweep, for orders nobody ever
 * came back to finish (Task 7); and the refund path, when a paid order is
 * refunded (Task 9). All read the order's `giftCardAmount` / `giftCardUsed`
 * — set at checkout time by whatever reserved the card — and delegate the
 * actual money movement to `releaseGiftCardReservation`, which stays the one
 * place a gift card balance is ever incremented. This function does not
 * duplicate that SQL.
 *
 * Idempotent, and safe under CONCURRENT calls for the same order — not just
 * sequential ones. Reconciliation can deliver two different terminal events
 * for the same order with two different provider event ids (e.g. a
 * `payment_failed` and a later `session.expired` for the same attempt): the
 * dedupe guard keys on event id, so it would not catch that, and two
 * concurrent reconcile() calls could both read a non-zero `giftCardAmount`
 * before either cleared it. Read-then-credit-then-clear (three separate
 * statements) would double-credit exactly like the race `reserveGiftCard`
 * and `releaseGiftCardReservation` already close with single-statement SQL a
 * few lines above — so this claims the amount the SAME way: one atomic
 * `UPDATE ... WHERE gift_card_amount > 0` makes the order row itself the
 * mutex. Whichever caller's UPDATE actually zeroes a still-positive amount
 * is the one that owns the credit; every other concurrent (or later) caller
 * sees zero rows back and returns 0 without touching the card.
 */
export async function reverseGiftCardForOrder(
  payload: Payload,
  args: { tenantId: string | number; orderId: string | number },
): Promise<number> {
  const { tenantId, orderId } = args

  const db = drizzleOf(payload)

  // Claim first, credit second. A plain `UPDATE ... RETURNING` is not enough
  // here: Postgres's RETURNING always reflects the row's POST-update state,
  // so `RETURNING gift_card_amount` after `SET gift_card_amount = 0` would
  // hand back 0, not the amount that needs crediting (verified against the
  // real database while building this — it is not a hypothetical). The fix
  // is the standard "claim" idiom: a `SELECT ... FOR UPDATE` in a CTE takes
  // the row lock and captures the amount BEFORE it changes, and only then
  // does the UPDATE clear it, referencing the CTE's pre-clear value in
  // RETURNING. Two concurrent executions of this exact statement serialize
  // on that row lock — the second one blocks, then on acquiring the lock
  // re-checks `gift_card_amount > 0` against the now-current (already
  // zeroed) row and finds it false, so its CTE returns no rows and the
  // outer UPDATE's join matches nothing. That is what makes this the same
  // kind of single-statement mutex `reserveGiftCard` and
  // `releaseGiftCardReservation` use a few lines above, not merely an
  // ordinary read-then-write with a race window.
  const claim = await db.execute(sql`
    WITH claim AS (
      SELECT id, gift_card_amount, gift_card_used_id
        FROM orders
       WHERE id = ${orderId}
         ${storeSql(tenantId)}
         AND gift_card_amount > 0
         FOR UPDATE
    )
    UPDATE orders o
       SET gift_card_amount = 0
      FROM claim c
     WHERE o.id = c.id
    RETURNING c.gift_card_amount AS claimed_amount, c.gift_card_used_id
  `)

  // `gift_card_amount` is `numeric`, so pg hands it back as a string (same
  // reason `gift_cards.balance` does — see the "findGiftCardByCode end to
  // end" test in tests/int/gift-card-reserve.int.spec.ts) — convert before
  // using it as a minor-unit amount. `gift_card_used_id` is a plain
  // `integer` FK column and comes back as a real number already.
  const row = (claim.rows ?? [])[0] as
    | { claimed_amount?: unknown; gift_card_used_id?: unknown }
    | undefined
  if (!row) return 0 // nothing was ever reserved, or another delivery already claimed it

  const amount = Number(row.claimed_amount)
  const cardId = row.gift_card_used_id as string | number | null | undefined

  if (!Number.isFinite(amount) || amount <= 0 || cardId == null) return 0

  // The claim above already committed — `gift_card_amount` is 0 on the order
  // row regardless of what happens next. If this credit throws, the ledger
  // and the order now disagree (money taken off the card at checkout, never
  // credited back, and nothing left recording that it's still owed) and an
  // operator has to reconcile it by hand. That is the deliberate lesser
  // evil versus the alternative of clearing the claim only after crediting
  // succeeds, which reopens the exact double-credit race this function
  // exists to close.
  await releaseGiftCardReservation(payload, { tenantId, cardId, orderId, amountMinor: amount })

  return amount
}

/**
 * A reservation is abandoned, not merely "not yet paid," once a `pending`
 * order carrying a gift-card reservation has sat untouched for this long.
 * 24 hours is a deliberate middle ground: shorter risks releasing a card
 * mid-checkout for a shopper on a slow bank redirect or an async payment
 * method that is still genuinely in flight (the reservation would come back
 * onto the card while the gateway could still capture — a legitimate late
 * `succeeded` webhook after that point hits the same stale-`giftCardAmount`
 * mismatch that the currency/amount mismatch comments in
 * `src/payments/reconciliation/payment-event-handler.ts` describe; longer
 * leaves a shopper's own money sitting hostage inside an order they may
 * already have forgotten about.
 */
export const ABANDONED_GIFT_CARD_RESERVATION_HOURS = 24

/**
 * "Pending for a day" means abandoned only for a provider that was ever
 * supposed to come back and say something.
 *
 * The `offline` rail (cash on delivery, bank transfer) leaves an order
 * `pending` BY DESIGN until a human marks it paid — that is written into
 * `src/payments/providers/offline.ts`, and no webhook exists to end the wait.
 * A COD order whose shopper applied a gift card is therefore indistinguishable
 * from an abandoned gateway checkout by age alone, and releasing it CREATES
 * MONEY: the card goes back to spendable, the merchant still collects only the
 * cash balance on delivery, and the ledger still sums correctly so no
 * invariant catches it (AED 100 order, AED 40 card, AED 60 collected in cash,
 * AED 40 handed back to the shopper for free).
 *
 * Keyed on the provider's `kind`, read out of the registry, NOT on the slug —
 * `CLAUDE.md`'s invariant is that nothing outside
 * `src/payments/core/provider-registry.ts` branches on a provider id, and any
 * future offline-shaped rail (a second cash method, an invoice-me rail) must
 * inherit this protection by declaring `kind: 'offline'` and nothing else.
 */
function offlineKindSlugs(): string[] {
  return listProviders()
    .filter((p) => p.kind === 'offline')
    .map((p) => p.slug)
}

/**
 * True when this order's provider is one that waits for a human.
 *
 * A MISSING or unregistered `paymentProvider` deliberately reads as false, i.e.
 * still sweepable. `startCheckout` always writes a registry slug onto a pending
 * order, so the only ways to reach a null here are a crash between the order
 * write and the provider write, or a repair script — and in every one of those
 * states no gateway session exists, nothing will ever arrive to finish the
 * order, and this sweep is the ONLY thing that will ever give the shopper their
 * card balance back. Treating "unknown" as offline would strand that money
 * permanently.
 */
function waitsForAHuman(paymentProvider: unknown): boolean {
  if (typeof paymentProvider !== 'string' || paymentProvider === '') return false
  return getProvider(paymentProvider)?.kind === 'offline'
}

/**
 * Sweep: give back gift-card reservations for orders nobody ever came back
 * to pay.
 *
 * Reconciliation only runs when a webhook arrives. A shopper who opens the
 * gateway's hosted page and simply closes the tab, on a provider that emits
 * nothing for a session that merely expires unused, produces no webhook at
 * all — `reverseGiftCardForOrder` never gets called from anywhere, and the
 * reservation is stranded on the order forever with no recovery path. This
 * is the backstop: find `pending` orders with money still reserved that are
 * older than the abandonment window, and release each one.
 *
 * Reuses `reverseGiftCardForOrder`'s own idempotent, concurrency-safe claim,
 * so overlap with a webhook that arrives for the same order in the same
 * moment (a late-but-real terminal event) is safe — whichever of the two
 * gets there first wins the claim, the other sees zero rows and no-ops.
 *
 * Age is NOT sufficient on its own: an `offline`-kind order is pending because
 * it is waiting for a merchant, not because anyone abandoned it. See
 * `offlineKindSlugs` / `waitsForAHuman` above for why releasing one creates
 * money. Those orders are excluded twice over — in the query, so a COD store's
 * permanently-pending backlog cannot fill the 500-row batch and starve the
 * gateway orders that DO need releasing, and again per order, so the money
 * guarantee does not rest on a query operator's null handling.
 */
export async function sweepAbandonedGiftCardReservations(
  payload: Payload,
): Promise<{ released: number; scanned: number }> {
  const cutoff = new Date(Date.now() - ABANDONED_GIFT_CARD_RESERVATION_HOURS * 60 * 60 * 1000).toISOString()
  const offlineSlugs = offlineKindSlugs()

  const { docs } = await payload.find({
    collection: 'orders',
    where: {
      and: [
        { status: { equals: 'pending' } },
        { giftCardAmount: { greater_than: 0 } },
        { createdAt: { less_than: cutoff } },
        // `not_in` alone would drop rows with a NULL `paymentProvider`
        // (SQL `NOT IN` is null-unsafe, and Payload only adds the `OR IS
        // NULL` for relationship fields — verified in
        // `@payloadcms/drizzle`'s parseParams). Those rows are exactly the
        // crash-mid-checkout ones this sweep exists to repair, so the null
        // case is spelled out rather than left to the operator.
        ...(offlineSlugs.length > 0
          ? [
              {
                or: [
                  { paymentProvider: { not_in: offlineSlugs } },
                  { paymentProvider: { exists: false } },
                ],
              },
            ]
          : []),
      ],
    },
    // depth 0: only the raw tenant id is needed, not a populated relation.
    depth: 0,
    limit: 500,
    overrideAccess: true,
  })

  let released = 0
  for (const order of docs as Array<{ id: string | number; tenant?: unknown; paymentProvider?: unknown }>) {
    const tenantId = storeIdOf(order)
    if (tenantId == null) continue // tenant-scoped by design; nothing safe to do without one
    if (waitsForAHuman(order.paymentProvider)) continue // COD/bank transfer: pending on purpose
    try {
      const amount = await reverseGiftCardForOrder(payload, { tenantId, orderId: order.id })
      if (amount > 0) released++
    } catch (err) {
      // One broken order must never abort the pass for the other 499. This is
      // not hypothetical: `releaseGiftCardReservation` throws BY DESIGN when
      // no gift-card row matches (a card hard-deleted out from under a
      // reservation, or a tenant id that no longer lines up), and this sweep
      // is the only recovery path the orders behind it have. Never log a
      // code; the order id is enough to look the row up.
      console.error('[sweepAbandonedGiftCardReservations] release failed for order', order.id, err)
    }
  }

  return { released, scanned: docs.length }
}

/**
 * How long after `paidAt` a gift-card-selling order gets scanned for a
 * missing card. `payment-event-handler` mints synchronously, inside the same
 * request that marks the order paid, so under normal operation this never
 * takes more than milliseconds — an hour is not racing that, it's a floor
 * comfortably above it, so this never re-scans an order whose mint is simply
 * still in flight. It also has to be short enough that a shopper who paid
 * and got nothing is made whole the same day, not "eventually."
 */
export const STUCK_GIFT_CARD_ISSUANCE_HOURS = 1

/**
 * Repair pass: mint any gift card a PAID order still owes.
 *
 * Two things leave a paid order short a card with no automatic recovery:
 *
 *  1. Task 8's zero-cover checkout path (a gift card covering the whole
 *     order) marks the order paid directly and mints inline, but there is no
 *     webhook for that order — ever — so if the inline mint throws, nothing
 *     will ever retry it. `payment-event-handler`'s webhook redelivery
 *     self-heal (the `already_paid` branch re-running `issueGiftCardsForOrder`)
 *     never gets a chance to run, because no second delivery exists.
 *  2. An ordinary gateway-paid order whose mint step throws AFTER the `paid`
 *     transition commits normally self-heals on the provider's webhook
 *     retry — but only if the provider retries at all, and only within
 *     whatever window it gives up. A provider that delivers once and never
 *     again leaves the same gap.
 *
 * Both are silent from the shopper's side: the order shows paid, the money
 * is gone, and nothing they can do surfaces the missing card except
 * complaining. This sweep is the backstop, run on the same daily cron as
 * `sweepAbandonedGiftCardReservations`.
 *
 * Also delivers the repaired card by email (`sendGiftCardEmailForOrder`) —
 * whichever call actually mints a card is the one responsible for emailing
 * it, and for a genuinely stuck order that call is this sweep, not
 * `payment-event-handler` (which already tried and is why the order is stuck
 * in the first place). Gated on `issued.length > 0`, same as every other
 * caller of `issueGiftCardsForOrder` — a shortfall of zero means nothing new
 * was minted, so nothing new gets emailed.
 *
 * Bounded to a single indexed-enough query rather than a scan of every paid
 * order: `status: in PAID_LIKE_ORDER_STATUSES` plus `lineItems.isGiftCard: true` (a join against
 * the order's array-field table, proven against the real database to match
 * only orders that actually sell a gift card) plus the `paidAt` cutoff.
 * `issueGiftCardsForOrder` is the SAME idempotent primitive
 * `payment-event-handler` already relies on — it counts what should exist
 * against what already does and mints only the shortfall — so a call here
 * costs one `count` query and no writes for every order that already has
 * every card it owes, and only does real work for a genuinely stuck one.
 */
export async function sweepStuckGiftCardIssuance(
  payload: Payload,
): Promise<{ scanned: number; minted: number }> {
  const cutoff = new Date(Date.now() - STUCK_GIFT_CARD_ISSUANCE_HOURS * 60 * 60 * 1000).toISOString()

  const { docs } = await payload.find({
    collection: 'orders',
    where: {
      and: [
        { status: { in: PAID_LIKE_ORDER_STATUSES as OrderStatus[] } },
        { 'lineItems.isGiftCard': { equals: true } },
        { paidAt: { less_than: cutoff } },
      ],
    },
    // depth 0: scalar fields (lineItems, currency, the giftCardRecipient*
    // trio) come back regardless of depth — only the raw tenant id is needed.
    depth: 0,
    limit: 500,
    overrideAccess: true,
  })

  let minted = 0
  for (const order of docs as Array<{
    id: string | number
    tenant?: unknown
    currency: string
    lineItems?: unknown
    giftCardRecipientName?: string | null
    giftCardRecipientEmail?: string | null
    giftCardMessage?: string | null
  }>) {
    const tenantId = storeIdOf(order)
    if (tenantId == null) continue // tenant-scoped by design; nothing safe to do without one
    try {
      const issued = await issueGiftCardsForOrder(payload, {
        id: order.id,
        storeId: tenantId,
        currency: order.currency,
        lineItems: order.lineItems as unknown as OrderLineItem[],
        giftCardRecipientName: order.giftCardRecipientName,
        giftCardRecipientEmail: order.giftCardRecipientEmail,
        giftCardMessage: order.giftCardMessage,
      })
      if (issued.length > 0) {
        await sendGiftCardEmailForOrder(payload, {
          tenantId,
          orderId: order.id,
          currency: order.currency,
          cards: issued,
          recipientEmail: order.giftCardRecipientEmail,
          recipientName: order.giftCardRecipientName,
          message: order.giftCardMessage,
        })
      }
      minted += issued.length
    } catch (err) {
      // One broken order must never abort the pass for the rest: a single
      // order whose mint throws (bad line-item data, a failed email send)
      // would otherwise take every order behind it in the batch down with
      // it, every night, until someone noticed. The reservation sweep above
      // isolates each order for the same reason. Never log a code; the order
      // id is enough to look the row up.
      console.error('[sweepStuckGiftCardIssuance] mint failed for order', order.id, err)
    }
  }

  return { scanned: docs.length, minted }
}
