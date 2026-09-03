'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { getStoreSettings } from '@/lib/storefront'
import { resolveStoreFromHost } from '@/lib/tenant-host-server'
import { randomUUID } from 'crypto'
import { parseCart } from '@/lib/cart'
import { buildOrderFromCart } from '@/lib/orders'
import { buildOrderCreateData } from '@/lib/orders-math'
import { toOrderDate, validateFulfilmentSelection, type FulfillmentSnapshot } from '@/lib/fulfillment'
import { listEnabledProviders } from '@/payments/core/config-loader'
import { startPaymentAttempt } from '@/payments/core/payment-service'
import { upsertContact } from '@/lib/marketing/contacts'
import { getCurrentCustomer } from '@/lib/auth/session'
import { findGiftCardByCode, reserveGiftCard, releaseReservationAndClearOrder } from '@/lib/gift-cards/redeem'
import { decideRedemption } from '@/lib/gift-cards/decide'
import { issueGiftCardsForOrder } from '@/lib/gift-cards/issue'
import { sendGiftCardEmailForOrder } from '@/lib/gift-cards/email'
import { runPaidSideEffects } from '@/payments/reconciliation/side-effects'
import { rateLimit } from '@/lib/rate-limit'
import type { OrderLineItem } from '@/lib/orders-math'
import type { Order } from '@/payload-types'
import { requestOrigin } from '@/lib/export/origin'
import { storeWhere, storeRef } from '@/store-scope'

// Every shopper-facing gift-card rejection renders this exact string, whether
// the code doesn't exist, belongs to another tenant, is voided, has a zero
// balance, or was just rate-limited. A distinguishable message would turn this
// form into an oracle for enumerating live codes — which are bearer money.
const GIFT_CARD_INVALID = 'That gift card code is not valid.'

export type CheckoutState = {
  error?: string
  fieldErrors?: Partial<Record<string, string>>
  /** Set when the provider requires a signed HTML form POST off-site. */
  formRedirect?: { kind: 'form'; action: string; method: 'POST'; fields: Record<string, string> }
} | null

/** Build the protocol + host origin for absolute URLs.
 *
 * The protocol comes from `x-forwarded-proto` (Vercel always sets it), NOT from
 * NODE_ENV. Deriving it from NODE_ENV meant any production BUILD served over
 * plain http — which is how the e2e suite runs — redirected the shopper to
 * `https://<host>` after placing an order and hit ERR_SSL_PROTOCOL_ERROR. */
async function getOrigin(): Promise<string> {
  const headerStore = await headers()
  const host = headerStore.get('host') ?? 'localhost:3000'
  return requestOrigin(headerStore, host)
}

/** First hop in x-forwarded-for is the client; the rest are proxies. */
async function clientIp(): Promise<string> {
  const headerStore = await headers()
  const forwarded = headerStore.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || headerStore.get('x-real-ip') || 'unknown'
}

/**
 * Best-effort release of an in-flight gift-card reservation.
 *
 * Called from every catch block downstream of a successful `reserveGiftCard`
 * — writing `giftCardAmount` onto the order, and asking the gateway for a
 * session — because a throw in either one currently leaves the money gone
 * from the card with no order to show for it. Worse, the caller sees a
 * generic "please try again" and resubmits the same form, which reruns this
 * whole action, resolves the same code, and reserves a SECOND time against a
 * card that never got its first reservation back. A gateway outage plus a
 * couple of retries is enough to drain a card to zero with no successful
 * order anywhere.
 *
 * A release failure here must never crash the response the shopper already
 * failed to get — but silently swallowing it would strand real money with no
 * trace, so it is logged loudly instead.
 *
 * Releasing is only half the job, hence `releaseReservationAndClearOrder`
 * rather than a bare `releaseGiftCardReservation`: the order also has to stop
 * ADVERTISING a reservation it no longer holds. It stays `pending` with a
 * `giftCardAmount` on it, which is the exact shape
 * `sweepAbandonedGiftCardReservations` hunts for 24 hours later — it would
 * credit the already-restored card a second time and invent money. See that
 * function's own comment in `src/lib/gift-cards/redeem.ts`.
 */
async function releaseReservationOnFailure(
  payload: Payload,
  storeId: number | string,
  orderId: number | string,
  reservation: { cardId: number; amountMinor: number },
): Promise<void> {
  try {
    await releaseReservationAndClearOrder(payload, {
      tenantId: storeId,
      cardId: reservation.cardId,
      orderId,
      amountMinor: reservation.amountMinor,
    })
  } catch (releaseErr) {
    console.error('[startCheckout] gift card release failed — balance may be stuck reserved', {
      store: storeId,
      order: orderId,
      cardId: reservation.cardId,
      amountMinor: reservation.amountMinor,
      err: releaseErr,
    })
  }
}

/**
 * Server action: validates checkout form, creates an order, obtains a
 * payment-gateway redirect URL, and redirects the buyer to the hosted
 * checkout page.
 *
 * Security invariants:
 *  - Tenant is resolved from the request Host header, not form input.
 *  - All prices are re-derived from the database (never from cart cookie).
 *  - Gateway is confirmed BEFORE the order is created to avoid orphan records.
 */
export async function startCheckout(
  _prevState: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  // ── 1. Resolve tenant from host ──────────────────────────────────────────
  const store = await resolveStoreFromHost()
  if (!store) return { error: 'Store not found.' }

  const settings = await getStoreSettings(store.id)
  const currency = settings?.currency ?? 'AED'

  // ── 2. Resolve enabled payment providers BEFORE creating any order ───────
  // Selection order: a valid form-chosen provider → first hosted → first enabled
  // (which may be the offline method). We never force a specific gateway.
  const enabledProviders = await listEnabledProviders(store.id)
  if (enabledProviders.length === 0) {
    return { error: "This store isn't accepting payments yet." }
  }
  const requestedProvider = String(formData.get('paymentProvider') ?? '').trim()
  const chosen =
    enabledProviders.find((p) => p.slug === requestedProvider) ??
    enabledProviders.find((p) => p.provider.kind === 'hosted') ??
    enabledProviders[0]

  // ── 3. Read and validate form fields ─────────────────────────────────────
  const email = String(formData.get('email') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const emailOptIn = formData.get('emailOptIn') === 'on'
  const line1 = String(formData.get('line1') ?? '').trim()
  const line2 = String(formData.get('line2') ?? '').trim() || undefined
  const city = String(formData.get('city') ?? '').trim()
  const state = String(formData.get('state') ?? '').trim() || undefined
  const postalCode = String(formData.get('postalCode') ?? '').trim()
  const country = String(formData.get('country') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim() || undefined
  const discountCode = String(formData.get('discountCode') ?? '').trim() || undefined
  const giftCardCode = String(formData.get('giftCardCode') ?? '').trim() || undefined
  // Recipient details for any gift card THIS order buys — one set per order,
  // not per card (see docs/superpowers/specs/2026-08-10-gift-cards-design.md).
  // Captured here, at checkout, rather than on the product page: the schema
  // and design spec put these fields on the order, and quantity N mints N
  // cards that all carry this single set of details.
  const giftCardRecipientName = String(formData.get('giftCardRecipientName') ?? '').trim() || undefined
  const giftCardRecipientEmail = String(formData.get('giftCardRecipientEmail') ?? '').trim() || undefined
  const giftCardMessage = String(formData.get('giftCardMessage') ?? '').trim() || undefined

  const fieldErrors: Record<string, string> = {}

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = 'A valid email address is required.'
  }
  if (!name) fieldErrors.name = 'Full name is required.'

  // ── 3b. Fulfilment (pickup/delivery scheduling) when the store enables it ──
  const fulfilmentConfig = settings?.fulfillment
  const fulfilmentEnabled = fulfilmentConfig?.enabled === true
  let fulfilmentSnapshot: FulfillmentSnapshot | null = null

  if (fulfilmentEnabled) {
    const result = validateFulfilmentSelection(
      {
        method: String(formData.get('fulfillmentMethod') ?? ''),
        dateISO: String(formData.get('fulfillmentDate') ?? ''),
        windowLabel: String(formData.get('fulfillmentWindow') ?? ''),
        zoneName: String(formData.get('deliveryZone') ?? ''),
      },
      fulfilmentConfig!,
      new Date(),
    )
    if (!result.ok) {
      Object.assign(fieldErrors, result.fieldErrors)
    } else {
      fulfilmentSnapshot = result.snapshot
    }
  }

  const isPickup = fulfilmentSnapshot?.method === 'pickup'

  // Address is required unless the buyer collects in person. For pickup the
  // phone becomes the required contact channel.
  if (!isPickup) {
    if (!line1) fieldErrors.line1 = 'Address line 1 is required.'
    if (!city) fieldErrors.city = 'City is required.'
    if (!postalCode) fieldErrors.postalCode = 'Postal code is required.'
    if (!country) fieldErrors.country = 'Country is required.'
  } else if (!phone) {
    fieldErrors.phone = 'A phone number is required for pickup orders.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors }
  }

  // Pickup orders have no buyer address — snapshot the store's pickup point
  // so the admin order view still shows where the order goes.
  const shippingAddress = isPickup
    ? {
        name,
        line1: `Click & collect — ${fulfilmentConfig?.pickup?.locationLabel || 'in store'}`,
        city: '-',
        postalCode: '-',
        country: String(formData.get('country') ?? '').trim() || '-',
        phone,
      }
    : { name, line1, line2, city, state, postalCode, country, phone }

  // ── 4. Read cart cookie ───────────────────────────────────────────────────
  const cookieStore = await cookies()
  const raw = cookieStore.get('cart')?.value
  const cart = parseCart(raw)

  if (cart.length === 0) {
    return { error: 'Your cart is empty.' }
  }

  // ── 5. Build order data (re-derives prices, validates discount) ───────────
  const buildResult = await buildOrderFromCart(store.id, cart, {
    email,
    shippingAddress,
    discountCode,
    currency,
    shippingAmount: fulfilmentSnapshot?.fee ?? 0,
    // Read at checkout and snapshotted onto the order by buildOrderFromCart.
    tax: settings?.tax
      ? {
          enabled: settings.tax.enabled === true,
          rate: typeof settings.tax.rate === 'number' ? settings.tax.rate : 0,
          pricesIncludeTax: settings.tax.pricesIncludeTax !== false,
          registrationNumber: settings.tax.registrationNumber ?? null,
        }
      : null,
  })

  if (!buildResult.ok) {
    // Discount invalid or cart became empty after active-product filtering
    if (buildResult.error.toLowerCase().includes('discount')) {
      return { fieldErrors: { discountCode: buildResult.error } }
    }
    return { error: buildResult.error }
  }

  const orderData = buildResult.data

  // ── 5b. Gift-card recipient email is required whenever the cart (as
  // rebuilt server-side, never the client-trusted cookie) actually contains a
  // gift-card line. Checked here — after pricing rebuild, before any
  // customer/order record is created — so a missing recipient never leaves an
  // orphan order behind. Without this, `sendGiftCardEmailForOrder` finds no
  // recipient and the mint is discarded with nobody ever receiving the code.
  const hasGiftCardLine = orderData.lineItems.some((line) => line.isGiftCard)
  if (
    hasGiftCardLine &&
    (!giftCardRecipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(giftCardRecipientEmail))
  ) {
    return {
      fieldErrors: { giftCardRecipientEmail: 'A recipient email is required for gift card orders.' },
    }
  }

  // ── 6. Upsert customer by (tenant, email) ─────────────────────────────────
  const payload = await getPayload({ config })

  const { docs: existing } = await payload.find({
    collection: 'customers',
    where: {
      and: [storeWhere(store.id), { email: { equals: email } }],
    },
    limit: 1,
    overrideAccess: true,
  })

  let customerId: number
  if (existing[0]) {
    customerId = existing[0].id
    // Update name if it wasn't set before
    if (!existing[0].name && name) {
      await payload.update({
        collection: 'customers',
        id: customerId,
        data: { name },
        overrideAccess: true,
      })
    }
  } else {
    const newCustomer = await payload.create({
      collection: 'customers',
      data: { ...storeRef(store.id), email, name },
      overrideAccess: true,
    })
    customerId = newCustomer.id
  }

  // ── 6b. Resolve session customer for authoritative customer link ─────────
  // Security: customer ID comes from the verified session, never from form input.
  const sessionCustomer = await getCurrentCustomer()
  const effectiveCustomerId = sessionCustomer ? sessionCustomer.id : customerId

  // ── 7. Create the order (status: pending) ────────────────────────────────
  const createdOrder = await payload.create({
    collection: 'orders',
    // Everything buildOrderFromCart computed, forwarded wholesale. This used to
    // be a hand-written field list that silently dropped the tax snapshot —
    // see `buildOrderCreateData`. Add caller-only fields to `extras`, never by
    // restating what OrderData already carries.
    data: buildOrderCreateData(orderData, {
      ...storeRef(store.id),
      customer: effectiveCustomerId,
      // Gated on the same server-derived `hasGiftCardLine` the validation
      // above used, not on the form fields being merely present — a crafted
      // request on a non-gift-card cart has no legitimate reason to stash a
      // recipient email on the order (it's never read: `planGiftCardIssues`
      // filters on `line.isGiftCard`), and there's no reason to accept PII
      // the order can't use.
      ...(hasGiftCardLine && giftCardRecipientName ? { giftCardRecipientName } : {}),
      ...(hasGiftCardLine && giftCardRecipientEmail ? { giftCardRecipientEmail } : {}),
      ...(hasGiftCardLine && giftCardMessage ? { giftCardMessage } : {}),
      ...(fulfilmentSnapshot
        ? {
            fulfillment: {
              method: fulfilmentSnapshot.method,
              date: toOrderDate(fulfilmentSnapshot.dateISO),
              windowLabel: fulfilmentSnapshot.windowLabel,
              zoneName: fulfilmentSnapshot.zoneName,
            },
          }
        : {}),
      status: 'pending',
      paymentProvider: chosen.slug,
    }),
    overrideAccess: true,
  })

  // ── 7b. Best-effort: newsletter opt-in (never fail the order on contact error) ──
  if (emailOptIn) {
    try {
      await upsertContact(store.id, { email, name: name || undefined, source: 'checkout' })
    } catch (err) {
      console.error('[startCheckout] contact upsert failed (non-fatal):', err)
    }
  }

  // ── 7c. Gift card applied as TENDER: `order.total` stays the full invoice
  // amount — the tax invoice reports it unchanged. Only the amount handed to
  // the gateway is reduced. Reservation happens now, before any gateway call,
  // so a second checkout cannot spend the same balance after we have already
  // asked the provider for a reduced amount (Task 7 releases it on failure).
  let amountToCharge = createdOrder.total
  // Set the moment `reserveGiftCard` succeeds — real money has left the card
  // from here on, so every failure branch below must release it via
  // `releaseReservationOnFailure` before returning an error to the shopper.
  let giftCardReservation: { cardId: number; amountMinor: number } | null = null

  if (giftCardCode) {
    const ip = await clientIp()
    // Keyed per store + caller: an unthrottled code lookup is a guessing
    // oracle pointed directly at bearer money.
    const limited = rateLimit(`giftcard:${store.id}:${ip}`, { limit: 10, windowMs: 60_000 })

    const card = limited.ok ? await findGiftCardByCode(payload, store.id, giftCardCode) : null
    const decision = card
      ? decideRedemption(
          { balance: card.balance, currency: card.currency, status: card.status },
          createdOrder.total,
          createdOrder.currency,
        )
      : { ok: false as const, error: GIFT_CARD_INVALID }

    // Every rejection above renders the SAME string. The merchant sees the
    // real reason on the card's ledger; the shopper never learns whether the
    // code was wrong, voided, someone else's tenant, or just rate-limited.
    if (!decision.ok) return { error: GIFT_CARD_INVALID }

    const cardId = Number(card!.id)
    const reserved = await reserveGiftCard(payload, {
      tenantId: store.id,
      cardId,
      orderId: createdOrder.id,
      amountMinor: decision.appliedMinor,
    })
    // Lost the race to another checkout on the same card — a different
    // situation from an invalid code, so the shopper gets a distinct, more
    // actionable message here.
    if (!reserved) return { error: 'That gift card no longer covers this order. Try again.' }

    giftCardReservation = { cardId, amountMinor: decision.appliedMinor }

    try {
      await payload.update({
        collection: 'orders',
        id: createdOrder.id,
        data: { giftCardAmount: decision.appliedMinor, giftCardUsed: cardId },
        overrideAccess: true,
      })
    } catch (err) {
      // The reservation already took the money off the card; if this write
      // never lands, the order carries no record of it, so undo the
      // reservation now rather than leave it unrecoverable (Task 7's release
      // reads `order.giftCardAmount` to know what to restore, and it would
      // read 0 here).
      await releaseReservationOnFailure(payload, store.id, createdOrder.id, giftCardReservation)
      console.error('[startCheckout] failed to record gift-card redemption on the order:', err)
      return { error: 'Something went wrong applying your gift card. Please try again.' }
    }

    amountToCharge = createdOrder.total - decision.appliedMinor
  }

  // ── 7d. A card covering the whole order leaves nothing to charge, and no
  // gateway will take a zero-amount payment (payment-service's own guard
  // ACCEPTS amountMinor === 0 — it only rejects negative or over-total — so
  // without this branch `startPaymentAttempt` would sail past that guard and
  // hand the provider adapter a real zero-amount session request, which is
  // where it actually breaks). The money already moved off the card the
  // moment `reserveGiftCard` succeeded above, so this order IS paid — mark it
  // directly and run the same fulfilment sequence a webhook confirmation
  // would trigger, skipping the provider round trip entirely.
  //
  // `paymentProvider` is cleared back to null: `chosen` was picked, and
  // written onto the order, before we knew the card would cover everything,
  // but no provider was ever actually contacted for this order.
  if (amountToCharge === 0) {
    let paidOrder: Order
    try {
      paidOrder = (await payload.update({
        collection: 'orders',
        id: createdOrder.id,
        data: { status: 'paid', paidAt: new Date().toISOString(), paymentProvider: null },
        overrideAccess: true,
      })) as Order
    } catch (err) {
      // The card was already debited by `reserveGiftCard` above; if the order
      // never actually flips to paid, that money must go back rather than
      // vanish with no order to show for it — same reasoning as the
      // giftCardAmount write a few lines up.
      if (giftCardReservation) {
        await releaseReservationOnFailure(payload, store.id, createdOrder.id, giftCardReservation)
      }
      console.error('[startCheckout] failed to mark a fully-covered order paid:', err)
      return { error: 'Something went wrong completing your order. Please try again.' }
    }

    // Mint any gift cards THIS order itself buys (spending card A to fully
    // cover an order that buys card B is a real case — the shopper never
    // hits a gateway, so the webhook-driven mint in `payment-event-handler`
    // never runs for this order; do it here instead). Best-effort: a mint
    // failure must not undo the payment that already happened.
    //
    // Also delivers the codes by email. No webhook EVER fires for this order
    // (see above), so `payment-event-handler`'s send is never reached either
    // — this is the only place a fully-covered order's cards get mailed out.
    // `sendGiftCardEmailForOrder` no-ops on an empty mint and never throws.
    try {
      const issuedCards = await issueGiftCardsForOrder(payload, {
        id: paidOrder.id,
        storeId: store.id,
        currency: paidOrder.currency,
        lineItems: paidOrder.lineItems as unknown as OrderLineItem[],
        giftCardRecipientName: paidOrder.giftCardRecipientName,
        giftCardRecipientEmail: paidOrder.giftCardRecipientEmail,
        giftCardMessage: paidOrder.giftCardMessage,
      })
      if (issuedCards.length > 0) {
        await sendGiftCardEmailForOrder(payload, {
          tenantId: store.id,
          orderId: paidOrder.id,
          currency: paidOrder.currency,
          cards: issuedCards,
          recipientEmail: paidOrder.giftCardRecipientEmail,
          recipientName: paidOrder.giftCardRecipientName,
          message: paidOrder.giftCardMessage,
        })
      }
    } catch (err) {
      console.error('[startCheckout] gift card issuance failed for a fully-covered order:', err)
    }

    // Stock decrement, discount usedCount, confirmation email, invoice —
    // the same best-effort sequence a gateway confirmation triggers via
    // `payment-event-handler`'s `runPaidSideEffects` call. Reused rather than
    // reimplemented so this path can never drift from the webhook path.
    await runPaidSideEffects(payload, store.id, paidOrder)

    const origin = await getOrigin()
    redirect(`${origin}/checkout/success?order=${paidOrder.id}`)
  }

  // ── 8. Create the payment attempt + provider session ──────────────────────
  // Return/cancel URLs are app-generated from the request origin (never accepted
  // from the client), so they are inherently origin-allowlisted.
  const origin = await getOrigin()
  const successUrl = `${origin}/checkout/success?order=${createdOrder.id}`
  const cancelUrl = `${origin}/cart`
  // App-generated webhook URL for this store+provider (some providers, e.g.
  // Mollie, require it per-payment; dashboard-configured providers ignore it).
  const webhookUrl = `${origin}/api/webhooks/${chosen.slug}/${store.slug}`

  let started
  try {
    started = await startPaymentAttempt({
      payload,
      order: createdOrder,
      loaded: chosen,
      returnUrl: successUrl,
      cancelUrl,
      webhookUrl,
      idempotencyKey: randomUUID(),
      amountMinor: amountToCharge,
    })
  } catch (err) {
    // Provider call failed. The order stays pending (ops can inspect/cancel),
    // but a card reservation cannot be left stuck: this is exactly the
    // gateway-outage case where the money already left the card and nothing
    // else in the system will ever notice, because reconciliation only runs
    // for an attempt that made it far enough to get a provider session. The
    // "please try again" below would otherwise debit the SAME card again on
    // every retry.
    if (giftCardReservation) {
      await releaseReservationOnFailure(payload, store.id, createdOrder.id, giftCardReservation)
    }
    console.error('[startCheckout] startPaymentAttempt failed:', err)
    return { error: 'Could not connect to the payment provider. Please try again.' }
  }

  // ── 9. Hand back the redirect ────────────────────────────────────────────
  const redirectResult = started.redirect
  if (redirectResult.kind === 'form') {
    // Signed HTML form POST — the client auto-submits it off-site.
    return { formRedirect: redirectResult }
  }
  // URL redirect (hosted checkout) or `none` (offline → straight to success).
  redirect(redirectResult.kind === 'url' ? redirectResult.url : successUrl)
}
