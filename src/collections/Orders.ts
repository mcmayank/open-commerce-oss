import type { CollectionConfig } from 'payload'
import type { CollectionBeforeChangeHook, Field } from 'payload'
import { decideRefund, type OrderStatus } from '@/lib/refunds'
import { getStorePaymentConfig } from '@/payments/core/config-loader'
import { getProvider } from '@/payments/core/provider-registry'
import { releaseGiftCardReservation, PAID_LIKE_ORDER_STATUSES } from '@/lib/gift-cards/redeem'
import { isSuperAdmin, getUserTenantIDs, type TenantsArrayUser } from '@/access/roles'
import { issueInvoice } from '@/lib/invoicing/issue'
import { NAV_GROUPS } from './nav-groups'
import { storeWhere, storeIdOf } from '@/store-scope'

/** Number field in integer minor units (e.g. paise/cents). */
const amountField = (name: string, required = true): Field => ({
  name,
  type: 'number',
  required,
  min: 0,
  admin: { readOnly: true, description: 'Amount in minor units (e.g. paise/cents). 1000 = ₹10.00' },
  validate: (value: number | null | undefined) =>
    value == null || Number.isInteger(value)
      ? true
      : 'Amount must be a whole number of minor units.',
})

/** Integer-only number field for counts and per-unit amounts. */
const intField = (name: string, options: { required?: boolean; min?: number } = {}): Field => ({
  name,
  type: 'number',
  required: options.required ?? true,
  ...(options.min !== undefined ? { min: options.min } : {}),
  validate: (value: unknown) =>
    value == null || Number.isInteger(value) ? true : `${name} must be a whole number.`,
})

/**
 * Stamp `paidAt` when an order becomes paid and nothing has stamped it yet.
 *
 * Two production paths set `paidAt` themselves: the webhook handler
 * (`payment-event-handler.ts`) and the fully-gift-card-covered checkout path.
 * The third way an order becomes paid had NO stamp at all — a merchant on the
 * `offline` rail (cash on delivery, bank transfer) flipping `status` to Paid in
 * the order dashboard, which is the ONLY way those orders are ever paid, since
 * no webhook exists for them. `paidAt` is admin-`readOnly`, so the merchant
 * cannot supply it by hand either.
 *
 * Fires on any resulting status in `PAID_LIKE_ORDER_STATUSES` (`paid`,
 * `shipped`, `delivered` — defined once in `src/lib/gift-cards/redeem.ts` and
 * read from there), not just `paid` itself: the order dashboard's status
 * select (`src/components/admin/FulfillmentCard.tsx`) lets a merchant jump an
 * order straight from `pending` to `shipped` or `delivered`, which is exactly
 * what happens to a gift card that is "delivered" by email the instant it's
 * paid for. Stopping at `paid` alone left those orders with no `paidAt` at
 * all.
 *
 * That gap is load-bearing well beyond gift cards: `summarizeOrders`
 * (`src/lib/orders-math.ts`) counts revenue on `paidAt`, `decideRefund` refuses
 * to refund an order without it, and `sweepStuckGiftCardIssuance` cannot even
 * SEE an order without it — so a shopper who pays cash for a gift card gets
 * nothing and no repair pass can find them.
 *
 * Never overwrites an existing value: a real payment timestamp always beats
 * "when someone happened to save the row". Deliberately fires on any update
 * that leaves the order in a paid-like state rather than only on the
 * pending→paid edge, so an order marked paid BEFORE this hook existed (or
 * widened) repairs itself the next time it is saved; with no stamp on file,
 * "now" is the only timestamp available and it beats the order being
 * invisible to revenue and refunds forever.
 */
export const stampPaidAt: CollectionBeforeChangeHook = ({ data, operation, originalDoc }) => {
  if (operation !== 'update') return data
  const nextStatus = (data?.status ?? originalDoc?.status) as OrderStatus | undefined
  if (!nextStatus || !PAID_LIKE_ORDER_STATUSES.includes(nextStatus)) return data
  if (data?.paidAt || originalDoc?.paidAt) return data
  return { ...data, paidAt: new Date().toISOString() }
}

/**
 * Orders collection — tenant-scoped.
 *
 * All monetary amounts (subtotal, discountAmount, shippingAmount, taxAmount,
 * total, unitPrice, lineTotal) are stored as INTEGER minor units (paise/cents).
 * Fractional values are rejected by the validate hook.
 *
 * Order creation happens server-side (checkout API) using overrideAccess.
 * Merchants advance fulfilment by updating `status` in the admin panel.
 */
export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    group: NAV_GROUPS.orders,
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'status', 'total', 'email'],
    components: {
      views: {
        edit: {
          default: {
            Component: '@/components/admin/order-view/OrderDashboard',
          },
        },
      },
    },
  },
  hooks: {
    beforeChange: [stampPaidAt],
  },
  indexes: [
    // Per-store; hosted prefixes `tenant` (TENANT_INDEXES in src/hosted/config.ts).
    { fields: ['orderNumber'], unique: true },
    { fields: ['providerEventId'], unique: true }, // DB-level idempotency backstop
  ],
  fields: [
    {
      name: 'orderNumber',
      type: 'text',
      admin: { readOnly: true, description: 'Human-readable order reference (e.g. ORD-00123).' },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      admin: {
        readOnly: true,
        description: 'Linked customer record. Optional — guest checkout is supported.',
      },
    },
    {
      name: 'email',
      type: 'text',
      required: true,
      admin: { readOnly: true, description: "Buyer's email at time of order (snapshot)." },
    },
    {
      name: 'lineItems',
      type: 'array',
      required: true,
      admin: { readOnly: true, description: 'Product snapshot at time of purchase.' },
      fields: [
        { name: 'productId', type: 'text', required: true },
        { name: 'title', type: 'text', required: true },
        { name: 'variantTitle', type: 'text' },
        intField('unitPrice', { min: 0 }),
        intField('qty', { min: 1 }),
        intField('lineTotal', { min: 0 }),
        // Set from `product.issuesGiftCard` at order-build time (Task 3). This
        // field was missing from the schema until now, so it was silently
        // dropped on write — `taxableBaseOf` and `planGiftCardIssues` both read
        // it back from a persisted order and got nothing without this column.
        { name: 'isGiftCard', type: 'checkbox', defaultValue: false, admin: { readOnly: true } },
      ],
    },
    amountField('subtotal'),
    amountField('discountAmount'),
    amountField('shippingAmount'),
    amountField('taxAmount'),
    // Tax is SNAPSHOTTED onto the order, never read live from store settings.
    // A merchant who changes their rate — or deregisters — must not silently
    // restate invoices they have already issued. The invoice reads the order.
    {
      name: 'taxRate',
      type: 'number',
      admin: {
        readOnly: true,
        description: 'The VAT rate (%) in force when this order was placed.',
      },
    },
    {
      name: 'taxInclusive',
      type: 'checkbox',
      admin: {
        readOnly: true,
        description:
          'Whether the line prices already contained the tax. Decides whether the invoice shows the VAT as extracted from the total or added to it.',
      },
    },
    {
      name: 'supplierTrn',
      type: 'text',
      admin: {
        readOnly: true,
        description:
          'The store’s tax registration number at the time of the order. Its presence is what makes this a tax invoice rather than a plain one.',
      },
    },
    amountField('total'),
    // Gift card applied as TENDER, not a discount: `total` above is the full
    // invoice amount and does not move. This is what was NOT charged to the
    // gateway. See docs/superpowers/specs/2026-08-10-gift-cards-design.md.
    amountField('giftCardAmount', false),
    {
      name: 'giftCardUsed',
      type: 'relationship',
      relationTo: 'gift-cards',
      admin: { readOnly: true, description: 'One card per order in this version.' },
    },
    { name: 'giftCardRecipientName', type: 'text', admin: { readOnly: true } },
    { name: 'giftCardRecipientEmail', type: 'email', admin: { readOnly: true } },
    { name: 'giftCardMessage', type: 'textarea', admin: { readOnly: true } },
    {
      name: 'refundedAmount',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        readOnly: true,
        description:
          'Total refunded against this order, in minor units. Netted off revenue while the order still stands; a FULL refund moves the status to Refunded, which removes it from revenue entirely.',
      },
    },
    {
      name: 'discountCode',
      type: 'text',
      admin: { readOnly: true, description: 'Discount code applied to this order (if any).' },
    },
    {
      name: 'currency',
      type: 'text',
      required: true,
      admin: { readOnly: true, description: '3-letter ISO 4217 currency code, e.g. INR, USD.' },
    },
    {
      name: 'shippingAddress',
      type: 'group',
      admin: { readOnly: true },
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'line1', type: 'text', required: true },
        { name: 'line2', type: 'text' },
        { name: 'city', type: 'text', required: true },
        { name: 'state', type: 'text' },
        { name: 'postalCode', type: 'text', required: true },
        { name: 'country', type: 'text', required: true },
        { name: 'phone', type: 'text' },
      ],
    },
    {
      name: 'fulfillment',
      type: 'group',
      admin: {
        readOnly: true,
        description: 'Pickup/delivery selection captured at checkout (snapshot).',
      },
      fields: [
        {
          name: 'method',
          type: 'select',
          options: [
            { label: 'Shipping', value: 'shipping' },
            { label: 'Pickup', value: 'pickup' },
            { label: 'Local delivery', value: 'delivery' },
          ],
        },
        { name: 'date', type: 'date', admin: { description: 'Scheduled collection/delivery day.' } },
        { name: 'windowLabel', type: 'text', admin: { description: 'e.g. "07:00–09:00".' } },
        { name: 'zoneName', type: 'text', admin: { description: 'Delivery zone (delivery only).' } },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Shipped', value: 'shipped' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Refunded', value: 'refunded' },
      ],
    },
    {
      name: 'paymentProvider',
      type: 'text',
      admin: { readOnly: true, description: 'e.g. razorpay, stripe.' },
    },
    {
      name: 'providerRef',
      type: 'text',
      admin: { readOnly: true, description: "Provider's payment or order ID." },
    },
    {
      name: 'providerEventId',
      type: 'text',
      admin: {
        readOnly: true,
        description:
          'Webhook event ID for idempotency — store on receipt to avoid double-processing.',
      },
    },
    {
      name: 'paidAt',
      type: 'date',
      admin: { readOnly: true, description: 'Timestamp when payment was confirmed (UTC).' },
    },
    {
      name: 'authorizedAt',
      type: 'date',
      admin: {
        readOnly: true,
        description:
          'Set when a payment was AUTHORIZED but not yet captured (e.g. manual-capture). ' +
          'The order is NOT paid or fulfilled in this state — needs merchant/provider capture.',
      },
    },
    {
      name: 'paymentAttempt',
      type: 'relationship',
      relationTo: 'payment-attempts',
      admin: { readOnly: true, description: 'The payment attempt that (last) drove this order.' },
    },
    {
      name: 'trackingNumber',
      type: 'text',
      admin: { description: 'Carrier tracking number — visible to the customer.' },
    },
    {
      name: 'invoiceNumber',
      type: 'text',
      admin: { readOnly: true, position: 'sidebar', description: 'Assigned when the invoice is issued.' },
    },
    {
      name: 'invoiceIssuedAt',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'invoiceSentAt',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'invoicePdf',
      type: 'upload',
      relationTo: 'invoices',
      admin: { readOnly: true, position: 'sidebar', description: 'Generated invoice PDF.' },
    },
    // issueInvoiceAction ui field removed — InvoiceCard (Task 4) will own this action
  ],
  endpoints: [
    {
      path: '/:id/invoice',
      method: 'post',
      handler: async (req) => {
        const user = req.user as TenantsArrayUser | null
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const id = req.routeParams?.id as string | undefined
        if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
        const order = await req.payload.findByID({ collection: 'orders', id, overrideAccess: true }).catch(() => null)
        if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })
        const tenantId = storeIdOf(order)
        if (tenantId === undefined) return Response.json({ error: 'Not found' }, { status: 404 })
        const allowed = isSuperAdmin(user) || getUserTenantIDs(user).some((t) => String(t) === String(tenantId))
        if (!allowed) return Response.json({ error: 'Not found' }, { status: 404 })
        try {
          const updated = await issueInvoice(req.payload, order, { force: true })
          return Response.json({ invoiceNumber: updated.invoiceNumber })
        } catch (e) {
          req.payload.logger.error({ err: e }, 'invoice issue failed')
          return Response.json({ error: 'Failed to generate invoice' }, { status: 500 })
        }
      },
    },
    {
      // Refund an order through its own gateway. Every reason to refuse is
      // decided by `decideRefund` (pure, tested) BEFORE the gateway is called,
      // and the order is only written after the money has actually moved — a
      // failed refund must never leave the order claiming it was refunded.
      path: '/:id/refund',
      method: 'post',
      handler: async (req) => {
        const user = req.user as TenantsArrayUser | null
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const id = req.routeParams?.id as string | undefined
        if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

        const order = await req.payload
          .findByID({ collection: 'orders', id, overrideAccess: true })
          .catch(() => null)
        if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })

        const tenantId = storeIdOf(order)
        if (tenantId === undefined) return Response.json({ error: 'Not found' }, { status: 404 })
        const allowed =
          isSuperAdmin(user) || getUserTenantIDs(user).some((t) => String(t) === String(tenantId))
        if (!allowed) return Response.json({ error: 'Not found' }, { status: 404 })

        const body = (await req.json?.()) as { amountMinor?: unknown } | undefined
        const requested = Number(body?.amountMinor)

        // Capability comes from the registry, credentials from the store's row.
        // Keeping them apart means "this gateway can't refund" and "this store
        // has no keys saved" are different messages instead of one wrong one.
        const slug = String(order.paymentProvider ?? '')
        const provider = slug ? getProvider(slug) : null
        const decision = decideRefund(
          {
            totalMinor: order.total ?? 0,
            refundedMinor: order.refundedAmount ?? 0,
            status: (order.status ?? 'pending') as OrderStatus,
            paidAt: order.paidAt ?? null,
            authorizedAt: order.authorizedAt ?? null,
            providerSupportsRefund: typeof provider?.refund === 'function',
            giftCardMinor: order.giftCardAmount ?? 0,
          },
          requested,
        )
        if (!decision.ok) return Response.json({ error: decision.error }, { status: 400 })

        // Gateway money moves first, and only if this refund actually needs
        // any — an order fully covered by a gift card never touched a
        // gateway (checkout clears `paymentProvider` to null for that case),
        // and a partial refund whose gateway portion is already exhausted
        // needs nothing further from it either. A zero-amount gateway call is
        // the same class of error as a zero-amount charge, so it is skipped
        // outright rather than sent as a no-op.
        if (decision.gatewayMinor > 0) {
          // Deliberately NOT filtered on `enabled`: a merchant who switched a
          // gateway off for new checkouts still has to refund the orders it took.
          const config = await getStorePaymentConfig(tenantId as string | number, slug, req.payload)
          if (!config) {
            return Response.json(
              { error: `No saved ${slug} credentials for this store, so the refund cannot be sent.` },
              { status: 400 },
            )
          }

          if (!order.providerRef) {
            return Response.json(
              { error: 'This order has no gateway payment reference to refund against.' },
              { status: 400 },
            )
          }

          try {
            await provider!.refund!(String(order.providerRef), decision.gatewayMinor, config.credentials)
          } catch (e) {
            req.payload.logger.error({ err: e, orderId: id }, 'gateway refund failed')
            return Response.json(
              { error: 'The gateway rejected the refund. Nothing was changed on this order.' },
              { status: 502 },
            )
          }
        }

        // Voucher money back onto the card, second. Deliberately NOT
        // `reverseGiftCardForOrder` — that zeroes `order.giftCardAmount`,
        // which is correct for an abandoned checkout that never completed but
        // wrong here: `giftCardAmount` is the TENDER SPLIT (how this order
        // was paid), and `decideRefund` reads it on every subsequent partial
        // refund to work out how much gateway portion remains. Clearing it
        // after this refund would make the next partial refund compute its
        // split against a gift-card portion of 0 and send too much through
        // the gateway. `releaseGiftCardReservation` does the atomic balance
        // increment and writes the `reverse` ledger row without touching
        // `giftCardAmount`.
        if (decision.giftCardMinor > 0) {
          const cardId =
            typeof order.giftCardUsed === 'object' && order.giftCardUsed
              ? (order.giftCardUsed as { id: string | number }).id
              : order.giftCardUsed
          if (cardId == null) {
            req.payload.logger.error(
              { orderId: id },
              'refund needs to credit a gift card but the order has no giftCardUsed on file',
            )
            return Response.json(
              {
                error:
                  'Part of this refund is gift-card money, but no card is on file for this order. Contact support before retrying.',
              },
              { status: 500 },
            )
          }
          try {
            await releaseGiftCardReservation(req.payload, {
              tenantId: tenantId as string | number,
              cardId,
              orderId: id,
              amountMinor: decision.giftCardMinor,
            })
          } catch (e) {
            req.payload.logger.error({ err: e, orderId: id }, 'gift card credit failed during refund')
            return Response.json(
              {
                error:
                  'The gateway portion was refunded, but crediting the gift card failed. Contact support before retrying.',
              },
              { status: 500 },
            )
          }
        }

        const updated = await req.payload.update({
          collection: 'orders',
          id,
          overrideAccess: true,
          data: { refundedAmount: decision.newRefundedTotal, status: decision.newStatus },
        })

        // Cards this order MINTED (`issuedFromOrder`), which is the opposite
        // direction from `giftCardUsed` handled above: money the buyer paid
        // out has just gone back to them, while the card that money bought is
        // still live and still spendable by whoever holds the code.
        //
        // Voiding it is deliberately NOT automatic. By the time a refund is
        // issued the recipient may have spent part or all of the balance, may
        // be a different person from the buyer, and may have received the card
        // as a gift — so "refunded, therefore void" is a product decision with
        // a real chance of taking value from an innocent third party, not a
        // mechanical consequence of the refund. What is NOT acceptable is the
        // merchant not knowing, so the response names the cards and says
        // plainly that they are untouched. Best-effort: a lookup failure must
        // never turn a completed refund into an error response.
        let giftCardNotice: string | null = null
        let issuedCards: { id: string | number; last4: string; status: string; balance: number }[] = []
        try {
          const { docs: minted } = await req.payload.find({
            collection: 'gift-cards',
            where: { and: [storeWhere(tenantId), { issuedFromOrder: { equals: id } }] },
            depth: 0,
            limit: 100,
            overrideAccess: true,
          })
          issuedCards = (minted as unknown as { id: string | number; last4: string; status: string; balance: number }[])
            .filter((c) => c.status !== 'void')
            .map((c) => ({ id: c.id, last4: c.last4, status: c.status, balance: Number(c.balance) }))
          if (issuedCards.length > 0) {
            const named = issuedCards.map((c) => `••${c.last4}`).join(', ')
            giftCardNotice = `This order issued ${issuedCards.length} gift card${issuedCards.length === 1 ? '' : 's'} (${named}). Refunding does NOT void ${issuedCards.length === 1 ? 'it' : 'them'} — ${issuedCards.length === 1 ? 'it is' : 'they are'} still spendable. Void ${issuedCards.length === 1 ? 'it' : 'them'} from Gift Cards if that is what you intended.`
            req.payload.logger.warn(
              { orderId: id, cards: issuedCards.map((c) => c.last4) },
              'refunded an order that issued gift cards — the cards were NOT voided',
            )
          }
        } catch (e) {
          req.payload.logger.error({ err: e, orderId: id }, 'could not check for gift cards issued from a refunded order')
        }

        return Response.json({
          refundedAmount: updated.refundedAmount,
          status: updated.status,
          fullyRefunded: decision.fullyRefunded,
          ...(giftCardNotice ? { giftCardNotice, issuedGiftCards: issuedCards } : {}),
        })
      },
    },
  ],
}
